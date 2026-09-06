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
 * @property {number} dc         mean sample value; a non-zero mean is a thump
 * @property {number} nan        count of non-finite samples
 * @property {number} clipped    count of samples above 0 dBFS
 * @property {number} attackMs   time from first sound to peak; < 1 ms is a click
 * @property {number} durationMs time from first to last audible sample
 */

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
  return {
    id,
    peak,
    rms: n > 0 ? Math.sqrt(sumSq / n) : 0,
    dc: n > 0 ? sum / n : 0,
    nan,
    clipped,
    attackMs: firstAt >= 0 ? ((peakAt - firstAt) / buffer.sampleRate) * 1000 : 0,
    durationMs: firstAt >= 0 ? ((lastAt - firstAt) / buffer.sampleRate) * 1000 : 0,
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
