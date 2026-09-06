// R1 GATE — the way into the Roots, and the first thing you cannot reach.
//
// The stone the opening ended on gives way to moss. The room descends in two
// steps to a floor with a thorn pit in it — 06-revision-1 §A1 says this stretch
// must never punish, so the pit is two tiles wide with a bottom you can stand on,
// and the checkpoint is on the near side of it.
//
// The wooden shelf overhead is HEIGHT GATE TEASE #1: ten tiles up, wood in the
// throw lane, an unlit save-lantern on it and a crawler walking past it. The base
// kit tops out at 6.5 tiles (§B), so it reads as a promise rather than a puzzle.

export const id = 'r1_gate';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#.....................L........#
#.................WWWWWWWWW....#
#.................WWWWWWWWW....#
D..............................#
D..............................#
########.......................#
########.......................#
########.......................#
############...................#
############...................D
############L..................D
################..##############
################^^##############
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 8], to: 'o6_weapon:d_e', requires: null },
  { id: 'd_e', at: [31, 14], to: 'r2_trunk:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'crawler', at: [20, 4] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 8], [6, 8], [9, 11], [12, 14], [14, 14], [22, 14], [31, 14]]) };

/** @type {number[]|null} */
export const macro = null;
