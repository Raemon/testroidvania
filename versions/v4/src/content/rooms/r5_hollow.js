// R5 HOLLOW — the way out of the Roots, and the region's one hopper.
//
// Two terraces down to the floor: gravity is the fast-travel system
// (02-world-structure §5.2), so the exit is downhill all the way.
//
// The hopper's hollow is four tiles deep and roofed with one-way slats. A hopper
// clears about two tiles, so it can never reach the walkway — you cross over the
// top of it and watch it try. It is the archetype's introduction with the sting
// taken out, which is what a room in the last minute of onboarding is for.
//
// The east door drops onto the Spine's tier-one floor (06-revision-1 §A3), with
// the S1->S2 Height gate waiting the moment you walk in with Zip.

export const id = 'r5_hollow';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D..............................#
D..............................#
#########......................#
#########......................#
#########......................#
#########......................#
###############................#
###############................D
###############...........L....D
#################======#########
#################......#########
#################......#########
#################......#########
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 8], to: 'r4_vinerun:d_e', requires: null },
  { id: 'd_e', at: [31, 15], to: 's1_floor:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'hopper', at: [19, 19] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 8], [7, 8], [11, 12], [16, 15], [20, 15], [26, 15], [31, 15]]) };

/** @type {number[]|null} */
export const macro = null;
