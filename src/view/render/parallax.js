/**
 * The value-banded background: a void gradient, three seeded skylines and the fog
 * planes between them (05-aesthetic §3.1).
 *
 * Each skyline is generated once per region and baked into an offscreen canvas
 * two screens wide, then scrolled with `drawImage` and wrapped modulo its width.
 * Per frame this whole layer is 2 gradients and 6 blits, which is why the most
 * compositionally important part of the scene is also the cheapest.
 *
 * The layers get *lighter* with distance. That inversion of the usual "far things
 * fade to the sky colour" is the entire depth cue here, since nothing is textured.
 */

import { VIEW_W, VIEW_H } from '../../core/constants.js';
import { SurfaceCache, createSurface } from './surface.js';
import { cosmeticRng, seedFrom } from './rng.js';
import { rgba, shade } from './palette.js';

/** @typedef {import('./palette.js').Region} Region */
/** @typedef {import('./surface.js').Surface} Surface */

const LAYER_W = VIEW_W * 2;
/** Taller than the view so a downward camera can slide the layer without a gap. */
const LAYER_H = VIEW_H + 48;

/**
 * @typedef {object} LayerSpec
 * @property {number} parallax   fraction of camera motion the layer takes
 * @property {number} baseline   silhouette footing, as a fraction of LAYER_H
 * @property {number} minH
 * @property {number} maxH
 * @property {number} spacing    average building width
 * @property {number} windows    chance a building shows lit windows
 */

/** @type {LayerSpec[]} */
const LAYERS = [
  { parallax: 0.20, baseline: 0.52, minH: 30, maxH: 140, spacing: 44, windows: 0.34 },
  { parallax: 0.45, baseline: 0.68, minH: 40, maxH: 150, spacing: 62, windows: 0.24 },
  { parallax: 0.70, baseline: 0.84, minH: 34, maxH: 120, spacing: 88, windows: 0.12 },
];

const cache = new SurfaceCache();

/**
 * The background is composited at *world* resolution and blitted up once.
 * Nothing back here has an edge finer than a building silhouette, so the six
 * full-screen passes it takes to build cost a quarter as much this way, and the
 * one upscale that replaces them is invisible. Foreground art still draws at
 * device resolution, which is where crisp 1.5px strokes actually matter.
 */
/** @type {Surface|null} */
let composite = null;

/**
 * One cathedral-city silhouette. Shapes come from a tiny vocabulary so the skyline
 * reads as architecture rather than as noise.
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => number} rnd
 * @param {number} x
 * @param {number} w
 * @param {number} baseY
 * @param {number} h
 */
function building(ctx, rnd, x, w, baseY, h) {
  const kind = rnd();
  const top = baseY - h;
  ctx.beginPath();
  if (kind < 0.34) {
    // Block with a stepped parapet.
    const step = Math.max(2, w * 0.16);
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, top + step);
    ctx.lineTo(x + step, top + step);
    ctx.lineTo(x + step, top);
    ctx.lineTo(x + w - step, top);
    ctx.lineTo(x + w - step, top + step);
    ctx.lineTo(x + w, top + step);
    ctx.lineTo(x + w, baseY);
  } else if (kind < 0.62) {
    // Arch: a nave with a round roof.
    const r = w / 2;
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, top + r);
    ctx.arc(x + r, top + r, r, Math.PI, 0);
    ctx.lineTo(x + w, baseY);
  } else if (kind < 0.85) {
    // Spire: a tower narrowing to a needle.
    const shoulder = top + h * 0.42;
    const inset = w * 0.28;
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, shoulder);
    ctx.lineTo(x + inset, shoulder);
    ctx.lineTo(x + w / 2, top);
    ctx.lineTo(x + w - inset, shoulder);
    ctx.lineTo(x + w, shoulder);
    ctx.lineTo(x + w, baseY);
  } else {
    // Buttress: a mass with a diagonal brace flying off one side.
    const dir = rnd() < 0.5 ? -1 : 1;
    const armX = dir < 0 ? x - w * 0.5 : x + w * 1.5;
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w, baseY - h * 0.45);
    ctx.lineTo(armX, baseY);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * @param {Region} region
 * @param {number} index
 * @returns {Surface}
 */
