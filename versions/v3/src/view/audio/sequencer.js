/**
 * The 16th-note step sequencer (05-aesthetic §6b).
 *
 * The clock and the music are deliberately separate. `scheduleStep()` is a pure
 * function of (step index, absolute time) — it never reads `currentTime`. The
 * lookahead driver is the only thing that does, and it can be replaced by a loop
 * that renders eight bars into an OfflineAudioContext for measurement. That split
 * is what makes music testable at all.
 *
 * The sequencer never stops or restarts when the game state changes. Only layer
 * gains ramp, and only on bar boundaries, so combat never arrives as a jolt.
 */

import { SILENT } from './graph.js';
import { drone as droneVoice, midiToFreq } from './voices.js';
import { createRng } from './rng.js';

/** @typedef {import('./graph.js').AudioGraph} AudioGraph */

/**
 * @typedef {object} Chord
 * @property {string} name
 * @property {number} bass      MIDI root for the bass layer
 * @property {number[]} pad     closed voicing above C4
 * @property {number[]} tones   the chord's {1,3,5,7,9} in MIDI, for the arp
 * @property {number} drone     MIDI note the drone glides to on this chord
 */

/**
 * @typedef {object} StepContext
 * @property {AudioGraph} graph
 * @property {AudioNode} bus        this layer's gain node
 * @property {number} time          absolute context time of this 16th
 * @property {number} step          absolute step index since the sequencer opened
 * @property {number} bar
 * @property {number} stepInBar
 * @property {number} stepInLoop    step within this layer's own loop length
 * @property {number} loop          how many times this layer's loop has come round
 * @property {Chord} chord
 * @property {number} chordIndex    which chord of the progression, so a layer can
 *   phase its own pattern against the harmony instead of repeating under it
 * @property {number} stepDur
 * @property {number} barDur
 * @property {number} intensity     latched at the bar, never mid-bar
 * @property {boolean} calm         a save-lantern room forces intensity 0
 * @property {() => number} rng      seeded per (layer, loop) so a loop pass is stable
 */

/**
 * @typedef {object} ChordContext
 * @property {AudioGraph} graph
 * @property {AudioNode} bus
 * @property {number} time
 * @property {Chord} chord
 * @property {number} chordIndex
 * @property {number} barDur
 * @property {number} intensity
 * @property {boolean} calm
 * @property {() => number} rng
 */

/**
 * @typedef {object} Layer
 * @property {string} id
 * @property {number} minIntensity  silent below this
 * @property {number} gain
 * @property {number} [loopSteps]   defaults to one bar
 * @property {(cx: StepContext) => void} [step]
 * @property {(cx: ChordContext) => void} [chord]
 */

/**
 * @typedef {object} Region
 * @property {string} id
 * @property {string} name
 * @property {number} tempo
 * @property {number} bossTempo
 * @property {number} stepsPerBar
 * @property {number} barsPerChord
 * @property {Chord[]} chords
 * @property {{gain: number}} drone
 * @property {Layer[]} layers
 */

/** 05 §6b: setInterval 25 ms, schedule up to 120 ms ahead. */
export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD_S = 0.12;
/** A blocked main thread must resync, never try to schedule the steps it owes. */
const RESYNC_LAG_S = 0.25;
const MAX_STEPS_PER_TICK = 64;

const RAMP_IN_S = 1.5;
const RAMP_OUT_S = 3;

/** Intensity rises fast and falls slow, so the music cannot flap. */
const RISE_TAU_S = 0.5;
const FALL_TAU_S = 6;

/** 05 §6b state -> intensity. Index is the "layer" 0-3 the observer reports. */
export const INTENSITY_LEVELS = [0, 0.45, 0.75, 1];

