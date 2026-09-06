/**
 * The boss registry: one file plus one alphabetically-sorted line each. The roster
 * is fixed by 00-BIBLE.md §2 — Stoker, Diver, Anchor, plus the Sentinel miniboss —
 * and by 06-revision-1 §C, which cut the Anchor's third phase.
 *
 * A boss is also an entity kind, registered in `entities/index.js`: everything that
 * is already true of a body (damage, contact, the Pin, the light list) has to be
 * true of a boss too, and a separate boss entity type would mean writing all of it
 * twice.
 */

import * as anchor from './anchor.js';
import * as diver from './diver.js';
import * as sentinel from './sentinel.js';
import * as stoker from './stoker.js';

/** @typedef {import('../types.js').AbilityId} AbilityId */

/**
 * @typedef {object} BossDef
 * @property {string} id
 * @property {string} name
 * @property {number} maxHp
 * @property {AbilityId|null} grants  the ability its death unlocks, null for the last one
 */

/** @type {Record<string, BossDef>} */
export const BOSSES = {
  anchor: anchor.boss,
  diver: diver.boss,
  sentinel: sentinel.boss,
  stoker: stoker.boss,
};

/** @param {string} kind @returns {boolean} */
export function isBoss(kind) {
  return Object.hasOwn(BOSSES, kind);
}
