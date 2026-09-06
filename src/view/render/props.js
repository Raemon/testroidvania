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
    drawLantern(ctx, region, t, l.x, l.y + TILE / 2, on);
  }
  drawRelit(ctx, state, region, t);
}

/**
 * The ending's relight trail (`ascent.js` stageHull): one light per save-lantern
 * the run lit, spread along the Hull behind the runner.
 *
 * They arrive as bare entries in `state.lights`, which the darkness reads and
 * nothing else did — so the payoff for exploring the whole map was a slightly
 * less dark corridor. Drawn as the same iron-and-flame lantern the four beacons
 * are, the trail is a row of lamps you lit, which is what it was always meant to
 * be. Still no new sim state: the lights are the data, this just believes them.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Region} region
 * @param {number} t seconds
 */
function drawRelit(ctx, state, region, t) {
  const own = state.roomData.lanterns ?? [];
  for (const l of state.lights ?? []) {
    if (l.kind !== 'lantern') continue;
    if (own.some((o) => Math.abs(o.x - l.x) < 1 && Math.abs(o.y - l.y) < 1)) continue;
    // Snapped to the tile it stands in, so a trail lamp and a room lamp sit on
    // the same floor line rather than one of them floating.
    const base = Math.floor(l.y / TILE) * TILE + TILE;
    drawLantern(ctx, region, t, l.x, base, true);
  }
}

/**
 * One lantern: iron, plinth, and a flame if it is lit.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Region} region
 * @param {number} t seconds
 * @param {number} x @param {number} base  the floor line it stands on
 * @param {boolean} on
 */
function drawLantern(ctx, region, t, x, base, on) {
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

  if (!on) return;
  // Lit lanterns breathe: a still flame reads as a decal, a moving one reads
  // as the room having been claimed.
  const h = 5.5 * (0.9 + hashNoise(Math.floor(t * 9) ^ Math.round(x)) * 0.2);
  teardrop(ctx, x, base - 8, h, h * 0.5, PLAYER.flame);
  teardrop(ctx, x, base - 8.5, h * 0.5, h * 0.24, PLAYER.core);
  drawGlow(ctx, x, base - 9, 30, PLAYER.flame, 0.4);
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
 * Pickups: a floating cream ember with orbiting motes, per 05 §7.1. The warm
 * glow ring at ~0.8 Hz is the game's one "this is for you" signal — and it only
 * says that if it is *not* the region accent. Accent is the colour of things that
 * are alive: enemy eyes, jelly tendrils, the drifting motes. A dormant charger
 * and a pickup rendered in the same cyan are the same object until one of them
 * charges you.
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
    drawGlow(ctx, x, y, 20, PLAYER.core, 0.6);
    drawGlow(ctx, x, y, 34, PLAYER.flame, 0.22);
    ctx.fillStyle = PLAYER.core;
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

/**
 * Rail tracks. Drawn faintly and behind everything, because the track is a
 * promise about where a platform will be — the player needs to read the path
 * before the platform arrives, not after.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../../core/types.js').Room} room
 * @param {Region} region
 */
export function drawRails(ctx, room, region) {
  for (const rail of room.rails ?? []) {
    const ax = rail.at[0] * TILE + TILE / 2;
    const ay = rail.at[1] * TILE + TILE / 2;
    const bx = rail.to[0] * TILE + TILE / 2;
    const by = rail.to[1] * TILE + TILE / 2;
    ctx.strokeStyle = rgba(region.edge, 0.22);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [ex, ey] of [[ax, ay], [bx, by]]) {
      ctx.beginPath();
      ctx.arc(ex ?? 0, ey ?? 0, 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/**
 * Rail platforms: the one dynamic solid in the game. They carry the full material
 * treatment (00-BIBLE §5) because whether the Pin can bite one is the whole point
 * of them, and a frozen one shows its bullseye core.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Region} region
 */
export function drawProps(ctx, state, region) {
  for (const prop of state.props ?? []) {
    const look = materialLook(prop.material ?? 'metal');
    ctx.fillStyle = shade(region.terrain, 0.10);
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.fillStyle = look.edge;
    ctx.fillRect(prop.x, prop.y, prop.w, 1.6);
    ctx.fillStyle = rgba(look.hatch, 0.75);
    for (let x = 3; x < prop.w - 2; x += 6) ctx.fillRect(prop.x + x, prop.y + prop.h * 0.55, 1.4, 1.4);

    // The bullseye is the mechanism core: the whole gating vocabulary in one ring.
    const cx = prop.x + prop.w / 2;
    const cy = prop.y + prop.h / 2;
    ctx.strokeStyle = prop.frozen ? rgba(PLAYER.flame, 0.9) : rgba(look.edge, 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(4, prop.h * 0.35), 0, Math.PI * 2);
    ctx.stroke();
    if (prop.frozen) drawGlow(ctx, cx, cy, 16, PLAYER.flame, 0.35);
  }
}
