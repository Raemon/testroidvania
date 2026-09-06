/**
 * Node-side sim runners shared by the determinism, rooms and playthrough tests.
 * Nothing here touches the DOM, so these run under the determinism trap.
 */

import { createInitialState } from '../../src/core/state.js';
import { step } from '../../src/core/step.js';
import { hash } from '../../src/core/hash.js';
import { check, formatViolation } from '../../src/core/invariants.js';
import { observe } from '../../src/bot/api.js';
import { createServo, servo } from '../../src/bot/servo.js';

/** @typedef {import('../../src/core/types.js').GameState} GameState */

/**
 * @param {number} seed
 * @param {string} [room]
 * @returns {GameState}
 */
export function newRun(seed, room) {
  return { ...createInitialState(seed, room), debug: true };
}

/**
 * Drive a run with the servo until it finishes the room's route, it gets stuck, or
 * the frame budget runs out. Invariants are checked every frame.
 *
 * @param {GameState} start
 * @param {object} [options]
 * @param {number} [options.maxFrames]
 * @param {(s: GameState) => boolean} [options.until] stop early when this is true
 * @returns {{ state: GameState, tape: number[], frames: number, done: boolean, stuck: boolean, violation: string|null }}
 */
export function runBot(start, options = {}) {
  const maxFrames = options.maxFrames ?? 2000;
  let state = start;
  let mem = createServo();
  /** @type {number[]} */
  const tape = [];
  let done = false;

  for (let f = 0; f < maxFrames; f++) {
    const result = servo(observe(state), mem);
    mem = result.mem;
    const prev = state;
    state = step(state, result.input);
    tape.push(result.input);

    const violations = check(prev, state, result.input);
    if (violations.length) {
      const v = violations[0];
      return { state, tape, frames: tape.length, done: false, stuck: mem.stuck, violation: v ? formatViolation(v) : 'unknown' };
    }
    if (mem.stuck) return { state, tape, frames: tape.length, done: false, stuck: true, violation: null };
    if (options.until?.(state)) return { state, tape, frames: tape.length, done: true, stuck: false, violation: null };
    if (result.done) {
      done = true;
      break;
    }
  }
  return { state, tape, frames: tape.length, done, stuck: false, violation: null };
}

/**
 * Replay a recorded tape. This is the Node half of the cross-environment hash
 * assertion, so it must do nothing the browser does not also do.
 * @param {GameState} start
 * @param {ArrayLike<number>} tape
 * @returns {GameState}
 */
export function replay(start, tape) {
  let state = start;
  for (let i = 0; i < tape.length; i++) state = step(state, tape[i] ?? 0);
  return state;
}

/**
 * @param {GameState} start
 * @param {ArrayLike<number>} tape
 * @param {number} every
 * @returns {{ final: string, checkpoints: string[] }}
 */
export function replayWithCheckpoints(start, tape, every) {
  let state = start;
  /** @type {string[]} */
  const checkpoints = [];
  for (let i = 0; i < tape.length; i++) {
    state = step(state, tape[i] ?? 0);
    if ((i + 1) % every === 0) checkpoints.push(hash(state));
  }
  return { final: hash(state), checkpoints };
}
