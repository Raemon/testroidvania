/**
 * Layer 1 of the autopilot (04-architecture §4): a reactive controller, not a
 * planner. It walks the room's `hints.route` waypoint by waypoint, probing the
 * tilemap one tile ahead at foot and head height and jumping when it is blocked,
 * when the floor runs out, or when the next waypoint is above it.
 *
 * It is deliberately cheap and deliberately fallible. When it gets stuck it says
 * so (`stuck`), and the caller escalates to Layer 2 rather than this file growing
 * a pathfinder.
 */

import { TILE } from '../core/constants.js';
import { IN } from '../core/input.js';
import { runAction } from './actions.js';
import { policyFor } from './policies/index.js';

/** @typedef {import('./api.js').Observation} Observation */

/** How close, in world units, counts as having reached a waypoint. */
const ARRIVE_X = 7;
const ARRIVE_Y = 14;
/** Frames of no quantized movement before the servo calls itself stuck. */
const STUCK_FRAMES = 45;
const WIGGLE_FRAMES = 20;
/**
 * Hard per-room budget. Even a servo that is technically still moving must give up
 * eventually: a bot that can loop forever is exactly the overnight failure the
 * softlock invariant exists to prevent, and silence is worse than a red test.
 */
export const ROOM_FRAME_BUDGET = 1800;
/** A boss room is a fight, not a walk, so it gets its own budget. */
export const BOSS_ROOM_FRAME_BUDGET = 7200;

/** @param {Observation} obs @param {ServoMemory} mem @returns {number} */
export function roomBudget(obs, mem) {
  return obs.boss || mem.sawBoss ? BOSS_ROOM_FRAME_BUDGET : ROOM_FRAME_BUDGET;
}

/**
 * @typedef {object} ServoMemory
 * @property {number} wp        index into the room's route
 * @property {string} room      the room the index belongs to
 * @property {number} lastX     quantized position, for the stuck detector
 * @property {number} lastY
 * @property {number} still     frames without quantized movement
 * @property {number} wiggle    frames left of the unstick manoeuvre
 * @property {number} frames    frames spent in this room
 * @property {boolean} stuck    give up: the wiggle did not help, or the budget ran out
 * @property {string} why       why it gave up, for the failure message
 * @property {boolean} sawBoss a boss has stood in this room; the budget stays a
 *   fight's budget afterwards, because the fight already spent the walking one
 * @property {string} act       the waypoint action being performed, '' when none
 * @property {{phase:number, frames:number}} actState
 */

/** @returns {ServoMemory} */
export function createServo() {
  return {
    wp: 0, room: '', lastX: NaN, lastY: NaN, still: 0, wiggle: 0, frames: 0,
    stuck: false, why: '', sawBoss: false, act: '', actState: { phase: 0, frames: 0 },
  };
}

/**
 * @param {Observation} obs
 * @param {ServoMemory} mem
 * @returns {{ input: number, mem: ServoMemory, done: boolean }}
 */
