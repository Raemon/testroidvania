/**
 * The player, drawn as a capsule. The visual is intentionally the same size as
 * the hitbox here so that "is the player where the sim says" is checkable by eye;
 * the aesthetic agent will make the rig overhang and squash, but must keep reading
 * position from the hitbox, never the other way round.
 */

import { PALETTE } from './palette.js';

/** @typedef {import('../../core/types.js').Player} Player */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Player} p
 */
export function drawPlayer(ctx, p) {
  // i-frames blink in 4-on/4-off blocks (03-game-feel §2.4).
  if (p.iframes > 0 && Math.floor(p.iframes / 4) % 2 === 1) ctx.globalAlpha = 0.35;

  const r = p.w / 2;
  ctx.fillStyle = p.state === 'dead' ? PALETTE.hazard : PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + r);
  ctx.arc(p.x + r, p.y + r, r, Math.PI, 0);
  ctx.lineTo(p.x + p.w, p.y + p.h - r);
  ctx.arc(p.x + r, p.y + p.h - r, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // One ink eye, on the facing side: the cheapest possible facing read.
  ctx.fillStyle = PALETTE.playerInk;
  ctx.fillRect(p.x + r + p.facing * 2 - 1, p.y + 5, 2, 3);
  ctx.globalAlpha = 1;
}
