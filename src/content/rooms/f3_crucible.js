// F3 CRUCIBLE — vents underfoot and the climb out over them.
//
// Two ember vents in the floor, a two-tile step, and then the region's one wooden
// thing: a shoring beam left in the roof. Eight tiles from the step to the gallery
// (§B: 8-11 with wood in the throw lane) makes this a Height gate the player has
// already been taught to read — the Foundry is not where Zip is learned, it is
// where Zip is assumed.
//
// BARRIER TEASE #2 hangs off the gallery: a slag plate over a nook with a lantern
// in it, at eye level from the floor and unopenable until the Stoker is dead.

export const id = 'f3_crucible';

export const tiles = `
################################
#..............................#
#..............................#
#............W.................#
#............W.................#
#............W.................D
#............W.................D
#............W..################
#............W...........#######
#............W...........S....##
#............W...........S.L..##
#............W...........#######
#............W.................#
#............W.................#
#..............................#
D.................######.......#
D...L.............######.......#
########^^###^^#################
########^^###^^#################
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 16], to: 'f2_conveyor:d_e', requires: null },
  { id: 'd_e', at: [31, 6], to: 'f4_vents:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 16], [6, 16], [11, 16], [16, 16], [20, 14, 'climb:ul'], [24, 6], [31, 6]]) };

/** @type {number[]|null} */
export const macro = null;
