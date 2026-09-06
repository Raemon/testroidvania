/**
 * Hazards. Globally constant coral (00-BIBLE §1 guardrail 4): whatever the region,
 * the thing that kills you is always this colour, always self-lit — it punches its
 * own hole in the darkness so you can never walk into one blind.
 *
 * The diagonal hatching is not decoration: it is the redundant channel that makes
 * the hazard read for a player who cannot see the coral hue at all.
 *
 * Two shapes, not one, and the difference is what the thing *is*:
 *
 *  - **Spikes** are teeth, and there is one tooth per tile-ish, not four per band
 *    however wide the band is. A fixed count meant a 512px void got four 128px
 *    coral mountains, which is not a spike field, it is a landscape.
 *  - **The void** (the Ascent's rising lethal substance, 02-world-structure §6) is
 *    a *liquid*: a flat top with a foam line on it and drips hanging off its face.
 *    It is the same hazard rect underneath — that is deliberate, it costs the sim
 *    nothing — but a rising tide drawn as a spike floor reads as a floor, and the
 *    whole beat is "the ground is coming up to meet you".
 */

import { CREAM, HAZARD, HAZARD_HI, rgba } from './palette.js';
import { drawGlow } from './glow.js';

/** @typedef {import('../../core/types.js').Room} Room */
/** @typedef {import('../../core/types.js').Hazard} Hazard */

/** One tooth per tile, floored at four so a one-tile spike is still a spike. */
const TOOTH_W = 16;
/** Drips hang off the void's face this far apart. */
const DRIP_SPACING = 14;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 * @param {{x:number, y:number, w:number, h:number}} view
 * @param {number} t seconds
 */
export function drawHazards(ctx, room, view, t) {
  for (const hz of room.hazards) {
    if (hz.x + hz.w < view.x - 16 || hz.x > view.x + view.w + 16) continue;
    if (hz.y + hz.h < view.y - 16 || hz.y > view.y + view.h + 16) continue;
    if (hz.kind === 'void') drawVoid(ctx, hz, t);
    else drawSpikes(ctx, hz, t);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Hazard} hz
 * @param {number} t seconds
 */
function drawSpikes(ctx, hz, t) {
  const teeth = Math.max(4, Math.round(hz.w / TOOTH_W));
  const step = hz.w / teeth;
  ctx.beginPath();
  ctx.moveTo(hz.x, hz.y + hz.h);
  for (let i = 0; i < teeth; i++) {
    ctx.lineTo(hz.x + step * (i + 0.5), hz.y + hz.h * 0.18);
    ctx.lineTo(hz.x + step * (i + 1), hz.y + hz.h);
  }
  ctx.closePath();

  ctx.fillStyle = HAZARD;
  ctx.fill();
  hatch(ctx, hz, t);
  ctx.strokeStyle = HAZARD_HI;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * The Ascent's void: a flat surface with foam on it and drips off its face.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Hazard} hz
 * @param {number} t seconds
 */
function drawVoid(ctx, hz, t) {
  const top = hz.y;
  ctx.fillStyle = HAZARD;
  ctx.fillRect(hz.x, top, hz.w, hz.h);
  hatch(ctx, hz, t);

  // A slow swell along the top edge. Not tall enough to be a wave — this is a
  // substance filling a shaft, and it must not look like a sea.
  ctx.strokeStyle = rgba(CREAM, 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = hz.x; x <= hz.x + hz.w; x += 8) {
    const y = top + Math.sin(x * 0.06 + t * 1.6) * 1.2;
    if (x === hz.x) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(HAZARD_HI, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hz.x, top + 3.5);
  ctx.lineTo(hz.x + hz.w, top + 3.5);
  ctx.stroke();

  // Drips: vertical ticks below the surface, at staggered lengths, so the face
  // of the void reads as running rather than as a fill.
  ctx.strokeStyle = rgba(HAZARD_HI, 0.4);
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = hz.x + 4; x < hz.x + hz.w; x += DRIP_SPACING) {
    const phase = (x * 0.31 + t * 0.7) % 1;
    const len = Math.min(hz.h, 4 + phase * 14);
    ctx.moveTo(x + 0.5, top + 2);
    ctx.lineTo(x + 0.5, top + 2 + len);
  }
  ctx.stroke();
}

/**
 * The scrolling diagonal hatch, clipped to whatever path is current. Slow enough
 * to read as "active" rather than as motion.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Hazard} hz
 * @param {number} t seconds
 */
function hatch(ctx, hz, t) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(hz.x, hz.y, hz.w, hz.h);
  ctx.clip();
  ctx.strokeStyle = rgba(HAZARD_HI, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const off = (t * 8) % 6;
  const span = Math.min(hz.h, 64);
  for (let d = -span; d < hz.w + span; d += 6) {
    ctx.moveTo(hz.x + d + off, hz.y + span);
    ctx.lineTo(hz.x + d + off + span, hz.y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The warm cast hazards throw into the room. Separate from the shapes because it
 * is additive and has to land on top of everything the hazard is behind.
 *
 * A long band gets one glow per screen-width rather than one for the whole rect:
 * a single glow centred on a 512px void is a bloom nobody is standing near.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 * @param {{x:number, y:number, w:number, h:number}} view
 */
export function drawHazardGlow(ctx, room, view) {
  for (const hz of room.hazards) {
    if (hz.x + hz.w < view.x || hz.x > view.x + view.w) continue;
    if (hz.y + hz.h < view.y || hz.y > view.y + view.h) continue;
    if (hz.kind === 'void') {
      for (let x = hz.x + 32; x < hz.x + hz.w; x += 64) drawGlow(ctx, x, hz.y + 6, 30, HAZARD, 0.3);
      continue;
    }
    drawGlow(ctx, hz.x + hz.w / 2, hz.y + hz.h / 2, 22, HAZARD, 0.28);
  }
}
