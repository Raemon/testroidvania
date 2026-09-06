/**
 * Listening to the engine the only way an agent can: render it into an
 * `OfflineAudioContext` and measure the samples.
 *
 * This is not a nicety. Almost every way synthesized audio goes wrong — an
 * envelope that is really a click, a filter that removes the whole sound, a gain
 * that clips, a NaN from a bad `exponentialRampToValueAtTime(0)` — shows up in the
 * numbers below and in nothing else. `npm test` runs a subset of this; the full
 * sweep prints a table.
 */

import { createGraph } from './graph.js';
import { RECIPES, SFX_IDS } from './sfx.js';
import { createSequencer } from './sequencer.js';
import { REGIONS } from './regions/index.js';
import { pad as padVoice, midiToFreq } from './voices.js';
import { chordDegree } from './regions/material.js';

/**
 * Measurements render at 22.05 kHz by default. Every voice ends in a lowpass at or
 * below 8 kHz (05 §6d), so nothing the engine produces lives above the 11 kHz
 * Nyquist — and halving the rate halves the time the test suite spends rendering.
 */
const RATE = 22050;

/** SFX with tails longer than the default render window. */
/** @type {Record<string, number>} */
const RENDER_SECONDS = { abilityPickup: 7, doorOpen: 5, lantern: 5, bossRoar: 5, hurt: 4.5, hazard: 4.5 };
const DEFAULT_SECONDS = 3.5;

/**
 * @typedef {object} Measurement
 * @property {string} id
 * @property {number} peak       maximum |sample|; > 1 is clipping
 * @property {number} rms
 * @property {number} rms100     RMS of the first 100 ms of sound — what a player
 *   hears as "the hit". Whole-buffer RMS mostly measures the length of the tail.
 * @property {number} dc         mean sample value; a non-zero mean is a thump
 * @property {number} nan        count of non-finite samples
 * @property {number} clipped    count of samples above 0 dBFS
 * @property {number} attackMs   time from first sound to *peak*. Only meaningful
 *   for a single-hit recipe: for a multi-hit one (enemyDeath's three ticks,
 *   abilityPickup's rising bells) the peak may be the last event, and a large
 *   number here says nothing about whether the first one clicks.
 * @property {number} durationMs time from first to last audible sample
 * @property {Record<string, number>} bands  energy per band, dB relative to total
 * @property {number} subShare   fraction of the energy below 120 Hz. A sound that
 *   is nearly all sub is a sound most laptops do not play at all.
 * @property {number} centroidHz spectral centre of mass
 */

/**
 * Band edges in Hz. The first two are the ones that matter most here: everything
 * below 120 Hz is inaudible on the speakers most people play browser games on,
 * and everything below 60 Hz is inaudible on nearly all of them while still
 * costing the mix its headroom.
 */
export const BANDS = [[20, 60], [60, 120], [120, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 4000], [4000, 8000]];

/**
 * In-place radix-2 FFT. Written out rather than pulled in because the whole point
 * of this module is that measurement has no dependencies the game does not have.
 * @param {Float64Array} re @param {Float64Array} im
 */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] ?? 0; re[i] = re[j] ?? 0; re[j] = tr;
      const ti = im[i] ?? 0; im[i] = im[j] ?? 0; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j] ?? 0;
        const ai = im[i + j] ?? 0;
        const xr = re[i + j + len / 2] ?? 0;
        const xi = im[i + j + len / 2] ?? 0;
        const br = xr * cr - xi * ci;
        const bi = xr * ci + xi * cr;
        re[i + j] = ar + br; im[i + j] = ai + bi;
        re[i + j + len / 2] = ar - br; im[i + j + len / 2] = ai - bi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * Average power spectrum over the whole buffer (Hann, 8192 window, 50% hop, mono
 * sum), then folded into bands.
 * @param {AudioBuffer} buffer
 * @returns {{bands: Record<string, number>, subShare: number, centroidHz: number}}
 */
