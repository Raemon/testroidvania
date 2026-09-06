/**
 * Terrain: chamfered, bevelled, hatched, and cached per room (05-aesthetic §3.3).
 *
 * Everything here is deterministic from the room id, so the whole room is drawn
 * once into an offscreen canvas the size of the room and blitted in one call per
 * frame. That matters twice over: it is what stops tiles looking like tiles (a
 * chamfer and a crack per cell would be hundreds of ops a frame otherwise), and
 * the material hatching is *gating information* — wood grain vs. stone ticks vs.
 * metal rivets is how the player knows what the Pin can bite — so it has to be
 * legible through the darkness overlay, not decoration that can be dropped.
 */

import { TILE } from '../../core/constants.js';
import { TILES } from '../../content/tiles.js';
import { createSurface, SurfaceCache } from './surface.js';
import { cosmeticRng, seedFrom } from './rng.js';
import { PLAYER, materialLook, rgba, shade } from './palette.js';
import { setMemoryMask } from './darkness.js';

/** @typedef {import('../../core/types.js').Room} Room */
/** @typedef {import('./palette.js').Region} Region */
/** @typedef {import('./surface.js').Surface} Surface */
/** @typedef {import('./view.js').View} View */

/** 45-degree cut on every exposed convex corner. The signature of the shape language. */
const CHAMFER = 4;
/** Ceiling on a baked room canvas, so a huge room degrades rather than explodes. */
const MAX_CACHED_PX = 8192;

const cache = new SurfaceCache();

/**
 * @param {Room} room
 * @param {number} tx
 * @param {number} ty
 * @returns {boolean} true outside the room, so a room's border reads as solid mass
 */
function solid(room, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return true;
  const glyph = room.grid[ty]?.[tx] ?? '.';
  return TILES[glyph]?.solid === true;
}

/**
 * The material face pattern. These are drawn *inside* the cell, in a colour a
 * couple of steps off the fill, and at an alpha chosen so that what survives the
 * overlay is still legible — the hatch is gating information, so "visible only in
 * full light" is the same as "not there".
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => number} rnd
 * @param {import('./palette.js').MaterialLook} look
 * @param {number} x
 * @param {number} y
 */
