/**
 * The screen grade (05-aesthetic §3.10, §3.12): vignette, region tint, hit flash
 * and film grain.
 *
 * This is the last pass and it is what makes a scene assembled from a dozen
 * independent modules look like one photograph. The region tint in particular is
 * doing real work: a single `'multiply'` wash pulls the player's cream, the coral
 * hazards and the region's own hues into one colour family for free.
 *
 * Deliberately no scanlines and no CRT curve — they fight the cut-paper concept.
 */

import { createSurface } from './surface.js';
import { HAZARD, rgba, shade } from './palette.js';
import { cosmeticRng, seedFrom } from './rng.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./surface.js').Surface} Surface */

/**
 * Region tint, vignette and film grain are one image, pre-baked in a few
 * variants that the frame counter cycles through.
 *
 * Each of them alone is a full-screen composite, and a full-screen composite is
 * the most expensive thing this renderer does. They never change within a region
 * except for the grain's offset, which is exactly what having more than one
 * variant buys back — so three images replace three passes with one.
 */
const VARIANTS = 3;

/** @type {{key:string, surfaces:Surface[]}|null} */
let gradeSurfaces = null;

/**
 * @param {import('./palette.js').Region} region
 * @param {number} w
 * @param {number} h
 * @returns {Surface[]}
 */
function gradeLayers(region, w, h) {
  const key = `${region.id}|${w}x${h}`;
  if (gradeSurfaces && gradeSurfaces.key === key) return gradeSurfaces.surfaces;
  const rnd = cosmeticRng(seedFrom('grade'));
  /** @type {Surface[]} */
  const surfaces = [];
  for (let n = 0; n < VARIANTS; n++) {
    const s = createSurface(w, h);
    // Cream grain first, so the vignette darkens it at the corners the way a
    // single exposure would.
    const img = s.ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 243;
      img.data[i + 1] = 233;
      img.data[i + 2] = 210;
      img.data[i + 3] = Math.floor(rnd() * 11);
    }
    s.ctx.putImageData(img, 0, 0);

    s.ctx.fillStyle = rgba(shade(region.fog, 0.25), 0.10);
    s.ctx.fillRect(0, 0, w, h);

    const g = s.ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    s.ctx.fillStyle = g;
    s.ctx.fillRect(0, 0, w, h);
    surfaces.push(s);
  }
  gradeSurfaces = { key, surfaces };
  return surfaces;
}

/**
 * @param {CanvasRenderingContext2D} ctx  in view space
 * @param {Readonly<GameState>} state
 * @param {import('./palette.js').Region} region
 * @param {number} frame
 * @param {{width:number, height:number}} target
 */
export function drawGrade(ctx, state, region, frame, target) {
  const p = state.player;
  const lowHealth = p.maxHp > 0 && p.hp / p.maxHp < 0.25 && p.hp > 0;
  const w = target.width;
  const h = target.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const layers = gradeLayers(region, w, h);
  const layer = layers[Math.abs(frame) % layers.length] ?? layers[0];
  ctx.globalAlpha = lowHealth ? 0.85 + 0.15 * Math.sin(frame * 0.126) : 0.72;
  if (layer) ctx.drawImage(layer.canvas, 0, 0);
  ctx.globalAlpha = 1;

  if (lowHealth) {
    ctx.globalAlpha = 0.10 + 0.06 * Math.sin(frame * 0.126);
    ctx.fillStyle = '#3A0A10';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Hit flash and the metal "clang" both read as a bright edge, so they share a
  // pass; only their colour and their source timer differ.
  const flash = state.flash ?? 0;
  const hurt = p.iframes > 54 ? (p.iframes - 54) / 6 : 0;
  if (hurt > 0 || flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.4, hurt * 0.35 + (flash / 6) * 0.3);
    ctx.fillStyle = flash > 0 && hurt === 0 ? '#FFFFFF' : HAZARD;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

}
