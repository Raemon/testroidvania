/**
 * The Jab: 3f startup, 4f active, 9f recovery, 16x12 in front, 1 damage.
 *
 * It is not a primary attack — it is the "I have thrown my weapon and I am
 * exposed" fallback, so it has no cooldown beyond its own recovery and it is
 * available in every state that is not hurt, dead or hanging. If the Jab ever
 * stops feeling usable, throwing the Pin stops feeling affordable.
 */

import { JAB_STARTUP, JAB_ACTIVE, JAB_RECOVERY, JAB_W, JAB_H } from './constants.js';
import { IN, justPressed } from './input.js';

/** @typedef {import('./types.js').Player} Player */
/** @typedef {import('./types.js').AABB} AABB */
/** @typedef {import('./types.js').InputMask} InputMask */

export const JAB_TOTAL = JAB_STARTUP + JAB_ACTIVE + JAB_RECOVERY;

/** @param {Readonly<Player>} p @returns {boolean} */
export function jabIsActive(p) {
  return p.jabFrames > JAB_STARTUP && p.jabFrames <= JAB_STARTUP + JAB_ACTIVE;
}

/**
 * @param {Readonly<Player>} p
 * @returns {AABB|null} the hurt box for this frame, or null when nothing is out
 */
export function jabBox(p) {
  if (!jabIsActive(p)) return null;
  const centreY = p.y + p.h / 2;
  return {
    x: p.facing > 0 ? p.x + p.w : p.x - JAB_W,
    y: centreY - JAB_H / 2,
    w: JAB_W,
    h: JAB_H,
  };
}

/**
 * Advance the jab clock and start a new one on a fresh press.
 * @param {Player} p
 * @param {InputMask} input
 * @param {InputMask} prevInput
 * @returns {Player}
 */
export function stepJab(p, input, prevInput) {
  if (p.jabFrames > 0) {
    const next = p.jabFrames + 1;
    return next > JAB_TOTAL ? { ...p, jabFrames: 0, jabHits: 0 } : { ...p, jabFrames: next };
  }
  if (p.hurtFrames > 0 || p.hang) return p;
  if (!justPressed(input, prevInput, IN.ATTACK)) return p;
  return { ...p, jabFrames: 1, jabHits: 0 };
}