/** @param {string} s @returns {number} */
function hashId(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * @param {AudioGraph} graph
 * @param {Region} region
 * @param {object} [options]
 * @param {number} [options.seed]
 * @returns {ReturnType<typeof build>}
 */
export function createSequencer(graph, region, options = {}) {
  return build(graph, region, options);
}

/**
 * @param {AudioGraph} graph
 * @param {Region} startRegion
 * @param {{seed?: number}} options
 */
function build(graph, startRegion, options) {
  const ctx = graph.ctx;
  const seed = options.seed ?? 1;

  let region = startRegion;
  /** @type {Map<string, GainNode>} */
  const layerGains = new Map();
  /** @type {ReturnType<typeof droneVoice> | null} */
  let droneHandle = null;

  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;
  let open = false;
  let step = 0;
  let nextStepTime = 0;
  let tempo = region.tempo;
  let intensity = 0;
  let barIntensity = 0;
  let calm = false;
  let lastChordIndex = -1;
  let resyncs = 0;
  let scheduledSteps = 0;

  /** @returns {number} */
  const stepDur = () => 60 / tempo / 4;
  /** @returns {number} */
  const barDur = () => stepDur() * region.stepsPerBar;

  /** @param {Layer} layer @returns {GainNode} */
  function gainFor(layer) {
    let g = layerGains.get(layer.id);
    if (!g) {
      g = ctx.createGain();
      g.gain.value = layer.minIntensity <= 0 ? layer.gain : SILENT;
      g.connect(graph.musicBus);
      layerGains.set(layer.id, g);
    }
    return g;
  }

  /**
   * Freeze a param at whatever it will be at `at`, then let the caller ramp from
   * there. `cancelScheduledValues` alone would snap the gain back to the last set
   * value mid-ramp, which is audible as a step.
   * @param {AudioParam} p @param {number} at
   */
  function holdAt(p, at) {
    const held = Math.max(p.value, SILENT);
    const hold = /** @type {{cancelAndHoldAtTime?: (t: number) => void}} */ (p).cancelAndHoldAtTime;
    if (hold) {
      try {
        hold.call(p, at);
        return;
      } catch { /* `at` is already in the past; fall through */ }
    }
    p.cancelScheduledValues(at);
    p.setValueAtTime(held, at);
  }

  /** @param {number} at */
  function applyLayerGains(at) {
    for (const layer of region.layers) {
      const g = gainFor(layer);
      const want = barIntensity + 1e-6 >= layer.minIntensity ? layer.gain : SILENT;
      const now = g.gain.value;
      if (Math.abs(now - want) < 1e-5) continue;
      holdAt(g.gain, at);
      g.gain.linearRampToValueAtTime(Math.max(want, SILENT), at + (want > now ? RAMP_IN_S : RAMP_OUT_S));
    }
  }

  /**
   * Schedule everything that happens on one 16th note. Pure in the time argument:
   * this is the function the offline renderer calls too.
   * @param {number} absStep
   * @param {number} time
   */
  function scheduleStep(absStep, time) {
    const spb = region.stepsPerBar;
    const bar = Math.floor(absStep / spb);
    const stepInBar = absStep % spb;
    const chordIndex = Math.floor(bar / region.barsPerChord) % region.chords.length;
    const chord = region.chords[chordIndex];
    if (!chord) return;

    if (stepInBar === 0) {
      // Everything that changes the mix changes it here and nowhere else.
      barIntensity = calm ? 0 : intensity;
      applyLayerGains(time);
      droneHandle?.setCombat(barIntensity >= 0.45, time);
      // Boss tempo lift, +8 BPM over two bars.
      const wantTempo = barIntensity >= 1 ? region.bossTempo : region.tempo;
      tempo += (wantTempo - tempo) * 0.5;
      if (Math.abs(tempo - wantTempo) < 0.05) tempo = wantTempo;

      if (chordIndex !== lastChordIndex) {
        lastChordIndex = chordIndex;
        droneHandle?.setFreq(midiToFreq(chord.drone), time, 4);
        for (const layer of region.layers) {
          if (!layer.chord) continue;
          if (barIntensity + 1e-6 < layer.minIntensity) continue;
          layer.chord({
            graph, bus: gainFor(layer), time, chord, chordIndex,
            barDur: barDur(), intensity: barIntensity, calm,
            rng: createRng(seed ^ hashId(layer.id) ^ (chordIndex * 2654435761)),
          });
        }
      }
    }

    for (const layer of region.layers) {
      if (!layer.step) continue;
      if (barIntensity + 1e-6 < layer.minIntensity) continue;
      const loopSteps = layer.loopSteps ?? spb;
      const loop = Math.floor(absStep / loopSteps);
      layer.step({
        graph,
        bus: gainFor(layer),
        time,
        step: absStep,
        bar,
        stepInBar,
        stepInLoop: absStep % loopSteps,
        loop,
        chord,
        chordIndex,
        stepDur: stepDur(),
        barDur: barDur(),
        intensity: barIntensity,
        calm,
        rng: createRng(seed ^ hashId(layer.id) ^ (loop * 40503)),
      });
    }
    scheduledSteps++;
  }

  /** @param {number} at */
  function openAt(at) {
    if (open) return;
    open = true;
    step = 0;
    lastChordIndex = -1;
    nextStepTime = at;
    tempo = region.tempo;
    const first = region.chords[0];
    droneHandle = droneVoice(graph, {
      time: at,
      freq: midiToFreq(first?.drone ?? 26),
      gain: region.drone.gain,
      bus: graph.musicBus,
      // 05 §6a: the low end stays dry. 0.4 made the drone the loudest thing in
      // the reverb, which is how a room tone becomes mud.
      reverb: 0.1,
    });
  }

  function drive() {
    const now = ctx.currentTime;
    // A synchronous frame pump or a backgrounded tab blocks the interval. Skip the
    // steps we owe rather than scheduling a thousand notes into the same instant.
    if (nextStepTime < now - RESYNC_LAG_S) {
      step += Math.max(1, Math.round((now - nextStepTime) / stepDur()));
      nextStepTime = now + 0.05;
      resyncs++;
    }
    let n = 0;
    while (nextStepTime < now + SCHEDULE_AHEAD_S && n < MAX_STEPS_PER_TICK) {
      scheduleStep(step, nextStepTime);
      nextStepTime += stepDur();
      step++;
      n++;
    }
  }

  return {
    /** @param {number} [when] */
    start(when) {
      openAt(when ?? ctx.currentTime + 0.1);
      if (timer !== null) return;
      drive();
      timer = setInterval(drive, LOOKAHEAD_MS);
    },

    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      if (!open) return;
      const now = ctx.currentTime;
      for (const g of layerGains.values()) {
        holdAt(g.gain, now);
        g.gain.linearRampToValueAtTime(SILENT, now + 0.3);
      }
      droneHandle?.release(now);
      droneHandle = null;
      open = false;
    },

    /**
     * Schedule `count` steps at fixed times with no clock at all — the offline
     * render path, and how the music gets measured.
     * @param {number} count
     * @param {number} [from] absolute start time
     */
    scheduleSteps(count, from = 0) {
      openAt(from);
      for (let i = 0; i < count; i++) {
        scheduleStep(step, nextStepTime);
        nextStepTime += stepDur();
        step++;
      }
      return nextStepTime;
    },

    /**
     * @param {number} dt seconds since the last call
     * @param {number} level 0..3
     */
    update(dt, level) {
      const want = INTENSITY_LEVELS[Math.max(0, Math.min(3, Math.round(level)))] ?? 0;
      const tau = want > intensity ? RISE_TAU_S : FALL_TAU_S;
      intensity += (want - intensity) * (1 - Math.exp(-Math.max(0, dt) / tau));
      if (Math.abs(want - intensity) < 1e-4) intensity = want;
    },

    /** @param {number} value 0..1, no smoothing — for tests and offline renders. */
    setIntensity(value) {
      intensity = Math.max(0, Math.min(1, value));
      barIntensity = calm ? 0 : intensity;
    },

    /** @param {boolean} value save-lantern rooms force intensity 0. */
    setCalm(value) { calm = value; },

    /** @param {Region} next */
    setRegion(next) {
      if (next.id === region.id) return;
      region = next;
      lastChordIndex = -1;
      graph.setRegion(next.id);
      graph.setDelayTime((60 / next.tempo) * 0.75);
      // Layer gains survive the swap, so a region change is a 4 s crossfade of
      // material rather than the music stopping and starting.
      const now = ctx.currentTime;
      droneHandle?.setFreq(midiToFreq(region.chords[0]?.drone ?? 26), now, 4);
    },

    state() {
      const spb = region.stepsPerBar;
      return {
        region: region.id,
        running: timer !== null,
        open,
        step,
        bar: Math.floor(step / spb),
        tempo,
        intensity,
        barIntensity,
        calm,
        resyncs,
        scheduledSteps,
        layers: Object.fromEntries([...layerGains].map(([id, g]) => [id, Number(g.gain.value.toFixed(4))])),
      };
    },

    /** Live interval count owned by the sequencer; the leak test asserts this is 0. */
    timers: () => (timer !== null ? 1 : 0),

    dispose() {
      this.stop();
      for (const g of layerGains.values()) {
        try { g.disconnect(); } catch { /* already gone */ }
      }
      layerGains.clear();
    },
  };
}
