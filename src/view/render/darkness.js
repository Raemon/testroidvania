/**
 * The darkness overlay — the game's identity (05-aesthetic §3.2, 06-revision-1 §D5).
 *
 * One offscreen canvas is filled with a dark, region-tinted wash and then *holes
 * are punched in it* with `destination-out` radial gradients, one per light. The
 * result is blitted over the world and under the UI. Doing it this way means N
 * overlapping lights cost N gradients and one composite, instead of needing a
 * per-pixel shader.
 *
 * The calibration constraints from §D5 are deliberate and easy to "fix" wrongly:
 * the radii are big (the light is a feel layer, not a puzzle), the overlay alpha
 * is capped at 0.55 in *every* region so nothing is ever unreadable, and terrain
 * the player has already seen stays legible at alpha 0.25.
 */

import { VIEW_W, VIEW_H, DARKNESS_ALPHA_CAP } from '../../core/constants.js';
import { createSurface } from './surface.js';
import { rgba, shade } from './palette.js';

/** @typedef {import('./palette.js').Region} Region */

/**
 * A light punched into the darkness.
 * @typedef {object} Light
 * @property {number} x  screen-space (world minus camera)
 * @property {number} y
 * @property {number} r
 * @property {string} color  the additive colour cast into the scene, if any
 * @property {number} [warmth]  0 = hole only, 1 = full warm cast
 */

/**
 * The overlay lives at world resolution. Its content is nothing but wide radial
 * gradients, so upscaling it to the device costs one blit and loses nothing —
 * whereas building it at device resolution costs four times as much per light.
 */
const SS = 1;

/** @type {import('./surface.js').Surface|null} */
let surface = null;

/** @returns {import('./surface.js').Surface} */
function overlay() {
  if (!surface) surface = createSurface(VIEW_W * SS, VIEW_H * SS);
  return surface;
}

/**
 * Radii breathe by ±4% on a 7 Hz + 13 Hz sine sum. Two incommensurate rates read
 * as a living flame; one reads as a machine.
 * @param {number} t seconds
 * @returns {number}
 */
export function flicker(t) {
  return 1 + 0.04 * (Math.sin(t * Math.PI * 2 * 7) * 0.6 + Math.sin(t * Math.PI * 2 * 13) * 0.4);
}

/**
 * @param {CanvasRenderingContext2D} ctx  in view space (origin at the view's corner)
 * @param {Region} region
 * @param {Light[]} lights
 * @param {number} alpha  requested overlay strength, clamped to the §D5 cap
 */
export function drawDarkness(ctx, region, lights, alpha) {
  const s = overlay();
  const o = s.ctx;
  o.setTransform(1, 0, 0, 1, 0, 0);
  // 'copy' replaces the previous frame's punched holes in the same pass that
  // lays the new wash down, which is one full-surface pass cheaper than clearing.
  o.globalCompositeOperation = 'copy';
  // Not black: the wash carries the region's hue so that unlit space still says
  // which region you are standing in.
  o.fillStyle = rgba(shade(region.fog, -0.78), Math.min(DARKNESS_ALPHA_CAP, Math.max(0, alpha)));
  o.fillRect(0, 0, s.w, s.h);

  o.globalCompositeOperation = 'destination-out';
  for (const light of lights) {
    const r = light.r * SS;
    if (!(r > 0)) continue;
    const x = light.x * SS;
    const y = light.y * SS;
    if (x < -r || y < -r || x > s.w + r || y > s.h + r) continue;
    const g = o.createRadialGradient(x, y, 0, x, y, r);
    // Flat and bright out to a third of the radius, then a long soft shoulder —
    // a linear falloff reads as a spotlight, this reads as a lantern.
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.30, 'rgba(0,0,0,0.88)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.58)');
    g.addColorStop(0.78, 'rgba(0,0,0,0.24)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g;
    o.fillRect(x - r, y - r, r * 2, r * 2);
  }
  o.globalCompositeOperation = 'source-over';

  ctx.drawImage(s.canvas, 0, 0, VIEW_W, VIEW_H);
}
