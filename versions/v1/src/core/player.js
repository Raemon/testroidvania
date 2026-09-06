/**
 * The player state machine and the timers that hang off it.
 *
 * The animation state is *derived* from physics every frame rather than being a
 * mode the rest of the sim branches on — the two exceptions, `hurt` and `dead`,
 * are the only states that take control away, so they are the only ones stored as
 * a decision. Deriving the rest means a physics change can never leave the state
 * machine stale.
 */

import { PLAYER_W, PLAYER_H, PLAYER_MAX_HP, PLAYER_IFRAMES, HURT_CONTROL_LOSS } from './constants.js';
import { stepPlayerPhysics } from './physics.js';

/** @typedef {import('./types.js').Player} Player */
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
 * @returns {Player}
 */
export function stepPlayer(room, player, input, prevInput) {
  const ticked = {
    ...player,
    iframes: Math.max(0, player.iframes - 1),
    hurtFrames: Math.max(0, player.hurtFrames - 1),
  };
  if (ticked.hp <= 0) {
    return { ...ticked, vx: 0, vy: 0, state: /** @type {PlayerAnimState} */ ('dead') };
  }
  const moved = stepPlayerPhysics(room, ticked, input, prevInput);
  return { ...moved, state: deriveAnimState(moved) };
}

/**
 * Apply one damage event. Phase 2 owns who calls this; the shape is fixed now so
 * combat and hazards agree on it.
 * @param {Player} player
 * @param {number} amount
 * @param {number} fromX  x of the damage source, for knockback direction
 * @returns {Player}
 */
export function damagePlayer(player, amount, fromX) {
  if (player.iframes > 0 || player.hp <= 0) return player;
  const hp = Math.max(0, player.hp - amount);
  const away = player.x + player.w / 2 < fromX ? -1 : 1;
  return {
    ...player,
    hp,
    iframes: PLAYER_IFRAMES,
    hurtFrames: hp > 0 ? HURT_CONTROL_LOSS : 0,
    vx: hp > 0 ? away * 3.5 : 0,
    vy: hp > 0 ? -2.5 : 0,
    state: hp > 0 ? 'hurt' : 'dead',
  };
}
