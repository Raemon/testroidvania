/**
 * The world -> device transform for one frame.
 *
 * `originX/originY` are the device pixel the world origin lands on, rounded to a
 * whole pixel. Everything in the frame shares them, which is what lets the baked
 * room blit as a 1:1 copy instead of a resample, and incidentally stops fine
 * strokes shimmering as the camera eases.
 *
 * @typedef {object} View
 * @property {number} scale     device pixels per world unit
 * @property {number} originX   device x of world (0, 0)
 * @property {number} originY
 * @property {number} camX      camera position in world units, rounded
 * @property {number} camY
 * @property {number} width     device backing-store width
 * @property {number} height
 */

export {};
