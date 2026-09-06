// R2 TRUNK — the base kit's own climb, measured against the reach table.
//
// The east block is **six tiles** with a wood face: a horizontal throw is 4.25
// (§B) and visibly short, but three tiles back and a diagonal puts the shelf four
// tiles up, and the hop off it clears the lip. That is the whole room, and it is
// the last thing the Pin alone can climb.
//
// The gallery overhead is HEIGHT GATE TEASE #2 — nine tiles, wood, a lantern and a
// crawler on it, and no way up. Two teases, one payoff (r3), per §B.

export const id = 'r2_trunk';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#...........L..................#
#.......WWWWWWW................#
#.......WWWWWWW................#
#..............................D
#..............................D
#...................W###########
#...................W###########
#...................W###########
#...................W###########
D...................W###########
D...................W###########
##########...###################
##########^^^###################
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 16], to: 'r1_gate:d_e', requires: null },
  { id: 'd_e', at: [31, 10], to: 'o7_shrine:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'crawler', at: [9, 6] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 16], [7, 16], [16, 16], [17, 16, 'throw:ur'], [19, 13], [23, 10], [31, 10]]) };

/** @type {number[]|null} */
export const macro = null;
