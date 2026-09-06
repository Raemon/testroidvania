/**
 * The boss registry. Empty in Phase 1: bosses are Phase 3, one file plus one
 * alphabetically-sorted line each (00-BIBLE.md §2 fixes the roster at Stoker,
 * Diver, Anchor, plus the Sentinel miniboss).
 */

/**
 * @typedef {object} BossDef
 * @property {string} id
 * @property {string} name
 * @property {number} maxHp
 */

/** @type {Record<string, BossDef>} */
export const BOSSES = {};
