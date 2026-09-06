/**
 * Every tunable number in the simulation. Verbatim from docs/design/03-game-feel.md
 * §1.1, which 00-BIBLE.md §7 declares law. All values are in world units (px) and
 * px/frame at a fixed 60 Hz step — there is no `dt` anywhere in the sim.
 *
 * Tuning the game feel is a single-file change. Any edit here moves the golden
 * hashes; that is intended, and `npm run goldens` is the sanctioned response.
 */

export const TILE = 16;

/** Internal world-space viewport. Bible §2: vector art scaled to the device. */
export const VIEW_W = 480;
export const VIEW_H = 270;

export const PLAYER_W = 12;
export const PLAYER_H = 20;

export const RUN_MAX = 2.6;
export const GROUND_ACCEL = 0.45;
export const GROUND_FRICTION = 0.65;
export const TURNAROUND_MULT = 1.6;
export const AIR_ACCEL = 0.30;
export const AIR_DRAG = 0.10;

export const JUMP_VY = -4.70;
export const GRAVITY_RISE = 0.195;
export const GRAVITY_FALL = 0.31;

/** Gravity is halved while |vy| is under this, giving ~5 frames of apex float. */
export const APEX_HANG_VY = 0.6;
export const APEX_HANG_MULT = 0.5;

export const TERMINAL_VY = 6.0;
export const FASTFALL_TERMINAL_VY = 8.0;
export const FASTFALL_GRAVITY_MULT = 1.4;

export const JUMP_CUT_MULT = 0.45;
/** Jump-cut is ignored before this many frames so a 1-frame tap has a floor. */
export const JUMP_CUT_MIN_FRAMES = 4;

export const COYOTE_FRAMES = 6;
export const JUMP_BUFFER_FRAMES = 8;

export const CEILING_CORNER_CORRECTION = 4;
export const LEDGE_NUDGE = 3;
export const FALLING_EDGE_SNAP = 2;

/** Frames a one-way platform is ignored after a down+jump drop-through. */
export const DROP_THROUGH_FRAMES = 8;

export const PLAYER_MAX_HP = 5;
export const PLAYER_IFRAMES = 60;
/** Frames of lost control after taking damage (03 §2.2). */
export const HURT_CONTROL_LOSS = 10;

/** Invariant ceiling on either velocity component; catches runaway integration. */
export const VMAX = 32;

/** Softlock detector window, 04-architecture §6 rule 17. */
export const SOFTLOCK_WINDOW = 600;

/** Entity budget, 04-architecture §6 rule 6. */
export const MAX_ENTITIES = 256;

/** Camera, 03-game-feel §3.3. */
export const CAM = {
  deadzoneX: 16,
  deadzoneUp: 24,
  deadzoneDown: 32,
  lookahead: 40,
  lookaheadLerp: 0.05,
  facingHoldFrames: 6,
  lerpX: 0.12,
  lerpY: 0.08,
  groundSnapY: 150,
  fastFallFrames: 20,
  fastFallLerpY: 0.25,
};
