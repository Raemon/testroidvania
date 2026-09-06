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

// --- The Pin (01-core-mechanic §Spec, 06-revision-1 §D1/§G) -----------------

export const PIN_THROW_STARTUP = 4;
export const PIN_SPEED = 9;
export const PIN_RANGE = 176;
/** Past its range the Pin loses force and falls until it lands as Dropped. */
export const PIN_FALL_GRAVITY = 0.3;
export const PIN_RECALL_SPEED = 13;
export const PIN_CATCH_RADIUS = 10;
/** Frames after a catch before the next throw is allowed; keeps recall-spam honest. */
export const PIN_THROW_LOCK = 4;
export const PIN_EMBED_DEPTH = 8;
/** Flying hitbox, oriented along travel. */
export const PIN_HIT_W = 12;
export const PIN_HIT_H = 4;
/** A wall pin's one-way platform, protruding perpendicular from the surface. */
export const PIN_PLATFORM_W = 16;
export const PIN_PLATFORM_H = 4;
/** A floor/ceiling pin's pole. */
export const PIN_POLE_W = 4;
export const PIN_POLE_H = 16;
/**
 * Where a throw leaves the hand, measured down from the player's top edge. 6 puts
 * a horizontal wall pin's platform exactly TILE above the feet, so "throw at the
 * wall, hop on" is a one-tile step every single time — the same read as a floor
 * pin, and enough margin over the measured 54.7px jump to clear a 4-tile wall.
 */
export const PIN_HAND_OFFSET = 6;
export const PIN_CLANG_FLASH_FRAMES = 6;
/** Out of bounds or inside a kill volume for this long and the Pin comes home. */
export const PIN_AUTO_RECALL_FRAMES = 30;
export const PIN_PINNED_FRAMES = 90;
export const PIN_THROW_DAMAGE = 2;
export const PIN_RECALL_DAMAGE = 1;
/** A light enemy is carried this far to the wall behind it before it can be pinned. */
export const PIN_CARRY_RANGE = 48;
/** Terminal sink speed in water; the Pin stays recallable and stays lit. */
export const PIN_WATER_SINK = 0.5;

/** Perch (§D1.1): the player is centred on a wall pin and stops sliding off it. */
export const PERCH_SNAP_X = 6;
/** Hang (§D1.2): falling this close to an embedded wall pin grabs it. */
export const HANG_GRAB_DIST = 8;
export const HANG_KICK_VX = 3.0;
export const HANG_KICK_VY = -5.0;
/** Frames after letting go before the same pin may be grabbed again. */
export const HANG_COOLDOWN = 12;

// --- Jab (01-core-mechanic §Spec) -------------------------------------------

export const JAB_STARTUP = 3;
export const JAB_ACTIVE = 4;
export const JAB_RECOVERY = 9;
export const JAB_W = 16;
export const JAB_H = 12;
export const JAB_DAMAGE = 1;
export const JAB_KNOCKBACK = 2;
/** A pinned enemy is helpless, so the jab that frees it counts double. */
export const JAB_CRIT_MULT = 2;

// --- Combat (00-BIBLE §7, 06-revision-1 §D3) --------------------------------

export const ENEMY_HP_LIGHT = 4;
export const ENEMY_HP_HEAVY = 8;
export const ENEMY_CONTACT_DAMAGE = 1;
export const ENEMY_KNOCKBACK = 2;
export const HITSTOP_HIT = 3;
export const HITSTOP_HEAVY = 5;
export const HITSTOP_KILL = 6;
export const PLAYER_KNOCKBACK_VX = 3.5;
export const PLAYER_KNOCKBACK_VY = -2.5;
/**
 * Knockback is halved when the full impulse would carry the player into a hazard.
 * Never zero: a player who cannot be moved cannot be read as having been hit.
 */
export const KNOCKBACK_HAZARD_MULT = 0.5;
/** How far ahead the hazard test looks along the knockback, in frames. */
export const KNOCKBACK_LOOKAHEAD_FRAMES = 8;
export const DEATH_RESPAWN_FRAMES = 60;

// --- Enemies ----------------------------------------------------------------

export const CRAWLER_SPEED = 1.0;
export const CRAWLER_W = 12;
export const CRAWLER_H = 12;
export const CHARGER_W = 14;
export const CHARGER_H = 10;
export const CHARGER_SIGHT = 200;
export const CHARGER_WINDUP = 20;
export const CHARGER_DASH_SPEED = 3.2;
export const CHARGER_DASH_FRAMES = 60;
export const CHARGER_RECOVER_FRAMES = 40;
export const ENEMY_GRAVITY = 0.31;
export const ENEMY_TERMINAL_VY = 6.0;

// --- Light (06-revision-1 §D5) ----------------------------------------------

/** The player's own aura. Never smaller, thrown Pin or not — an ember carries it. */
export const LIGHT_AURA_R = 90;
/** Every ability permanently widens the aura, 90 -> 250 by the end. */
export const LIGHT_AURA_PER_ABILITY = 40;
/** The Pin's light, which travels with the Pin. */
export const LIGHT_PIN_R = 260;
export const LIGHT_HAZARD_R = 40;
export const LIGHT_EYE_R = 28;
export const LIGHT_LANTERN_R = 120;
/** Terrain already seen stays visible at this alpha; 0.12 was a rumour. */
export const DISCOVERED_ALPHA = 0.25;
export const DARKNESS_ALPHA_CAP = 0.55;

/** Frames a crumble tile survives after the Pin bites into it. */
export const CRUMBLE_FRAMES = 12;
