/**
 * A rail platform: a one-way surface that rides a fixed track between two points.
 *
 * It is the only dynamic solid in the game. Free-body crates were cut
 * (06-revision-1 §C) because a body that collides with terrain, the player and
 * other bodies is a night's worth of bugs for one puzzle; a track is a better
 * constraint than a physics body, and it is still "pull the thing to you".
 *
 * It is **metal**, so the Pin clangs off it — until Deep Pin, which embeds in its
 * core and stops it dead. That is A2's traversal use (§G).
 */

import { TILE, REEL_SPEED } from '../constants.js';

/** @typedef {import('../types.js').Prop} Prop */
/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').AABB} AABB */

export const kind = 'rail';

/** Two tiles wide, a quarter tile thick: the same read as a Pin's shelf. */
const RAIL_W = TILE * 2;
const RAIL_H = 4;
/** Slow enough to time, fast enough that waiting for one is a decision. */
const RAIL_SPEED = 1.2;

/**
 * @param {number} id
 * @param {[number, number]} at   track end A, in tile coords
 * @param {[number, number]} to   track end B, in tile coords
 * @param {boolean} [running]     already under power; see below
 * @returns {Prop}
 */
export function spawn(id, at, to, running = false) {
  const ax = at[0] * TILE;
  const ay = at[1] * TILE;
  return {
    id, kind,
    x: ax, y: ay, w: RAIL_W, h: RAIL_H,
    ax, ay, bx: to[0] * TILE, by: to[1] * TILE,
    // Parked, unless the room says otherwise. A *gate* rail must stay parked: a
    // rail that is already running is a free ride, and the Gap gate has to be
    // opened by A3 and not by waiting. But a rail that gates nothing and is parked
    // for ever is scenery, and the Foundry is supposed to be the region you time
    // things against — so a room may hand one of its conveyors its power back.
    t: 0, dir: 1, speed: running ? RAIL_SPEED : 0,
    frozen: false, reel: 0, material: 'metal',
  };
}

/**
 * @param {Prop} p
 * @param {Readonly<GameState>} s
 * @returns {Prop}
 */
export function update(p, s) {
  if (p.frozen) return p;
  const length = Math.hypot(p.bx - p.ax, p.by - p.ay) || 1;
  if (p.reel > 0) {
    // Reeled: it comes to the end of its track nearest you, then stops. It never
    // leaves the rail, so there is nothing for it to get wedged in.
    const toB = Math.hypot(p.bx - (s.player.x + s.player.w / 2), p.by - (s.player.y + s.player.h / 2))
      < Math.hypot(p.ax - (s.player.x + s.player.w / 2), p.ay - (s.player.y + s.player.h / 2));
    const t = clamp01(p.t + (toB ? 1 : -1) * (REEL_SPEED / length));
    // It arrives at your end of the track and then *waits* for the rest of the reel
    // before setting off. A ferry that leaves the instant it docks is not a ferry.
    return {
      ...place(p, t),
      reel: p.reel - 1,
      speed: p.reel === 1 ? RAIL_SPEED : 0,
      dir: /** @type {-1|1} */ (t >= 1 ? -1 : 1),
    };
  }
  if (p.speed === 0) return p;
  const t = p.t + p.dir * (p.speed / length);
  if (t >= 1) return { ...place(p, 1), dir: /** @type {-1|1} */ (-1) };
  if (t <= 0) return { ...place(p, 0), dir: /** @type {-1|1} */ (1) };
  return place(p, t);
}

/** @param {Prop} p @param {number} t @returns {Prop} */
function place(p, t) {
  return { ...p, t, x: p.ax + (p.bx - p.ax) * t, y: p.ay + (p.by - p.ay) * t };
}

/** @param {number} v @returns {number} */
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
