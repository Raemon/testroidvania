/**
 * Compiles a room module's ASCII into the {@link Room} the sim consumes.
 *
 * Rooms are ASCII in JS modules (04-architecture §8) so a misplaced tile is
 * visible in a diff. Compilation is pure and cheap; `rooms/index.js` memoises it
 * because the compiled grid is shared, read-only state on every frame.
 */

import { TILE } from '../core/constants.js';
import { tileAt } from './tiles.js';

/** @typedef {import('../core/types.js').Room} Room */
/** @typedef {import('../core/types.js').Hazard} Hazard */
/** @typedef {import('../core/types.js').Door} Door */

/**
 * @typedef {object} RoomModule
 * @property {string} id
 * @property {string} tiles
 * @property {Door[]} doors
 * @property {{kind:string, at:[number,number]}[]} spawns
 * @property {{id:string, kind:string, at:[number,number]}[]} pickups
 * @property {{route:import('../core/types.js').Waypoint[]}} hints
 * @property {number[]|null} macro
 */

/**
 * @param {RoomModule} mod
 * @returns {Room}
 */
export function compileRoom(mod) {
  const grid = mod.tiles.split('\n').filter((row) => row.length > 0);
  const w = grid[0]?.length ?? 0;
  const h = grid.length;

  /** @type {Hazard[]} */
  const hazards = [];
  /** @type {{at:[number,number], x:number, y:number}[]} */
  const lanterns = [];
  for (let ty = 0; ty < h; ty++) {
    const row = grid[ty] ?? '';
    for (let tx = 0; tx < w; tx++) {
      const def = tileAt(row[tx] ?? '.');
      if (def.damage > 0) hazards.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE, kind: def.name });
      if (def.lantern) lanterns.push({ at: [tx, ty], x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
    }
  }

  return {
    id: mod.id,
    w,
    h,
    grid,
    doors: mod.doors,
    hazards,
    spawns: mod.spawns,
    pickups: mod.pickups,
    lanterns,
    route: mod.hints.route,
    macro: mod.macro,
  };
}