function facePattern(ctx, rnd, look, x, y) {
  ctx.strokeStyle = look.hatch;
  ctx.lineCap = 'round';
  if (look.pattern === 'grain') {
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const o = 2 + i * 5 + rnd() * 2;
      ctx.moveTo(x + o, y + TILE);
      ctx.lineTo(x + o + 6, y);
    }
    ctx.stroke();
  } else if (look.pattern === 'crack') {
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.68;
    ctx.beginPath();
    const n = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const cx = x + 3 + rnd() * (TILE - 6);
      const cy = y + 3 + rnd() * (TILE - 6);
      const len = 2 + rnd() * 3;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + len, cy + (rnd() < 0.5 ? len : -len) * 0.5);
    }
    ctx.stroke();
  } else {
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = look.hatch;
    for (const [rx, ry] of [[4, 4], [12, 4], [4, 12], [12, 12]]) {
      ctx.beginPath();
      ctx.arc(x + (rx ?? 0), y + (ry ?? 0), 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * @param {Room} room
 * @param {Region} region
 * @param {number} scale
 * @returns {Surface}
 */
function bakeRoom(room, region, scale) {
  const s = createSurface(room.w * TILE * scale, room.h * TILE * scale);
  const ctx = s.ctx;
  // Baked at *device* scale, not world scale. The room is then blitted 1:1, which
  // both skips the per-frame upscale filter (the single most expensive draw in
  // the frame when it was there) and leaves the 1px bevels genuinely crisp
  // instead of resampled.
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const rnd = cosmeticRng(seedFrom(`${room.id}:terrain`));
  const dark = shade(region.terrain, -0.45);

  // The solid mass is filled as one path, not as a `fillRect` per cell. Under a
  // fractional device transform (which is most real window sizes) two abutting
  // anti-aliased rectangles each cover their shared edge partially, and partial
  // plus partial does not sum to opaque — so every wall showed a faint grid of
  // its own tiles. One path has no interior edges to antialias.
  const mass = new Path2D();
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      const def = TILES[room.grid[ty]?.[tx] ?? '.'];
      if (!def || !def.solid || def.crumble || def.oneWay) continue;
      mass.rect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  ctx.fillStyle = region.terrain;
  ctx.fill(mass);

  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      const glyph = room.grid[ty]?.[tx] ?? '.';
      const def = TILES[glyph];
      if (!def) continue;
      const x = tx * TILE;
      const y = ty * TILE;

      if (def.oneWay) {
        drawPlatform(ctx, region, x, y);
        continue;
      }
      // Crumble tiles are drawn live (render/props.js): baking them would mean
      // re-baking the whole room every time one gave way.
      if (!def.solid || def.crumble) continue;

      const look = materialLook(def.material ?? 'stone');
      const up = solid(room, tx, ty - 1);
      const down = solid(room, tx, ty + 1);
      const left = solid(room, tx - 1, ty);
      const right = solid(room, tx + 1, ty);

      // Mortar: one cell in six carries a crack, so a wall of identical tiles
      // stops repeating without any per-cell cost at runtime.
      if (rnd() < 1 / 6) {
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        const vertical = rnd() < 0.5;
        const o = 3 + rnd() * (TILE - 6);
        if (vertical) { ctx.moveTo(x + o, y + 1); ctx.lineTo(x + o + (rnd() - 0.5) * 3, y + TILE - 1); }
        else { ctx.moveTo(x + 1, y + o); ctx.lineTo(x + TILE - 1, y + o + (rnd() - 0.5) * 3); }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Any exposed face, not just the top. A wall's *face* is the surface the
      // player throws the Pin at, so if only ledges are hatched, wood and stone
      // are indistinguishable exactly where telling them apart decides the throw.
      if (!up || !left || !right) facePattern(ctx, rnd, look, x, y);

      if (!up) {
        // Top light: a bevel plus a short gradient down the face, which is what
        // makes a flat block read as a lit surface rather than a rectangle. Its
        // brightness wobbles per cell so a long ledge is a lit edge and not a
        // drafting rule. The gradient is strong on purpose: it is the thing the
        // darkness has to *take away*, and a wash that hides nothing reads as a
        // colour cast rather than as an absence of light.
        ctx.fillStyle = rgba(look.edge, 0.78 + rnd() * 0.22);
        ctx.fillRect(x, y, TILE, 1.6);
        const g = ctx.createLinearGradient(0, y + 1.6, 0, y + 12);
        g.addColorStop(0, rgba(look.edge, 0.45));
        g.addColorStop(1, rgba(look.edge, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, y + 1.6, TILE, 10);
      }
      if (!down) {
        ctx.fillStyle = dark;
        ctx.fillRect(x, y + TILE - 1, TILE, 1);
      }
      if (!left) {
        ctx.fillStyle = rgba(look.edge, 0.4);
        ctx.fillRect(x, y, 1, TILE);
      }
      if (!right) {
        ctx.fillStyle = rgba(look.edge, 0.4);
        ctx.fillRect(x + TILE - 1, y, 1, TILE);
      }
    }
  }

  chamferCorners(ctx, room);
  return s;
}

/**
 * Cut the exposed convex corners. Done as a second pass with `destination-out` so
 * the background shows *through* the cut — filling with a void colour would paint
 * a wrong-coloured notch over the parallax behind it.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 */
function chamferCorners(ctx, room) {
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      if (!solid(room, tx, ty)) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const up = solid(room, tx, ty - 1);
      const down = solid(room, tx, ty + 1);
      const left = solid(room, tx - 1, ty);
      const right = solid(room, tx + 1, ty);
      /** @param {number} cx @param {number} cy @param {number} sx @param {number} sy */
      const cut = (cx, cy, sx, sy) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * CHAMFER);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * CHAMFER, cy);
        ctx.closePath();
        ctx.fill();
      };
      if (!up && !left) cut(x, y, 1, 1);
      if (!up && !right) cut(x + TILE, y, -1, 1);
      if (!down && !left) cut(x, y + TILE, 1, -1);
      if (!down && !right) cut(x + TILE, y + TILE, -1, -1);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * One-way platforms read as a plank you can pass through: thin, warm-edged, and
 * with visible gaps at both ends so they are never mistaken for solid terrain.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Region} region
 * @param {number} x
 * @param {number} y
 */
function drawPlatform(ctx, region, x, y) {
  const look = materialLook('wood');
  ctx.fillStyle = shade(region.terrain, 0.14);
  ctx.fillRect(x, y + 1, TILE, 5);
  ctx.fillStyle = look.edge;
  ctx.fillRect(x, y + 1, TILE, 1.5);
  ctx.fillStyle = rgba(look.hatch, 0.7);
  ctx.fillRect(x + 3, y + 3, 3, 1);
  ctx.fillRect(x + 10, y + 3, 3, 1);
}


/**
 * Blit only the part of a baked room the camera can see. Rooms are much bigger
 * than the screen, and a full-room blit makes the cost of drawing terrain scale
 * with the room instead of with the window.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Surface} s
 * @param {View} v
 * @param {number} alpha
 */
function blitRoom(ctx, s, v, alpha) {
  // Source and destination are the same size and both land on integer device
  // pixels, so this is a straight copy. A blit whose scale is 1.067 because the
  // bake resolution was quantised takes a resampling path that costs six times
  // as much, and that one factor was most of the frame.
  const sx = Math.max(0, -v.originX);
  const sy = Math.max(0, -v.originY);
  const sw = Math.min(s.w - sx, v.width - Math.max(0, v.originX));
  const sh = Math.min(s.h - sy, v.height - Math.max(0, v.originY));
  if (sw <= 0 || sh <= 0) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(s.canvas, sx, sy, sw, sh, v.originX + sx, v.originY + sy, sw, sh);
  ctx.globalAlpha = 1;
  ctx.setTransform(v.scale, 0, 0, v.scale, v.originX, v.originY);
}

