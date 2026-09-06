/**
 * The entity registry: kind -> behaviour. Empty in Phase 1 by design — enemies
 * arrive in Phase 3, one file plus one alphabetically-sorted line each.
 * Content validation reads it, so a room cannot spawn a kind nothing implements.
 */

/**
 * @typedef {object} EntityKind
 * @property {string} kind
 * @property {(id: number, roomId: string, tx: number, ty: number) => import('../types.js').Entity} spawn
 * @property {(e: import('../types.js').Entity, s: import('../types.js').GameState) => import('../types.js').Entity} update
 */

/** @type {Record<string, EntityKind>} */
export const ENTITY_KINDS = {};

/** @param {string} kind @returns {boolean} */
export function isEntityKind(kind) {
  return Object.hasOwn(ENTITY_KINDS, kind);
}
