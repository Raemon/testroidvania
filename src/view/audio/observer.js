/**
 * State -> sound, by *observation only*.
 *
 * The simulation is pure and must stay bit-exact under replay, so audio is never
 * allowed to write to it and the core is never allowed to call into audio. What is
 * left is a diff: two consecutive `GameState`s go in, a list of sounds comes out.
 * Everything this module remembers between frames (a stride accumulator, a pickup
 * chain, the last heartbeat) lives here, never in `GameState`.
 *
 * Some events cannot honestly be derived this way — see the report in
 * `src/view/audio/README` of the task, and `WANTED_FROM_CORE` below.
 */

import { IN, justPressed } from '../../core/input.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('../../core/types.js').Entity} Entity */
/** @typedef {import('./sfx.js').SfxOpts} SfxOpts */

/** @typedef {{ id: string, opts: SfxOpts }} AudioEvent */

/** Player stride, from 05-aesthetic §4 (foot phase = distance / 28). */
const STRIDE = 28;
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
 * Events the core does not expose, which audio therefore cannot fire. Listed here
 * so the list lives next to the code that would use it.
 */
export const WANTED_FROM_CORE = [
  'zip start / zip arrive (Zip is indistinguishable from a fast fall in state)',
  'wall-kick off a Hang',
  'boss phase change, boss roar, boss stomp footfall',
  'menu cursor movement (there is no menu state, only the PAUSE bit)',
  'door open as distinct from room transition (a transition is instantaneous)',
  'footstep material under the foot (derived from the room grid would duplicate collision)',
  'water entry / exit ripple',
  'crumble tile break (brokenTiles gives the tile but not which frame it broke)',
];

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
  let strideDist = 0;
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

      // A room change resets everything positional; sounds from the old room would
      // arrive attenuated by a distance that no longer means anything.
      if (next.room !== prev.room) {
        strideDist = 0;
        out.push({ id: 'doorOpen', opts: { seed, gain: 0.7 } });
        return out;
      }

      // --- movement -------------------------------------------------------
      if (prev.player.jumpFrames === 0 && p.jumpFrames > 0) {
        out.push({ id: 'jump', opts: { seed } });
      }
      if (!prev.player.grounded && p.grounded) {
        out.push({ id: 'land', opts: { seed, speed: Math.abs(prev.player.vy) } });
        strideDist = 0;
      }
      if (p.grounded && p.hurtFrames === 0) {
        strideDist += Math.abs(p.x - prev.player.x);
        if (strideDist >= STRIDE) {
          strideDist -= STRIDE;
          footLeft = !footLeft;
          out.push({ id: 'footstep', opts: { seed, pan: footLeft ? -0.15 : 0.15, material: 'stone' } });
        }
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
      if (prev.pin.state === 'returning' && next.pin.state === 'held') {
        out.push({ id: 'dash', opts: { seed, gain: 0.8 } });
      }
      if (prev.player.jabFrames === 0 && p.jabFrames > 0) {
        out.push({ id: 'swing', opts: { seed, pan: p.facing * 0.2, gain: 0.8 } });
      }

      // --- combat ----------------------------------------------------------
      /** @type {Map<number, Entity>} */
      const before = new Map(prev.entities.map((e) => [e.id, e]));
      for (const e of next.entities) {
        const was = before.get(e.id);
        if (was && e.hp < was.hp && e.hp > 0) {
          const r = relativeTo(next, e.x + e.w / 2, e.y + e.h / 2);
          out.push({ id: 'hit', opts: { seed, dist: r.dist, dx: r.dx } });
        }
      }
      const now = new Set(next.entities.map((e) => e.id));
      for (const e of prev.entities) {
        if (now.has(e.id)) continue;
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
