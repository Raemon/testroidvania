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
  TILE, PIN_PLATFORM_W, PIN_PLATFORM_H, PIN_POLE_W, PIN_POLE_H, PIN_HIT_W, PIN_HIT_H,
} from './constants.js';
import { solidAt } from './collision.js';
import { propBox } from './props/index.js';

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

/**
 * What a flying Pin runs into during one motion slice, if anything.
 *
 * Rails are tested before terrain because a rail is always the thing standing in
 * front of a wall. `tx`/`ty` name the tile for a terrain hit and `propId` the rail
 * for a prop hit; exactly one of them is set, and the caller turns that into a
 * verdict without caring which it was.
 *
 * @typedef {object} PinContact
 * @property {number} x  the surface point the Pin stops at
 * @property {number} y
 * @property {number} nx surface normal, pointing back out of the material
 * @property {number} ny
 * @property {number} tx
 * @property {number} ty
 * @property {number|null} propId
 */

/**
 * @param {import('./types.js').Room} room
 * @param {readonly import('./types.js').Prop[]} props
 * @param {number} x @param {number} y @param {number} dx @param {number} dy
 * @returns {PinContact|null}
 */
export function contactAhead(room, props, x, y, dx, dy) {
  return propContact(props, x, y, dx, dy) ?? terrainContact(room, x, y, dx, dy);
}

/**
 * @param {readonly import('./types.js').Prop[]} props
 * @param {number} x @param {number} y @param {number} dx @param {number} dy
 * @returns {PinContact|null}
 */
function propContact(props, x, y, dx, dy) {
  const px = x + dx;
  const py = y + dy;
  for (const p of props) {
    const b = propBox(p);
    if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) continue;
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      return { x: dx > 0 ? b.x : b.x + b.w, y: py, nx: dx > 0 ? -1 : 1, ny: 0, tx: 0, ty: 0, propId: p.id };
    }
    return { x: px, y: dy > 0 ? b.y : b.y + b.h, nx: 0, ny: dy > 0 ? -1 : 1, tx: 0, ty: 0, propId: p.id };
  }
  return null;
}

/**
 * Point-vs-tilemap contact for one motion slice.
 * @param {import('./types.js').Room} room
 * @param {number} x @param {number} y @param {number} dx @param {number} dy
 * @returns {PinContact|null}
 */
function terrainContact(room, x, y, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  if (dx !== 0 && solidAt(room, Math.floor(nx / TILE), Math.floor(y / TILE))) {
    const tx = Math.floor(nx / TILE);
    const face = dx > 0 ? tx * TILE : (tx + 1) * TILE;
    return { x: face, y, tx, ty: Math.floor(y / TILE), nx: dx > 0 ? -1 : 1, ny: 0, propId: null };
  }
  if (dy !== 0 && solidAt(room, Math.floor(x / TILE), Math.floor(ny / TILE))) {
    const ty = Math.floor(ny / TILE);
    const face = dy > 0 ? ty * TILE : (ty + 1) * TILE;
    return { x, y: face, tx: Math.floor(x / TILE), ty, nx: 0, ny: dy > 0 ? -1 : 1, propId: null };
  }
  if (solidAt(room, Math.floor(nx / TILE), Math.floor(ny / TILE))) {
    const tx = Math.floor(nx / TILE);
    const ty = Math.floor(ny / TILE);
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: dx > 0 ? tx * TILE : (tx + 1) * TILE, y: ny, tx, ty, nx: dx > 0 ? -1 : 1, ny: 0, propId: null };
    }
    return { x: nx, y: dy > 0 ? ty * TILE : (ty + 1) * TILE, tx, ty, nx: 0, ny: dy > 0 ? -1 : 1, propId: null };
  }
  return null;
}
