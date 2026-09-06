/**
 * Camera, 03-game-feel §3.3. Pure: it takes the previous camera and the state and
 * returns a new camera, so it can be unit-tested and so nothing in the drawing
 * code can perturb it.
 *
 * The camera position is the world coordinate of the view's top-left corner.
 */

import { TILE, VIEW_W, VIEW_H, CAM } from '../../core/constants.js';
import { hashNoise } from './rng.js';

/** Screenshake ceiling, 00-BIBLE §7: 6px over 24 frames, max-not-sum. */
const SHAKE_MAX_PX = 6;
const SHAKE_FRAMES = 24;

/** @typedef {import('../../core/types.js').GameState} GameState */

/**
 * @typedef {object} Camera
 * @property {number} x           rendered position: the base plus this frame's shake
 * @property {number} y
 * @property {number} bx          the base the follow easing works on
 * @property {number} by
 * @property {number} lookahead   current lookahead offset in world units
 * @property {-1|1} facing        the facing the lookahead is aiming at
 * @property {number} facingHold  frames the player has faced the other way
 */

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
function clamp(v, lo, hi) {
  return hi < lo ? lo : v < lo ? lo : v > hi ? hi : v;
}

/**
 * @param {Readonly<GameState>} state
 * @returns {Camera}
 */
export function createCamera(state) {
  const cam = { x: 0, y: 0, bx: 0, by: 0, lookahead: 0, facing: /** @type {-1|1} */ (1), facingHold: 0 };
  const at = clampToRoom(state, targetFor(state, cam, true));
  return { ...cam, x: at.x, y: at.y, bx: at.x, by: at.y };
}

/**
 * @param {Camera} cam
 * @param {Readonly<GameState>} state
 * @returns {Camera}
 */
export function updateCamera(cam, state) {
  const p = state.player;
  let facing = cam.facing;
  let facingHold = cam.facingHold;
  if (p.facing !== cam.facing) {
    facingHold++;
    if (facingHold >= CAM.facingHoldFrames) {
      facing = p.facing;
      facingHold = 0;
    }
  } else {
    facingHold = 0;
  }
  const lookahead = cam.lookahead + (facing * CAM.lookahead - cam.lookahead) * CAM.lookaheadLerp;

  const next = { ...cam, facing, facingHold, lookahead, x: cam.bx, y: cam.by };
  const goal = targetFor(state, next, false);
  const lerpY = p.fallFrames >= CAM.fastFallFrames ? CAM.fastFallLerpY : CAM.lerpY;
  next.x = cam.bx + (goal.x - cam.bx) * CAM.lerpX;
  next.y = cam.by + (goal.y - cam.by) * lerpY;
  const base = clampToRoom(state, next);
  const offset = shakeOffset(state);
  // Shake is baked into x/y rather than applied at draw time so that everything
  // that projects a world point to the screen — the render, and the harness's
  // "is the player visible" probe — agrees about where the camera actually is.
  return { ...next, bx: base.x, by: base.y, x: base.x + offset.x, y: base.y + offset.y };
}

/**
 * Decaying seeded noise. It is a function of the tick, not of accumulated state,
 * so a replay shakes identically and a snapshot resumes mid-shake correctly.
 * @param {Readonly<GameState>} state
 * @returns {{x:number, y:number}}
 */
function shakeOffset(state) {
  const frames = state.shake ?? (state.player.iframes > 48 ? state.player.iframes - 48 : 0);
  if (!(frames > 0)) return { x: 0, y: 0 };
  const amp = SHAKE_MAX_PX * Math.min(1, frames / SHAKE_FRAMES);
  return {
    x: (hashNoise(state.tick * 2) * 2 - 1) * amp,
    y: (hashNoise(state.tick * 2 + 1) * 2 - 1) * amp * 0.6,
  };
}

/**
 * The position the camera is easing toward, before the room clamp.
 * @param {Readonly<GameState>} state
 * @param {Camera} cam
 * @param {boolean} snap  ignore the deadzone, for the first frame of a room
 * @returns {{x:number, y:number}}
 */
function targetFor(state, cam, snap) {
  const p = state.player;
  const pcx = p.x + p.w / 2 + cam.lookahead;
  const pcy = p.y + p.h / 2;

  const x = snap ? pcx - VIEW_W / 2 : clamp(cam.x, pcx - VIEW_W / 2 - CAM.deadzoneX, pcx - VIEW_W / 2 + CAM.deadzoneX);


  // Grounded, the camera parks the feet at 55% of screen height and the vertical
  // deadzone is ignored — that is what stops the view bobbing on every small hop.
  if (p.grounded) return { x, y: p.y + p.h - CAM.groundSnapY };
  const y = snap ? pcy - VIEW_H / 2 : clamp(cam.y, pcy - VIEW_H / 2 - CAM.deadzoneDown, pcy - VIEW_H / 2 + CAM.deadzoneUp);
  return { x, y };
}

/**
 * @param {Readonly<GameState>} state
 * @param {{x:number, y:number}} pos
 * @returns {{x:number, y:number}}
 */
function clampToRoom(state, pos) {
  const roomW = state.roomData.w * TILE;
  const roomH = state.roomData.h * TILE;
  // Rooms that fit on one screen use a fixed camera (03 §3.3 "Small rooms").
  const x = roomW <= VIEW_W ? (roomW - VIEW_W) / 2 : clamp(pos.x, 0, roomW - VIEW_W);
  const y = roomH <= VIEW_H ? (roomH - VIEW_H) / 2 : clamp(pos.y, 0, roomH - VIEW_H);
  return { x, y };
}
