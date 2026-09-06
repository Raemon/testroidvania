/**
 * Input sources. All three produce the same thing — one 16-bit mask per frame —
 * which is what lets the bot and a replay drive the *real* game loop with no
 * test-only code path anywhere in the game (04-architecture §4).
 */

import { IN } from '../core/input.js';
import { observe } from '../bot/api.js';
import { createServo, servo } from '../bot/servo.js';

/** @typedef {import('../core/types.js').GameState} GameState */

/**
 * @typedef {object} InputSource
 * @property {(state: Readonly<GameState>) => number} read  bits for the coming frame
 * @property {() => void} [dispose]
 */

/** @type {Record<string, number>} */
const KEYMAP = {
  ArrowLeft: IN.LEFT, KeyA: IN.LEFT,
  ArrowRight: IN.RIGHT, KeyD: IN.RIGHT,
  ArrowUp: IN.UP, KeyW: IN.UP,
  ArrowDown: IN.DOWN, KeyS: IN.DOWN,
  KeyZ: IN.JUMP, Space: IN.JUMP, KeyJ: IN.JUMP,
  KeyX: IN.ATTACK, KeyK: IN.ATTACK,
  KeyC: IN.THROW, KeyL: IN.THROW,
  KeyV: IN.ZIP,
  KeyB: IN.RECALL, ShiftLeft: IN.RECALL, ShiftRight: IN.RECALL, Semicolon: IN.RECALL,
  Escape: IN.PAUSE,
  Tab: IN.MAP,
};

/**
 * @param {Window & typeof globalThis} win
 * @returns {InputSource}
 */
export function keyboardSource(win) {
  let held = 0;
  /** @param {KeyboardEvent} e */
  const down = (e) => {
    const bit = KEYMAP[e.code];
    if (bit === undefined) return;
    held |= bit;
    e.preventDefault();
  };
  /** @param {KeyboardEvent} e */
  const up = (e) => {
    const bit = KEYMAP[e.code];
    if (bit === undefined) return;
    held &= ~bit;
    e.preventDefault();
  };
  const blur = () => { held = 0; };
  win.addEventListener('keydown', down);
  win.addEventListener('keyup', up);
  win.addEventListener('blur', blur);
  return {
    read: () => held,
    dispose() {
      win.removeEventListener('keydown', down);
      win.removeEventListener('keyup', up);
      win.removeEventListener('blur', blur);
    },
  };
}

/**
 * @returns {InputSource & { done: () => boolean, stuck: () => boolean }}
 */
export function botSource() {
  let mem = createServo();
  let done = false;
  return {
    read(state) {
      const result = servo(observe(state), mem);
      mem = result.mem;
      done = result.done;
      return result.input;
    },
    done: () => done,
    stuck: () => mem.stuck,
  };
}

/**
 * @param {ArrayLike<number>} tape
 * @returns {InputSource & { remaining: () => number }}
 */
export function replaySource(tape) {
  let i = 0;
  return {
    read: () => (i < tape.length ? (tape[i++] ?? 0) : 0),
    remaining: () => Math.max(0, tape.length - i),
  };
}

/**
 * A source the harness drives directly with `setInput`.
 * @returns {InputSource & { set: (bits: number) => void }}
 */
export function manualSource() {
  let bits = 0;
  return { read: () => bits, set: (b) => { bits = b; } };
}
