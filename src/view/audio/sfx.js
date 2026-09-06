/**
 * The 17 SFX recipes of 05-aesthetic §6c, plus the player that enforces §6d's
 * anti-harshness rules around them: retrigger guard, voice limiting, pitch
 * variation, distance attenuation and panning.
 *
 * A recipe is a pure scheduling function `(graph, time, opts) -> Voice[]`. It never
 * reads the clock, so the same recipe renders identically in an OfflineAudioContext
 * — which is the only way we can check that an envelope is a sound and not a click.
 */

import { bell, pad, drone, pluck, sub, breath, tick, ampEnv, outputChain, midiToFreq } from './voices.js';
import { SILENT } from './graph.js';
import { createRng, pitchVary } from './rng.js';

/** @typedef {import('./graph.js').AudioGraph} AudioGraph */
/** @typedef {import('./voices.js').Voice} Voice */

/**
 * @typedef {object} SfxOpts
 * @property {number} [gain]     0..1 before distance attenuation
 * @property {number} [pan]      -1..1
 * @property {number} [vary]     pitch multiplier, normally 0.96..1.04
 * @property {number} [dist]     distance from the player, world units
 * @property {number} [dx]       signed offset from the player, for panning
 * @property {number} [seed]     usually `state.tick`, so a replay sounds the same
 * @property {number} [time]     absolute schedule time; defaults to now
 * @property {number} [speed]    fall speed (land), chain index (pickup), etc.
 * @property {string} [material] 'stone' | 'metal' | 'water' (footstep)
 * @property {AudioNode} [bus]
 */

/** 05 §6d. */
export const RETRIGGER_GUARD_S = 0.035;
export const MAX_PER_ID = 3;
export const MAX_VOICES = 24;

/** D Dorian, for the chained-pickup ladder (SFX 8). */
const D_DORIAN = [0, 2, 3, 5, 7, 9, 10];

/**
 * @param {SfxOpts} o
 * @returns {{gain:number, pan:number, vary:number, bus:AudioNode|undefined}}
 */
function base(o) {
  return {
    gain: o.gain ?? 1,
    pan: o.pan ?? 0,
    vary: o.vary ?? 1,
    bus: o.bus,
  };
}

/**
 * Every recipe, keyed by id. Ids 1-17 of §6c, with the multi-variant entries
 * (menu, map, boss) split into one id each so the retrigger guard and the voice
 * limiter can treat them separately.
 * @type {Record<string, (graph: AudioGraph, time: number, opts: SfxOpts) => Voice[]>}
 */