/**
 * @param {Room} room
 * @param {Region} region
 * @param {number} scale device pixels per world unit
 * @returns {Surface|null} null for rooms too large to bake
 */
export function roomSurface(room, region, scale) {
  const q = room.w * TILE * scale > MAX_CACHED_PX || room.h * TILE * scale > MAX_CACHED_PX ? 1 : scale;
  return cache.get(`room|${room.id}|${region.id}|${q.toFixed(3)}`, () => bakeRoom(room, region, q));
}

/**
 * Draws the baked room 1:1 in device space. The caller passes the transform
 * rather than the renderer inferring it, so the rounding that keeps the blit
 * pixel-aligned happens in exactly one place.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 * @param {Region} region
 * @param {View} v
 * @param {number} [alpha]
 */
export function drawTerrain(ctx, room, region, v, alpha = 1) {
  const s = roomSurface(room, region, v.scale);
  if (s) blitRoom(ctx, s, v, alpha);
}

/** @type {{key:string, surface:Surface}|null} */
let maskSurface = null;

/** @param {Room} room @returns {Surface} a 1px-per-tile scratch canvas */
function maskFor(room) {
  const key = `${room.id}`;
  if (maskSurface && maskSurface.key === key) return maskSurface.surface;
  const surface = createSurface(room.w, room.h);
  maskSurface = { key, surface };
  return surface;
}

let maskSig = 0;

/**
 * Repaint the remembered-tile mask when it has changed, and hand it to the
 * darkness overlay to punch.
 *
 * The mask is one *pixel* per tile — a whole room's memory is a few hundred
 * bytes — and the reveal happens by lifting the darkness rather than by drawing
 * the terrain a second time, which is one full-screen pass cheaper per frame.
 * @param {Room} room
 * @param {number[]} rows one bitmask per tile row
 * @param {number} alpha
 * @param {View} v
 */
export function updateMemoryMask(room, rows, alpha, v) {
  if (!rows || rows.length === 0) {
    setMemoryMask(null);
    return;
  }
  let sig = rows.length;
  for (let i = 0; i < rows.length; i++) sig = (Math.imul(sig, 31) + (rows[i] ?? 0)) | 0;
  const mask = maskFor(room);
  if (sig !== maskSig) {
    maskSig = sig;
    mask.ctx.clearRect(0, 0, mask.w, mask.h);
    mask.ctx.fillStyle = '#000000';
    for (let ty = 0; ty < rows.length && ty < room.h; ty++) {
      const bits = rows[ty] ?? 0;
      if (bits === 0) continue;
      for (let tx = 0; tx < room.w; tx++) {
        if ((bits >>> tx) & 1) mask.ctx.fillRect(tx, ty, 1, 1);
      }
    }
  }
  setMemoryMask({
    mask: mask.canvas,
    x: -v.camX, y: -v.camY,
    w: room.w * TILE, h: room.h * TILE,
    alpha,
  });
}

/**
 * Water and doors are drawn separately from the baked terrain because both
 * animate; they are cheap enough to path every frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 * @param {Region} region
 * @param {{x:number,y:number,w:number,h:number}} view
 * @param {number} t seconds
 */
export function drawFluids(ctx, room, region, view, t) {
  const tx0 = Math.max(0, Math.floor(view.x / TILE));
  const tx1 = Math.min(room.w - 1, Math.floor((view.x + view.w) / TILE));
  const ty0 = Math.max(0, Math.floor(view.y / TILE));
  const ty1 = Math.min(room.h - 1, Math.floor((view.y + view.h) / TILE));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const glyph = room.grid[ty]?.[tx] ?? '.';
      const x = tx * TILE;
      const y = ty * TILE;
      if (glyph === '~') {
        const surface = (room.grid[ty - 1]?.[tx] ?? '.') !== '~';
        ctx.fillStyle = rgba(region.fog, 0.34);
        ctx.fillRect(x, y, TILE, TILE);
        if (surface) {
          ctx.strokeStyle = rgba(region.accent, 0.4);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + 1 + Math.sin(t * 2.1 + tx * 0.6) * 0.8);
          ctx.lineTo(x + TILE, y + 1 + Math.sin(t * 2.1 + (tx + 1) * 0.6) * 0.8);
          ctx.stroke();
        }
      } else if (glyph === 'D') {
        // A door is a slot of *warm* light: cream, not the region accent. The
        // accent belongs to things that are alive and may bite; cream is the
        // game's "this one is for you" colour, and a door and an enemy eye must
        // never be the same hue at a glance.
        const g = ctx.createLinearGradient(x, y, x + TILE, y);
        g.addColorStop(0, rgba(PLAYER.core, 0.05));
        g.addColorStop(0.5, rgba(PLAYER.core, 0.20 + 0.06 * Math.sin(t * 1.6)));
        g.addColorStop(1, rgba(PLAYER.core, 0.05));
        ctx.fillStyle = g;
        ctx.fillRect(x + 1, y, TILE - 2, TILE);
      }
    }
  }
}
