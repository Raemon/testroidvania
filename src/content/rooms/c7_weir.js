// C6 WEIR — the GAP gate, sixty seconds after the shrine that opens it.
//
// Measured against §B: the far ledge is **fourteen tiles** from the lip you stand
// on, which is past the Pin's 176px and well past a jump, and there is nothing
// pinnable in between — the raft is metal, so before Deep Pin it will not even
// hold the Pin, and after it a frozen raft is a raft that is still parked.
//
// Reel is the shove. Pin the raft, recall, and the drag brings it to your end of
// its track and *lets it go*: it sets off across the weir with you on it.

export const id = 'c7_weir';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D..............................D
##########..............########
##########~~~~~~W~~~~~~~########
##########~~~~~~W~~~~~~~########
##########~~~~~~W~~~~~~~########
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'c6_shrine:d_e', requires: null },
  { id: 'd_e', at: [31, 12], to: 'c8_rapids:d_w', requires: 'reel' },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [{ kind: 'rail', at: [11, 11], to: [22, 11] }];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['deepPin', 'reel'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[3, 12], [8, 12, 'throw:r'], [8, 12, 'recall'], [11, 10], [11, 10, 'ride:22'], [26, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
