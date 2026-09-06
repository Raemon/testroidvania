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
  DROP_THROUGH_FRAMES, HANG_KICK_VX, HANG_KICK_VY, HANG_MANTLE_VY, HANG_COOLDOWN,
  STRIDE_LENGTH, TILE,
  WATER_JUMP_MULT, WATER_GRAVITY_MULT, WATER_TERMINAL_VY, WATER_DRAG,
  CURRENT_PUSH, WIND_ACCEL,
} from './constants.js';
import { IN, axisX, isDown, justPressed } from './input.js';
import { moveBox, isSupported, materialUnder, inWater, currentAt } from './collision.js';
import { emit } from './events.js';
import { grabbableHang, hangAnchor, perchCentre, stillHanging, stillHangingBelow } from './grip.js';

/** @typedef {import('./types.js').Player} Player */
/** @typedef {import('./types.js').Pin} Pin */
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
    if (Math.abs(vx) <= decel) return 0;
    const next = vx - Math.sign(vx) * decel;
    // Snap the float residue away: leaving 2e-16 on the clock would make "stopped"
    // a different state from "stopped", and every hash downstream would notice.
    return Math.abs(next) < 1e-6 ? 0 : next;
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
 * @param {Readonly<Pin>} pin the Pin the player can grip; grips only ever attach to
 *   `state.pin`, which A5 keeps as the most recently thrown of the two
 * @param {import('./types.js').SimEvent[]} events appended to; see events.js
 * @param {readonly import('./types.js').AABB[]} platforms every dynamic one-way
 *   surface this frame: both Pins' shelves and every rail
 * @returns {Player} a fresh player object
 */
