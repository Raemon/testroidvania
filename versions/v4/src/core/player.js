/**
 * The player state machine and the timers that hang off it.
 *
 * The animation state is *derived* from physics every frame rather than being a
 * mode the rest of the sim branches on — the two exceptions, `hurt` and `dead`,
 * are the only states that take control away, so they are the only ones stored as
 * a decision. Deriving the rest means a physics change can never leave the state
 * machine stale.
 */

import {
  PLAYER_W, PLAYER_H, PLAYER_MAX_HP, PLAYER_IFRAMES, HURT_CONTROL_LOSS,
  KNOCKBACK_HAZARD_MULT, KNOCKBACK_LOOKAHEAD_FRAMES,
  PLAYER_KNOCKBACK_VX, PLAYER_KNOCKBACK_VY,
} from './constants.js';
import { stepPlayerPhysics } from './physics.js';
import { stepJab } from './jab.js';
import { overlaps } from './geometry.js';
import { emit } from './events.js';

/** @typedef {import('./types.js').Player} Player */
/** @typedef {import('./types.js').Pin} Pin */
/** @typedef {import('./types.js').Hazard} Hazard */
/** @typedef {import('./types.js').PlayerAnimState} PlayerAnimState */
/** @typedef {import('./types.js').Room} Room */
/** @typedef {import('./types.js').InputMask} InputMask */

/**
 * @param {number} x world units, left edge of the hitbox
 * @param {number} y world units, top edge of the hitbox
 * @returns {Player}
 */
export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    grounded: false,
    onOneWay: false,
    facing: 1,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    iframes: 0,
    hurtFrames: 0,
    state: 'fall',
    coyote: 0,
    jumpBuffer: 0,
    jumpFrames: 0,
    jumpHeld: false,
    jumpCut: false,
    dropThrough: 0,
    fallFrames: 0,
    safeGround: { x, y },
    perch: false,
    hang: false,
    hangBelow: false,
    hangCooldown: 0,
    zipFrames: 0,
    zipVx: 0,
    zipVy: 0,
    throwFreeze: 0,
    jabFrames: 0,
    jabHits: 0,
    deadFrames: 0,
    stride: 0,
    inWater: false,
    submerged: 0,
    crumbleFrames: 0,
    nearDoor: '',
  };
}

/**
 * Everything that has to be let go of when the body changes mode: a hit, a room
 * transition, a death, the start of a Zip.
 *
 * It is one function because it was four, and the four had already drifted apart —
 * which is the failure mode where a room transition leaves you perched on a Pin in
 * the room you just left. Anything that takes control of the body calls this.
 *
 * @param {Player} p
 * @returns {Player}
 */
export function releaseBody(p) {
  return {
    ...p,
    perch: false,
    hang: false,
    hangBelow: false,
    hangCooldown: 0,
    zipFrames: 0,
    zipVx: 0,
    zipVy: 0,
    jabFrames: 0,
    jabHits: 0,
  };
}

/**
 * @param {Player} p
 * @returns {PlayerAnimState}
 */
export function deriveAnimState(p) {
  if (p.hp <= 0) return 'dead';
  if (p.hurtFrames > 0) return 'hurt';
  if (!p.grounded) return p.vy < 0 ? 'jump' : 'fall';
  return Math.abs(p.vx) > 0.1 ? 'run' : 'idle';
}

/**
 * @param {Room} room
 * @param {Player} player
 * @param {InputMask} input
 * @param {InputMask} prevInput
 * @param {Readonly<Pin>} pin
 * @param {import('./types.js').SimEvent[]} events appended to; see events.js
 * @param {readonly import('./types.js').AABB[]} platforms dynamic one-way surfaces
 * @returns {Player}
 */
export function stepPlayer(room, player, input, prevInput, pin, events, platforms) {
  const ticked = {
    ...player,
    iframes: Math.max(0, player.iframes - 1),
    hurtFrames: Math.max(0, player.hurtFrames - 1),
  };
  if (ticked.hp <= 0) {
    return {
      ...releaseBody(ticked),
      vx: 0,
      vy: 0,
      deadFrames: ticked.deadFrames + 1,
      state: /** @type {PlayerAnimState} */ ('dead'),
    };
  }
  const jabbed = stepJab(ticked, input, prevInput);
  if (jabbed.jabFrames === 1) emit(events, 'jab', jabbed.x + jabbed.w / 2, jabbed.y + jabbed.h / 2);
  const moved = stepPlayerPhysics(room, jabbed, input, prevInput, pin, events, platforms);
  return { ...moved, state: deriveAnimState(moved) };
}

/**
 * Apply one damage event, including the knockback rule that matters most: a hit
 * must never be the thing that throws you onto the spikes. When the full impulse
 * would carry the player into a hazard the impulse is halved — halved, not
 * cancelled, because a hit you cannot feel does not read as a hit.
 *
 * @param {Player} player
 * @param {number} amount
 * @param {number} fromX  x of the damage source, for knockback direction
 * @param {readonly Hazard[]} [hazards] hazards to steer the knockback away from
 * @returns {Player}
 */
export function damagePlayer(player, amount, fromX, hazards = []) {
  if (player.iframes > 0 || player.hp <= 0) return player;
  const hp = Math.max(0, player.hp - amount);
  const away = player.x + player.w / 2 < fromX ? -1 : 1;
  const full = away * PLAYER_KNOCKBACK_VX;
  const vx = knockbackIntoHazard(player, full, hazards) ? full * KNOCKBACK_HAZARD_MULT : full;
  return {
    ...releaseBody(player),
    hp,
    iframes: PLAYER_IFRAMES,
    hurtFrames: hp > 0 ? HURT_CONTROL_LOSS : 0,
    vx: hp > 0 ? vx : 0,
    vy: hp > 0 ? PLAYER_KNOCKBACK_VY : 0,
    state: hp > 0 ? 'hurt' : 'dead',
  };
}

/**
 * @param {Readonly<Player>} player
 * @param {number} vx
 * @param {readonly Hazard[]} hazards
 * @returns {boolean} true if riding `vx` for the lookahead lands in a hazard
 */
export function knockbackIntoHazard(player, vx, hazards) {
  if (hazards.length === 0) return false;
  const swept = {
    x: Math.min(player.x, player.x + vx * KNOCKBACK_LOOKAHEAD_FRAMES),
    y: player.y,
    w: player.w + Math.abs(vx) * KNOCKBACK_LOOKAHEAD_FRAMES,
    h: player.h,
  };
  return hazards.some((hz) => overlaps(swept, hz));
}
