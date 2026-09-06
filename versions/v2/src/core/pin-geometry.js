/**
 * Where an embedded Pin *is*, in world units. Physics, the Pin machine, the bot
 * and the renderer all have to agree on this or the platform you can see is not
 * the platform you can stand on, so it lives in exactly one file.
 *
 * An embedded Pin stores the surface contact point and the outward normal. The
 * platform hangs off that: a 16x4 shelf for a wall pin, a 4x16 pole for a floor
 * or ceiling pin.
 */

import {
  PIN_PLATFORM_W, PIN_PLATFORM_H, PIN_POLE_W, PIN_POLE_H, PIN_HIT_W, PIN_HIT_H,
} from './constants.js';

/** @typedef {import('./types.js').Pin} Pin */
/** @typedef {import('./types.js').AABB} AABB */

/** @param {Readonly<Pin>} pin @returns {boolean} */
export function isEmbedded(pin) {
  return pin.state === 'embedded';
}

/** @param {Readonly<Pin>} pin @returns {boolean} true for a pin stuck in a vertical face */
export function isWallPin(pin) {
  return pin.nx !== 0;
}

/**
 * The one-way platform an embedded Pin presents. Null for every other state —
 * a flying, dropped, returning or held Pin is not something you can stand on.
 * @param {Readonly<Pin>} pin
 * @returns {AABB|null}
 */
export function pinPlatform(pin) {
  if (pin.state !== 'embedded') return null;
  if (pin.nx !== 0) {
    // Wall pin: a shelf protruding along the normal, its top face at the pin.
    const x = pin.nx > 0 ? pin.x : pin.x - PIN_PLATFORM_W;
    return { x, y: pin.y - PIN_PLATFORM_H / 2, w: PIN_PLATFORM_W, h: PIN_PLATFORM_H };
  }
  // Floor or ceiling pin: a pole standing out of the surface.
  const y = pin.ny < 0 ? pin.y - PIN_POLE_H : pin.y;
  return { x: pin.x - PIN_POLE_W / 2, y, w: PIN_POLE_W, h: PIN_POLE_H };
}

/**
 * Every one-way platform the player collides with this frame. A list because
 * Twin Pin (A5) will make it two, and because a caller that takes a list cannot
 * be surprised by that.
 * @param {Readonly<Pin>} pin
 * @returns {AABB[]}
 */
export function pinPlatforms(pin) {
  const plat = pinPlatform(pin);
  return plat ? [plat] : [];
}

/**
 * The box a flying Pin damages with, oriented along travel.
 * @param {Readonly<Pin>} pin
 * @returns {AABB}
 */
export function pinHitbox(pin) {
  const vertical = Math.abs(pin.vy) > Math.abs(pin.vx);
  const w = vertical ? PIN_HIT_H : PIN_HIT_W;
  const h = vertical ? PIN_HIT_W : PIN_HIT_H;
  return { x: pin.x - w / 2, y: pin.y - h / 2, w, h };
}
