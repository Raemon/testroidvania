/**
 * STOKER — the Foundry boss. Ground slams and lava waves. Grants A2 Deep Pin.
 *
 * Phase machine, and nothing else: `wake -> stalk -> telegraph -> windup -> slam ->
 * recover`, plus `open` whenever one of its two bellows is held by a Pin.
 *
 * The slam is a heavy attack, so 03-game-feel §2.7 gives it 24 frames of telegraph
 * and 14 of windup before the waves exist: 38 frames of warning for 1 damage each.
 * The two **wooden bellows** are the only thing on it the Pin will bite.
 */

import { TILE } from '../constants.js';
import { moveEntity } from '../entities/index.js';
import { make as makeBolt } from '../entities/bolt.js';
import { spawnBoss, hatchParts, tick, enter, facePlayer, BOSS_HEAVY_TELEGRAPH } from './base.js';
import { emit } from '../events.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'stoker';
export const rig = 'knight';

const STOKER_HP = 18;
const STOKER_W = 40;
const STOKER_H = 32;
const STOKER_SLAM_WINDUP = 14;
export const STOKER_SLAM_ACTIVE = 10;
const STOKER_RECOVER = 40;
export const STOKER_WAVE_SPEED = 1.6;

/** @type {import('./index.js').BossDef} */
export const boss = { id: 'stoker', name: 'Stoker', maxHp: STOKER_HP, grants: 'deepPin' };

const STALK_SPEED = 0.7;
const STALK_FRAMES = 70;

/** The bellows: wood, because Stoker is the boss that has to be beatable *before* A2. */
const PARTS = /** @type {const} */ ([
  { offX: -6, offY: 6, swing: 5, material: 'wood' },
  { offX: STOKER_W - 8, offY: 6, swing: 5, material: 'wood' },
]);

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  return spawnBoss({ id, kind, roomId, tx, ty, w: STOKER_W, h: STOKER_H, hp: STOKER_HP });
}

/** @param {Readonly<Entity>} e @param {Readonly<GameState>} s @param {number} nextId @returns {Entity[]} */
export function hatch(e, s, nextId) {
  if (e.mode === 'slam' && (e.timers.mode ?? 0) === STOKER_SLAM_ACTIVE) return waves(e, s, nextId);
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
  // A held bellows stops the machine: it cannot attack while you are holding it open.
  if (open) return enter(moveEntity(room, base, 0), s, 'open', 0);
  if (base.mode === 'open') return enter(moveEntity(room, base, 0), s, 'stalk', STALK_FRAMES);

  if (base.mode === 'wake') {
    return timer > 0
      ? { ...moveEntity(room, base, 0), timers: { ...base.timers, mode: timer } }
      : enter(moveEntity(room, base, 0), s, 'stalk', STALK_FRAMES);
  }

  if (base.mode === 'stalk') {
    const facing = facePlayer(base, s);
    const moved = { ...moveEntity(room, { ...base, facing }, facing * STALK_SPEED), facing };
    return timer > 0
      ? { ...moved, timers: { ...moved.timers, mode: timer } }
      : enter(moved, s, 'telegraph', BOSS_HEAVY_TELEGRAPH + STOKER_SLAM_WINDUP);
  }

  if (base.mode === 'telegraph') {
    const still = moveEntity(room, base, 0);
    return timer > 0
      ? { ...still, timers: { ...still.timers, mode: timer } }
      : enter(still, s, 'slam', STOKER_SLAM_ACTIVE);
  }

  if (base.mode === 'slam') {
    const still = moveEntity(room, base, 0);
    if ((base.timers.mode ?? 0) === STOKER_SLAM_ACTIVE) {
      emit(s.events, 'boss.stomp', base.x + base.w / 2, base.y + base.h, { id: base.id });
    }
    return timer > 0
      ? { ...still, timers: { ...still.timers, mode: timer } }
      : enter(still, s, 'recover', STOKER_RECOVER);
  }

  const still = moveEntity(room, base, 0);
  return timer > 0
    ? { ...still, timers: { ...still.timers, mode: timer } }
    : enter(still, s, 'stalk', STALK_FRAMES);
}

/**
 * Two lava waves along the floor, one each way. You jump them; they are the reason
 * the arena has anything to stand on.
 * @param {Readonly<Entity>} e @param {Readonly<GameState>} s @param {number} nextId
 * @returns {Entity[]}
 */
function waves(e, s, nextId) {
  const y = e.y + e.h - TILE / 2;
  return [
    makeBolt(nextId, e.roomId, e.x, y, -STOKER_WAVE_SPEED, 0),
    makeBolt(nextId + 1, e.roomId, e.x + e.w, y, STOKER_WAVE_SPEED, 0),
  ];
}
