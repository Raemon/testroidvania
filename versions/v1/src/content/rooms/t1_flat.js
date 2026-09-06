// Phase 1 test content. Throwaway: real rooms arrive in Phase 3.
// Exercises flat running at max speed and a 2-tile step up to the east door.

export const id = 't1_flat';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................D
#..............................D
#...................############
#...................############
################################
################################
################################
################################`;
//  # stone  W wood  M metal  . empty  = one-way  ^ spike  o pickup  D door  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 10], to: 't2_gap:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {[number,number][]} */ ([[3, 12], [18, 12], [22, 10], [31, 10]]) };

/** @type {number[]|null} */
export const macro = null;
