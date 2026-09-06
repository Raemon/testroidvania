/**
 * Tilemap drawing. Plain rectangles with a top-edge bevel per material, which is
 * enough to read wood / stone / metal apart while the foundation is under test.
 * Replacing this file replaces the terrain look; nothing else depends on it.
 */

import { TILE } from '../../core/constants.js';
import { TILES } from '../../content/tiles.js';
import { PALETTE, MATERIAL_COLORS } from './palette.js';

/** @typedef {import('../../core/types.js').Room} Room */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Room} room
 * @param {{x:number, y:number, w:number, h:number}} viewRect world-space visible area
 */
export function drawTiles(ctx, room, viewRect) {
  const tx0 = Math.max(0, Math.floor(viewRect.x / TILE));
  const tx1 = Math.min(room.w - 1, Math.floor((viewRect.x + viewRect.w) / TILE));
  const ty0 = Math.max(0, Math.floor(viewRect.y / TILE));
  const ty1 = Math.min(room.h - 1, Math.floor((viewRect.y + viewRect.h) / TILE));

  for (let ty = ty0; ty <= ty1; ty++) {
    const row = room.grid[ty] ?? '';
    for (let tx = tx0; tx <= tx1; tx++) {
      const glyph = row[tx] ?? '.';
      const def = TILES[glyph];
      if (!def || (!def.solid && !def.oneWay && def.name !== 'door' && def.name !== 'water')) continue;
      const x = tx * TILE;
      const y = ty * TILE;

      if (def.name === 'door') {
        ctx.fillStyle = PALETTE.door;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x + 2, y, TILE - 4, TILE);
        ctx.globalAlpha = 1;
        continue;
      }
      if (def.name === 'water') {
        ctx.fillStyle = PALETTE.water;
        ctx.fillRect(x, y, TILE, TILE);
        continue;
      }
      if (def.oneWay) {
        ctx.fillStyle = PALETTE.platform;
        ctx.fillRect(x, y, TILE, 5);
        ctx.fillStyle = PALETTE.platformEdge;
        ctx.fillRect(x, y, TILE, 1.5);
        continue;
      }
      const colors = MATERIAL_COLORS[def.material ?? 'stone'] ?? MATERIAL_COLORS['stone'];
      ctx.fillStyle = colors?.fill ?? PALETTE.stone;
      ctx.fillRect(x, y, TILE, TILE);
      // Bevel only exposed top faces, so the silhouette of a mass reads as one shape.
      if ((room.grid[ty - 1]?.[tx] ?? '.') !== glyph) {
        ctx.fillStyle = colors?.edge ?? PALETTE.stoneEdge;
        ctx.fillRect(x, y, TILE, 1.5);
      }
    }
  }
}
