/**
 * The boss-policy registry: boss id -> `(observation) -> input bits`.
 *
 * One file plus one alphabetically-sorted line each, the same rule as rooms,
 * abilities, entities and bosses. `test/bosses.test.js` iterates BOSSES and demands
 * a policy for every one of them, so a boss cannot ship without something that can
 * beat it.
 */

import * as anchor from './anchor.js';
import * as diver from './diver.js';
import * as sentinel from './sentinel.js';
import * as stoker from './stoker.js';

/** @typedef {import('../api.js').Observation} Observation */
/** @typedef {(obs: Observation) => number} BossPolicy */

/** @type {Record<string, BossPolicy>} */
export const POLICIES = {
  anchor: anchor.policy,
  diver: diver.policy,
  sentinel: sentinel.policy,
  stoker: stoker.policy,
};

/**
 * @param {Observation} obs
 * @returns {BossPolicy|null} the policy for the boss in this room, if there is one
 */
export function policyFor(obs) {
  return obs.boss ? POLICIES[obs.boss.id] ?? null : null;
}