export function spectrum(buffer) {
  const N = 8192;
  /** @type {Float32Array[]} */
  const chans = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  const acc = new Float64Array(N / 2);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let frames = 0;
  for (let start = 0; start + N <= buffer.length; start += N / 2) {
    let energy = 0;
    for (let i = 0; i < N; i++) {
      let v = 0;
      for (const ch of chans) v += ch[start + i] ?? 0;
      v /= chans.length;
      re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
      im[i] = 0;
      energy += v * v;
    }
    // Silence contributes no spectrum, and averaging it in would make a short
    // sound in a long buffer look like a quiet one.
    if (energy / N < 1e-9) continue;
    fft(re, im);
    for (let k = 0; k < N / 2; k++) acc[k] = (acc[k] ?? 0) + (re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2;
    frames++;
  }
  const binHz = buffer.sampleRate / N;
  /** @type {Record<string, number>} */
  const bands = {};
  let total = 0;
  let num = 0;
  let below120 = 0;
  for (let k = 1; k < acc.length; k++) {
    const e = acc[k] ?? 0;
    total += e;
    num += k * binHz * e;
    if (k * binHz < 120) below120 += e;
  }
  for (const [lo, hi] of BANDS) {
    let e = 0;
    for (let k = Math.ceil((lo ?? 0) / binHz); k < Math.min(acc.length, (hi ?? 0) / binHz); k++) e += acc[k] ?? 0;
    bands[`${lo}-${hi}`] = total > 0 ? 10 * Math.log10(e / total + 1e-12) : -120;
  }
  return {
    bands,
    subShare: total > 0 ? below120 / total : 0,
    centroidHz: total > 0 ? num / total : 0,
  };
}

/**
 * @param {AudioBuffer} buffer
 * @param {string} id
 * @returns {Measurement}
 */
export function analyse(buffer, id) {
  let peak = 0;
  let sum = 0;
  let sumSq = 0;
  let nan = 0;
  let clipped = 0;
  let n = 0;
  let firstAt = -1;
  let lastAt = -1;
  let peakAt = 0;
  const floor = 1e-4;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = data[i] ?? 0;
      if (!Number.isFinite(v)) { nan++; continue; }
      const abs = Math.abs(v);
      if (abs > peak) { peak = abs; peakAt = i; }
      if (abs > 1) clipped++;
      if (abs > floor) {
        if (firstAt < 0 || i < firstAt) firstAt = i;
        if (i > lastAt) lastAt = i;
      }
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  // The first 100 ms of actual sound, per channel-0, which is the part a player
  // reads as the event itself.
  const ch0 = buffer.getChannelData(0);
  let head = 0;
  let headN = 0;
  if (firstAt >= 0) {
    for (let i = firstAt; i < Math.min(ch0.length, firstAt + buffer.sampleRate * 0.1); i++) {
      const v = ch0[i] ?? 0;
      head += v * v;
      headN++;
    }
  }
  const sp = spectrum(buffer);
  return {
    id,
    peak,
    rms: n > 0 ? Math.sqrt(sumSq / n) : 0,
    rms100: headN > 0 ? Math.sqrt(head / headN) : 0,
    dc: n > 0 ? sum / n : 0,
    nan,
    clipped,
    attackMs: firstAt >= 0 ? ((peakAt - firstAt) / buffer.sampleRate) * 1000 : 0,
    durationMs: firstAt >= 0 ? ((lastAt - firstAt) / buffer.sampleRate) * 1000 : 0,
    bands: sp.bands,
    subShare: sp.subShare,
    centroidHz: sp.centroidHz,
  };
}

/**
 * Render one SFX recipe on its own, straight from the recipe so the real-time
 * retrigger guard and voice limiter cannot mask a broken envelope.
 * @param {string} id
 * @param {object} [options]
 * @param {number} [options.seconds]
 * @param {number} [options.rate]
 * @param {import('./sfx.js').SfxOpts} [options.opts]
 * @returns {Promise<Measurement>}
 */
export async function renderSfx(id, options = {}) {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`renderSfx: no recipe '${id}'`);
  const seconds = options.seconds ?? RENDER_SECONDS[id] ?? DEFAULT_SECONDS;
  const rate = options.rate ?? RATE;
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const graph = createGraph(ctx, { region: 'cistern' });
  recipe(graph, 0.05, { gain: 1, pan: 0, vary: 1, bus: graph.sfxBus, ...options.opts });
  return analyse(await ctx.startRendering(), id);
}

/**
 * Render the first `bars` bars of a region's music.
 * @param {object} [options]
 * @param {string} [options.region]
 * @param {number} [options.bars]
 * @param {number} [options.intensity] 0..1
 * @param {number} [options.tail] extra seconds so the reverb finishes
 * @param {number} [options.rate]
 * @returns {Promise<Measurement & {bars: number, steps: number}>}
 */
export async function renderMusic(options = {}) {
  const regionId = options.region ?? 'cistern';
  const region = REGIONS[regionId];
  if (!region) throw new Error(`renderMusic: no region '${regionId}'`);
  const bars = options.bars ?? 8;
  const steps = bars * region.stepsPerBar;
  const stepDur = 60 / region.tempo / 4;
  const seconds = steps * stepDur + (options.tail ?? 4);

  const rate = options.rate ?? RATE;
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const graph = createGraph(ctx, { region: regionId, delayTime: (60 / region.tempo) * 0.75 });
  const seq = createSequencer(graph, region, { seed: 1 });
  seq.setIntensity(options.intensity ?? 1);
  seq.scheduleSteps(steps, 0.05);
  const measured = analyse(await ctx.startRendering(), `music:${regionId}@${options.intensity ?? 1}`);
  return { ...measured, bars, steps };
}

