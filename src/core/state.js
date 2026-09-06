/**
 * Construction of a fresh GameState. Everything a run needs is in here — there is
 * no hidden module state anywhere in `src/core`, which is what makes
 * snapshot/restore and cross-environment replay work.
 */

import { toSeed } from './rng.js';
import { createPlayer } from './player.js';
import { getRoom, standOn } from './rooms.js';
import { START } from '../content/world.js';
import { PLAYER_W, PLAYER_H } from './constants.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Room} Room */

/** @returns {import('./types.js').Pin} */
export function createPin() {
  return { state: 'held', x: 0, y: 0, vx: 0, vy: 0, travelled: 0, surface: null, dirX: 1, dirY: 0, hostId: null };
}

/** @returns {import('./types.js').Progress} */
export function createProgress() {
  return { abilities: [], bossesKilled: [], pickupsTaken: [], lanternsLit: [], flags: {}, deaths: 0 };
}

/**
 * The empty room stands in when a world id names a room that does not exist. It
 * is a sealed 1x1 box, so the sim stays total instead of crashing on bad content.
 * @type {Room}
 */
const VOID_ROOM = {
  id: '__void__', w: 3, h: 3, grid: ['###', '#.#', '###'],
  doors: [], hazards: [], spawns: [], pickups: [], route: [], macro: null,
};

/**
 * @param {number} seed
 * @param {string} [worldId] room to start in; defaults to the world's start room
 * @returns {GameState}
 */
export function createInitialState(seed, worldId) {
  const roomId = worldId ?? START.room;
  const room = getRoom(roomId) ?? VOID_ROOM;
  // A run that starts anywhere but the world's start room (a room test, the
  // fuzzer) begins at that room's first servo waypoint, which content validation
  // has already proved is a standable tile.
  const at = roomId === START.room
    ? START.at
    : room.route[0] ?? /** @type {[number,number]} */ ([1, room.h - 2]);
  const pos = standOn(at[0], at[1], PLAYER_W, PLAYER_H);

  return {
    tick: 0,
    rng: toSeed(seed),
    seed,
    input: 0,
    prevInput: 0,
    room: room.id,
    roomData: room,
    player: createPlayer(pos.x, pos.y),
    pin: createPin(),
    entities: [],
    nextEntityId: 1,
    progress: createProgress(),
    liveness: { fingerprint: 0, sameFor: 0, inputFramesInWindow: 0 },
    errors: [],
    debug: false,
  };
}
