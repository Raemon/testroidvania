/**
 * The bot's half of the Pin and the ability ladder. A route waypoint may carry an
 * action — `throw:ur`, `recall`, `jab:r`, `climb:ur`, `wait:20`, `fight` — and the
 * servo runs it to completion standing on that waypoint before moving on.
 *
 * Actions exist because the Pin's outcome depends on *where you stand*, which is
 * exactly the lesson `o5_ladder` teaches. So the throw action first settles: it
 * refuses to press the button until the bot is grounded, still, and within 3px of
 * the waypoint. A bot that throws while drifting is a bot that reproduces the
 * player's mistake rather than the room's solution.
 *
 * `climb` is one action rather than three because a Zip climb leaves the body
 * hanging off a wall halfway through, and a waypoint the bot is hanging ten tiles
 * above is a waypoint it can never be said to have arrived at.
 */

import { IN } from '../core/input.js';
import { JAB_TOTAL } from '../core/jab.js';
import { policyFor } from './policies/index.js';

/** @typedef {import('./api.js').Observation} Observation */

/** How close, in world units, the bot must be before it will throw. */
const SETTLE_X = 3;
/** Ceiling on one action. `climb` flies twice, and a boss fight is a boss fight. */
/** @type {Record<string, number>} */
const BUDGETS = { chain: 240, climb: 240, fight: 6000, mantle: 180, ride: 600, wait: 600, zip: 180 };
const DEFAULT_BUDGET = 120;

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
  if (verb === 'throw' || verb === 'jab' || verb === 'climb' || verb === 'chain') return Object.hasOwn(AIM, arg);
  if (verb === 'recall' || verb === 'zip' || verb === 'kick' || verb === 'fight' || verb === 'mantle') return true;
  if (verb === 'ride') return Number.isInteger(Number(arg));
  if (verb === 'wait') return Number.isInteger(Number(arg)) && Number(arg) > 0;
  return false;
}

/**
 * @typedef {object} ActionState
 * @property {number} phase
 * @property {number} frames
 */

/** @typedef {{input:number, st:ActionState, done:boolean, failed:string}} ActionResult */

/**
 * @param {string} action
 * @param {Observation} obs
 * @param {number} targetX  world x of the waypoint the action belongs to
 * @param {ActionState} st
 * @returns {ActionResult}
 */
export function runAction(action, obs, targetX, st) {
  const next = { phase: st.phase, frames: st.frames + 1 };
  const [verb = '', arg = ''] = action.split(':');
  const budget = BUDGETS[verb] ?? DEFAULT_BUDGET;
  if (next.frames > budget) {
    return { input: 0, st: next, done: false, failed: `action '${action}' never finished (${next.frames} frames, pin is ${obs.pin.state})` };
  }
  const bits = AIM[arg] ?? 0;

  if (verb === 'wait') return { input: 0, st: next, done: next.frames >= Number(arg), failed: '' };
  if (verb === 'jab') return jab(obs, targetX, next, bits);
  if (verb === 'recall') return recall(obs, next);
  if (verb === 'zip') return zip(obs, next);
  if (verb === 'kick') return kick(obs, next);
  if (verb === 'climb') return climb(obs, targetX, next, bits);
  if (verb === 'chain') return chain(obs, targetX, next, bits);
  if (verb === 'mantle') return mantle(obs, next);
  if (verb === 'ride') return ride(obs, next, Number(arg));
  if (verb === 'fight') return fight(obs, next);
  return throwPin(obs, targetX, next, bits);
}

