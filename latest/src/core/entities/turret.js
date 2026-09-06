/**
 * Turret: anchored, heavy, fires on a fixed interval.
 *
 * Like the Charger it **acquires the nearest light in its line of sight, which may
 * be a Pin you threw** (06-revision-1 §D2) — so a Turret room is a room where you
 * choose whether your light is a lantern or a decoy.
 *
 * Heavy class budget (03 §2.7): 20 frames of telegraph, 12 of windup. The bolt does
 * not exist until frame 32.
 */

import { ENEMY_HP_HEAVY } from '../constants.js';
import { createEntity, entityEye } from './base.js';
import { nearestVisibleLight } from '../los.js';
import { make as makeBolt, BOLT_SPEED } from './bolt.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'turret';
export const rig = 'tick';

const TURRET_W = 16;
const TURRET_H = 16;
const TURRET_SIGHT = 220;
/** Heavy class: 20 + 12 = 32 frames before the bolt exists (03-game-feel §2.7). */
const TURRET_TELEGRAPH = 20;
const TURRET_WINDUP = 12;
const TURRET_RECOVER = 30;

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return createEntity({
    id, kind, roomId, tx, ty,
    w: TURRET_W, h: TURRET_H, hp: ENEMY_HP_HEAVY, mass: 1, mode: 'idle',
  });
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  if (e.pinned || e.stun > 0 || e.reel > 0) return e;
  const timer = Math.max(0, (e.timers.mode ?? 0) - 1);

  if (e.mode === 'fire') return { ...e, mode: 'recover', timers: { ...e.timers, mode: TURRET_RECOVER } };
  if (e.mode === 'recover') {
    return timer > 0 ? { ...e, timers: { ...e.timers, mode: timer } } : { ...e, mode: 'idle', timers: { ...e.timers, mode: 0 } };
  }

  if (e.mode === 'idle') {
    const eye = entityEye(e);
    const seen = nearestVisibleLight(s.roomData, eye.x, eye.y, s.lights.filter((l) => l.kind !== 'eye'), TURRET_SIGHT);
    if (!seen) return e;
    return {
      ...e,
      mode: 'telegraph',
      facing: /** @type {-1|1} */ (seen.x < e.x + e.w / 2 ? -1 : 1),
      targetX: seen.x,
      targetY: seen.y,
      timers: { ...e.timers, mode: TURRET_TELEGRAPH + TURRET_WINDUP },
    };
  }

  if (timer > 0) return { ...e, timers: { ...e.timers, mode: timer } };
  return { ...e, mode: 'fire', timers: { ...e.timers, mode: 0 } };
}

/**
 * The one frame of the cycle that makes a bolt. `fire` lasts exactly one frame, so
 * a telegraph always produces exactly one shot.
 * @param {Readonly<Entity>} e
 * @param {Readonly<GameState>} s
 * @param {number} nextId
 * @returns {Entity[]}
 */
export function hatch(e, s, nextId) {
  if (e.mode !== 'fire') return [];
  const eye = entityEye(e);
  const dx = e.targetX - eye.x;
  const dy = e.targetY - eye.y;
  const dist = Math.hypot(dx, dy) || 1;
  return [makeBolt(nextId, e.roomId, eye.x, eye.y, (dx / dist) * BOLT_SPEED, (dy / dist) * BOLT_SPEED)];
}