export const RECIPES = {
  /** 1. Jump — an exhale that brightens, with a click of shoe leather under it. */
  jump(g, t, o) {
    const b = base(o);
    return [
      breath(g, { time: t, freq: 900 * b.vary, to: 1800 * b.vary, sweep: 0.08, attack: 0.005, decay: 0.11, gain: 0.28 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.25 }),
      tick(g, { time: t, freq: 520 * b.vary, gain: 0.3 * b.gain, pan: b.pan, bus: b.bus, decay: 0.04, reverb: 0.15 }),
    ];
  },

  /** 2. Land — weight. The sub carries it; the breath is the dust. */
  land(g, t, o) {
    const b = base(o);
    // Fall speed maps to loudness, not to pitch: a heavy landing should be louder,
    // not lower, or every drop sounds like a different creature.
    const impact = Math.max(0.35, Math.min(1, (o.speed ?? 4) / 6));
    return [
      sub(g, { time: t, freq: 90 * b.vary, to: 45 * b.vary, sweep: 0.06, attack: 0.002, decay: 0.12, gain: 0.55 * impact * b.gain, pan: b.pan, bus: b.bus }),
      breath(g, { time: t, freq: 400 * b.vary, q: 0.8, attack: 0.002, decay: 0.06, gain: 0.22 * impact * b.gain, pan: b.pan, bus: b.bus, reverb: 0.3 }),
    ];
  },

  /** 3. Footstep — 45 ms, quiet, alternating pan. It must never draw attention. */
  footstep(g, t, o) {
    const b = base(o);
    const material = o.material ?? 'stone';
    if (material === 'water') {
      return [
        tick(g, { time: t, freq: 380 * b.vary, gain: 0.15 * b.gain, pan: b.pan, bus: b.bus, decay: 0.04, reverb: 0.3 }),
        breath(g, { time: t, freq: 200 * b.vary, q: 1.2, attack: 0.002, decay: 0.05, gain: 0.12 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.3 }),
      ];
    }
    const f = material === 'metal' ? 700 : 1100;
    return [tick(g, { time: t, freq: f * b.vary, gain: 0.15 * b.gain, pan: b.pan, bus: b.bus, decay: 0.04, reverb: 0.2 })];
  },

  /** 4. Weapon swing — a whoosh that darkens as it passes. Also the Pin throw. */
  swing(g, t, o) {
    const b = base(o);
    return [breath(g, { time: t, freq: 2500 * b.vary, to: 600 * b.vary, sweep: 0.09, attack: 0.01, decay: 0.1, gain: 0.3 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.25, delay: 0.15 })];
  },

  /** 5. Hit enemy — the bell is "the glass in every hit"; without it a hit is a thud. */
  hit(g, t, o) {
    const b = base(o);
    return [
      tick(g, { time: t, freq: 240 * b.vary, to: 80 * b.vary, sweep: 0.05, decay: 0.06, gain: 0.7 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.2 }),
      breath(g, { time: t, freq: 3000 * b.vary, attack: 0.001, decay: 0.03, gain: 0.3 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.2 }),
      bell(g, { time: t, freq: 1319 * b.vary, gain: 0.2 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.6, delay: 0.2 }),
    ];
  },

  /** 6. Player hurt — the two bells are 26 Hz apart on purpose; the beating is nausea. */
  hurt(g, t, o) {
    const b = base(o);
    return [
      sub(g, { time: t, freq: 120 * b.vary, to: 40 * b.vary, sweep: 0.09, attack: 0.002, decay: 0.09, gain: 0.7 * b.gain, pan: b.pan, bus: b.bus }),
      breath(g, { time: t, freq: 500 * b.vary, mode: 'lowpass', q: 0.7, attack: 0.002, decay: 0.15, gain: 0.35 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.3 }),
      bell(g, { time: t, freq: 440 * b.vary, gain: 0.35 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.4, delay: 0.1 }),
      bell(g, { time: t, freq: 466 * b.vary, gain: 0.35 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.4, delay: 0.1 }),
    ];
  },

  /** 7. Enemy death — three descending ticks, then the room swallowing it. */
  enemyDeath(g, t, o) {
    const b = base(o);
    /** @type {Voice[]} */
    const out = [];
    const steps = [880, 660, 440];
    for (let i = 0; i < steps.length; i++) {
      out.push(tick(g, { time: t + i * 0.04, freq: (steps[i] ?? 440) * b.vary, gain: 0.35 * b.gain, pan: b.pan, bus: b.bus, decay: 0.05, reverb: 0.3 }));
    }
    out.push(breath(g, { time: t + 0.12, freq: 1200 * b.vary, to: 200 * b.vary, sweep: 0.3, attack: 0.01, decay: 0.3, gain: 0.3 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.8 }));
    return out;
  },

  /** 8. Pickup — `speed` is the chain index; consecutive grabs walk up D Dorian. */
  pickup(g, t, o) {
    const b = base(o);
    const stepIndex = Math.max(0, Math.min(7, Math.round(o.speed ?? 0)));
    const semis = (D_DORIAN[stepIndex % 7] ?? 0) + 12 * Math.floor(stepIndex / 7);
    const f = 1568 * Math.pow(2, semis / 12) * b.vary;
    return [
      bell(g, { time: t, freq: f, gain: 0.25 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.55, delay: 0.3 }),
      bell(g, { time: t + 0.05, freq: f * 1.5, gain: 0.18 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.55, delay: 0.3 }),
    ];
  },

  /** 9. Ability pickup — the four-second one. 05 §7.1 step 4. */
  abilityPickup(g, t, o) {
    const b = base(o);
    /** @type {Voice[]} */
    const out = [];
    // Dm9 lifting to Dmaj9: the single raised third is the whole "the light learns
    // a colour" moment, so it is a modulation and not a new chord.
    const chord = pad(g, { time: t, freqs: [midiToFreq(62), midiToFreq(65), midiToFreq(69), midiToFreq(76)], gain: 0.16 * b.gain, bus: b.bus, reverb: 0.9, release: 1.5 });
    chord.release(t + 2);
    out.push(chord);
    const rise = [74, 81, 86, 90, 93];
    for (let i = 0; i < rise.length; i++) {
      out.push(bell(g, { time: t + 0.6 + i * 0.12, freq: midiToFreq(rise[i] ?? 74) * b.vary, gain: 0.3 * b.gain, bus: b.bus, reverb: 0.9, delay: 0.6 }));
    }
    out.push(sub(g, { time: t, freq: 55, attack: 0.8, decay: 1.5, gain: 0.4 * b.gain, bus: b.bus }));
    return out;
  },

  /** 10. Door open (stone) — the grinds are what sell the weight; the thud ends it. */
  doorOpen(g, t, o) {
    const b = base(o);
    /** @type {Voice[]} */
    const out = [breath(g, { time: t, freq: 300 * b.vary, to: 120 * b.vary, sweep: 0.6, mode: 'lowpass', attack: 0.02, decay: 0.6, gain: 0.5 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.5 })];
    for (let i = 0; i < 8; i++) {
      out.push(tick(g, { time: t + i * 0.07, freq: 90 * b.vary, to: 60, sweep: 0.02, decay: 0.03, gain: 0.18 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.3 }));
    }
    out.push(sub(g, { time: t + 0.62, freq: 60, attack: 0.004, decay: 0.18, gain: 0.6 * b.gain, bus: b.bus }));
    return out;
  },

  /** 11. Save lantern lit — 05 §7.4. The "fwoomp" then the room answering. */
  lantern(g, t, o) {
    const b = base(o);
    return [
      breath(g, { time: t, freq: 3000 * b.vary, attack: 0.004, decay: 0.04, gain: 0.35 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.4 }),
      breath(g, { time: t + 0.04, freq: 800 * b.vary, mode: 'lowpass', attack: 0.02, decay: 0.4, gain: 0.3 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.7 }),
      bell(g, { time: t + 0.12, freq: midiToFreq(86) * b.vary, gain: 0.4 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.9, delay: 0.4 }),
      bell(g, { time: t + 0.12, freq: midiToFreq(93) * b.vary, gain: 0.2 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.9, delay: 0.4 }),
    ];
  },

  /** 12. Hazard contact — hurt, plus three dry ticks. The dryness is the sting. */
  hazard(g, t, o) {
    const b = base(o);
    const out = RECIPES.hurt ? RECIPES.hurt(g, t, o) : [];
    for (let i = 0; i < 3; i++) {
      out.push(tick(g, { time: t + i * 0.015, freq: 3000 * b.vary, to: 1500, sweep: 0.01, decay: 0.02, gain: 0.25 * b.gain, pan: b.pan, bus: b.bus, reverb: 0 }));
    }
    return out;
  },

  /** 13. Dash / Zip / recall — a whoosh that brightens, the mirror of the swing. */
  dash(g, t, o) {
    const b = base(o);
    return [
      breath(g, { time: t, freq: 1500 * b.vary, to: 4000 * b.vary, sweep: 0.12, attack: 0.005, decay: 0.14, gain: 0.3 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.25, delay: 0.4 }),
      sub(g, { time: t, freq: 200 * b.vary, to: 400 * b.vary, sweep: 0.1, attack: 0.005, decay: 0.1, gain: 0.15 * b.gain, pan: b.pan, bus: b.bus }),
    ];
  },

  /** 14a. Menu move — dry, on the ui bus. */
  menuMove(g, t, o) {
    const b = base(o);
    return [tick(g, { time: t, freq: 1200 * b.vary, gain: 0.2 * b.gain, bus: b.bus ?? g.uiBus, decay: 0.03, reverb: 0 })];
  },

  /** 14b. Menu confirm. */
  menuConfirm(g, t, o) {
    const b = base(o);
    return [bell(g, { time: t, freq: 1047 * b.vary, gain: 0.3 * b.gain, bus: b.bus ?? g.uiBus, reverb: 0.5, delay: 0.2 })];
  },

  /** 14c. Menu back. */
  menuBack(g, t, o) {
    const b = base(o);
    return [tick(g, { time: t, freq: 800 * b.vary, to: 400 * b.vary, sweep: 0.06, decay: 0.06, gain: 0.22 * b.gain, bus: b.bus ?? g.uiBus, reverb: 0 })];
  },

  /** 15a. Map open — "paper". */
  mapOpen(g, t, o) {
    const b = base(o);
    return [
      breath(g, { time: t, freq: 2000 * b.vary, to: 3200 * b.vary, sweep: 0.08, attack: 0.004, decay: 0.08, gain: 0.25 * b.gain, bus: b.bus ?? g.uiBus, reverb: 0.2 }),
      tick(g, { time: t, freq: 600 * b.vary, gain: 0.18 * b.gain, bus: b.bus ?? g.uiBus, decay: 0.03, reverb: 0 }),
    ];
  },

  /** 15b. Map close — the same paper, swept the other way. */
  mapClose(g, t, o) {
    const b = base(o);
    return [
      breath(g, { time: t, freq: 3200 * b.vary, to: 2000 * b.vary, sweep: 0.08, attack: 0.004, decay: 0.08, gain: 0.25 * b.gain, bus: b.bus ?? g.uiBus, reverb: 0.2 }),
      tick(g, { time: t, freq: 600 * b.vary, to: 400 * b.vary, gain: 0.18 * b.gain, bus: b.bus ?? g.uiBus, decay: 0.03, reverb: 0 }),
    ];
  },

  /**
   * 16a. Boss roar. Two saws is the only place sawtooth appears in the game, and the
   * 400 -> 1200 -> 300 Hz lowpass arc is what keeps it a roar instead of a buzz.
   */
  bossRoar(g, t, o) {
    const b = base(o);
    const ctx = g.ctx;
    const chain = outputChain(g, { time: t, gain: 0.5 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.6, delay: 0.2 }, 8000);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.linearRampToValueAtTime(1200, t + 0.4);
    filter.frequency.linearRampToValueAtTime(300, t + 0.9);
    filter.connect(chain.input);

    const amp = ctx.createGain();
    amp.connect(filter);
    const endsAt = ampEnv(amp.gain, t, 1, 0.08, 0.9);
    /** @type {OscillatorNode[]} */
    const oscs = [];
    for (const f of [55, 82]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f * b.vary;
      const v = ctx.createGain();
      v.gain.value = 0.5;
      osc.connect(v);
      v.connect(amp);
      osc.start(t);
      osc.stop(endsAt);
      oscs.push(osc);
      chain.nodes.push(v);
    }
    const last = oscs[oscs.length - 1];
    if (last) {
      last.onended = () => {
        for (const n of [...chain.nodes, filter, amp, ...oscs]) {
          try { n.disconnect(); } catch { /* already gone */ }
        }
      };
    }
    return [
      { endsAt, stop: (when) => { for (const osc of oscs) { try { osc.stop(when + 0.012); } catch { /* stopped */ } } } },
      breath(g, { time: t, freq: 300 * b.vary, mode: 'lowpass', attack: 0.08, decay: 0.9, gain: 0.25 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.7 }),
    ];
  },

  /** 16b. Boss stomp. */
  bossStomp(g, t, o) {
    const b = base(o);
    return [
      sub(g, { time: t, freq: 70 * b.vary, to: 30, sweep: 0.12, attack: 0.002, decay: 0.2, gain: 0.9 * b.gain, pan: b.pan, bus: b.bus }),
      breath(g, { time: t, freq: 150 * b.vary, mode: 'lowpass', attack: 0.004, decay: 0.2, gain: 0.4 * b.gain, pan: b.pan, bus: b.bus, reverb: 0.5 }),
    ];
  },

  /** 17. Low-health heartbeat — two beats, 140 ms apart, under everything. */
  heartbeat(g, t, o) {
    const b = base(o);
    return [
      sub(g, { time: t, freq: 60, attack: 0.006, decay: 0.08, gain: 0.4 * b.gain, bus: b.bus }),
      sub(g, { time: t + 0.14, freq: 50, attack: 0.006, decay: 0.08, gain: 0.25 * b.gain, bus: b.bus }),
    ];
  },
};

