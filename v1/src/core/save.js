/**
 * Snapshot / restore. `snapshot` produces a JSON string; `restore` rebuilds a
 * GameState from it. The verified property is `hash(restore(snapshot(s))) === hash(s)`,
 * checked in `determinism.test.js` and again every 1,000 frames by the invariants.
 *
 * `roomData` is deliberately *not* serialized: it is immutable compiled content,
 * so the snapshot stores only the room id and restore looks the room back up. That
 * keeps a save a few hundred bytes instead of a few tens of kilobytes, and it
 * means a content edit is visible to an old save rather than frozen inside it.
 */

import { getRoom } from '../content/rooms/index.js';
import { createInitialState } from './state.js';

/** @typedef {import('./types.js').GameState} GameState */

const SAVE_VERSION = 1;

/**
 * @param {Readonly<GameState>} state
 * @returns {string}
 */
export function snapshot(state) {
  const { roomData, ...rest } = state;
  return JSON.stringify({ v: SAVE_VERSION, state: rest });
}

/**
 * @param {string} json
 * @returns {GameState}
 * @throws {Error} on malformed input — callers are tests and the harness, both of
 *   which want the failure loud; `step()` never calls this
 */
export function restore(json) {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.v !== SAVE_VERSION) throw new Error(`save version ${parsed?.v} is not ${SAVE_VERSION}`);
  /** @type {GameState} */
  const saved = parsed.state;
  const room = getRoom(saved.room);
  if (!room) throw new Error(`save names unknown room '${saved.room}'`);
  const base = createInitialState(saved.seed, saved.room);
  return { ...base, ...saved, roomData: room };
}

/**
 * @param {Readonly<GameState>} state
 * @returns {GameState} a deep copy that shares only the immutable room data
 */
export function clone(state) {
  return restore(snapshot(state));
}
