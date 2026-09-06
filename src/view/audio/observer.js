/**
 * State -> sound, by *observation only*.
 *
 * The simulation is pure and must stay bit-exact under replay, so audio is never
 * allowed to write to it and the core is never allowed to call into audio. What is
 * left is a diff: two consecutive `GameState`s go in, a list of sounds comes out.
 * Everything this module remembers between frames (which foot is next, a pickup
 * chain, the last heartbeat) lives here, never in `GameState`.
 *
 * Some events cannot honestly be derived this way, and the sim publishes those in
 * `state.events` — a list rebuilt from scratch every `step()`, so reading it is
 * still observation and a replay still hashes identically. A Zip arrival is
 * indistinguishable from a fast fall in a diff; a crumble tile's break frame is
 * gone by the time `brokenTiles` shows it; the material under a foot would mean
 * re-deriving collision out here. Those come from the event list. Everything a
 * diff can honestly see still comes from the diff, because a state difference is
 * the thing that cannot go stale.
 */

import { IN, justPressed } from '../../core/input.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('../../core/types.js').Entity} Entity */
/** @typedef {import('./sfx.js').SfxOpts} SfxOpts */

/** @typedef {{ id: string, opts: SfxOpts }} AudioEvent */

/** 05 §6c 17: every 1.1 s. */
const HEARTBEAT_TICKS = 66;
const LOW_HEALTH = 0.25;
/** 05 §6b: "damage in the last 4 s" raises intensity. */
const RECENT_DAMAGE_TICKS = 240;
/** An enemy this close counts as aware of the player (CHARGER_SIGHT). */
const AWARE_DIST = 200;
/** Chained pickups inside a second walk up the scale. */
const PICKUP_CHAIN_TICKS = 60;

/**
 * What audio still cannot fire, because nothing in the sim says it happened.
 * Everything else that used to be on this list now arrives in `state.events` and
 * is wired in EVENT_SOUNDS below.
 */
export const WANTED_FROM_CORE = [
  'menu cursor movement (there is no menu state, only the PAUSE bit)',
];

/**
 * `state.events` kind -> the recipe it plays. Exported so the suite can check it
 * against the sim's own `EVENT_KINDS` and against the recipe table: the fault
 * this file had was a name nobody was listening for.
 *
 * These are the sounds the game was emitting into nothing: the Zip, the
 * wall-kick, tiles crumbling underfoot, water, every boss beat past the roar, the
 * whole ascent, and the end of the game. The sim has published them for a while;
 * the observer was still diffing state and could not see any of them.
 *
 * @type {Record<string, {id: string, gain?: number, vary?: number}>}
 */
export const EVENT_SOUNDS = {
  // 05 §6c 13 is "Dash / Zip / recall" — the departure is the dash whoosh.
  'zip.start': { id: 'dash', gain: 0.9 },
  'zip.arrive': { id: 'zipArrive' },
  wallkick: { id: 'wallKick' },
  'crumble.break': { id: 'crumble' },
  'water.enter': { id: 'splash' },
  // The same recipe, quieter and a shade higher: leaving water is a smaller
  // event than entering it, and it must not read as a second entry.
  'water.exit': { id: 'splash', gain: 0.5, vary: 1.12 },
  'boss.roar': { id: 'bossRoar' },
  'boss.stomp': { id: 'bossStomp' },
  'boss.phase': { id: 'bossPhase' },
  'boss.death': { id: 'bossDeath' },
  'ascent.start': { id: 'ascentRise' },
  'ascent.tier': { id: 'ascentTier' },
  'ascent.void': { id: 'voidNear' },
  'game.complete': { id: 'finale' },
};

/** @param {{x:number,y:number,w:number,h:number}} a @param {{x:number,y:number,w:number,h:number}} b */
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** @param {Readonly<GameState>} s @returns {{x:number,y:number}} */
function playerCentre(s) {
  return { x: s.player.x + s.player.w / 2, y: s.player.y + s.player.h / 2 };
}

/**
 * @param {Readonly<GameState>} s
 * @param {number} x
 * @param {number} y
 * @returns {{dist:number, dx:number}}
 */
