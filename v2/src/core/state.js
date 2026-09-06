/**
 * Construction of a fresh GameState. Everything a run needs is in here — there is
 * no hidden module state anywhere in `src/core`, which is what makes
 * snapshot/restore and cross-environment replay work.
 */

import { toSeed } from './rng.js';
import { createPlayer } from './player.js';
import { createPin } from './pin.js';
import { getRoom, standOn } from './rooms.js';
import { spawnFor } from './combat.js';
import { computeLights } from './light.js';
import { START } from '../content/world.js';
import { PLAYER_W, PLAYER_H, PIN_HAND_OFFSET } from './constants.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Room} Room */

export { createPin };

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
  doors: [], hazards: [], spawns: [], pickups: [], lanterns: [], route: [], macro: null,
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

  const player = createPlayer(pos.x, pos.y);
  /** @type {GameState} */
  const state = {
    tick: 0,
    rng: toSeed(seed),
    seed,
    input: 0,
    prevInput: 0,
    room: room.id,
    roomData: room,
    player,
    pin: { ...createPin(), x: pos.x + PLAYER_W / 2, y: pos.y + PIN_HAND_OFFSET },
    entities: spawnFor(room),
    nextEntityId: 1,
    progress: createProgress(),
    events: [],
    lights: [],
    discovered: {},
    brokenTiles: [],
    hitstop: 0,
    flash: 0,
    shake: 0,
    respawn: { room: room.id, x: pos.x, y: pos.y },
    liveness: { fingerprint: 0, sameFor: 0, inputFramesInWindow: 0 },
    errors: [],
    debug: false,
  };
  return { ...state, lights: computeLights(state) };
}
