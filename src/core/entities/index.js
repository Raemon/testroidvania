/**
 * The entity registry: kind -> behaviour. Adding an enemy is one new file plus one
 * alphabetically-sorted line here (AGENTS.md rule 4). Content validation reads it,
 * so a room cannot spawn a kind nothing implements.
 */

import * as charger from './charger.js';
import * as crawler from './crawler.js';

export { entityBox, entityEye, damageEntity, createEntity, moveEntity, blockedAhead } from './base.js';

/**
 * @typedef {object} EntityKind
 * @property {string} kind
 * @property {(id: number, roomId: string, tx: number, ty: number) => import('../types.js').Entity} spawn
 * @property {(e: import('../types.js').Entity, s: Readonly<import('../types.js').GameState>) => import('../types.js').Entity} update
 */

/** @type {Record<string, EntityKind>} */
export const ENTITY_KINDS = {
  charger,
  crawler,
};

/** @param {string} kind @returns {boolean} */
export function isEntityKind(kind) {
  return Object.hasOwn(ENTITY_KINDS, kind);
}
