/**
 * Hazards. Globally constant coral (00-BIBLE §1 guardrail 4): whatever the region,
 * the thing that kills you is always this colour, always spiky, and always self-lit
 * — it punches its own hole in the darkness so you can never walk into one blind.
 *
 * The diagonal hatching is not decoration: it is the redundant channel that makes
 * the hazard read for a player who cannot see the coral hue at all.
 */

import { HAZARD, HAZARD_HI, rgba } from './palette.js';
import { drawGlow } from './glow.js';

/** @typedef {import('../../core/types.js').Room} Room */

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

    const teeth = 4;
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

    // Hatching scrolls slowly along the diagonal so the shape is unmistakably
    // "active" even when it is a static block of spikes.
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = rgba(HAZARD_HI, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const off = (t * 8) % 6;
    for (let d = -hz.h; d < hz.w + hz.h; d += 6) {
      ctx.moveTo(hz.x + d + off, hz.y + hz.h);
      ctx.lineTo(hz.x + d + off + hz.h, hz.y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = HAZARD_HI;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/**
 * The warm cast hazards throw into the room. Separate from the shapes because it
 * is additive and has to land on top of everything the hazard is behind.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 * @param {{x:number, y:number, w:number, h:number}} view
 */
export function drawHazardGlow(ctx, room, view) {
  for (const hz of room.hazards) {
    if (hz.x + hz.w < view.x || hz.x > view.x + view.w) continue;
    if (hz.y + hz.h < view.y || hz.y > view.y + view.h) continue;
    drawGlow(ctx, hz.x + hz.w / 2, hz.y + hz.h / 2, 22, HAZARD, 0.28);
  }
}