/** Stable order, for tests and for the report. */
export const SFX_IDS = Object.keys(RECIPES);

/**
 * @typedef {object} SfxPlayer
 * @property {(id: string, opts?: SfxOpts) => boolean} play
 * @property {() => {plays: number, byId: Record<string, number>, active: number, suppressed: number, stolen: number}} stats
 * @property {() => void} stopAll
 */

/**
 * @param {AudioGraph} graph
 * @returns {SfxPlayer}
 */
export function createSfxPlayer(graph) {
  /** @type {{id: string, at: number, endsAt: number, voices: Voice[]}[]} */
  let active = [];
  /** @type {Map<string, number>} */
  const lastAt = new Map();
  /** @type {Record<string, number>} */
  const byId = {};
  let plays = 0;
  let suppressed = 0;
  let stolen = 0;

  /** @param {number} now */
  function prune(now) {
    active = active.filter((v) => v.endsAt > now);
  }

  return {
    play(id, opts = {}) {
      const recipe = RECIPES[id];
      if (!recipe) return false;
      const now = graph.ctx.currentTime;
      const t = Math.max(opts.time ?? now, now);

      prune(now);
      if (t - (lastAt.get(id) ?? -Infinity) < RETRIGGER_GUARD_S) {
        suppressed++;
        return false;
      }

      // Voice limiting: the 4th of an id, and anything over 24 total, steals the
      // oldest with a 10 ms ramp rather than being dropped — a dropped sound reads
      // as a bug, a stolen one reads as a busy room.
      const mine = active.filter((v) => v.id === id);
      while (mine.length >= MAX_PER_ID) {
        const victim = mine.shift();
        if (!victim) break;
        for (const v of victim.voices) v.stop(now);
        active = active.filter((v) => v !== victim);
        stolen++;
      }
      while (active.length >= MAX_VOICES) {
        const victim = active.shift();
        if (!victim) break;
        for (const v of victim.voices) v.stop(now);
        stolen++;
      }

      const dist = opts.dist ?? 0;
      const attenuation = dist > 0 ? Math.max(0.1, Math.min(1, 1 - dist / 600)) : 1;
      const pan = opts.dx !== undefined ? Math.max(-0.7, Math.min(0.7, opts.dx / 500)) : (opts.pan ?? 0);
      const vary = opts.vary ?? pitchVary(createRng((opts.seed ?? 0) * 2654435761 + id.length));

      const voices = recipe(graph, t, {
        ...opts,
        gain: (opts.gain ?? 1) * attenuation,
        pan,
        vary,
        bus: opts.bus ?? graph.sfxBus,
      });

      let endsAt = t;
      for (const v of voices) if (v.endsAt > endsAt) endsAt = v.endsAt;
      active.push({ id, at: t, endsAt, voices });
      lastAt.set(id, t);
      plays++;
      byId[id] = (byId[id] ?? 0) + 1;
      return true;
    },

    stats() {
      prune(graph.ctx.currentTime);
      return { plays, byId: { ...byId }, active: active.length, suppressed, stolen };
    },

    stopAll() {
      const now = graph.ctx.currentTime;
      for (const entry of active) for (const v of entry.voices) v.stop(now);
      active = [];
    },
  };
}

export { bell, pad, drone, pluck, sub, breath, tick, SILENT };
