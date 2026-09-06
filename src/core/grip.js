/**
 * The two ways a body holds onto an embedded Pin: standing on it (**Perch**) and
 * grabbing it on the way past (**Hang**). Both are 06-revision-1 §D1, and both are
 * pure geometry — physics decides *when*, this file decides *where*.
 *
 * Hang is what gives the base kit a climb rhythm — throw, jump, grab, wall-kick —
 * instead of a single step, so it is load-bearing long before Zip exists.
 */

import { PIN_PLATFORM_H, PIN_HAND_OFFSET, HANG_GRAB_DIST } from './constants.js';
import { overlapsSolid } from './collision.js';
import { pinPlatform } from './pin-geometry.js';

/** @typedef {import('./types.js').AABB} AABB */
/** @typedef {import('./types.js').Pin} Pin */
/** @typedef {import('./types.js').Player} Player */
/** @typedef {import('./types.js').Room} Room */

/**
 * @param {AABB} box the player, already resolved for this frame
 * @param {Readonly<Pin>} pin
 * @returns {number|null} the x that centres the box on a wall pin's shelf, or null
 *   when the box is not standing on one
 */
export function perchCentre(box, pin) {
  if (pin.state !== 'embedded' || pin.nx === 0) return null;
  const plat = pinPlatform(pin);
  if (!plat) return null;
  const feet = box.y + box.h;
  if (Math.abs(feet - plat.y) > 1e-9) return null;
  if (box.x >= plat.x + plat.w || box.x + box.w <= plat.x) return null;
  return plat.x + (plat.w - box.w) / 2;
}

/**
 * @param {Room} room
 * @param {AABB} box
 * @param {Readonly<Pin>} pin
 * @returns {boolean} true if a body falling here should snap onto the Pin
 */
export function grabbableHang(room, box, pin) {
  if (pin.state !== 'embedded' || pin.nx === 0) return false;
  const nearEdge = pin.nx > 0 ? box.x : box.x + box.w;
  if (Math.abs(nearEdge - pin.x) > HANG_GRAB_DIST) return false;
  // The Pin has to be somewhere along the body, not at the ankles or overhead.
  if (pin.y < box.y - HANG_GRAB_DIST || pin.y > box.y + box.h) return false;
  const at = hangAnchor(box, pin);
  return !overlapsSolid(room, { x: at.x, y: at.y, w: box.w, h: box.h });
}

/**
 * Where a hanging body sits: flush against the surface, the Pin at hand height.
 * @param {AABB} box
 * @param {Readonly<Pin>} pin
 * @returns {{x:number, y:number}}
 */
export function hangAnchor(box, pin) {
  return {
    x: pin.nx > 0 ? pin.x : pin.x - box.w,
    y: pin.y - PIN_HAND_OFFSET,
  };
}

/**
 * A hang survives only while the Pin it hangs from does. Recall therefore always
 * drops the player, which is the §G invariant: nothing about the Pin can strand you.
 * @param {Readonly<Player>} p
 * @param {Readonly<Pin>} pin
 * @returns {boolean}
 */
export function stillHanging(p, pin) {
  if (pin.state !== 'embedded' || pin.nx === 0) return false;
  if (p.hp <= 0 || p.hurtFrames > 0) return false;
  const nearEdge = pin.nx > 0 ? p.x : p.x + p.w;
  return Math.abs(nearEdge - pin.x) <= 1e-6 && Math.abs(pin.y - PIN_HAND_OFFSET - p.y) <= PIN_PLATFORM_H;
}
