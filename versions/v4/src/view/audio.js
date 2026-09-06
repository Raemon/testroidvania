/**
 * PINLIGHT's audio engine. Everything is synthesized live; there are no audio files
 * and never will be.
 *
 * The one rule that shapes the whole design: **audio reads game state and never
 * writes to it.** The core does not know audio exists. Sound is triggered by
 * diffing two consecutive `GameState`s (see `audio/observer.js`), so a replay is
 * bit-identical whether the speakers are on, off, or absent.
 *
 * URL parameters:
 *   `?mute=1`      the engine is a no-op shell: no AudioContext, no listeners, no timers.
 *   `?audio=silent` the full engine runs but the limiter is connected to nothing.
 *                   Used by the headless test, so every node genuinely executes.
 */

import { createGraph, MIX } from './audio/graph.js';
import { createSfxPlayer, RECIPES, SFX_IDS } from './audio/sfx.js';
import { createSequencer } from './audio/sequencer.js';
import { createObserver, WANTED_FROM_CORE } from './audio/observer.js';
import { regionForRoom, REGIONS } from './audio/regions/index.js';

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('./audio/sfx.js').SfxOpts} SfxOpts */
/** @typedef {'off'|'silent'|'on'} AudioMode */

export { RECIPES, SFX_IDS, REGIONS, WANTED_FROM_CORE };

/** Sounds that duck the music bus to 0.6x (05 §6d). */
const DUCKERS = new Set(['hurt', 'hazard', 'bossStomp']);

/** 05 §7.1: the ability pickup forces the music to intensity 0 for its four seconds. */
const ABILITY_CALM_TICKS = 240;

/** @returns {URLSearchParams} */
function pageParams() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '');
  } catch {
    return new URLSearchParams('');
  }
}

/**
 * @param {object} [options]
 * @param {AudioMode} [options.mode]
 * @param {URLSearchParams} [options.params]
 * @param {EventTarget|null} [options.gestureTarget] where the unlock listeners go
 * @param {number} [options.seed]
 * @returns {AudioEngine}
 */
export function createAudio(options = {}) {
  const params = options.params ?? pageParams();
  const mode = options.mode
    ?? (params.get('mute') === '1' ? 'off'
      : params.get('audio') === 'silent' ? 'silent'
        : 'on');
  return new AudioEngine(mode, options);
}

class AudioEngine {
  /**
   * @param {AudioMode} mode
   * @param {{gestureTarget?: EventTarget|null, seed?: number}} options
   */
  constructor(mode, options) {
    /** @type {AudioMode} */
    this.mode = mode;
    this.seed = options.seed ?? 1;
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {import('./audio/graph.js').AudioGraph|null} */
    this.graph = null;
    /** @type {ReturnType<typeof createSfxPlayer>|null} */
    this.sfx = null;
    /** @type {ReturnType<typeof createSequencer>|null} */
    this.seq = null;
    this.observer = createObserver();
    this.events = 0;
    this.paused = false;
    this.regionId = 'cistern';
    this.calmUntilTick = -1;
    /** Once the game is complete the score stays in the ending's material. */
    this.ended = false;
    /** @type {(() => void)|null} */
    this.detach = null;

    if (mode === 'off') return;
    const target = options.gestureTarget === undefined ? globalThis : options.gestureTarget;
    if (target && typeof (/** @type {EventTarget} */ (target).addEventListener) === 'function') {
      this.listenForGesture(/** @type {EventTarget} */(target));
    }
  }

  /**
   * 05 §6d: the context is created and resumed on the first user gesture, and until
   * then every play call is a no-op. Browsers require this; doing it any other way
   * yields a context stuck in `suspended` and a silent game with no error.
   * @param {EventTarget} target
   */
  listenForGesture(target) {
    const kinds = ['pointerdown', 'keydown', 'touchstart'];
    const onGesture = () => {
      this.detach?.();
      this.unlock();
    };
    for (const kind of kinds) target.addEventListener(kind, onGesture);
    this.detach = () => {
      for (const kind of kinds) target.removeEventListener(kind, onGesture);
      this.detach = null;
    };
  }

  /** @returns {boolean} whether the engine is now live. */
  unlock() {
    if (this.mode === 'off') return false;
    if (this.ctx) {
      void this.ctx.resume?.();
      return true;
    }
    const Ctor = /** @type {{AudioContext?: typeof AudioContext}} */ (globalThis).AudioContext;
    if (!Ctor) return false;

    const ctx = new Ctor();
    const region = REGIONS.cistern;
    if (!region) return false;
    const graph = createGraph(ctx, {
      output: this.mode === 'silent' ? null : ctx.destination,
      region: region.id,
      delayTime: (60 / region.tempo) * 0.75,
    });
    this.ctx = ctx;
    this.graph = graph;
    this.sfx = createSfxPlayer(graph);
    this.seq = createSequencer(graph, region, { seed: this.seed });
    this.regionId = region.id;
    void ctx.resume?.();
    this.seq.start();
    return true;
  }

