/**
 * Room props: save-lanterns, crumble tiles and pickups.
 *
 * These are the three things in a room that are neither terrain nor a creature,
 * and all three are drawn live rather than baked into the room cache — a lantern
 * changes state, a crumble tile can be gone, and a pickup bobs. Baking them would
 * mean re-baking the room every time one of them changed.
 */

import { TILE } from '../../core/constants.js';
import { lanternId } from '../../core/light.js';
import { CREAM, PLAYER, materialLook, rgba, shade } from './palette.js';
import { drawGlow } from './glow.js';
import { teardrop } from './player.js';
import { hashNoise } from './rng.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./palette.js').Region} Region */

/**
 * A save-lantern: tall iron on a plinth, dark and dead until you walk through it,
 * then the only warm light in the room that is not in your own hand.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Region} region
 * @param {number} t seconds
 */
export function drawLanterns(ctx, state, region, t) {
  const lit = state.progress?.lanternsLit ?? [];
  for (const l of state.roomData.lanterns ?? []) {
    const on = lit.includes(lanternId(state.roomData.id, l.at));
    const x = l.x;
    const base = l.y + TILE / 2;

    // A filled iron body, not an outline: an unlit lantern that is only a wire
    // rectangle disappears into the background instead of reading as a thing you
    // have not yet claimed.
    ctx.fillStyle = shade(region.terrain, 0.20);
    ctx.fillRect(x - 6, base - 3, 12, 3);
    ctx.fillStyle = '#161A20';
    ctx.beginPath();
    ctx.moveTo(x - 4.5, base - 3);
    ctx.lineTo(x - 4.5, base - 15);
    ctx.lineTo(x, base - 19);
    ctx.lineTo(x + 4.5, base - 15);
    ctx.lineTo(x + 4.5, base - 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = on ? rgba(CREAM, 0.8) : rgba(CREAM, 0.32);
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, base - 21, 2, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();

    if (!on) continue;
    // Lit lanterns breathe: a still flame reads as a decal, a moving one reads
    // as the room having been claimed.
    const h = 5.5 * (0.9 + hashNoise(Math.floor(t * 9) ^ Math.round(x)) * 0.2);
    drawGlow(ctx, x, base - 9, 30, PLAYER.flame, 0.4);
    teardrop(ctx, x, base - 8, h, h * 0.5, PLAYER.flame);
    teardrop(ctx, x, base - 8.5, h * 0.5, h * 0.24, PLAYER.core);
  }
}

/**
 * Crumble tiles. Excluded from the baked room so that one giving way is a change
 * to a list, not a re-bake of the whole room.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Region} region
 * @param {{x:number, y:number, w:number, h:number}} view
 */
export function drawCrumble(ctx, state, region, view) {
  const room = state.roomData;
  const broken = state.brokenTiles ?? [];
  const look = materialLook('wood');
  const tx0 = Math.max(0, Math.floor(view.x / TILE));
  const tx1 = Math.min(room.w - 1, Math.floor((view.x + view.w) / TILE));
  const ty0 = Math.max(0, Math.floor(view.y / TILE));
  const ty1 = Math.min(room.h - 1, Math.floor((view.y + view.h) / TILE));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if ((room.grid[ty]?.[tx] ?? '.') !== 'c') continue;
      if (broken.includes(`${tx},${ty}`)) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = region.terrain;
      ctx.fillRect(x, y, TILE, TILE);
      // Dashed edges rather than a solid bevel: the tile is visibly not whole.
      ctx.strokeStyle = rgba(look.edge, 0.8);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x + 0.7, y + 0.7, TILE - 1.4, TILE - 1.4);
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba(look.hatch, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + TILE - 3);
      ctx.lineTo(x + TILE - 4, y + 4);
      ctx.moveTo(x + 8, y + TILE - 3);
      ctx.lineTo(x + TILE - 3, y + 8);
      ctx.stroke();
    }
  }
}

/**
 * Pickups: a floating accent ember with orbiting motes, per 05 §7.1. The warm
 * glow ring at ~0.8 Hz is the game's one "this is for you" signal.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Region} region
 * @param {number} t seconds
 */
export function drawPickups(ctx, state, region, t) {
  const taken = state.progress?.pickupsTaken ?? [];
  for (const pk of state.roomData.pickups ?? []) {
    if (taken.includes(pk.id)) continue;
    const x = pk.at[0] * TILE + TILE / 2;
    const y = pk.at[1] * TILE + TILE / 2 + Math.sin(t * Math.PI * 2 * 0.6) * 3;
    drawGlow(ctx, x, y, 20, region.accent, 0.6);
    ctx.fillStyle = region.accent;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = t * 1.4 + (i / 4) * Math.PI * 2;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(a * 2);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 4, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
