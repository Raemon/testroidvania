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

import { VIEW_W, VIEW_H } from '../../core/constants.js';
import { createSurface } from './surface.js';
import { HAZARD, rgba, shade } from './palette.js';
import { cosmeticRng, hashNoise, seedFrom } from './rng.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./surface.js').Surface} Surface */

/** @type {{key:string, surface:Surface}|null} */
let vignetteSurface = null;
/** @type {{key:string, surface:Surface}|null} */
let grainSurface = null;

/**
 * Vignette and region tint are one cached image rather than two full-screen
 * passes: the tint never changes within a region and the vignette never changes
 * at all, so compositing them together once is free and blitting them together
 * halves the cost of the grade.
 * Built at the device's own size so it blits 1:1: a scaled full-screen blit is
 * the most expensive single draw in the frame and this one never has to be.
 * @param {import('./palette.js').Region} region
 * @param {number} w
 * @param {number} h
 * @returns {Surface}
 */
function vignette(region, w, h) {
  const key = `${region.id}|${w}x${h}`;
  if (vignetteSurface && vignetteSurface.key === key) return vignetteSurface.surface;
  const s = createSurface(w, h);
  s.ctx.fillStyle = rgba(shade(region.fog, 0.25), 0.10);
  s.ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const g = s.ctx.createRadialGradient(cx, cy, h * 0.28, cx, cy, w * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  s.ctx.fillStyle = g;
  s.ctx.fillRect(0, 0, w, h);
  vignetteSurface = { key, surface: s };
  return s;
}

/**
 * Cream noise, one tile bigger than the screen in both axes, so a whole frame of
 * grain is a single 1:1 blit at an offset instead of a grid of scaled ones.
 * @param {number} w
 * @param {number} h
 * @returns {Surface}
 */
function grain(w, h) {
  const key = `${w}x${h}`;
  if (grainSurface && grainSurface.key === key) return grainSurface.surface;
  const s = createSurface(w + 64, h + 64);
  const rnd = cosmeticRng(seedFrom('grain'));
  const img = s.ctx.createImageData(s.w, s.h);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 243;
    img.data[i + 1] = 233;
    img.data[i + 2] = 210;
    img.data[i + 3] = Math.floor(rnd() * 9);
  }
  s.ctx.putImageData(img, 0, 0);
  grainSurface = { key, surface: s };
  return s;
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

  ctx.globalAlpha = lowHealth ? 0.85 + 0.15 * Math.sin(frame * 0.126) : 0.72;
  ctx.drawImage(vignette(region, w, h).canvas, 0, 0);
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

  // Grain offset is a hash of the frame number, so a screenshot at tick N is
  // byte-identical on every run instead of merely "close enough".
  const g = grain(w, h);
  const ox = -Math.floor(hashNoise(frame) * 64);
  const oy = -Math.floor(hashNoise(frame * 7 + 1) * 64);
  ctx.globalAlpha = 0.32;
  ctx.drawImage(g.canvas, ox, oy);
  ctx.globalAlpha = 1;
}
