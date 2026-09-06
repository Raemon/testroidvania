// X1 STAIR — the Apex's front door, and its thesis stated in one room.
//
// Five ledges hanging in the dark with nothing under them, climbed west, and
// nothing new to learn. That is the region: everything the player already has,
// stacked, with the floor five tiles below every mistake.
//
// The treads are crumble stone, which in the Apex is a *material* rule and not a
// trap: the Pin will not bite anything you are standing on up here, so the ledges
// have to be taken as jumps. The hoppers in the pit can reach three and a half
// tiles, which is one tile short of the lowest ledge — they are what a fall costs,
// and the wood post in the corner is how a fall is paid for.

export const id = 'x2_stair';

export const tiles = `
################################
#..............................#
#..............................#
D..............................#
D..............................#
######.........................#
#..............................#
#.....cccccc...................#
#..............................#
#...........cccccc.............#
#..............................#
#.................cccccc.......D
#.........................L....D
#.......................########
#..............................#
#..........................W...#
#..........................W...#
#..........................W...#
#..........................W...#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 12], to: 's4_gallery:d_apex', requires: null },
  { id: 'd_w', at: [0, 4], to: 'x3_buttress:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'hopper', at: [10, 18] }, { kind: 'hopper', at: [20, 18] }, { kind: 'shell', at: [25, 18] }, { kind: 'drifter', at: [16, 16] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[29, 12], [26, 12], [21, 10], [15, 8], [9, 6], [3, 4], [0, 4]]) };

/** @type {number[]|null} */
export const macro = null;
