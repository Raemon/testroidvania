// Beat 6 of 06-revision-1 §F: THE PIN IS A STEP.
//
// A 4-tile wood wall, which is the one height a bare jump (54.7px, measured)
// cannot clear and a throw-and-hop (16px + 54.7px) can. It is the only wood in
// the room. The player has one button they have not pressed.

export const id = 'o4_step';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................D
#..............................D
#...................WWWWWWWWWWW#
#...................WWWWWWWWWWW#
D...................WWWWWWWWWWW#
D...................WWWWWWWWWWW#
####################WWWWWWWWWWW#
####################WWWWWWWWWWW#
####################WWWWWWWWWWW#
####################WWWWWWWWWWW#`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 8], to: 'o5_ladder:d_w', requires: null },
  { id: 'd_w', at: [0, 12], to: 'o3_drop:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [10, 12], [17, 12, 'throw:r'], [19, 11], [22, 8], [31, 8]]) };

/** @type {number[]|null} */
export const macro = null;
