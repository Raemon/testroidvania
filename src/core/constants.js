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
/** A full tile tall, so a chest-height throw always meets it. */
export const CRAWLER_W = 14;
export const CRAWLER_H = 16;
export const CHARGER_W = 16;
export const CHARGER_H = 12;
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

/** Distance walked between footsteps, from 05-aesthetic §4 (foot phase = distance / 28). */
export const STRIDE_LENGTH = 28;

/** How far ahead of a door the `door.open` event fires, so a grind has a wind-up. */
export const DOOR_LEAD = 24;

// --- A1 Zip (01-core-mechanic §3, 06-revision-1 §B) -------------------------

export const ZIP_SPEED = 12;
/** Close enough to the anchor to count as arrived. */
export const ZIP_ARRIVE_DIST = 4;
/** A zip can never outlive the Pin's own range; this is the safety stop. */
export const ZIP_MAX_FRAMES = 60;
/**
 * The jump-cancel caps. Deliberately well above RUN_MAX: `accelerate()` only caps
 * the direction being pushed, so a cancel is allowed to leave the player faster
 * than they can run and let friction eat it. That carry is the skill ceiling.
 */
export const ZIP_CANCEL_VX_CAP = 6.0;
export const ZIP_CANCEL_VY_CAP = 8.0;
export const ZIP_PASS_DAMAGE = 1;
/** Zip into a Pinned enemy: Skewer. */
export const SKEWER_DAMAGE = 3;
export const SKEWER_STUN = 20;

// --- A3 Reel ----------------------------------------------------------------

export const REEL_SPEED = 6;
/** Ceiling on one drag. Past it the thing stays where it is; recall already went home. */
export const REEL_FRAMES = 90;

// --- A4 Ricochet ------------------------------------------------------------

/** One mirror-bounce, and only one. Range keeps counting through it. */
export const RICOCHET_BOUNCES = 1;

// --- Rail platforms (props) -------------------------------------------------

export const RAIL_SPEED = 0.8;

// --- Enemies, phase 3 (03-game-feel §2.7 telegraph budgets) -----------------

export const HOPPER_W = 14;
export const HOPPER_H = 14;
export const HOPPER_SIGHT = 160;
/** Light class: 10 telegraph + 6 windup = 16 frames before it can touch you. */
export const HOPPER_TELEGRAPH = 10;
export const HOPPER_WINDUP = 6;
export const HOPPER_LAND_WAIT = 14;
export const HOPPER_JUMP_VY = -4.6;
export const HOPPER_JUMP_VX = 2.0;

export const TURRET_W = 16;
export const TURRET_H = 16;
export const TURRET_SIGHT = 220;
/** Heavy class: 20 telegraph + 12 windup = 32 frames before the bolt exists. */
export const TURRET_TELEGRAPH = 20;
export const TURRET_WINDUP = 12;
export const TURRET_RECOVER = 30;
export const BOLT_W = 6;
export const BOLT_H = 6;
export const BOLT_SPEED = 2.4;
export const BOLT_LIFE = 120;

export const DRIFTER_W = 12;
export const DRIFTER_H = 12;
export const DRIFTER_SPEED = 0.6;
/** Sine period in frames, and half-amplitude in world units. */
export const DRIFTER_PERIOD = 90;
export const DRIFTER_AMPLITUDE = 14;
export const DRIFTER_HP = 1;

export const SHELL_W = 20;
export const SHELL_H = 18;
export const SHELL_SPEED = 0.5;
/** The armoured arc, measured from straight ahead. Outside it the shell is open. */
export const SHELL_ARMOUR_DOT = 0.2;

// --- Bosses (02-world-structure §2, 06-revision-1 §C) -----------------------

/** Boss heavies do 2, so 03 §2.7 demands >= 24 frames of telegraph for them. */
export const BOSS_HEAVY_TELEGRAPH = 24;
export const BOSS_LIGHT_TELEGRAPH = 14;
export const BOSS_CONTACT_DAMAGE = 1;
export const BOSS_PART_HP = 6;

export const STOKER_HP = 18;
export const STOKER_W = 40;
export const STOKER_H = 32;
export const STOKER_SLAM_WINDUP = 14;
export const STOKER_SLAM_ACTIVE = 10;
export const STOKER_RECOVER = 40;
export const STOKER_WAVE_SPEED = 1.6;

export const DIVER_HP = 18;
export const DIVER_W = 32;
export const DIVER_H = 26;
export const DIVER_SUBMERGE_FRAMES = 50;
export const DIVER_GEYSER_ACTIVE = 12;
export const DIVER_RECOVER = 36;

export const SENTINEL_HP = 14;
export const SENTINEL_W = 34;
export const SENTINEL_H = 30;

export const ANCHOR_HP = 24;
export const ANCHOR_W = 44;
export const ANCHOR_H = 36;
/** Phase 2 begins here; phase 3 was cut (06-revision-1 §C), the Ascent is the finale. */
export const ANCHOR_PHASE2_AT = 0.5;
export const ANCHOR_CHASE_SPEED = 1.4;
