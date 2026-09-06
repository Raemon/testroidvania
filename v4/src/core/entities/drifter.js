/**
 * Drifter: a slow sine-flyer with 1 HP. It punishes standing still and dies to
 * anything, including the recall passing through it.
 *
 * It has no attack, so 03 §2.7's telegraph floor does not apply: contact is its
 * whole threat, and its path is a sine wave you can read a second in advance.
 */


import { createEntity } from './base.js';
import { overlapsSolid } from '../collision.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'drifter';
export const rig = 'jelly';

const DRIFTER_W = 12;
const DRIFTER_H = 12;
const DRIFTER_SPEED = 0.6;
/** Sine period in frames, and half-amplitude in world units. */
const DRIFTER_PERIOD = 90;
const DRIFTER_AMPLITUDE = 14;
/** One hit kills it. Anything at all: a jab, a recall passing through, a zip. */
const DRIFTER_HP = 1;

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  const e = createEntity({
    id, kind, roomId, tx, ty,
    w: DRIFTER_W, h: DRIFTER_H, hp: DRIFTER_HP, mass: 0, mode: 'drift',
  });
  // The spawn tile is the centre of the sine, not a floor to rest on.
  return { ...e, targetY: e.y, timers: { phase: 0 } };
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  if (e.pinned || e.stun > 0 || e.reel > 0) return e;
  const phase = ((e.timers.phase ?? 0) + 1) % DRIFTER_PERIOD;
  const facing = towardPlayer(e, s);
  const x = e.x + facing * DRIFTER_SPEED;
  const y = e.targetY + Math.sin((phase / DRIFTER_PERIOD) * Math.PI * 2) * DRIFTER_AMPLITUDE;
  // It flies, so terrain simply stops it rather than resolving against it.
  const blocked = overlapsSolid(s.roomData, { x, y, w: e.w, h: e.h });
  return {
    ...e,
    x: blocked ? e.x : x,
    y: overlapsSolid(s.roomData, { x: e.x, y, w: e.w, h: e.h }) ? e.y : y,
    facing,
    vx: 0,
    vy: 0,
    timers: { phase },
  };
}

/** @param {Readonly<Entity>} e @param {Readonly<GameState>} s @returns {-1|1} */
function towardPlayer(e, s) {
  return /** @type {-1|1} */ (s.player.x + s.player.w / 2 < e.x + e.w / 2 ? -1 : 1);
}
