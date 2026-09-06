/**
 * The ability registry. The five ids are locked by 00-BIBLE.md §4 and each one is a
 * file plus one alphabetically-sorted line here (AGENTS.md rule 4).
 *
 * An ability is not a subsystem. Each of the five re-tags something the player has
 * already bounced off — a material, a surface, a body, a distance — so its file
 * holds the predicates its owner subsystem asks, and the registry holds the
 * metadata that content validation and the reachability solver read.
 */

import * as deepPin from './deepPin.js';
import * as reel from './reel.js';
import * as ricochet from './ricochet.js';
import * as twinPin from './twinPin.js';
import * as zip from './zip.js';

/** @typedef {import('../types.js').AbilityId} AbilityId */

/** @type {AbilityId[]} */
export const ABILITY_IDS = ['deepPin', 'reel', 'ricochet', 'twinPin', 'zip'];

/**
 * @typedef {object} AbilityDef
 * @property {AbilityId} id
 * @property {string} name
 * @property {string} gate  the gate kind this ability opens (06-revision-1 §B)
 * @property {(abilities: readonly AbilityId[]) => boolean} owned
 */

/** @type {Record<string, AbilityDef>} */
export const ABILITIES = {
  deepPin,
  reel,
  ricochet,
  twinPin,
  zip,
};

/**
 * The order the ladder is earned in. The Spine's five tiers are gated in exactly
 * this order (06-revision-1 §A3), and the reachability solver proves it.
 * @type {AbilityId[]}
 */
export const ABILITY_ORDER = ['zip', 'deepPin', 'reel', 'ricochet', 'twinPin'];

/** @param {string} id @returns {boolean} */
export function isAbilityId(id) {
  return ABILITY_IDS.includes(/** @type {AbilityId} */ (id));
}

/** @param {string} id @returns {number} -1 when the id is not an ability */
export function ladderIndex(id) {
  return ABILITY_ORDER.indexOf(/** @type {AbilityId} */ (id));
}
