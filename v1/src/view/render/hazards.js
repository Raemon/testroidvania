/**
 * Hazards. Globally constant coral (bible §1 guardrail 4): whatever the region,
 * the thing that kills you is always this colour and always spiky.
 */

import { PALETTE } from './palette.js';

/** @typedef {import('../../core/types.js').Room} Room */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 */
export function drawHazards(ctx, room) {
  for (const hz of room.hazards) {
    const teeth = 4;
    const step = hz.w / teeth;
    ctx.fillStyle = PALETTE.hazard;
    ctx.beginPath();
    ctx.moveTo(hz.x, hz.y + hz.h);
    for (let i = 0; i < teeth; i++) {
      ctx.lineTo(hz.x + step * (i + 0.5), hz.y + hz.h * 0.25);
      ctx.lineTo(hz.x + step * (i + 1), hz.y + hz.h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.hazardEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
