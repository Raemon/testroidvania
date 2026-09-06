// Beat 5 of 03-game-feel §6: the corridor ends in a shaft. Landing at terminal
// velocity is the loudest thing that has happened yet, and the save-lantern is
// right there — seen before it can matter, per the layout rules.

export const id = 'o3_drop';

export const tiles = `
########################
##########...###########
##########...###########
##########...###########
##########...###########
#............###########
D............###########
D............###########
##########...###########
##########.............#
##########.............#
##########.............#
##########.............#
##########.............#
##########.............#
##########.............#
##########.............D
##########....L........D
########################
########################`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [23, 17], to: 'o4_step:d_w', requires: null },
  { id: 'd_w', at: [0, 7], to: 'o2_gaps:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[4, 7], [8, 7], [11, 17], [14, 17], [19, 17], [23, 17]]) };

/** @type {number[]|null} */
export const macro = null;
