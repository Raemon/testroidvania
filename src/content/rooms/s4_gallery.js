// S4 GALLERY — tier four, and the BLIND gate.
//
// 06-revision-1 §A2 threw out the old Surface gate: bouncing off a wall does not get
// you *up* it. What replaced it is this room. There is exactly one pinnable surface
// — the wood strip high on the west wall — and a stone overhang stands between it
// and every position the player can stand in. No straight line reaches it.
//
// The answer is the riveted east wall: bank off the metal, round the overhang, and
// the Pin lands in the wood. Then zip to it. The Apex door is above the gate.

export const id = 's4_gallery';

export const tiles = `
################################
#..............................#
#..............................#
#..................#...........#
#..................#...........D
#.................#W...........D
#.................#W....MMMMMMM#
#.................#W....MMMMMMM#
#####################...MMMMMMM#
#.......................MMMMMMM#
#.......................MMMMMMM#
#.......................MMMMMMM#
#.......................MMMMMMM#
D..............................D
D.....L........................D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_down', at: [31, 14], to: 's3_throat:d_up', requires: null },
  { id: 'd_up', at: [31, 5], to: 's5_crown:d_down', requires: 'ricochet' },
  { id: 'd_apex', at: [0, 14], to: 'x2_stair:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip', 'ricochet'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[20, 14], [20, 14, 'climb:ur'], [26, 5], [31, 5]]) };

/** @type {number[]|null} */
export const macro = null;
