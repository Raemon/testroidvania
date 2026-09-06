// Beat 7 of 06-revision-1 §F: THE PIN IS A LADDER — the spacing lesson, and the
// single most important teaching room in the game.
//
// The wall is 5 tiles. A horizontal throw puts the shelf 16px up and 16+54.7 is
// visibly not 80. Two tiles back and a 45-degree throw puts it 40px up, which is
// both reachable from the floor and enough to clear the top. Where you stand is
// the whole answer, and the room is short enough that there is nothing else to try.

export const id = 'o5_ladder';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................D
#..............................D
#.....................WWWWWWWWW#
#.....................WWWWWWWWW#
#.....................WWWWWWWWW#
D.....................WWWWWWWWW#
D.....................WWWWWWWWW#
######################WWWWWWWWW#
######################WWWWWWWWW#
######################WWWWWWWWW#
######################WWWWWWWWW#`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 7], to: 'o6_weapon:d_w', requires: null },
  { id: 'd_w', at: [0, 12], to: 'o4_step:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [12, 12], [20, 12, 'throw:ur'], [21, 10], [23, 7], [31, 7]]) };

/** @type {number[]|null} */
export const macro = null;
