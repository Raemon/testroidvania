/**
 * A Turret's bolt. It is an entity rather than a special case so that everything
 * already true of entities is true of it: it hurts on contact, the Pin can knock it
 * out of the air, and it shows up in the light list with its own eye.
 *
 * It is not spawnable from a room — it only ever exists because a Turret made it —
 * but it carries the registry's `spawn` so the registry stays one shape.
 */

import { TILE, BOLT_W, BOLT_H, BOLT_LIFE } from '../constants.js';
import { solidAt } from '../collision.js';
import { createEntity } from './base.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'bolt';

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return createEntity({ id, kind, roomId, tx, ty, w: BOLT_W, h: BOLT_H, hp: 1, mass: 0, mode: 'fly' });
}

/**
 * @param {number} id @param {string} roomId
 * @param {number} x @param {number} y @param {number} vx @param {number} vy
 * @returns {Entity}
 */
export function make(id, roomId, x, y, vx, vy) {
  const e = spawn(id, roomId, 0, 0);
  return { ...e, x: x - BOLT_W / 2, y: y - BOLT_H / 2, vx, vy, timers: { life: BOLT_LIFE } };
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  const life = (e.timers.life ?? 0) - 1;
  if (life <= 0) return { ...e, hp: 0 };
  const x = e.x + e.vx;
  const y = e.y + e.vy;
  // No gravity, no bounce: it flies until it hits something or runs out of life.
  if (hitsWall(s, x, y, e.w, e.h)) return { ...e, hp: 0 };
  return { ...e, x, y, timers: { life } };
}

/**
 * @param {Readonly<GameState>} s
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @returns {boolean}
 */
function hitsWall(s, x, y, w, h) {
  for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + h - 1e-9) / TILE); ty++) {
    for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + w - 1e-9) / TILE); tx++) {
      if (solidAt(s.roomData, tx, ty)) return true;
    }
  }
  return false;
}