export function servo(obs, mem) {
  const next = mem.room === obs.room ? { ...mem } : { ...createServo(), room: obs.room };
  const route = obs.route;
  if (route.length === 0) return { input: 0, mem: next, done: true };

  next.frames++;
  if (obs.boss) next.sawBoss = true;
  const budget = roomBudget(obs, next);
  if (next.frames > budget) {
    next.stuck = true;
    next.why = `spent ${next.frames} frames in ${obs.room} without finishing its route (budget ${budget})`;
    return { input: 0, mem: next, done: false };
  }

  const p = obs.player;
  const goal = route[Math.min(next.wp, route.length - 1)] ?? [0, 0];
  const targetX = goal[0] * TILE + TILE / 2;
  const targetFootY = (goal[1] + 1) * TILE;

  // An action owns the bot completely until it finishes: the whole point of
  // `throw` is that it happens from one exact spot.
  if (next.act) {
    const result = runAction(next.act, obs, targetX, next.actState);
    next.actState = result.st;
    if (result.failed) {
      next.stuck = true;
      next.why = `${obs.room}: ${result.failed}`;
      return { input: 0, mem: next, done: false };
    }
    if (!result.done) return { input: result.input, mem: next, done: false };
    next.act = '';
    next.still = 0;
    if (next.wp >= route.length - 1) return { input: 0, mem: next, done: true };
    next.wp++;
    return { input: 0, mem: next, done: false };
  }

  if (Math.abs(p.cx - targetX) <= ARRIVE_X && Math.abs(p.footY - targetFootY) <= ARRIVE_Y) {
    const action = goal[2];
    if (action) {
      next.act = action;
      next.actState = { phase: 0, frames: 0 };
      return { input: 0, mem: next, done: false };
    }
    if (next.wp >= route.length - 1) return { input: 0, mem: next, done: true };
    next.wp++;
    return { input: 0, mem: next, done: false };
  }

  const dir = p.cx < targetX ? 1 : -1;

  // Perched on a Pin's shelf, with somewhere else to be. Perch ignores horizontal
  // input by design (§D1.1), so the only way off it is Jump or Down — and a bot
  // that presses neither stands on a 16px shelf until its budget runs out.
  if (p.perch && Math.abs(p.cx - targetX) > ARRIVE_X) {
    next.still = 0;
    return { input: (dir > 0 ? IN.RIGHT : IN.LEFT) | (obs.tick % 4 === 0 ? IN.JUMP : 0), mem: next, done: false };
  }

  // Hanging off the Pin with the route still above us: **mantle**. Jump with no
  // direction climbs onto the shelf; Jump with one is the wall-kick, which is a
  // way back down from a ledge the bot was trying to get onto. Pulsed, because
  // Jump is edge-triggered and a held button is not a press.
  if (p.hang) {
    next.still = 0;
    const up = targetFootY < p.footY;
    const pulse = obs.tick % 4 === 0;
    return { input: pulse ? (up ? IN.JUMP : IN.DOWN) : 0, mem: next, done: false };
  }

  // A living boss owns the room: nothing about a route is true while it is up.
  const policy = policyFor(obs);
  if (policy) {
    next.still = 0;
    return { input: policy(obs), mem: next, done: false };
  }

  const qx = Math.round(p.x / 4);
  const qy = Math.round(p.y / 4);
  if (qx === next.lastX && qy === next.lastY) next.still++;
  else next.still = 0;
  next.lastX = qx;
  next.lastY = qy;

  if (next.still >= STUCK_FRAMES && next.wiggle === 0) {
    next.wiggle = WIGGLE_FRAMES;
    next.still = 0;
    if (mem.wiggle > 0) {
      next.stuck = true;
      next.why = `stuck at waypoint ${next.wp} of ${route.length} in ${obs.room}, at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}); the wiggle did not help`;
    }
  }

  let input = 0;
  if (next.wiggle > 0) {
    next.wiggle--;
    // Back off the way we came and hold jump; that clears a lip or a ledge grab.
    return { input: (dir > 0 ? IN.LEFT : IN.RIGHT) | IN.JUMP, mem: next, done: false };
  }

  if (Math.abs(p.cx - targetX) > 2) input |= dir > 0 ? IN.RIGHT : IN.LEFT;

  if (wantsJump(obs, dir, targetFootY)) input |= IN.JUMP;
  return { input, mem: next, done: false };
}

/**
 * @param {Observation} obs
 * @param {-1|1|number} dir
 * @param {number} targetFootY
 * @returns {boolean}
 */
function wantsJump(obs, dir, targetFootY) {
  const p = obs.player;
  const footTile = Math.floor((p.footY - 1) / TILE);
  const headTile = Math.floor(p.y / TILE);
  const aheadTile = Math.floor((p.cx + dir * (TILE * 0.75)) / TILE);

  // Still rising toward something higher than us: keep the button down so the
  // jump-cut does not fire and rob us of the last 30px of height.
  if (!p.grounded) {
    if (p.vy >= 0) return false;
    // Hold past the waypoint's own height, not up to it. Releasing at +4 spends
    // the jump-cut while still rising, which costs more than half the remaining
    // arc — and the rooms that are one pixel of lip away from a landing are
    // exactly the ones that teach something.
    if (p.footY > targetFootY - 12) return true;
    // Or still under the lip of the thing we jumped at. Releasing here is how a
    // bot ends up bouncing off the same 2-tile block forever.
    return obs.solidAt(aheadTile, Math.floor((p.footY - 1) / TILE));
  }
  if (obs.solidAt(aheadTile, footTile) || obs.solidAt(aheadTile, headTile)) return true;

  // The next waypoint is above us, and within the 56px a full jump buys.
  if (targetFootY < p.footY - 8 && p.footY - targetFootY <= 56) return true;

  // The floor runs out ahead and the goal is on the far side of the gap.
  const groundTile = Math.floor(p.footY / TILE);
  const edgeTile = Math.floor((p.cx + dir * (TILE * 1.25)) / TILE);
  const floorGone = !obs.solidAt(edgeTile, groundTile) && !obs.oneWayAt(edgeTile, groundTile);
  return floorGone && targetFootY <= p.footY + 8;
}
