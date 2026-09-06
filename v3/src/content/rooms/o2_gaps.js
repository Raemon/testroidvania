// Beats 3-4 of 03-game-feel §6: two gaps over pits with floors, so falling
// costs two seconds and nothing else, then a 3-tile ceiling that punishes a
// full jump and rewards a tap.

export const id = 'o2_gaps';

export const tiles = `
################################
#......................#########
#......................#########
#......................#########
#......................#########
#......................#########
#......................#########
#......................#########
#......................#########
#......................#########
#..............................#
D..............................D
D..............................D
#########....####.....####.#####
#########...#####....#####.#####
################################
################################`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 12], to: 'o3_drop:d_w', requires: null },
  { id: 'd_w', at: [0, 12], to: 'o1_arrival:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [7, 12], [14, 12], [16, 12], [24, 12], [29, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