function relativeTo(s, x, y) {
  const c = playerCentre(s);
  const dx = x - c.x;
  const dy = y - c.y;
  return { dist: Math.hypot(dx, dy), dx };
}

/** @param {Entity} e @returns {boolean} */
function isBoss(e) {
  return /boss|stoker|diver|anchor|sentinel/i.test(e.kind);
}

/**
 * @returns {{
 *   observe: (prev: Readonly<GameState>, next: Readonly<GameState>) => AudioEvent[],
 *   intensity: (s: Readonly<GameState>) => number,
 *   calm: (s: Readonly<GameState>) => boolean,
 * }}
 */
export function createObserver() {
  let footLeft = false;
  let lastHeartbeatTick = -Infinity;
  let lastDamageTick = -Infinity;
  let pickupChain = 0;
  let lastPickupTick = -Infinity;

  return {
    observe(prev, next) {
      /** @type {AudioEvent[]} */
      const out = [];
      const p = next.player;
      const seed = next.tick;

      // --- what the sim says happened ---------------------------------------
      /** @type {Set<number>} */
      const bossDeaths = new Set();
      for (const ev of next.events ?? []) {
        if (ev.kind === 'boss.death' && ev.id !== null) bossDeaths.add(ev.id);
        if (ev.kind === 'footstep') {
          // The one thing about a footstep that only the sim knows is what is
          // under it. The stride pacing is the sim's too, so taking the whole
          // event removes a duplicate accumulator out here.
          footLeft = !footLeft;
          out.push({ id: 'footstep', opts: { seed, pan: footLeft ? -0.15 : 0.15, material: p.inWater ? 'water' : ev.material ?? 'stone' } });
          continue;
        }
        const sound = EVENT_SOUNDS[ev.kind];
        if (!sound) continue;
        const r = relativeTo(next, ev.x, ev.y);
        out.push({ id: sound.id, opts: { seed, dist: r.dist, dx: r.dx, gain: sound.gain ?? 1, ...(sound.vary === undefined ? {} : { vary: sound.vary }) } });
      }

      // A room change resets everything positional; sounds from the old room would
      // arrive attenuated by a distance that no longer means anything.
      if (next.room !== prev.room) {
        out.push({ id: 'doorOpen', opts: { seed, gain: 0.7 } });
        return out;
      }

      // --- movement -------------------------------------------------------
      if (prev.player.jumpFrames === 0 && p.jumpFrames > 0) {
        out.push({ id: 'jump', opts: { seed } });
      }
      if (!prev.player.grounded && p.grounded) {
        out.push({ id: 'land', opts: { seed, speed: Math.abs(prev.player.vy) } });
      }

      // --- the Pin ---------------------------------------------------------
      if (prev.pin.state === 'held' && next.pin.state === 'flying') {
        out.push({ id: 'swing', opts: { seed, pan: next.pin.dirX * 0.2 } });
      }
      if (prev.pin.state === 'flying' && (next.pin.state === 'embedded' || next.pin.state === 'pinned')) {
        const r = relativeTo(next, next.pin.x, next.pin.y);
        out.push({ id: 'hit', opts: { seed, dist: r.dist, dx: r.dx } });
      }
      if (next.pin.clang > prev.pin.clang) {
        const r = relativeTo(next, next.pin.x, next.pin.y);
        // An octave up on the whole recipe: the same impact, but unmistakably metal.
        out.push({ id: 'hit', opts: { seed, dist: r.dist, dx: r.dx, vary: 2, gain: 0.8 } });
      }
      if (prev.pin.state === 'flying' && next.pin.state === 'dropped') {
        const r = relativeTo(next, next.pin.x, next.pin.y);
        out.push({ id: 'land', opts: { seed, speed: 2, gain: 0.5, dist: r.dist, dx: r.dx } });
      }
      if (prev.pin.state === 'returning' && next.pin.state === 'held') {
        out.push({ id: 'dash', opts: { seed, gain: 0.8 } });
      }
      if (prev.player.jabFrames === 0 && p.jabFrames > 0) {
        out.push({ id: 'swing', opts: { seed, pan: p.facing * 0.2, gain: 0.8 } });
      }

      // --- combat ----------------------------------------------------------
      // A respawn re-spawns the room with fresh entity ids, so every old id
      // vanishes at once. That is not twelve enemies dying.
      const respawned = prev.player.hp <= 0 && p.hp > 0;
      /** @type {Map<number, Entity>} */
      const before = new Map(respawned ? [] : prev.entities.map((e) => [e.id, e]));
      for (const e of next.entities) {
        const was = before.get(e.id);
        if (was && e.hp < was.hp && e.hp > 0) {
          const r = relativeTo(next, e.x + e.w / 2, e.y + e.h / 2);
          out.push({ id: 'hit', opts: { seed, dist: r.dist, dx: r.dx } });
        }
      }
      const now = new Set(next.entities.map((e) => e.id));
      for (const e of respawned ? [] : prev.entities) {
        if (now.has(e.id)) continue;
        // A boss that died already got its own sound from the event list; the
        // three little descending ticks under it would read as a bug.
        if (bossDeaths.has(e.id)) continue;
        const r = relativeTo(next, e.x + e.w / 2, e.y + e.h / 2);
        out.push({ id: 'enemyDeath', opts: { seed, dist: r.dist, dx: r.dx } });
      }

      if (p.hp < prev.player.hp) {
        lastDamageTick = next.tick;
        const box = { x: p.x, y: p.y, w: p.w, h: p.h };
        const onSpikes = next.roomData.hazards.some((h) => overlaps(box, h));
        out.push({ id: onSpikes ? 'hazard' : 'hurt', opts: { seed } });
      }

      // --- progress --------------------------------------------------------
      if (next.progress.pickupsTaken.length > prev.progress.pickupsTaken.length) {
        pickupChain = next.tick - lastPickupTick <= PICKUP_CHAIN_TICKS ? Math.min(7, pickupChain + 1) : 0;
        lastPickupTick = next.tick;
        out.push({ id: 'pickup', opts: { seed, speed: pickupChain } });
      }
      if (next.progress.abilities.length > prev.progress.abilities.length) {
        out.push({ id: 'abilityPickup', opts: { seed } });
      }
      if (next.progress.lanternsLit.length > prev.progress.lanternsLit.length) {
        out.push({ id: 'lantern', opts: { seed } });
      }

      // --- UI ---------------------------------------------------------------
      if (justPressed(next.input, next.prevInput, IN.PAUSE)) {
        out.push({ id: 'menuConfirm', opts: { seed } });
      }
      if (justPressed(next.input, next.prevInput, IN.MAP)) {
        out.push({ id: 'mapOpen', opts: { seed } });
      }

      // --- heartbeat --------------------------------------------------------
      if (p.hp > 0 && p.maxHp > 0 && p.hp / p.maxHp <= LOW_HEALTH) {
        if (next.tick - lastHeartbeatTick >= HEARTBEAT_TICKS) {
          lastHeartbeatTick = next.tick;
          out.push({ id: 'heartbeat', opts: { seed } });
        }
      } else {
        lastHeartbeatTick = -Infinity;
      }

      return out;
    },

    /** @param {Readonly<GameState>} s @returns {number} 0-3 */
    intensity(s) {
      const c = playerCentre(s);
      let level = 0;
      for (const e of s.entities) {
        if (e.hp <= 0) continue;
        if (isBoss(e)) return 3;
        if (Math.hypot(e.x + e.w / 2 - c.x, e.y + e.h / 2 - c.y) <= AWARE_DIST) level = 1;
      }
      if (s.tick - lastDamageTick <= RECENT_DAMAGE_TICKS) level = Math.max(level, 2);
      return level;
    },

    /** Save-lantern rooms force intensity 0 (05 §6b). @param {Readonly<GameState>} s */
    calm(s) {
      const lanterns = /** @type {{length:number}|undefined} */ (s.roomData.lanterns);
      return Boolean(lanterns && lanterns.length > 0 && s.entities.length === 0);
    },
  };
}
