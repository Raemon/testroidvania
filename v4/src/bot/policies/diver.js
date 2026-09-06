/**
 * Policy for the Diver: the base brawl, plus "do not stand where the geyser will be".
 *
 * While it is under, its plates are welded shut and nothing can be done to it, so the
 * policy spends that time getting off the column it is aiming at. That is exactly
 * what the fight asks a player to do.
 */

import { brawl, backAway } from './base.js';

/** @typedef {import('../api.js').Observation} Observation */

export const boss = 'diver';

/**
 * @param {Observation} obs
 * @returns {number}
 */
export function policy(obs) {
  const b = obs.boss;
  if (b && (b.mode === 'submerge' || b.mode === 'telegraph')) {
    // Geysers come up under where you are standing. Keep moving away from it.
    return backAway(obs, obs.player.cx < b.x + b.w / 2 ? 1 : 2);
  }
  return brawl(obs);
}