export function stepPlayerPhysics(room, p, input, prevInput, pin, events, platforms) {
  const stunned = p.hurtFrames > 0;
  // Water is read once, at the body's centre, and then it changes four numbers:
  // the jump, the fall, the drag and the terminal speed (02 §2). Reading it once
  // is what keeps "am I swimming" from disagreeing with itself mid-frame.
  const swimming = inWater(room, p.x + p.w / 2, p.y + p.h / 2);
  const current = currentAt(room, p.x + p.w / 2, p.y + p.h / 2);
  const downHeld = isDown(input, IN.DOWN);
  const jumpHeld = isDown(input, IN.JUMP);
  const jumpPressed = justPressed(input, prevInput, IN.JUMP);
  const downPressed = justPressed(input, prevInput, IN.DOWN);
  const letGo = jumpPressed || downPressed;

  if (p.hang) {
    if (!stillHanging(p, pin)) return { ...p, hang: false, hangCooldown: HANG_COOLDOWN };
    if (!letGo) return { ...p, vx: 0, vy: 0, grounded: false, onOneWay: false, coyote: 0, fallFrames: 0 };
    // Jump *away* from the wall is the kick. Jump with nothing held — or held into
    // the wall — is a **mantle**: straight up, onto the shelf you are gripping.
    // A player holding a ledge who presses Jump means "up", and the version where
    // the only up was a backwards fling cost the test bot a whole room.
    const away = axisX(input) === Math.sign(pin.nx);
    const kick = jumpPressed && away;
    const mantle = jumpPressed && !away;
    if (kick) emit(events, 'wallkick', p.x + p.w / 2, p.y + p.h / 2, { material: pin.surface });
    if (mantle) emit(events, 'jump', p.x + p.w / 2, p.y + p.h, { material: pin.surface });
    return {
      ...p,
      hang: false,
      hangCooldown: HANG_COOLDOWN,
      vx: kick ? HANG_KICK_VX * pin.nx : 0,
      vy: kick ? HANG_KICK_VY : mantle ? HANG_MANTLE_VY : 0,
      facing: kick ? /** @type {-1|1} */ (pin.nx > 0 ? 1 : -1) : p.facing,
      jumpFrames: kick ? 1 : 0,
      // A mantle is a fixed 14px lift, not a jump: the variable-height cut would
      // eat more than half of it and leave the hands under the shelf.
      jumpCut: mantle,
      jumpBuffer: 0,
      coyote: 0,
    };
  }

  if (p.hangBelow) {
    // Under a ceiling pin, after a Zip. Jump and Down both just let go (01 §3).
    if (!stillHangingBelow(p, pin)) return { ...p, hangBelow: false, hangCooldown: HANG_COOLDOWN };
    if (!letGo) return { ...p, vx: 0, vy: 0, grounded: false, onOneWay: false, coyote: 0, fallFrames: 0 };
    return { ...p, hangBelow: false, hangCooldown: HANG_COOLDOWN, vx: 0, vy: 0, jumpBuffer: 0, coyote: 0 };
  }

  // Perch (§D1.1) holds you still on a 16x4 shelf until you ask to leave it.
  const perch = p.perch && !letGo;
  const ax = stunned || perch || p.throwFreeze > 0 ? 0 : axisX(input);

  let coyote = p.grounded ? COYOTE_FRAMES : Math.max(0, p.coyote - 1);
  let jumpBuffer = jumpPressed ? JUMP_BUFFER_FRAMES : Math.max(0, p.jumpBuffer - 1);
  let dropThrough = Math.max(0, p.dropThrough - 1);
  let jumpFrames = p.jumpFrames > 0 ? p.jumpFrames + 1 : 0;
  let jumpCut = p.jumpCut;

  let vx = p.throwFreeze > 0 ? 0 : accelerate(p.vx, ax, p.grounded);
  let vy = p.vy;

  // Down + jump on a one-way platform drops through instead of jumping.
  if (!stunned && p.grounded && p.onOneWay && downHeld && jumpBuffer > 0) {
    dropThrough = DROP_THROUGH_FRAMES;
    jumpBuffer = 0;
    coyote = 0;
  } else if (!stunned && jumpBuffer > 0 && coyote > 0) {
    emit(events, 'jump', p.x + p.w / 2, p.y + p.h, { material: materialUnder(room, p) });
    vy = swimming ? JUMP_VY * WATER_JUMP_MULT : JUMP_VY;
    jumpBuffer = 0;
    coyote = 0;
    jumpFrames = 1;
    jumpCut = false;
  }

  const airborne = !p.grounded || vy < 0;
  const fastFalling = downHeld && airborne && dropThrough === 0;
  if (swimming) {
    // Buoyancy is a weaker *gravity*, not a scaled velocity: scaling vy would eat
    // the jump impulse on the frame it is given and leave a stroke that barely
    // clears a step. You go up less and come down slower — a different move, not a
    // worse one, which is what makes water read as a medium rather than a penalty.
    const pull = applyGravity(vy, fastFalling) - vy;
    vy = Math.min(vy + pull * WATER_GRAVITY_MULT, WATER_TERMINAL_VY);
    vx -= vx * WATER_DRAG;
    vx += current * CURRENT_PUSH * WATER_DRAG * 4;
  } else {
    vy = applyGravity(vy, fastFalling);
  }
  // Wind is the Apex's weather: a constant push on anything not standing on
  // something, so a jump is a decision about where the wind will have put you.
  if (room.wind !== 0 && !p.grounded && !stunned) vx += room.wind * WIND_ACCEL;

  if (!jumpCut && jumpFrames >= JUMP_CUT_MIN_FRAMES && vy < 0 && !jumpHeld) {
    vy *= JUMP_CUT_MULT;
    jumpCut = true;
  }

  const moved = moveBox(room, { x: p.x, y: p.y, w: p.w, h: p.h }, vx, vy, dropThrough > 0, platforms);
  vx = moved.vx;
  vy = moved.vy;

  let box = { x: moved.x, y: moved.y, w: p.w, h: p.h };
  const grounded = moved.grounded || (vy >= 0 && isSupported(room, box, platforms) && dropThrough === 0);
  if (grounded) {
    jumpFrames = 0;
    jumpCut = false;
    coyote = COYOTE_FRAMES;
  }

  let facing = ax !== 0 ? /** @type {-1|1} */ (ax) : p.facing;
  const fallFrames = vy > 0 && !grounded ? p.fallFrames + 1 : 0;
  if (grounded && !p.grounded) {
    emit(events, 'land', box.x + box.w / 2, box.y + box.h, { material: materialUnder(room, box) });
  }
  // Footsteps are paced by distance, not by frames, so a walk and a sprint sound
  // like a walk and a sprint rather than the same loop at two speeds.
  let stride = grounded ? p.stride + Math.abs(vx) : 0;
  if (stride >= STRIDE_LENGTH) {
    stride -= STRIDE_LENGTH;
    emit(events, 'footstep', box.x + box.w / 2, box.y + box.h, { material: materialUnder(room, box) });
  }
  const wet = inWater(room, box.x + box.w / 2, box.y + box.h / 2);
  if (wet !== p.inWater) {
    emit(events, wet ? 'water.enter' : 'water.exit', box.x + box.w / 2, box.y + box.h / 2);
  }
  const safeGround = grounded ? { x: moved.x, y: moved.y } : p.safeGround;
  const hangCooldown = Math.max(0, p.hangCooldown - 1);

  // Landing on a wall pin centres you on it; falling past one grabs it. Both are
  // §D1's answer to "a 16x4 shelf under a 12-wide player is a nervous place".
  let nextPerch = false;
  let hang = false;
  if (grounded && !stunned) {
    const centre = perchCentre(box, pin);
    // Perch latches on the *landing* and is released by Jump or Down. Re-arming it
    // every frame you stand there would make Down a one-frame nudge instead of a
    // decision to step off.
    if (centre !== null && !p.grounded) {
      box = { ...box, x: centre };
      vx = 0;
      nextPerch = true;
      emit(events, 'perch', box.x + box.w / 2, box.y + box.h, { material: pin.surface });
    } else if (centre !== null && perch) {
      nextPerch = true;
    }
  } else if (!grounded && !stunned && vy > 0 && hangCooldown === 0 && grabbableHang(room, box, pin)) {
    const at = hangAnchor(box, pin);
    box = { ...box, x: at.x, y: at.y };
    hang = true;
    vx = 0;
    vy = 0;
    emit(events, 'hang', at.x + box.w / 2, at.y + box.h / 2, { material: pin.surface });
    facing = /** @type {-1|1} */ (pin.nx > 0 ? -1 : 1);
  }

  return {
    ...p,
    x: box.x,
    y: box.y,
    vx,
    vy,
    grounded: hang ? false : grounded,
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
    perch: nextPerch,
    hang,
    hangCooldown,
    throwFreeze: Math.max(0, p.throwFreeze - 1),
    stride,
    inWater: wet,
  };
}

export { clamp };
