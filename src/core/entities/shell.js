/**
 * Shell: armoured, heavy, slow, and it stands in the corridor you want.
 *
 * **It is only hurt from above or behind** — the geometry lives in `base.js`'s
 * `armoured()` so that every attack in the game answers the same question. Being
 * heavy, it can never be nailed to a wall: the Pin does its damage and drops. The
 * answer is to get an angle, which is what makes it the enemy that teaches Zip.
 */

import { SHELL_W, SHELL_H, SHELL_SPEED, ENEMY_HP_HEAVY } from '../constants.js';
import { createEntity, moveEntity, blockedAhead } from './base.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'shell';

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return createEntity({
    id, kind, roomId, tx, ty,
    w: SHELL_W, h: SHELL_H, hp: ENEMY_HP_HEAVY, mass: 1, mode: 'patrol',
  });
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  if (e.pinned || e.stun > 0 || e.reel > 0) return moveEntity(s.roomData, e, 0);
  // It turns to face the player when they are close: the armour is only useful if
  // it is pointed at you, and a shell that never turns is a shell you walk around.
  const cx = s.player.x + s.player.w / 2;
  const near = Math.abs(cx - (e.x + e.w / 2)) < 96;
  const want = /** @type {-1|1} */ (near ? (cx < e.x + e.w / 2 ? -1 : 1) : e.facing);
  const facing = blockedAhead(s.roomData, e, want) ? /** @type {-1|1} */ (-want) : want;
  return { ...moveEntity(s.roomData, { ...e, facing }, facing * SHELL_SPEED), facing };
}