  /**
   * @param {string} id
   * @param {SfxOpts} [opts]
   * @returns {boolean}
   */
  play(id, opts) {
    if (!this.sfx) return false;
    const played = this.sfx.play(id, opts);
    if (!played) return false;
    if (DUCKERS.has(id)) this.graph?.duckMusic(0.6, 0.04, 0.9);
    // The heartbeat sidechains the music -3 dB on each beat, so the low-health
    // pulse is felt through the score rather than layered on top of it.
    if (id === 'heartbeat') this.graph?.duckMusic(0.7, 0.03, 0.4);
    if (id === 'abilityPickup') this.duckSfx(0.3, 4);
    return true;
  }

  /**
   * 05 §6d: the SFX bus ducks to 0.3x during an ability pickup, so the five bells
   * are the only thing in the room.
   * @param {number} amount @param {number} seconds
   */
  duckSfx(amount, seconds) {
    const g = this.graph;
    if (!g) return;
    const now = g.ctx.currentTime;
    const p = g.sfxBus.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(MIX.sfx * amount, now + 0.1);
    p.linearRampToValueAtTime(MIX.sfx, now + seconds);
  }

  /**
   * The whole interface between the game and its sound: two frames in, nothing out.
   * @param {Readonly<GameState>} prev
   * @param {Readonly<GameState>} next
   */
  observe(prev, next) {
    if (this.mode === 'off') return;
    const events = this.observer.observe(prev, next);
    this.events += events.length;

    if (next.room !== prev.room && !this.ended) {
      const region = regionForRoom(next.room);
      if (region.id !== this.regionId) {
        this.regionId = region.id;
        this.seq?.setRegion(region);
      }
    }

    const seq = this.seq;
    if (seq) {
      seq.setCalm(this.observer.calm(next) || next.tick < this.calmUntilTick);
      seq.setAbilities(next.progress.abilities.length);
      seq.update(1 / 60, this.ended ? 0 : this.observer.intensity(next));
    }

    for (const e of events) {
      if (e.id === 'menuConfirm') this.setPaused(!this.paused);
      if (e.id === 'abilityPickup') this.calmUntilTick = next.tick + ABILITY_CALM_TICKS;
      // The run ends in the Hull, which wears the Ossuary's palette — so without
      // this the game's last chord is F# Phrygian's bII, the region's "unease"
      // chord, held under the credits forever. 05 §7.5 asks for the opposite.
      if (e.id === 'finale') this.enterEnding();
      this.play(e.id, e.opts);
    }
  }

  /**
   * Move the score to the ending's material and leave it there. The sequencer is
   * not restarted: the drone glides from wherever it is into D, the layer gains
   * survive, and the resolution arrives as a change of colour in a sound that has
   * been running since the first room.
   */
  enterEnding() {
    if (this.ended) return;
    const region = REGIONS.ending;
    if (!region) return;
    this.ended = true;
    this.regionId = region.id;
    this.seq?.setRegion(region);
  }

  /** @param {boolean} value */
  setPaused(value) {
    this.paused = value;
    this.graph?.setPauseFilter(!value);
  }

  stats() {
    const sfx = this.sfx?.stats();
    return {
      mode: this.mode,
      unlocked: this.ctx !== null,
      contextState: this.ctx?.state ?? 'none',
      events: this.events,
      plays: sfx?.plays ?? 0,
      byId: sfx?.byId ?? {},
      active: sfx?.active ?? 0,
      suppressed: sfx?.suppressed ?? 0,
      stolen: sfx?.stolen ?? 0,
      timers: this.seq?.timers() ?? 0,
      region: this.regionId,
      ended: this.ended,
      sequencer: this.seq?.state() ?? null,
    };
  }

  /** Stop everything and release the context. Leaves no interval behind. */
  dispose() {
    this.detach?.();
    this.seq?.dispose();
    this.sfx?.stopAll();
    this.graph?.dispose();
    const ctx = this.ctx;
    this.seq = null;
    this.sfx = null;
    this.graph = null;
    this.ctx = null;
    void ctx?.close?.().catch?.(() => {});
  }
}

export { AudioEngine };