/** @param {Observation} obs @param {number} targetX @param {ActionState} next @param {number} bits @returns {ActionResult} */
function jab(obs, targetX, next, bits) {
  if (next.phase === 0) {
    const settle = settleInput(obs, targetX);
    if (settle !== null) return { input: settle, st: next, done: false, failed: '' };
    return { input: bits | IN.ATTACK, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  }
  return { input: 0, st: next, done: obs.player.jabFrames === 0 && next.frames > JAB_TOTAL, failed: '' };
}

/**
 * Get the Pin back — both of them, once Twin Pin exists, since Recall is unmasked
 * and every Pin answers it. Pulsed rather than held because a Pin caught mid-pulse
 * would otherwise be thrown straight back out by the next frame's press.
 * @param {Observation} obs @param {ActionState} next @returns {ActionResult}
 */
function recall(obs, next) {
  if (obs.pin.state === 'held' && obs.pinB.state === 'held') return { input: 0, st: next, done: true, failed: '' };
  return { input: next.frames % 6 === 1 ? IN.RECALL : 0, st: next, done: false, failed: '' };
}

/** @param {Observation} obs @param {number} targetX @param {ActionState} next @param {number} bits @returns {ActionResult} */
function throwPin(obs, targetX, next, bits) {
  if (next.phase === 0) {
    const settle = settleInput(obs, targetX);
    if (settle !== null) return { input: settle, st: next, done: false, failed: '' };
    return { input: bits | IN.THROW, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  }
  const landed = obs.pin.state === 'embedded' || obs.pin.state === 'pinned' || obs.pin.state === 'dropped';
  return { input: 0, st: next, done: landed, failed: '' };
}

/**
 * Fly to the Pin. Nothing is held during the flight: any Jump would cancel the zip,
 * and the cancel is a move the bot only makes when a route asks for it.
 * @param {Observation} obs @param {ActionState} next @returns {ActionResult}
 */
function zip(obs, next) {
  if (next.phase === 0) {
    if (obs.pin.state !== 'embedded' && obs.pin.state !== 'pinned') {
      return { input: 0, st: next, done: false, failed: `zip with the Pin ${obs.pin.state}` };
    }
    return { input: IN.ZIP, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  }
  if (next.phase === 1 && obs.player.zipFrames > 0) return { input: 0, st: { phase: 2, frames: next.frames }, done: false, failed: '' };
  if (next.phase === 1) return { input: IN.ZIP, st: next, done: false, failed: '' };
  return { input: 0, st: next, done: obs.player.zipFrames === 0, failed: '' };
}

/**
 * Jump *away* from the wall, which is what makes it a kick rather than a mantle.
 * The direction is not decoration: a bare Jump from a Hang now climbs onto the
 * shelf instead (06-revision-1 §D1, as amended by the first playtest).
 * @param {Observation} obs @returns {number}
 */
function awayBit(obs) {
  return obs.pin.nx > 0 ? IN.RIGHT : IN.LEFT;
}

/** @param {Observation} obs @param {ActionState} next @returns {ActionResult} */
function kick(obs, next) {
  const p = obs.player;
  if (!p.hang && !p.hangBelow) return { input: 0, st: next, done: next.phase > 0, failed: '' };
  if (next.phase === 0) return { input: IN.JUMP | awayBit(obs), st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  return { input: 0, st: next, done: false, failed: '' };
}

/**
 * Throw, fly to it, kick off it: the Zip climb, as one indivisible move. Phases are
 * 0 throw, 1 wait for the embed, 2 press Zip, 3 ride it, 4 kick off the wall.
 * @param {Observation} obs @param {number} targetX @param {ActionState} next @param {number} bits
 * @returns {ActionResult}
 */
function climb(obs, targetX, next, bits) {
  const p = obs.player;
  if (next.phase === 0) {
    const settle = settleInput(obs, targetX);
    if (settle !== null) return { input: settle, st: next, done: false, failed: '' };
    return { input: bits | IN.THROW, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  }
  if (next.phase === 1) {
    if (obs.pin.state === 'dropped') return { input: 0, st: next, done: false, failed: 'the climb throw found nothing to bite' };
    if (obs.pin.state !== 'embedded') return { input: 0, st: next, done: false, failed: '' };
    return { input: IN.ZIP, st: { phase: 2, frames: next.frames }, done: false, failed: '' };
  }
  if (next.phase === 2) {
    if (p.zipFrames === 0) return { input: IN.ZIP, st: next, done: false, failed: '' };
    return { input: 0, st: { phase: 3, frames: next.frames }, done: false, failed: '' };
  }
  if (next.phase === 3) {
    if (p.zipFrames > 0) return { input: 0, st: next, done: false, failed: '' };
    if (!p.hang && !p.hangBelow) return { input: 0, st: next, done: true, failed: '' };
    return { input: IN.JUMP | (p.hang ? awayBit(obs) : 0), st: { phase: 4, frames: next.frames }, done: false, failed: '' };
  }
  return { input: 0, st: next, done: !p.hang && !p.hangBelow, failed: '' };
}

/**
 * One link of a chain-zip: throw, wait for the bite, zip, ride, and stop — hanging
 * off whatever you just hit, which is where the next link starts.
 *
 * Deliberately *not* `climb`: `climb` ends by kicking off the wall, and a kick is
 * the wrong end for a link in the middle of a void. Phases are 0 throw, 1 wait for
 * the embed, 2 press Zip, 3 ride it.
 * @param {Observation} obs @param {number} targetX @param {ActionState} next @param {number} bits
 * @returns {ActionResult}
 */
function chain(obs, targetX, next, bits) {
  const p = obs.player;
  if (next.phase === 0) {
    const settle = settleInput(obs, targetX);
    if (settle !== null) return { input: settle, st: next, done: false, failed: '' };
    return { input: bits | IN.THROW, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  }
  if (next.phase === 1) {
    if (obs.pin.state === 'dropped') return { input: 0, st: next, done: false, failed: 'the chain throw found nothing to bite' };
    if (obs.pin.state !== 'embedded') return { input: 0, st: next, done: false, failed: '' };
    return { input: IN.ZIP, st: { phase: 2, frames: next.frames }, done: false, failed: '' };
  }
  if (next.phase === 2) {
    if (p.zipFrames === 0) return { input: IN.ZIP, st: next, done: false, failed: '' };
    return { input: 0, st: { phase: 3, frames: next.frames }, done: false, failed: '' };
  }
  return { input: 0, st: next, done: p.zipFrames === 0, failed: '' };
}

/**
 * Climb onto the shelf you are hanging from. Jump with no direction held is the
 * mantle; holding one would be the wall-kick, which is a way back down.
 * @param {Observation} obs @param {ActionState} next @returns {ActionResult}
 */
function mantle(obs, next) {
  const p = obs.player;
  if (next.phase === 0) {
    if (!p.hang) return { input: 0, st: next, done: false, failed: '' };
    return { input: IN.JUMP, st: { phase: 1, frames: next.frames }, done: false, failed: '' };
  }
  return { input: 0, st: next, done: p.perch || (p.grounded && !p.hang), failed: '' };
}

/**
 * Stand still on a rail until it has carried you to the tile you asked for. Holding
 * a direction on a moving platform is how a bot walks off the front of it.
 * @param {Observation} obs @param {ActionState} next @param {number} tx
 * @returns {ActionResult}
 */
function ride(obs, next, tx) {
  const target = tx * 16 + 8;
  const aboard = obs.props.some((pr) => (
    Math.abs(obs.player.footY - pr.y) <= 1 && obs.player.x < pr.x + pr.w && obs.player.x + 12 > pr.x
  ));
  if (!aboard && next.phase === 0) return { input: 0, st: next, done: false, failed: '' };
  return { input: 0, st: { phase: 1, frames: next.frames }, done: Math.abs(obs.player.cx - target) <= 14, failed: '' };
}

/**
 * Hand the bot to this boss's policy until the boss is dead. The policy is reactive
 * — it reads the phase it is looking at — so it keeps working when the boss changes.
 * @param {Observation} obs @param {ActionState} next @returns {ActionResult}
 */
function fight(obs, next) {
  if (!obs.boss) return { input: 0, st: next, done: true, failed: '' };
  const policy = policyFor(obs);
  if (!policy) return { input: 0, st: next, done: false, failed: `no policy for boss '${obs.boss.id}'` };
  return { input: policy(obs), st: next, done: false, failed: '' };
}

/**
 * @param {Observation} obs
 * @param {number} targetX
 * @returns {number|null} input bits while still settling, or null when ready
 */
function settleInput(obs, targetX) {
  const p = obs.player;
  // A body hanging off a Pin or perched on one is as settled as a body gets: it
  // cannot move horizontally at all, so waiting for it to be grounded waits forever.
  if (p.hang || p.hangBelow || p.perch) return null;
  if (!p.grounded) return 0;
  const dx = targetX - p.cx;
  if (Math.abs(dx) > SETTLE_X) return dx > 0 ? IN.RIGHT : IN.LEFT;
  return p.vx === 0 ? null : 0;
}