/**
 * Each chord's pad voice alone, at the region's own gain.
 *
 * The guard this exists for: with a fixed filter cutoff, a chord voiced higher is
 * a chord filtered harder, so the progression's loudness tracks its voicing
 * instead of its intensity. Four chords that differ by more than a couple of dB
 * mean the filter has stopped keytracking.
 * @param {object} [options]
 * @param {string} [options.region]
 * @param {number} [options.rate]
 * @returns {Promise<Measurement[]>}
 */
export async function renderPads(options = {}) {
  const regionId = options.region ?? 'cistern';
  const region = REGIONS[regionId];
  if (!region) throw new Error(`renderPads: no region '${regionId}'`);
  const rate = options.rate ?? RATE;
  /** @type {Measurement[]} */
  const out = [];
  for (const chord of region.chords) {
    const ctx = new OfflineAudioContext(2, Math.ceil(rate * 6), rate);
    const graph = createGraph(ctx, { region: regionId });
    const voice = padVoice(graph, { time: 0.05, freqs: chord.pad.map(midiToFreq), gain: 0.12, bus: graph.musicBus, reverb: 0.7, release: 3.5 });
    voice.release(3.5);
    out.push(analyse(await ctx.startRendering(), chord.name));
  }
  return out;
}

/**
 * How a region's boss lead sits against that region's own harmony.
 *
 * Counted symbolically rather than rendered, because the question is about notes
 * and not about samples: for every note of the phrase, against the chord actually
 * sounding under it, is that note in the chord, and is it a semitone away from one
 * of the chord's tones? A semitone against a sustained pad is the harshest
 * interval there is, and it is the one thing a lead written for another key does
 * constantly.
 *
 * The phrase repeats until every chord in the progression has heard it, so a
 * 4-bar phrase over an 8-bar progression is counted twice, once against each half.
 *
 * @param {string} regionId
 * @param {object} [options]
 * @param {(number|null)[]} [options.notes] override the phrase with literal MIDI —
 *   how the Cistern's lead scored in the four regions that used to borrow it.
 * @returns {{region: string, sounded: number, nonChord: number, clashes: number}}
 */
export function leadDissonance(regionId, options = {}) {
  const region = REGIONS[regionId];
  if (!region) throw new Error(`leadDissonance: no region '${regionId}'`);
  const lead = region.layers.find((l) => l.id === 'lead');
  const literal = options.notes ?? lead?.notes;
  const phrase = options.notes ?? lead?.degrees ?? lead?.notes;
  const out = { region: regionId, sounded: 0, nonChord: 0, clashes: 0 };
  if (!lead || !phrase) return out;

  const spb = region.stepsPerBar;
  const loopSteps = lead.loopSteps ?? spb;
  const progression = region.chords.length * region.barsPerChord * spb;
  // Enough passes that the phrase has met every chord at least once.
  const passes = Math.max(1, Math.ceil(progression / loopSteps));
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < phrase.length; i++) {
      const entry = phrase[i];
      if (entry === null || entry === undefined) continue;
      const absStep = pass * loopSteps + i * 4;
      const bar = Math.floor(absStep / spb);
      const chord = region.chords[Math.floor(bar / region.barsPerChord) % region.chords.length];
      if (!chord) continue;
      const note = literal ? entry : chordDegree(chord, entry);
      if (note === undefined) continue;
      const pc = ((note % 12) + 12) % 12;
      const tones = new Set(chord.tones.map((m) => ((m % 12) + 12) % 12));
      out.sounded++;
      if (tones.has(pc)) continue;
      out.nonChord++;
      for (const t of tones) {
        const d = Math.abs(pc - t) % 12;
        if (d === 1 || d === 11) { out.clashes++; break; }
      }
    }
  }
  return out;
}

/**
 * Distance between two regions' spectra: the Euclidean norm of the difference of
 * their per-band levels, in dB.
 *
 * The failure this exists for: every region sharing one `layers` array, so that
 * only tempo, chords and reverb tail differed and Verdant and the Ossuary
 * measured 2.9 dB apart — the same music in a slightly different room.
 * @param {{bands: Record<string, number>}} a
 * @param {{bands: Record<string, number>}} b
 * @returns {number}
 */
export function spectralDistance(a, b) {
  let d2 = 0;
  for (const [lo, hi] of BANDS) {
    const key = `${lo}-${hi}`;
    d2 += ((a.bands[key] ?? -120) - (b.bands[key] ?? -120)) ** 2;
  }
  return Math.sqrt(d2);
}

/**
 * Every SFX plus the Cistern at each intensity. Returns plain JSON so it crosses
 * `page.evaluate` unchanged.
 * @returns {Promise<{sfx: Measurement[], music: (Measurement & {bars:number, steps:number})[]}>}
 */
export async function measureAll() {
  /** @type {Measurement[]} */
  const sfx = [];
  for (const id of SFX_IDS) sfx.push(await renderSfx(id));
  /** @type {(Measurement & {bars:number, steps:number})[]} */
  const music = [];
  for (const intensity of [0, 0.45, 0.75, 1]) {
    music.push(await renderMusic({ bars: 8, intensity }));
  }
  return { sfx, music };
}
