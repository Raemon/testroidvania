/**
 * DIVER — the Cistern boss. It submerges, surfaces somewhere else, and throws
 * geysers up through the floor. Grants A4 Ricochet.
 *
 * The fight's shape is "you cannot reach it while it is under", so its **stone
 * fins** are the answer: by the Cistern the player has Deep Pin, and freezing a fin
 * mid-sweep is what holds the Diver on the surface long enough to hurt it. That is
 * A2 used offensively, which is the whole reason its parts are stone and not wood.
 */

import { TILE } from '../constants.js';
import { moveEntity } from '../entities/index.js';
import { make as makeBolt, BOLT_SPEED } from '../entities/bolt.js';
import { spawnBoss, hatchParts, tick, enter, facePlayer, BOSS_LIGHT_TELEGRAPH } from './base.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'diver';
export const rig = 'jelly';

const DIVER_HP = 18;
const DIVER_W = 32;
const DIVER_H = 26;
const DIVER_SUBMERGE_FRAMES = 50;
const DIVER_GEYSER_ACTIVE = 12;
const DIVER_RECOVER = 36;

/** @type {import('./index.js').BossDef} */
export const boss = { id: 'diver', name: 'Diver', maxHp: DIVER_HP, grants: 'ricochet' };

const SURFACE_FRAMES = 90;
const SWIM_SPEED = 1.2;

/** Fins: stone, so freezing one needs the Deep Pin the player already carries. */
const PARTS = /** @type {const} */ ([
  { offX: -4, offY: 4, swing: 7, material: 'stone' },
  { offX: DIVER_W - 10, offY: 4, swing: 7, material: 'stone' },
]);

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return spawnBoss({ id, kind, roomId, tx, ty, w: DIVER_W, h: DIVER_H, hp: DIVER_HP });
}

/** @param {Readonly<Entity>} e @param {Readonly<GameState>} s @param {number} nextId @returns {Entity[]} */
export function hatch(e, s, nextId) {
  if (e.mode === 'geyser' && (e.timers.mode ?? 0) === DIVER_GEYSER_ACTIVE) {
    // Three columns of water under the player, so standing still is the mistake.
    const x = s.player.x + s.player.w / 2;
    const y = (s.roomData.h - 1) * TILE;
    return [-TILE, 0, TILE].map((dx, i) => makeBolt(nextId + i, e.roomId, x + dx, y, 0, -BOLT_SPEED));
  }
  return hatchParts(e, nextId, [...PARTS]);
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  const { e: base, timer, open } = tick(e, s);
  const room = s.roomData;
  // A frozen fin pins it to the surface: it cannot dive while you hold one.
  if (open) return enter(moveEntity(room, base, 0), s, 'open', 0);
  if (base.mode === 'open') return enter(moveEntity(room, base, 0), s, 'surface', SURFACE_FRAMES);

  if (base.mode === 'wake') {
    return timer > 0
      ? { ...moveEntity(room, base, 0), timers: { ...base.timers, mode: timer } }
      : enter(moveEntity(room, base, 0), s, 'surface', SURFACE_FRAMES);
  }

  if (base.mode === 'surface') {
    const facing = facePlayer(base, s);
    const moved = { ...moveEntity(room, { ...base, facing }, facing * SWIM_SPEED), facing };
    return timer > 0
      ? { ...moved, timers: { ...moved.timers, mode: timer } }
      : enter(moved, s, 'submerge', DIVER_SUBMERGE_FRAMES);
  }

  if (base.mode === 'submerge') {
    // Under: untouchable and harmless, tracking the player from below.
    const facing = facePlayer(base, s);
    const moved = { ...moveEntity(room, { ...base, facing }, facing * SWIM_SPEED), facing };
    return timer > 0
      ? { ...moved, timers: { ...moved.timers, mode: timer, guard: 1 } }
      : enter(moved, s, 'telegraph', BOSS_LIGHT_TELEGRAPH);
  }

  if (base.mode === 'telegraph') {
    const still = moveEntity(room, base, 0);
    return timer > 0
      ? { ...still, timers: { ...still.timers, mode: timer } }
      : enter(still, s, 'geyser', DIVER_GEYSER_ACTIVE);
  }

  if (base.mode === 'geyser') {
    const still = moveEntity(room, base, 0);
    return timer > 0
      ? { ...still, timers: { ...still.timers, mode: timer } }
      : enter(still, s, 'recover', DIVER_RECOVER);
  }

  const still = moveEntity(room, base, 0);
  return timer > 0
    ? { ...still, timers: { ...still.timers, mode: timer } }
    : enter(still, s, 'surface', SURFACE_FRAMES);
}
