/**
 * ANCHOR — the Core boss, and the last fight in the game. **Two phases only.**
 *
 * Phase 3, the Crown, was cut (06-revision-1 §C): a third fight to build and tune
 * for sixty seconds of scripted coda, when the Ascent is already the finale. So:
 *
 *  1. `ground` — a grounded fight. Slams, waves, the same read as the Stoker.
 *  2. `chase`  — at half health the arena floor gives way and it comes after you,
 *     ignoring terrain, because the void it rides on is not standing on anything.
 *
 * Its pinnable parts are **stone rings**, and freezing one is what buys the window
 * that phase 2 does not otherwise give you.
 */

import { TILE } from '../constants.js';
import { moveEntity } from '../entities/index.js';
import { make as makeBolt } from '../entities/bolt.js';
import { spawnBoss, hatchParts, tick, enter, facePlayer, BOSS_HEAVY_TELEGRAPH } from './base.js';
import { STOKER_SLAM_ACTIVE, STOKER_WAVE_SPEED } from './stoker.js';
import { emit } from '../events.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'anchor';
export const rig = 'knight';

const ANCHOR_HP = 24;
const ANCHOR_W = 44;
const ANCHOR_H = 36;
/** Phase 2 begins here; phase 3 was cut (06-revision-1 §C). */
const ANCHOR_PHASE2_AT = 0.5;
const ANCHOR_CHASE_SPEED = 1.4;

/** @type {import('./index.js').BossDef} */
export const boss = { id: 'anchor', name: 'Anchor', maxHp: ANCHOR_HP, grants: null };

const GROUND_SPEED = 0.8;
const STALK_FRAMES = 60;

const PARTS = /** @type {const} */ ([
  { offX: -6, offY: 10, swing: 8, material: 'stone' },
  { offX: ANCHOR_W - 8, offY: 10, swing: 8, material: 'stone' },
]);

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return spawnBoss({ id, kind, roomId, tx, ty, w: ANCHOR_W, h: ANCHOR_H, hp: ANCHOR_HP });
}

/** @param {Readonly<Entity>} e @param {Readonly<GameState>} s @param {number} nextId @returns {Entity[]} */
export function hatch(e, s, nextId) {
  if (e.mode === 'slam' && (e.timers.mode ?? 0) === STOKER_SLAM_ACTIVE) {
    const y = e.y + e.h - TILE / 2;
    return [
      makeBolt(nextId, e.roomId, e.x, y, -STOKER_WAVE_SPEED, 0),
      makeBolt(nextId + 1, e.roomId, e.x + e.w, y, STOKER_WAVE_SPEED, 0),
    ];
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
  const broken = base.hp <= base.maxHp * ANCHOR_PHASE2_AT;

  if (open) return enter(moveEntity(room, base, 0), s, 'open', 0);

  if (broken && base.mode !== 'chase') {
    emit(s.events, 'boss.stomp', base.x + base.w / 2, base.y + base.h, { id: base.id });
    return enter(base, s, 'chase', 0);
  }

  if (base.mode === 'chase') {
    // The floor is gone. It does not walk any more; it comes straight at you.
    const px = s.player.x + s.player.w / 2;
    const py = s.player.y + s.player.h / 2;
    const dx = px - (base.x + base.w / 2);
    const dy = py - (base.y + base.h / 2);
    const dist = Math.hypot(dx, dy) || 1;
    return {
      ...base,
      x: base.x + (dx / dist) * ANCHOR_CHASE_SPEED,
      y: base.y + (dy / dist) * ANCHOR_CHASE_SPEED,
      vx: 0,
      vy: 0,
      facing: facePlayer(base, s),
    };
  }

  if (base.mode === 'wake' || base.mode === 'open') {
    return timer > 0
      ? { ...moveEntity(room, base, 0), timers: { ...base.timers, mode: timer } }
      : enter(moveEntity(room, base, 0), s, 'stalk', STALK_FRAMES);
  }

  if (base.mode === 'stalk') {
    const facing = facePlayer(base, s);
    const moved = { ...moveEntity(room, { ...base, facing }, facing * GROUND_SPEED), facing };
    return timer > 0
      ? { ...moved, timers: { ...moved.timers, mode: timer } }
      : enter(moved, s, 'telegraph', BOSS_HEAVY_TELEGRAPH);
  }

  if (base.mode === 'telegraph') {
    const still = moveEntity(room, base, 0);
    return timer > 0
      ? { ...still, timers: { ...still.timers, mode: timer } }
      : enter(still, s, 'slam', STOKER_SLAM_ACTIVE);
  }

  const still = moveEntity(room, base, 0);
  return timer > 0
    ? { ...still, timers: { ...still.timers, mode: timer } }
    : enter(still, s, 'stalk', STALK_FRAMES);
}
