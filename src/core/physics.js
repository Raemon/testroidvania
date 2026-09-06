/**
 * One frame of player motion: velocity integration plus the input-forgiveness
 * rules, then a single call into the collision sweep. Implements 03-game-feel
 * §1.1 exactly; every number it uses lives in constants.js.
 *
 * Frame order (fixed, and the reason replays reproduce):
 *   timers -> horizontal -> drop-through -> jump -> gravity -> jump-cut ->
 *   terminal clamp -> collision -> post-move bookkeeping.
 */

import {
  RUN_MAX, GROUND_ACCEL, GROUND_FRICTION, TURNAROUND_MULT, AIR_ACCEL, AIR_DRAG,
  JUMP_VY, GRAVITY_RISE, GRAVITY_FALL, APEX_HANG_VY, APEX_HANG_MULT,
  TERMINAL_VY, FASTFALL_TERMINAL_VY, FASTFALL_GRAVITY_MULT,
  JUMP_CUT_MULT, JUMP_CUT_MIN_FRAMES, COYOTE_FRAMES, JUMP_BUFFER_FRAMES,
  DROP_THROUGH_FRAMES,
} from './constants.js';
import { IN, axisX, isDown, justPressed } from './input.js';
import { moveBox, isSupported } from './collision.js';

/** @typedef {import('./types.js').Player} Player */
/** @typedef {import('./types.js').Room} Room */
/** @typedef {import('./types.js').InputMask} InputMask */

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * @param {number} vx
 * @param {number} ax  -1, 0 or 1
 * @param {boolean} grounded
 * @returns {number}
 */
export function accelerate(vx, ax, grounded) {
  if (ax === 0) {
    const decel = grounded ? GROUND_FRICTION : AIR_DRAG;
    return Math.abs(vx) <= decel ? 0 : vx - Math.sign(vx) * decel;
  }
  const base = grounded ? GROUND_ACCEL : AIR_ACCEL;
  const accel = base * (vx * ax < 0 ? TURNAROUND_MULT : 1);
  const next = vx + ax * accel;
  // Only the direction being pushed is capped, so an external impulse can still
  // carry the player above run speed until friction or drag eats it.
  return ax > 0 ? Math.min(next, Math.max(RUN_MAX, vx)) : Math.max(next, Math.min(-RUN_MAX, vx));
}

/**
 * @param {number} vy
 * @param {boolean} fastFalling
 * @returns {number} vy after one frame of gravity, terminal-clamped
 */
export function applyGravity(vy, fastFalling) {
  let g;
  if (fastFalling && vy >= 0) {
    g = GRAVITY_FALL * FASTFALL_GRAVITY_MULT;
  } else {
    g = vy < 0 ? GRAVITY_RISE : GRAVITY_FALL;
    if (Math.abs(vy) < APEX_HANG_VY) g *= APEX_HANG_MULT;
  }
  const terminal = fastFalling ? FASTFALL_TERMINAL_VY : TERMINAL_VY;
  return Math.min(vy + g, terminal);
}

/**
 * @param {Room} room
 * @param {Player} p
 * @param {InputMask} input
 * @param {InputMask} prevInput
 * @returns {Player} a fresh player object
 */
export function stepPlayerPhysics(room, p, input, prevInput) {
  const stunned = p.hurtFrames > 0;
  const ax = stunned ? 0 : axisX(input);
  const downHeld = isDown(input, IN.DOWN);
  const jumpHeld = isDown(input, IN.JUMP);
  const jumpPressed = justPressed(input, prevInput, IN.JUMP);

  let coyote = p.grounded ? COYOTE_FRAMES : Math.max(0, p.coyote - 1);
  let jumpBuffer = jumpPressed ? JUMP_BUFFER_FRAMES : Math.max(0, p.jumpBuffer - 1);
  let dropThrough = Math.max(0, p.dropThrough - 1);
  let jumpFrames = p.jumpFrames > 0 ? p.jumpFrames + 1 : 0;
  let jumpCut = p.jumpCut;

  let vx = accelerate(p.vx, ax, p.grounded);
  let vy = p.vy;

  // Down + jump on a one-way platform drops through instead of jumping.
  if (!stunned && p.grounded && p.onOneWay && downHeld && jumpBuffer > 0) {
    dropThrough = DROP_THROUGH_FRAMES;
    jumpBuffer = 0;
    coyote = 0;
  } else if (!stunned && jumpBuffer > 0 && coyote > 0) {
    vy = JUMP_VY;
    jumpBuffer = 0;
    coyote = 0;
    jumpFrames = 1;
    jumpCut = false;
  }

  const airborne = !p.grounded || vy < 0;
  const fastFalling = downHeld && airborne && dropThrough === 0;
  vy = applyGravity(vy, fastFalling);

  if (!jumpCut && jumpFrames >= JUMP_CUT_MIN_FRAMES && vy < 0 && !jumpHeld) {
    vy *= JUMP_CUT_MULT;
    jumpCut = true;
  }

  const moved = moveBox(room, { x: p.x, y: p.y, w: p.w, h: p.h }, vx, vy, dropThrough > 0);
  vx = moved.vx;
  vy = moved.vy;

  const box = { x: moved.x, y: moved.y, w: p.w, h: p.h };
  const grounded = moved.grounded || (vy >= 0 && isSupported(room, box) && dropThrough === 0);
  if (grounded) {
    jumpFrames = 0;
    jumpCut = false;
    coyote = COYOTE_FRAMES;
  }

  const facing = ax !== 0 ? /** @type {-1|1} */ (ax) : p.facing;
  const fallFrames = vy > 0 && !grounded ? p.fallFrames + 1 : 0;
  const safeGround = grounded ? { x: moved.x, y: moved.y } : p.safeGround;

  return {
    ...p,
    x: moved.x,
    y: moved.y,
    vx,
    vy,
    grounded,
    onOneWay: moved.onOneWay,
    facing,
    coyote,
    jumpBuffer,
    jumpFrames,
    jumpHeld,
    jumpCut,
    dropThrough,
    fallFrames,
    safeGround,
  };
}

export { clamp };
