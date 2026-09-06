/**
 * A2 DEEP PIN. The Pin bites stone, and it bites the core of a mechanism.
 *
 * Everything here is a predicate over the material vocabulary rather than a new
 * rule: Deep Pin does not add a surface type, it re-tags one the player has already
 * bounced off (00-BIBLE §5). That is why the whole ability is three functions.
 *
 * Its gate is the **Barrier**: a slag block. Pin it, and the recall shatters it —
 * the one explicitly-locked door in the game.
 */

/** @typedef {import('../types.js').AbilityId} AbilityId */
/** @typedef {import('../types.js').Material} Material */

export const id = /** @type {AbilityId} */ ('deepPin');
export const name = 'Deep Pin';
export const gate = 'barrier';

/** @param {readonly AbilityId[]} abilities @returns {boolean} */
export function owned(abilities) {
  return abilities.includes('deepPin');
}

/**
 * The three-way read, in one place. Combat asks this about a boss part exactly as
 * traversal asks it about a wall, which is the point of having three materials.
 * @param {Material|null} material
 * @param {readonly AbilityId[]} abilities
 * @returns {boolean}
 */
export function bitesMaterial(material, abilities) {
  if (material === 'wood') return true;
  if (material === 'stone') return owned(abilities);
  return false;
}

/**
 * A mechanism keeps running until the Pin is in its core; then it stops dead. This
 * is A2's traversal use — "hold this still while I walk past" — and it is why a
 * rail platform is metal (and so a clang) until Deep Pin exists.
 * @param {readonly AbilityId[]} abilities
 * @returns {boolean}
 */
export function freezesMechanisms(abilities) {
  return owned(abilities);
}
