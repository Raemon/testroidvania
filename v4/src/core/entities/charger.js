/**
 * Charger: dormant until it sees a light, then it dashes at it.
 *
 * It acquires **the nearest light source in its line of sight — which may be a
 * thrown Pin, not the player** (06-revision-1 §D2). That is the whole reason it
 * exists: with a Charger in the room, throwing the Pin somewhere is a decoy, and
 * "where does the light go" becomes a decision instead of a penalty.
 */

import {
  CHARGER_W, CHARGER_H, CHARGER_SIGHT, CHARGER_WINDUP, CHARGER_DASH_SPEED,
  CHARGER_DASH_FRAMES, CHARGER_RECOVER_FRAMES, ENEMY_HP_LIGHT,
} from '../constants.js';
import { createEntity, moveEntity, blockedAhead, entityEye } from './base.js';
import { nearestVisibleLight } from '../los.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'charger';
export const rig = 'tick';

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return createEntity({
    id, kind, roomId, tx, ty,
    w: CHARGER_W, h: CHARGER_H, hp: ENEMY_HP_LIGHT, mass: 0, mode: 'dormant',
  });
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  if (e.pinned || e.stun > 0) return moveEntity(s.roomData, e, 0);
  const timer = Math.max(0, (e.timers.mode ?? 0) - 1);

  if (e.mode === 'dormant') {
    const eye = entityEye(e);
    // Its own eye is a light; skip anything that close so it cannot chase itself.
    const seen = nearestVisibleLight(s.roomData, eye.x, eye.y, s.lights.filter((l) => l.kind !== 'eye'), CHARGER_SIGHT);
    if (!seen) return { ...moveEntity(s.roomData, e, 0), timers: { ...e.timers, mode: 0 } };
    return {
      ...moveEntity(s.roomData, e, 0),
      mode: 'windup',
      facing: /** @type {-1|1} */ (seen.x < e.x + e.w / 2 ? -1 : 1),
      targetX: seen.x,
      targetY: seen.y,
      timers: { ...e.timers, mode: CHARGER_WINDUP },
    };
  }

  if (e.mode === 'windup') {
    if (timer > 0) return { ...moveEntity(s.roomData, e, 0), timers: { ...e.timers, mode: timer } };
    return { ...moveEntity(s.roomData, e, 0), mode: 'dash', timers: { ...e.timers, mode: CHARGER_DASH_FRAMES } };
  }

  if (e.mode === 'dash') {
    const stop = timer === 0 || blockedAhead(s.roomData, e, e.facing) || passedTarget(e);
    if (stop) {
      return { ...moveEntity(s.roomData, e, 0), mode: 'recover', timers: { ...e.timers, mode: CHARGER_RECOVER_FRAMES } };
    }
    return { ...moveEntity(s.roomData, e, e.facing * CHARGER_DASH_SPEED), timers: { ...e.timers, mode: timer } };
  }

  if (timer > 0) return { ...moveEntity(s.roomData, e, 0), timers: { ...e.timers, mode: timer } };
  return { ...moveEntity(s.roomData, e, 0), mode: 'dormant', timers: { ...e.timers, mode: 0 } };
}

/** @param {Readonly<Entity>} e @returns {boolean} */
function passedTarget(e) {
  const cx = e.x + e.w / 2;
  return e.facing > 0 ? cx >= e.targetX : cx <= e.targetX;
}
