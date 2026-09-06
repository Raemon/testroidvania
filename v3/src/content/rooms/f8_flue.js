// F8 FLUE — the climb out, and the first stone the Pin has ever bitten.
//
// There is no wood in this shaft. Before A2 it is unclimbable by construction;
// after it, the same throw the player has made forty times lands in a stone rib
// and the room becomes a ladder — which is a better demonstration of Deep Pin than
// any amount of shattering, and it costs one material change.
//
// Nine tiles to the first shelf, five to the second, and out into the Spine's tier
// two beside the slag gate that A2 also opens (06-revision-1 §A3).

export const id = 'f8_flue';

export const tiles = `
################################
#........#.....#...............#
#........#.....#...............D
#........#.....#...............D
#........#.....#..##############
#........#.....#...............#
#........#.....................#
#........#.....................#
#........#.....................#
#........#...############......#
#........#.....................#
#........#.....................#
#........#.....................#
#........#.....................#
#........#.....................#
#..............................#
D..............................#
D..............................#
################################
################################
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 17], to: 'f7_slagway:d_e', requires: null },
  { id: 'd_e', at: [31, 3], to: 's2_awakening:d_out', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip', 'deepPin'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 17], [10, 17], [17, 17, 'climb:ul'], [20, 8, 'recall'], [20, 8, 'wait:10'], [20, 8, 'climb:ul'], [26, 3], [31, 3]]) };

/** @type {number[]|null} */
export const macro = null;
