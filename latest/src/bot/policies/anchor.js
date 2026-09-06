/**
 * Policy for the Anchor. Two phases, because the boss has two (06-revision-1 §C cut
 * the third): stand and fight, then keep moving while it comes after you.
 *
 * In the chase there is no floor to back off along, so the policy keeps circling and
 * takes its throws when the Anchor's rings swing into the lane — which is the same
 * thing the Ascent will ask of the player sixty seconds later.
 */

import { IN } from '../../core/input.js';
import { brawl, pressNow, backAway } from './base.js';

/** @typedef {import('../api.js').Observation} Observation */

export const boss = 'anchor';

/**
 * @param {Observation} obs
 * @returns {number}
 */
export function policy(obs) {
  const b = obs.boss;
  const p = obs.player;
  if (b && b.mode === 'slam' && p.grounded) {
    return IN.JUMP | backAway(obs, p.cx < b.x + b.w / 2 ? IN.LEFT : IN.RIGHT);
  }
  if (b && b.mode === 'chase') {
    // It ignores terrain, so distance is the only defence, and the Pin has to fly
    // while we retreat rather than after we have stopped.
    const gap = p.cx - (b.x + b.w / 2);
    const run = backAway(obs, gap < 0 ? IN.LEFT : IN.RIGHT);
    const aim = gap < 0 ? IN.RIGHT : IN.LEFT;
    if (Math.abs(gap) < 56) return run | (p.grounded ? IN.JUMP : 0);
    if (obs.pin.state !== 'held') return pressNow(obs) ? IN.RECALL : 0;
    return aim | (pressNow(obs) ? IN.THROW : 0);
  }
  return brawl(obs);
}
