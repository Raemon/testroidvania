/**
 * The bot's half of the Pin. A route waypoint may carry an action —
 * `throw:ur`, `recall`, `jab:r`, `wait:20` — and the servo runs it to completion
 * standing on that waypoint before moving on.
 *
 * Actions exist because the Pin's outcome depends on *where you stand*, which is
 * exactly the lesson `o5_ladder` teaches. So the throw action first settles: it
 * refuses to press the button until the bot is grounded, still, and within 3px of
 * the waypoint. A bot that throws while drifting is a bot that reproduces the
 * player's mistake rather than the room's solution.
 */

import { IN } from '../core/input.js';
import { JAB_TOTAL } from '../core/jab.js';

/** @typedef {import('./api.js').Observation} Observation */

/** How close, in world units, the bot must be before it will throw. */
const SETTLE_X = 3;
/** Ceiling on any one action, so a bot that cannot finish one says so. */
const ACTION_BUDGET = 120;

/** @type {Record<string, number>} */
const AIM = {
  r: IN.RIGHT,
  l: IN.LEFT,
  u: IN.UP,
  d: IN.DOWN,
  ur: IN.UP | IN.RIGHT,
  ul: IN.UP | IN.LEFT,
  dr: IN.DOWN | IN.RIGHT,
  dl: IN.DOWN | IN.LEFT,
};

/** @param {string} action @returns {boolean} */
export function isKnownAction(action) {
  const [verb = '', arg = ''] = action.split(':');
  if (verb === 'throw' || verb === 'jab') return Object.hasOwn(AIM, arg);
  if (verb === 'recall') return true;
  if (verb === 'wait') return Number.isInteger(Number(arg)) && Number(arg) > 0;
  return false;
}

/**
 * @typedef {object} ActionState
 * @property {number} phase
 * @property {number} frames
 */

/**
 * @param {string} action
 * @param {Observation} obs
 * @param {number} targetX  world x of the waypoint the action belongs to
 * @param {ActionState} st
 * @returns {{input:number, st:ActionState, done:boolean, failed:string}}
 */
export function runAction(action, obs, targetX, st) {
  const next = { phase: st.phase, frames: st.frames + 1 };
  if (next.frames > ACTION_BUDGET) {
    return { input: 0, st: next, done: false, failed: `action '${action}' never finished (${next.frames} frames, pin is ${obs.pin.state})` };
  }
  const [verb = '', arg = ''] = action.split(':');
  const bits = AIM[arg] ?? 0;

  if (verb === 'wait') {
    return { input: 0, st: next, done: next.frames >= Number(arg), failed: '' };
  }

  if (verb === 'jab') {
    if (next.phase === 0) {
      const settle = settleInput(obs, targetX);
      if (settle !== null) return { input: settle, st: next, done: false, failed: '' };
      return { input: bits | IN.ATTACK, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
    }
    return { input: 0, st: next, done: obs.player.jabFrames === 0 && next.frames > JAB_TOTAL, failed: '' };
  }

  if (verb === 'recall') {
    // Already in hand (the Pin was walked over on the way here) is success, not a
    // second throw: recall means "get it back", and it is back.
    if (obs.pin.state === 'held') return { input: 0, st: next, done: true, failed: '' };
    if (next.phase === 0) {
      return { input: IN.THROW, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
    }
    return { input: 0, st: next, done: obs.pin.state === 'held', failed: '' };
  }

  // throw
  if (next.phase === 0) {
    const settle = settleInput(obs, targetX);
    if (settle !== null) return { input: settle, st: next, done: false, failed: '' };
    return { input: bits | IN.THROW, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  }
  const landed = obs.pin.state === 'embedded' || obs.pin.state === 'pinned' || obs.pin.state === 'dropped';
  return { input: 0, st: next, done: landed, failed: '' };
}

/**
 * @param {Observation} obs
 * @param {number} targetX
 * @returns {number|null} input bits while still settling, or null when ready
 */
function settleInput(obs, targetX) {
  const p = obs.player;
  if (!p.grounded) return 0;
  const dx = targetX - p.cx;
  if (Math.abs(dx) > SETTLE_X) return dx > 0 ? IN.RIGHT : IN.LEFT;
  return p.vx === 0 ? null : 0;
}
