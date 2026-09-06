/**
 * Policy for the Sentinel: the base brawl, plus "get out of the dash lane".
 *
 * It is a Shell with Charger AI, so it telegraphs for 20 frames and then crosses the
 * room. The answer is the same as for the Charger — be somewhere else — and the
 * policy has to actually do it, because a Sentinel dash costs 1 HP.
 */

import { IN } from '../../core/input.js';
import { brawl, backAway } from './base.js';

/** @typedef {import('../api.js').Observation} Observation */

export const boss = 'sentinel';

/**
 * @param {Observation} obs
 * @returns {number}
 */
export function policy(obs) {
  const b = obs.boss;
  const p = obs.player;
  if (b && (b.mode === 'dash' || b.mode === 'windup') && Math.abs(p.cx - (b.x + b.w / 2)) < 90) {
    return IN.JUMP | backAway(obs, p.cx < b.x + b.w / 2 ? IN.LEFT : IN.RIGHT);
  }
  return brawl(obs);
}
