/**
 * Policy for the Stoker: the base brawl, plus "jump the slam".
 *
 * The slam's 38 frames of telegraph exist so a player can read it; the policy reads
 * the same thing, from the same field, which is the point of testing a boss with a
 * policy rather than a tape.
 */

import { IN } from '../../core/input.js';
import { brawl } from './base.js';

/** @typedef {import('../api.js').Observation} Observation */

export const boss = 'stoker';

/**
 * @param {Observation} obs
 * @returns {number}
 */
export function policy(obs) {
  const b = obs.boss;
  const p = obs.player;
  if (b && b.mode === 'slam' && p.grounded && Math.abs(p.cx - (b.x + b.w / 2)) < 96) {
    // The waves run along the floor. Be off it.
    return IN.JUMP | (p.cx < b.x ? IN.LEFT : IN.RIGHT);
  }
  return brawl(obs);
}
