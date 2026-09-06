/**
 * The mix graph (05-aesthetic §6a, §6d).
 *
 *   voice -> layer/bus gain -> [music lowpass] -> preMaster -> compressor -> limiter -> out
 *   voice -> reverb send ----> convolver -> reverb return ---^
 *   voice -> delay  send ----> delay (fb) -> delay return ---^
 *
 * Two compressors in series is deliberate: the first one glues (slow, gentle), the
 * second one is a brick wall so nothing ever leaves the graph above 0 dBFS. Web
 * game audio that clips is almost always missing the second stage.
 *
 * Everything here takes a `BaseAudioContext`, never an `AudioContext`, so the whole
 * engine can be built inside an `OfflineAudioContext` and measured.
 */

import { createRng } from './rng.js';

/** 05 §6d levels. */
export const MIX = {
  music: 0.55,
  sfx: 0.8,
  ui: 0.5,
  reverbReturn: 0.35,
  delayReturn: 0.25,
};

/** No `gain.value = 0` anywhere — that is the click. This is the floor instead. */
export const SILENT = 0.0001;

/** 05 §6d: nothing unfiltered reaches the output. */
export const MAX_LOWPASS_HZ = 8000;

/**
 * Every voice's output is scaled by this before its bus. The recipes in 05 §6c are
 * written in *velocities* (a "vel 0.7" tick), and a velocity of 1 on a raw
 * oscillator is full scale — so summing three or four of them slams the limiter and
 * everything comes out squashed. This is the one number that turns the design's
 * relative levels into the absolute ones §6d asks for: SFX peaking near -10 dBFS,
 * music near -16.
 */
export const VOICE_TRIM = 0.38;

export const MIN_ATTACK = 0.001;
export const MIN_RELEASE = 0.008;

/**
 * Per-region reverb. 05 §6a: "Only tail length and lowpass change per region."
 * @type {Record<string, {tail:number, top:number, bottom:number, early:number}>}
 */
export const REGION_REVERB = {
  cistern: { tail: 2.8, top: 6000, bottom: 800, early: 0 },
  ossuary: { tail: 3.6, top: 5000, bottom: 700, early: 0 },
  foundry: { tail: 1.6, top: 8000, bottom: 1200, early: 0 },
  verdant: { tail: 2.2, top: 7000, bottom: 900, early: 0.06 },
  spine: { tail: 2.4, top: 6000, bottom: 800, early: 0 },
  // The ending is the only room in the game with sky in it.
  ending: { tail: 4, top: 7500, bottom: 1000, early: 0.04 },
};

/**
 * 05 §6b: "Region change crossfades over 4 s." What crosses is the *space* — the
 * reverb tail and the delay both fade out, change, and fade back over this — and
 * the layer gains, which survive the swap untouched so no part of the arrangement
 * stops and restarts. The material itself changes on one downbeat, because a
 * chord table that swaps mid-bar is a mistake, not a crossfade.
 */
export const REGION_CROSSFADE_S = 4;

/** 12 ms of silence in front of the tail, so the reverb reads as a room and not as a smear. */
const PRE_DELAY_S = 0.012;

/**
 * @typedef {object} AudioGraph
 * @property {BaseAudioContext} ctx
 * @property {GainNode} sfxBus
 * @property {GainNode} musicBus
 * @property {GainNode} uiBus
 * @property {GainNode} preMaster
 * @property {BiquadFilterNode} musicFilter  swept to 600 Hz on pause
 * @property {DynamicsCompressorNode} compressor
 * @property {DynamicsCompressorNode} limiter
 * @property {ConvolverNode} convolver
 * @property {GainNode} reverbBus            send destination
 * @property {GainNode} reverbReturn
 * @property {DelayNode} delay
 * @property {GainNode} delayBus             send destination
 * @property {GainNode} delayReturn
 * @property {GainNode} delayFeedback
 * @property {AudioBuffer} noise             one shared 2 s loop
 * @property {Map<string, AudioBuffer>} impulses
 * @property {Map<number, AudioBuffer>} plucks  Karplus-Strong tables, by reference MIDI note
 * @property {string} region
 * @property {(region: string) => void} setRegion
 * @property {(seconds: number) => void} setDelayTime
 * @property {(open: boolean) => void} setPauseFilter
 * @property {(amount: number, attack: number, release: number) => void} duckMusic
 * @property {() => void} dispose
 */

