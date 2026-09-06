/**
 * A boss's limb: the pinnable part, on a body whose every other surface is metal.
 *
 * It is armour, not health — it can never be destroyed — and its only job is to be
 * *takeable*. Pin it and the boss's plates come down; Deep Pin freezes it where it
 * swings, which is A2's combat use and the reason a mid-game boss has a stone limb.
 *
 * Everything about which part belongs to whom, and where it sits, is data the boss
 * put in `timers` when it hatched, so this file has no per-boss knowledge at all.
 */

import { BOSS_PART_HP } from '../constants.js';
import { createEntity } from './base.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'part';

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return createEntity({
    id, kind, roomId, tx, ty,
    w: 14, h: 14, hp: BOSS_PART_HP, mass: 0, mode: 'limb',
  });
}

/**
 * @param {number} id
 * @param {Readonly<Entity>} owner
 * @param {object} spec
 * @param {number} spec.offX
 * @param {number} spec.offY
 * @param {number} spec.swing  half-amplitude of the limb's sweep, 0 for a fixed part
 * @param {import('../types.js').Material} spec.material
 * @returns {Entity}
 */
export function make(id, owner, spec) {
  const base = spawn(id, owner.roomId, 0, 0);
  return {
    ...base,
    x: owner.x + spec.offX,
    y: owner.y + spec.offY,
    owner: owner.kind,
    pinMaterial: spec.material,
    // Guarded means indestructible: the part is the handle, never the health bar.
    timers: { owner: owner.id, offX: spec.offX, offY: spec.offY, swing: spec.swing, guard: 1 },
  };
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  const owner = s.entities.find((x) => x.id === e.timers.owner);
  if (!owner || owner.hp <= 0) return { ...e, hp: 0 };
  if (e.pinned) return { ...e, vx: 0, vy: 0 };
  const swing = Math.sin(s.tick / 40) * (e.timers.swing ?? 0);
  return {
    ...e,
    x: owner.x + (e.timers.offX ?? 0) + swing,
    y: owner.y + (e.timers.offY ?? 0),
    facing: owner.facing,
    vx: 0,
    vy: 0,
  };
}
