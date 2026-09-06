/**
 * What every enemy shares: a body, gravity, a tile sweep, and a damage door.
 *
 * Enemies are pattern-driven and frame-exact — there is no RNG in any of them, so
 * "the crawler was somewhere else that time" is never an explanation for a failing
 * test.
 */

import { TILE, ENEMY_GRAVITY, ENEMY_TERMINAL_VY, ENEMY_KNOCKBACK } from '../constants.js';
import { moveBox, solidAt } from '../collision.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').Room} Room */
/** @typedef {import('../types.js').AABB} AABB */

/**
 * @param {object} spec
 * @param {number} spec.id
 * @param {string} spec.kind
 * @param {string} spec.roomId
 * @param {number} spec.tx
 * @param {number} spec.ty
 * @param {number} spec.w
 * @param {number} spec.h
 * @param {number} spec.hp
 * @param {0|1} spec.mass
 * @param {string} spec.mode
 * @returns {Entity}
 */
export function createEntity(spec) {
  return {
    id: spec.id,
    kind: spec.kind,
    roomId: spec.roomId,
    // Feet on the bottom of the spawn tile, centred on it.
    x: spec.tx * TILE + (TILE - spec.w) / 2,
    y: (spec.ty + 1) * TILE - spec.h,
    w: spec.w,
    h: spec.h,
    vx: 0,
    vy: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    facing: -1,
    hitLockout: 0,
    timers: {},
    mass: spec.mass,
    mode: spec.mode,
    pinned: false,
    stun: 0,
    flash: 0,
    targetX: 0,
    targetY: 0,
  };
}

/** @param {Readonly<Entity>} e @returns {AABB} */
export function entityBox(e) {
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

/** @param {Readonly<Entity>} e @returns {{x:number, y:number}} the eye, which is self-lit */
export function entityEye(e) {
  return { x: e.x + e.w / 2 + e.facing * 2, y: e.y + e.h / 3 };
}

/**
 * @param {Entity} e
 * @param {number} amount
 * @param {number} fromX  for knockback direction
 * @returns {Entity} a fresh entity; `hp` may reach 0, which combat then reaps
 */
export function damageEntity(e, amount, fromX) {
  if (e.hp <= 0 || e.hitLockout > 0) return e;
  const hp = Math.max(0, e.hp - amount);
  const away = e.x + e.w / 2 < fromX ? -1 : 1;
  return {
    ...e,
    hp,
    hitLockout: 4,
    flash: 3,
    // A pinned enemy stays pinned while it is being hit; that is the point of it.
    vx: e.pinned ? 0 : away * ENEMY_KNOCKBACK,
  };
}

/**
 * One frame of ordinary enemy motion. Pinned or stunned bodies do not move, which
 * is what makes "nail it to the wall and walk up to it" safe to teach.
 * @param {Room} room
 * @param {Entity} e
 * @param {number} vx desired horizontal velocity for this frame
 * @returns {Entity}
 */
export function moveEntity(room, e, vx) {
  if (e.pinned) return { ...e, vx: 0, vy: 0 };
  const vy = Math.min(e.vy + ENEMY_GRAVITY, ENEMY_TERMINAL_VY);
  const moved = moveBox(room, entityBox(e), vx, vy, true);
  return { ...e, x: moved.x, y: moved.y, vx: moved.vx, vy: moved.vy };
}

/**
 * @param {Room} room
 * @param {Readonly<Entity>} e
 * @param {-1|1} dir
 * @returns {boolean} true if walking `dir` would step off a ledge or into a wall
 */
export function blockedAhead(room, e, dir) {
  const probeX = dir > 0 ? e.x + e.w + 1 : e.x - 1;
  const tx = Math.floor(probeX / TILE);
  const midTy = Math.floor((e.y + e.h / 2) / TILE);
  const footTy = Math.floor((e.y + e.h + 1) / TILE);
  return solidAt(room, tx, midTy) || !solidAt(room, tx, footTy);
}