/**
 * A 2 s white-noise loop, shared by every noise voice (05 §6a). Seeded, so two
 * runs of the same build produce byte-identical noise.
 * @param {BaseAudioContext} ctx
 * @returns {AudioBuffer}
 */
export function createNoiseBuffer(ctx) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * 2));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rng = createRng(0x51f);
  for (let i = 0; i < len; i++) data[i] = rng() * 2 - 1;
  return buf;
}

/**
 * The generated impulse response: noise x exponential decay, run through a one-pole
 * lowpass whose cutoff sweeps down across the tail. The sweep is the whole trick —
 * a flat noise tail sounds like a hiss, a darkening one sounds like stone.
 *
 * @param {BaseAudioContext} ctx
 * @param {{tail:number, top:number, bottom:number, early:number}} shape
 * @returns {AudioBuffer}
 */
export function createImpulse(ctx, shape) {
  const rate = ctx.sampleRate;
  const pre = Math.floor(rate * PRE_DELAY_S);
  const tail = Math.max(1, Math.floor(rate * shape.tail));
  const buf = ctx.createBuffer(2, pre + tail, rate);
  const rng = createRng(0xbeef);
  const earlyAt = shape.early > 0 ? Math.floor(rate * shape.early) : -1;

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let z = 0;
    let peak = 0;
    for (let i = 0; i < tail; i++) {
      const t = i / rate;
      const frac = i / tail;
      const cutoff = shape.top + (shape.bottom - shape.top) * frac;
      // One-pole lowpass, coefficient recomputed per sample because the cutoff moves.
      const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
      z += a * (rng() * 2 - 1 - z);
      let v = z * Math.exp(-t * (3.2 / (shape.tail / 2.8)));
      // Verdant's 60 ms early-reflection bump: one short slap inside the tail.
      if (earlyAt > 0 && i > earlyAt && i < earlyAt + rate * 0.01) v *= 2.2;
      data[pre + i] = v;
      const abs = Math.abs(v);
      if (abs > peak) peak = abs;
    }
    if (peak > 0) {
      const norm = 0.9 / peak;
      for (let i = 0; i < tail; i++) data[pre + i] = (data[pre + i] ?? 0) * norm;
    }
  }
  return buf;
}

/**
 * @param {BaseAudioContext} ctx
 * @param {object} [options]
 * @param {AudioNode|null} [options.output] where the limiter lands; `null` leaves the
 *   graph running but disconnected, which is how the headless test hears nothing
 *   while every node still genuinely executes.
 * @param {string} [options.region]
 * @param {number} [options.delayTime] seconds; dotted 8th at the region tempo
 * @returns {AudioGraph}
 */
