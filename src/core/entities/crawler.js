/**
 * Crawler: patrols, turns at ledges and walls, hurts on contact, and never
 * attacks. Mass 0, so it is the enemy the Pin can nail to a wall — which makes it
 * the enemy the game teaches the Pin with (06-revision-1 §F beat 8).
 */

import { CRAWLER_SPEED, CRAWLER_W, CRAWLER_H, ENEMY_HP_LIGHT } from '../constants.js';
import { createEntity, moveEntity, blockedAhead } from './base.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'crawler';

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return createEntity({
    id, kind, roomId, tx, ty,
    w: CRAWLER_W, h: CRAWLER_H, hp: ENEMY_HP_LIGHT, mass: 0, mode: 'patrol',
  });
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  if (e.pinned || e.stun > 0) return moveEntity(s.roomData, e, 0);
  const facing = blockedAhead(s.roomData, e, e.facing) ? /** @type {-1|1} */ (-e.facing) : e.facing;
  return { ...moveEntity(s.roomData, { ...e, facing }, facing * CRAWLER_SPEED), facing };
}
