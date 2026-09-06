/**
 * What the three bosses and the miniboss share.
 *
 * The design's best boss idea is **"find the pinnable part while the rest is
 * metal"**, so it is not per-boss code — it is here, once, as two rules:
 *
 *  1. A boss root is guarded (immune) while none of its parts is held by a Pin.
 *  2. A boss whose part is held stops attacking and can be hurt by anything.
 *
 * Everything else a boss file contains is its own phase machine and its own
 * telegraphs, which is the only part of a boss worth writing by hand.
 */

import { createEntity } from '../entities/index.js';
import { make as makePart } from '../entities/part.js';
import { emit } from '../events.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').Material} Material */

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
 * @returns {Entity}
 */
export function spawnBoss(spec) {
  const e = createEntity({ ...spec, mass: 1, mode: 'wake' });
  // Metal everywhere but the parts, and guarded until one of them is taken.
  return { ...e, pinMaterial: 'metal', timers: { mode: WAKE_FRAMES, guard: 1, born: 0 } };
}

/** 03-game-feel §2.7: nothing attacks within 20 frames of entering the screen. */
export const WAKE_FRAMES = 20;

/**
 * @param {Readonly<Entity>} e
 * @param {Readonly<GameState>} s
 * @returns {boolean} true if one of this boss's parts is currently held by a Pin
 */
export function exposed(e, s) {
  return s.entities.some((x) => x.timers.owner === e.id && x.pinned);
}

/**
 * The frame after a boss spawns, it hatches its limbs. Doing it here rather than in
 * the room means a boss can never be placed without the thing that makes it
 * beatable.
 * @param {Readonly<Entity>} e
 * @param {number} nextId
 * @param {{offX:number, offY:number, swing:number, material:Material}[]} parts
 * @returns {Entity[]}
 */
export function hatchParts(e, nextId, parts) {
  if ((e.timers.born ?? 0) !== 1) return [];
  return parts.map((spec, i) => makePart(nextId + i, e, spec));
}

/**
 * Advance the shared bookkeeping every boss phase machine starts with.
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {{e: Entity, timer: number, open: boolean}}
 */
export function tick(e, s) {
  const open = exposed(e, s);
  const born = (e.timers.born ?? 0) + 1;
  const timer = Math.max(0, (e.timers.mode ?? 0) - 1);
  if (born === 1) emit(s.events, 'boss.roar', e.x + e.w / 2, e.y + e.h / 2, { id: e.id });
  return { e: { ...e, timers: { ...e.timers, born, guard: open ? 0 : 1 } }, timer, open };
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @param {string} mode
 * @param {number} frames
 * @returns {Entity}
 */
export function enter(e, s, mode, frames) {
  if (mode !== e.mode) emit(s.events, 'boss.phase', e.x + e.w / 2, e.y + e.h / 2, { id: e.id });
  return { ...e, mode, timers: { ...e.timers, mode: frames } };
}

/** @param {Readonly<Entity>} e @param {Readonly<GameState>} s @returns {-1|1} */
export function facePlayer(e, s) {
  return /** @type {-1|1} */ (s.player.x + s.player.w / 2 < e.x + e.w / 2 ? -1 : 1);
}