export function createGraph(ctx, options = {}) {
  const region = options.region ?? 'cistern';
  const output = options.output === undefined ? ctx.destination : options.output;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.06;
  if (output) limiter.connect(output);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 6;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;
  compressor.connect(limiter);

  const preMaster = ctx.createGain();
  preMaster.gain.value = 1;
  preMaster.connect(compressor);

  const sfxBus = ctx.createGain();
  sfxBus.gain.value = MIX.sfx;
  sfxBus.connect(preMaster);

  const uiBus = ctx.createGain();
  uiBus.gain.value = MIX.ui;
  uiBus.connect(preMaster);

  // The music bus keeps its own lowpass so pause can sweep it to 600 Hz without
  // touching SFX (05 §6d ducking).
  const musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 18000;
  musicFilter.Q.value = 0.7;
  musicFilter.connect(preMaster);

  const musicBus = ctx.createGain();
  musicBus.gain.value = MIX.music;
  musicBus.connect(musicFilter);

  const shape = REGION_REVERB[region] ?? REGION_REVERB.cistern;
  /** @type {Map<string, AudioBuffer>} */
  const impulses = new Map();
  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  if (shape) {
    const ir = createImpulse(ctx, shape);
    impulses.set(region, ir);
    convolver.buffer = ir;
  }

  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = MIX.reverbReturn;
  reverbReturn.connect(compressor);
  convolver.connect(reverbReturn);

  const reverbBus = ctx.createGain();
  reverbBus.gain.value = 1;
  reverbBus.connect(convolver);

  const delay = ctx.createDelay(2);
  delay.delayTime.value = options.delayTime ?? 0.625;

  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.38;
  const delayDamp = ctx.createBiquadFilter();
  delayDamp.type = 'lowpass';
  delayDamp.frequency.value = 2200;
  delay.connect(delayFeedback);
  delayFeedback.connect(delayDamp);
  delayDamp.connect(delay);

  const delayReturn = ctx.createGain();
  delayReturn.gain.value = MIX.delayReturn;
  delay.connect(delayReturn);
  delayReturn.connect(compressor);

  const delayBus = ctx.createGain();
  delayBus.gain.value = 1;
  delayBus.connect(delay);

  /** @type {AudioGraph} */
  const graph = {
    ctx,
    sfxBus,
    musicBus,
    uiBus,
    preMaster,
    musicFilter,
    compressor,
    limiter,
    convolver,
    reverbBus,
    reverbReturn,
    delay,
    delayBus,
    delayReturn,
    delayFeedback,
    noise: createNoiseBuffer(ctx),
    impulses,
    plucks: new Map(),
    region,

    setRegion(next) {
      const nextShape = REGION_REVERB[next];
      if (!nextShape || next === graph.region) return;
      let ir = impulses.get(next);
      if (!ir) {
        ir = createImpulse(ctx, nextShape);
        impulses.set(next, ir);
      }
      graph.region = next;
      // Swapping a convolver buffer mid-tail is an audible cut, so duck the return
      // across the swap: out over 0.4 s, and the new room opens over the rest of
      // the crossfade. This is the half of it you hear as the walls moving.
      const now = ctx.currentTime;
      reverbReturn.gain.cancelScheduledValues(now);
      reverbReturn.gain.setValueAtTime(Math.max(reverbReturn.gain.value, SILENT), now);
      reverbReturn.gain.linearRampToValueAtTime(SILENT, now + 0.4);
      convolver.buffer = ir;
      reverbReturn.gain.linearRampToValueAtTime(MIX.reverbReturn, now + REGION_CROSSFADE_S);
    },

    setDelayTime(seconds) {
      const now = ctx.currentTime;
      const want = Math.max(0.01, Math.min(2, seconds));
      if (Math.abs(want - delay.delayTime.value) < 0.004) return;
      // Ramping a delay line's time pitch-bends everything already inside it: the
      // old region's tail arrives as a tape wobble in the middle of the change.
      // So duck the return, step the time while nothing is coming back, and let
      // the new tempo's echo fade in across the crossfade instead.
      const g = delayReturn.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(g.value, SILENT), now);
      g.linearRampToValueAtTime(SILENT, now + 0.2);
      delay.delayTime.cancelScheduledValues(now);
      delay.delayTime.setValueAtTime(want, now + 0.2);
      g.linearRampToValueAtTime(MIX.delayReturn, now + REGION_CROSSFADE_S);
    },

    setPauseFilter(open) {
      const now = ctx.currentTime;
      musicFilter.frequency.cancelScheduledValues(now);
      musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, now);
      musicFilter.frequency.linearRampToValueAtTime(open ? 18000 : 600, now + 0.3);
    },

    duckMusic(amount, attack, release) {
      const now = ctx.currentTime;
      const g = musicBus.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(g.value, SILENT), now);
      g.linearRampToValueAtTime(Math.max(MIX.music * amount, SILENT), now + attack);
      g.linearRampToValueAtTime(MIX.music, now + attack + release);
    },

    dispose() {
      for (const node of [limiter, compressor, preMaster, sfxBus, uiBus, musicBus,
        musicFilter, convolver, reverbBus, reverbReturn, delay, delayBus, delayReturn,
        delayFeedback, delayDamp]) {
        try { node.disconnect(); } catch { /* already gone */ }
      }
      impulses.clear();
      graph.plucks.clear();
    },
  };

  return graph;
}
