/**
 * Pre-rendered glow sprites (05-aesthetic §3.4).
 *
 * `ctx.shadowBlur` is banned in the game loop: it re-blurs the shape on the CPU on
 * every single draw and collapses the frame rate as soon as more than a handful of
 * things glow. A radial gradient baked into a small canvas once at load costs one
 * `drawImage` per glow instead, and composited with `'lighter'` it looks the same.
 *
 * Sizes are quantised to powers of two so a scene with fifty glowing things still
 * only ever builds a few sprites.
 */

import { VIEW_W, VIEW_H } from '../../core/constants.js';
import { createSurface, SurfaceCache } from './surface.js';
import { rgba } from './palette.js';

const cache = new SurfaceCache();

/** Sprite diameters that actually get baked; anything else is scaled from these. */
const SIZES = [16, 32, 64, 128, 256];

/** @param {number} r @returns {number} */
function bucket(r) {
  const want = r * 2;
  for (const s of SIZES) if (s >= want) return s;
  return 256;
}

/**
 * @param {string} color
 * @param {number} size  sprite diameter
 * @param {number} falloff  gradient exponent: 1 = linear, higher = tighter core
 * @returns {import('./surface.js').Surface}
 */
function sprite(color, size, falloff) {
  return cache.get(`${color}|${size}|${falloff}`, () => {
    const s = createSurface(size, size);
    const c = size / 2;
    const g = s.ctx.createRadialGradient(c, c, 0, c, c, c);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      g.addColorStop(t, rgba(color, Math.pow(1 - t, falloff)));
    }
    s.ctx.fillStyle = g;
    s.ctx.fillRect(0, 0, size, size);
    return s;
  });
}

/**
 * Draw a soft light blob centred on (x, y). Additive, so overlapping lights build
 * up the way real ones do.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color
 * @param {number} [alpha]
 * @param {number} [falloff]
 */
export function drawGlow(ctx, x, y, radius, color, alpha = 1, falloff = 2.2) {
  if (!(radius > 0)) return;
  const s = sprite(color, bucket(radius), falloff);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(s.canvas, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

/**
 * The backlight halo of 05 §2c.2 — a *non*-additive wash behind an entity, in the
 * region's fog colour, that lifts a dark body off dark terrain. Additive would
 * make enemies glow; this only separates them.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color
 * @param {number} [alpha]
 */
export function drawHalo(ctx, x, y, radius, color, alpha = 0.18) {
  if (!(radius > 0)) return;
  const s = sprite(color, bucket(radius), 1.6);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(s.canvas, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

/**
 * The warm cast: what the lights *add* to the scene, as opposed to what the
 * darkness subtracts everywhere else.
 *
 * Painted into the darkness overlay's own surface rather than onto the frame. A
 * full-screen composite is the most expensive thing this renderer does, and warm
 * and cold are two halves of one statement about the same pixel — so they travel
 * as one image and cost one pass between them. Drawn straight into the frame this
 * was the single most expensive layer in the game: a 256px sprite scaled to ~700
 * device pixels per light, 5.4 ms at 1280 and 12.0 ms at 1920, a third of the
 * frame for a smudge you can barely see.
 *
 * @param {CanvasRenderingContext2D} ctx  the overlay surface, at world resolution
 * @param {import('./darkness.js').Light[]} lights  screen-space (world minus camera)
 * @param {number} alpha  per-light strength before `warmth`
 */
export function paintWarmCasts(ctx, lights, alpha) {
  for (const l of lights) {
    if (!l.warmth) continue;
    // Most of the way out to the hole the same light punches: the two are one
    // statement — warm where a light reaches, cold where it does not — and a warm
    // cast half the size of its own hole reads as a separate, smaller lamp.
    const r = Math.min(l.r * 0.85, 230);
    if (!(r > 0)) continue;
    if (l.x < -r || l.y < -r || l.x > VIEW_W + r || l.y > VIEW_H + r) continue;
    drawGlow(ctx, l.x, l.y, r, l.color, alpha * l.warmth, 2.6);
  }
}

/** Warm sprite cache after the palette is known, so frame one is not the slow one. */
export function prewarmGlow(/** @type {string[]} */ colors) {
  for (const color of colors) for (const size of SIZES) sprite(color, size, 2.2);
}
