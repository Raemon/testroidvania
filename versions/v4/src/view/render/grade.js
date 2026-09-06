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

import { PLAYER_IFRAMES } from '../../core/constants.js';
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

/** The grade is built at world resolution and rides the darkness overlay up. */
export const GRADE_W = 480;
export const GRADE_H = 270;

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
/**
 * The constant part of the grade — region tint, vignette and film grain — as one
 * pre-baked image for this frame. The darkness overlay composites it and carries
 * it up to the device in the same blit, so the whole grade costs no full-screen
 * pass of its own.
 *
 * It stops at the view's edges: grain spilled into the letterbox bars would make
 * every bar pixel unique, which both looks wrong and destroys the "what colour
 * is the background" assumption the harness's pixel probe depends on.
 * @param {import('./palette.js').Region} region
 * @param {number} frame
 * @returns {Surface|null}
 */
export function gradeLayer(region, frame) {
  const layers = gradeLayers(region, GRADE_W, GRADE_H);
  return layers[Math.abs(frame) % layers.length] ?? layers[0] ?? null;
}

/** 2 frames at full, then 4 to fall off: long enough to see, short enough to be a hit. */
const HURT_PEAK_FRAMES = 2;
const HURT_DECAY_FRAMES = 4;

/**
 * @param {number} iframes
 * @returns {number} 0..1, how much of the hurt vignette this frame shows
 */
function hurtLevel(iframes) {
  if (iframes <= 0) return 0;
  const since = PLAYER_IFRAMES - iframes;
  if (since < 0) return 0;
  if (since < HURT_PEAK_FRAMES) return 1;
  if (since < HURT_PEAK_FRAMES + HURT_DECAY_FRAMES) return 1 - (since - HURT_PEAK_FRAMES) / HURT_DECAY_FRAMES;
  return 0;
}

/** @type {Surface|null} */
let hurtSurface = null;

/**
 * The hurt vignette: coral at the edges of the frame, nothing at all in the
 * middle 60%.
 *
 * The previous version was a full-frame `lighter` coral fill at 0.35, which put a
 * mauve cast over every pixel including the player and the sky — it read as a
 * rendering fault rather than as damage, and it hid the one thing you need to see
 * when you are hit, which is where you and the enemy are. Baked once and blitted,
 * because it is an event and events must not cost a gradient evaluation.
 * @returns {Surface}
 */
function hurtVignette() {
  if (hurtSurface) return hurtSurface;
  const s = createSurface(GRADE_W, GRADE_H);
  const cx = GRADE_W / 2;
  const cy = GRADE_H / 2;
  const outer = Math.hypot(cx, cy);
  const g = s.ctx.createRadialGradient(cx, cy, outer * 0.60, cx, cy, outer);
  g.addColorStop(0, rgba(HAZARD, 0));
  g.addColorStop(0.55, rgba(HAZARD, 0.18));
  g.addColorStop(1, rgba(HAZARD, 0.5));
  s.ctx.fillStyle = g;
  s.ctx.fillRect(0, 0, GRADE_W, GRADE_H);
  hurtSurface = s;
  return s;
}

/**
 * The parts of the grade that are *events* rather than a constant look. These
 * are rare, so they stay as their own full-screen passes rather than costing one
 * every frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {number} frame
 * @param {{x:number, y:number, w:number, h:number}} rect
 */
export function drawGrade(ctx, state, frame, rect) {
  const p = state.player;
  const lowHealth = p.maxHp > 0 && p.hp / p.maxHp < 0.25 && p.hp > 0;
  const w = rect.w;
  const h = rect.h;
  const flash = state.flash ?? 0;
  const hurt = hurtLevel(p.iframes);
  if (!lowHealth && hurt <= 0 && flash <= 0) return;
  ctx.setTransform(1, 0, 0, 1, rect.x, rect.y);

  if (lowHealth) {
    ctx.globalAlpha = 0.10 + 0.06 * Math.sin(frame * 0.126);
    ctx.fillStyle = '#3A0A10';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  if (hurt > 0) {
    ctx.globalAlpha = hurt;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(hurtVignette().canvas, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
  }

  // The metal "clang" is a different event and keeps the bright full-frame edge:
  // it is a *good* thing happening to the Pin, and it is over in six frames.
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.3, (flash / 6) * 0.3);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
