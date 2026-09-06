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

/** @typedef {import('./api.js').Observation} Observation */

/** How close, in world units, counts as having reached a waypoint. */
const ARRIVE_X = 7;
const ARRIVE_Y = 14;
/** Frames of no quantized movement before the servo calls itself stuck. */
const STUCK_FRAMES = 45;
const WIGGLE_FRAMES = 20;

/**
 * @typedef {object} ServoMemory
 * @property {number} wp        index into the room's route
 * @property {string} room      the room the index belongs to
 * @property {number} lastX     quantized position, for the stuck detector
 * @property {number} lastY
 * @property {number} still     frames without quantized movement
 * @property {number} wiggle    frames left of the unstick manoeuvre
 * @property {boolean} stuck    the wiggle did not help; escalate
 */

/** @returns {ServoMemory} */
export function createServo() {
  return { wp: 0, room: '', lastX: NaN, lastY: NaN, still: 0, wiggle: 0, stuck: false };
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

  const p = obs.player;
  const goal = route[Math.min(next.wp, route.length - 1)] ?? [0, 0];
  const targetX = goal[0] * TILE + TILE / 2;
  const targetFootY = (goal[1] + 1) * TILE;

  if (Math.abs(p.cx - targetX) <= ARRIVE_X && Math.abs(p.footY - targetFootY) <= ARRIVE_Y) {
    if (next.wp >= route.length - 1) return { input: 0, mem: next, done: true };
    next.wp++;
    return { input: 0, mem: next, done: false };
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
    next.stuck = mem.wiggle > 0;
  }

  const dir = p.cx < targetX ? 1 : -1;
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
  if (!p.grounded) return p.vy < 0 && p.footY > targetFootY + 4;
  if (obs.solidAt(aheadTile, footTile) || obs.solidAt(aheadTile, headTile)) return true;

  // The next waypoint is above us, and within the 56px a full jump buys.
  if (targetFootY < p.footY - 8 && p.footY - targetFootY <= 56) return true;

  // The floor runs out ahead and the goal is on the far side of the gap.
  const groundTile = Math.floor(p.footY / TILE);
  const edgeTile = Math.floor((p.cx + dir * (TILE * 1.25)) / TILE);
  const floorGone = !obs.solidAt(edgeTile, groundTile) && !obs.oneWayAt(edgeTile, groundTile);
  return floorGone && targetFootY <= p.footY + 8;
}
