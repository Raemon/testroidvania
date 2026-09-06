/**
 * Hopper: arc-jumps toward the player.
 *
 * It is the light class of 03-game-feel §2.7, so it spends **10 frames of telegraph
 * plus 6 of windup crouching before it leaves the ground** — 16 frames of warning,
 * which is the floor for anything in this game that can touch you.
 */

import { ENEMY_HP_LIGHT } from '../constants.js';
import { createEntity, moveEntity } from './base.js';
import { hasLineOfSight } from '../los.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'hopper';
export const rig = 'tick';

const HOPPER_W = 14;
const HOPPER_H = 14;
const HOPPER_SIGHT = 160;
/** 10 telegraph + 6 windup = the 16-frame floor from 03-game-feel §2.7. */
const HOPPER_TELEGRAPH = 10;
const HOPPER_WINDUP = 6;
const HOPPER_LAND_WAIT = 14;
const HOPPER_JUMP_VY = -4.6;
const HOPPER_JUMP_VX = 2.0;

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return createEntity({
    id, kind, roomId, tx, ty,
    w: HOPPER_W, h: HOPPER_H, hp: ENEMY_HP_LIGHT, mass: 0, mode: 'rest',
  });
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  if (e.pinned || e.stun > 0 || e.reel > 0) return moveEntity(s.roomData, e, 0);
  const timer = Math.max(0, (e.timers.mode ?? 0) - 1);
  const airborne = !onGround(s, e);

  if (e.mode === 'leap') {
    if (airborne) return { ...moveEntity(s.roomData, e, e.vx), timers: { ...e.timers, mode: 0 } };
    return { ...moveEntity(s.roomData, e, 0), mode: 'rest', timers: { ...e.timers, mode: HOPPER_LAND_WAIT } };
  }

  if (e.mode === 'rest') {
    if (timer > 0 || airborne) return { ...moveEntity(s.roomData, e, 0), timers: { ...e.timers, mode: timer } };
    const to = sighted(s, e);
    if (!to) return moveEntity(s.roomData, e, 0);
    return {
      ...moveEntity(s.roomData, e, 0),
      mode: 'telegraph',
      facing: /** @type {-1|1} */ (to < e.x + e.w / 2 ? -1 : 1),
      targetX: to,
      timers: { ...e.timers, mode: HOPPER_TELEGRAPH + HOPPER_WINDUP },
    };
  }

  // telegraph + windup: a visible crouch, and it cannot move during it.
  if (timer > 0) return { ...moveEntity(s.roomData, e, 0), timers: { ...e.timers, mode: timer } };
  const leap = { ...e, vy: HOPPER_JUMP_VY, mode: 'leap' };
  return { ...moveEntity(s.roomData, leap, e.facing * HOPPER_JUMP_VX), mode: 'leap', timers: { ...e.timers, mode: 0 } };
}

/** @param {Readonly<GameState>} s @param {Readonly<Entity>} e @returns {number|null} */
function sighted(s, e) {
  const p = s.player;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  if (Math.hypot(cx - (e.x + e.w / 2), cy - (e.y + e.h / 2)) > HOPPER_SIGHT) return null;
  return hasLineOfSight(s.roomData, e.x + e.w / 2, e.y + e.h / 2, cx, cy) ? cx : null;
}

/** @param {Readonly<GameState>} s @param {Readonly<Entity>} e @returns {boolean} */
function onGround(s, e) {
  return moveEntity(s.roomData, e, 0).vy === 0;
}
