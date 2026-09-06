/**
 * The ability registry. The five ids are locked by 00-BIBLE.md §4 and are listed
 * here now so content validation can reject a door that requires something that
 * will never exist. Behaviour is Phase 3: an agent adds one file plus one
 * alphabetically-sorted line to ABILITIES.
 */

/** @typedef {import('../types.js').AbilityId} AbilityId */

/** @type {AbilityId[]} */
export const ABILITY_IDS = ['deepPin', 'reel', 'ricochet', 'twinPin', 'zip'];

/**
 * @typedef {object} AbilityDef
 * @property {AbilityId} id
 * @property {string} name
 * @property {(state: import('../types.js').GameState) => import('../types.js').GameState} [update]
 */

/** @type {Record<string, AbilityDef>} */
export const ABILITIES = {};

/** @param {string} id @returns {boolean} */
export function isAbilityId(id) {
  return ABILITY_IDS.includes(/** @type {AbilityId} */ (id));
}
