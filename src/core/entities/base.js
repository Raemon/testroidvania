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

/** Bodies that carry the Shell's "only from above or behind" armour rule. */
const ARMOURED_KINDS = ['shell', 'sentinel'];

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
 * @param {import('../types.js').Material|null} [spec.pinMaterial] the Pin embeds in
 *   this body itself, gated by the same three-way read as terrain
 * @param {string} [spec.owner] boss id this body is a part of
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
    pinMaterial: spec.pinMaterial ?? null,
    reel: 0,
    owner: spec.owner ?? '',
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
 * A Shell's armour. "Only hurt from above or behind" is a *geometry* rule, so it
 * lives next to the geometry rather than inside four different attack sites: every
 * attack already knows where it came from.
 * @param {Readonly<Entity>} e
 * @param {number} fromX
 * @param {number} fromY
 * @returns {boolean} true if the blow lands on the shell and does nothing
 */
export function armoured(e, fromX, fromY) {
  // A body with plates is governed by its plates and nothing else: a boss whose
  // pinnable part is held is *open*, from any angle. Otherwise the Shell rule.
  if (e.timers.guard !== undefined) return e.timers.guard > 0;
  if (!ARMOURED_KINDS.includes(e.kind)) return false;
  if (e.pinned || e.stun > 0) return false;
  if (fromY < e.y) return false;
  return Math.sign(fromX - (e.x + e.w / 2)) !== -e.facing;
}

/**
 * @param {Entity} e
 * @param {number} amount
 * @param {number} fromX  for knockback direction
 * @param {number} [fromY] where the blow came from vertically; defaults to level
 *   with the body, which is the only case the armour rule can refuse
 * @returns {Entity} a fresh entity; `hp` may reach 0, which combat then reaps
 */
export function damageEntity(e, amount, fromX, fromY) {
  if (e.hp <= 0 || e.hitLockout > 0) return e;
  if (armoured(e, fromX, fromY ?? e.y + e.h / 2)) return { ...e, hitLockout: 4, flash: 2 };
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
