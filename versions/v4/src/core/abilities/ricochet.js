/**
 * A4 RICOCHET. One mirror-bounce off metal, and the range keeps counting through it.
 *
 * Its gate is the **Blind** gate (06-revision-1 §A2): a pinnable surface with no
 * straight-line throw path from anywhere the player can stand, because metal is in
 * the way. You bank around the corner. The old "sheer metal wall" gate was
 * unbuildable — bouncing off a wall does not get you up it — and is gone.
 */

/** One mirror-bounce, and only one. */
const RICOCHET_BOUNCES = 1;

/** @typedef {import('../types.js').AbilityId} AbilityId */
/** @typedef {import('../types.js').Pin} Pin */

export const id = /** @type {AbilityId} */ ('ricochet');
export const name = 'Ricochet';
export const gate = 'blind';

/** @param {readonly AbilityId[]} abilities @returns {boolean} */
export function owned(abilities) {
  return abilities.includes('ricochet');
}

/**
 * @param {Readonly<Pin>} pin
 * @param {readonly AbilityId[]} abilities
 * @returns {boolean} true if this clang should become a bounce instead
 */
export function canBounce(pin, abilities) {
  return owned(abilities) && !pin.inert && pin.bounces < RICOCHET_BOUNCES;
}

/**
 * Mirror the flight about the surface normal. `travelled` is deliberately left
 * alone: "range keeps counting" is what makes a bank a real throw and not a free
 * second one.
 * @param {Pin} pin
 * @param {number} nx surface normal, pointing out of the metal
 * @param {number} ny
 * @returns {Pin}
 */
export function bounce(pin, nx, ny) {
  const dot = pin.vx * nx + pin.vy * ny;
  const vx = pin.vx - 2 * dot * nx;
  const vy = pin.vy - 2 * dot * ny;
  return {
    ...pin,
    vx,
    vy,
    bounces: pin.bounces + 1,
    dirX: /** @type {-1|1} */ (vx === 0 ? pin.dirX : Math.sign(vx)),
    dirY: /** @type {-1|0|1} */ (Math.sign(vy)),
  };
}