function skyline(region, index) {
  return cache.get(`sky|${region.id}|${index}`, () => {
    const spec = LAYERS[index] ?? /** @type {LayerSpec} */ (LAYERS[0]);
    const s = createSurface(LAYER_W, LAYER_H);
    const rnd = cosmeticRng(seedFrom(`${region.id}:skyline:${index}`));
    const baseY = LAYER_H * spec.baseline;
    // Value, not colour, carries depth: each layer steps darker as it comes
    // nearer, ending just above the terrain band.
    const body = index === 0 ? shade(region.far, 0.12) : index === 1 ? region.mid : shade(region.mid, -0.52);

    s.ctx.fillStyle = body;
    s.ctx.fillRect(0, baseY - 1, LAYER_W, LAYER_H - baseY + 1);

    /** @type {{x:number, w:number, h:number}[]} */
    const placed = [];
    let x = -spec.spacing;
    while (x < LAYER_W + spec.spacing) {
      const w = spec.spacing * (0.55 + rnd() * 0.9);
      const h = spec.minH + rnd() * (spec.maxH - spec.minH);
      placed.push({ x, w, h });
      building(s.ctx, rnd, x, w, baseY + 2, h);
      x += w * (0.72 + rnd() * 0.5);
    }

    // A few lit windows per layer: the only warm points in the far distance, and
    // the thing that says "city" rather than "mountains".
    s.ctx.fillStyle = rgba(region.accent, index === 0 ? 0.22 : 0.14);
    for (const b of placed) {
      if (rnd() > spec.windows) continue;
      const rows = 1 + Math.floor(rnd() * 3);
      for (let r = 0; r < rows; r++) {
        const wx = b.x + b.w * (0.25 + rnd() * 0.5);
        const wy = baseY - b.h * (0.2 + rnd() * 0.6);
        s.ctx.fillRect(Math.round(wx), Math.round(wy), 1.5, 2.5);
      }
    }

    // Each layer sits in its own bank of fog, densest at its footing. Baking the
    // fog into the layer (rather than washing the whole screen) is what keeps the
    // *near* fog from also lifting the far silhouettes.
    const g = s.ctx.createLinearGradient(0, baseY - spec.maxH, 0, LAYER_H);
    g.addColorStop(0, rgba(region.fog, 0));
    g.addColorStop(0.65, rgba(region.fog, 0.16));
    g.addColorStop(1, rgba(region.fog, 0.34));
    s.ctx.fillStyle = g;
    s.ctx.fillRect(0, baseY - spec.maxH, LAYER_W, LAYER_H);
    return s;
  });
}

/**
 * The void band: the lightest thing on screen and the back of every scene.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Region} region
 */
function drawVoid(ctx, region) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  // Foundry is the one region lit from below — dead furnaces under the floor —
  // so its gradient runs the other way. Everywhere else the sky darkens downward
  // and the fog banks put the light back at the horizon.
  g.addColorStop(0, region.litFromBelow ? region.voidTop : shade(region.voidTop, 0.06));
  g.addColorStop(0.6, region.voidTop);
  g.addColorStop(1, region.voidBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Region} region
 * @param {number} camX
 * @param {number} camY
 */
export function drawParallax(ctx, region, camX, camY) {
  if (!composite) composite = createSurface(VIEW_W, VIEW_H, true);
  const b = composite.ctx;
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'source-over';
  drawVoid(b, region);

  for (let i = 0; i < LAYERS.length; i++) {
    const spec = LAYERS[i] ?? /** @type {LayerSpec} */ (LAYERS[0]);
    const s = skyline(region, i);
    const off = ((-camX * spec.parallax) % LAYER_W + LAYER_W) % LAYER_W;
    const y = Math.round(Math.max(-44, Math.min(20, -camY * spec.parallax * 0.30)));
    b.drawImage(s.canvas, Math.round(off - LAYER_W), y);
    b.drawImage(s.canvas, Math.round(off), y);
  }

  // One fog plane in front of everything distant. A single bank of haze between
  // the background and the foreground is what gives the terrain something
  // lighter to be a silhouette *against*.
  const g = b.createLinearGradient(0, VIEW_H * 0.30, 0, VIEW_H);
  g.addColorStop(0, rgba(region.fog, 0.02));
  g.addColorStop(1, rgba(region.fog, 0.20));
  b.fillStyle = g;
  b.fillRect(0, 0, VIEW_W, VIEW_H);

  // Blitted without smoothing. This is a 2-3x upscale of a full screen and the
  // filtered path costs ~4ms of the frame; the content is flat silhouettes and
  // wide gradients, which nearest-neighbour reproduces indistinguishably (it
  // actually keeps the silhouette edges harder).
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(composite.canvas, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
