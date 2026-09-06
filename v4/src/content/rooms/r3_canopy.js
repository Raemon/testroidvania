// R3 CANOPY — the first thing Zip is for, sixty seconds after the shrine.
//
// The canopy ledge is **nine tiles** above the floor with a hanging root in the
// throw lane: the Height gate exactly as §B defines it. Throw up-left into the
// root, ride the Pin, kick off it, and the ledge catches you — the same three
// beats the Spine's own S1->S2 gate asks for a minute later, which is the point.
//
// No enemies. 02-world-structure's minute-6 row calls for a rest beat here, and a
// room that teaches a new verb should only ever ask for the verb.

export const id = 'r3_canopy';

export const tiles = `
################################
#........W.....................#
#........W.....................#
#........W.....................#
#........W.....................#
#........W.....................#
#........W.....................#
#........W.....................D
#........W.....................D
#........W...###################
#........W.....................#
#........W.....................#
#........W.....................#
#........W.....................#
#........W.....................#
#..............................#
D..............................#
D...L..........................#
################################
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 17], to: 'o7_shrine:d_e', requires: null },
  { id: 'd_e', at: [31, 8], to: 'r4_vinerun:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 17], [10, 17], [17, 17, 'climb:ul'], [22, 8], [31, 8]]) };

/** @type {number[]|null} */
export const macro = null;
