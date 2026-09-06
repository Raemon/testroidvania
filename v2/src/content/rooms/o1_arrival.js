// Beats 0-2 of 03-game-feel §6: the drop-in landing, ten flat tiles to find
// max speed, then a 1-tile and a 2-tile step so Jump is discovered, not taught.

export const id = 'o1_arrival';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................D
#..............................D
#.................##############
#.................##############
#...........####################
################################
################################
################################
################################`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 9], to: 'o2_gaps:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[3, 12], [10, 12], [15, 11], [22, 9], [31, 9]]) };

/** @type {number[]|null} */
export const macro = null;
