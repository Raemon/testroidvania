// C4 UNDERCROFT — the room where the Shell teaches the angle.
//
// The shells own the flooded corridor along the bottom and they own it completely:
// eight HP, armoured everywhere but above and behind, and too heavy to nail to a
// wall. The answer the room wants is not a fight, it is the ledge — you cross
// above them, and the four-tile break in that ledge is the price of the crossing.
//
// The parked raft over the corridor is the Gap gate's second tease. It sits on a
// track it cannot start by itself, one throw away from a walkway you are standing
// on, and it will not move for anything the player has yet.

export const id = 'c5_undercroft';

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
D..............................D
D..............................D
##############....##############
#..............................#
#.............W................#
#~~~~~~~~~~~~~W~~~~~~~~~~~~~~L~#
#~~~~~~~~~~~~~W~~~~~~~~~~~~~~~~#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'c4_channel:d_e', requires: null },
  { id: 'd_e', at: [31, 12], to: 'c6_shrine:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'shell', at: [20, 17] }, { kind: 'shell', at: [27, 17] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [{ kind: 'rail', at: [22, 15], to: [16, 15] }];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [8, 12], [13, 12], [18, 12], [24, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
