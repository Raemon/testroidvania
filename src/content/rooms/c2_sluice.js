// C1 SLUICE — the Cistern's front door, and the first water in the game.
//
// The bench is two steps inside it, because the Spine's tier-three gate is the
// last thing the player crossed and the first thing they will fall back to.
//
// Everything here is a promise about the region: a pool you walk straight through
// (water is scenery until the Basin makes it a room), a drifter idling four tiles
// over the walkway where it cannot touch you, and the shelf under the ceiling with
// the lantern on it — which is the way *out* of the Cistern, seen from below on the
// way in, fifteen minutes early. You come back through it and drop onto the door
// you are standing in now.

export const id = 'c2_sluice';

export const tiles = `
################################
#..............................#
#..............................#
D..............................#
D..........................L...#
#######........................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D..........WW......~~~~~~~~~~~~D
D...L......WW......~~~~~~~~~~~~D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 16], to: 's3_throat:d_cistern', requires: null },
  { id: 'd_e', at: [31, 16], to: 'c3_basin:d_w', requires: null },
  { id: 'd_wu', at: [0, 4], to: 'c3_basin:d_eu', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'drifter', at: [22, 11] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 16], [8, 16], [16, 16], [31, 16]]) };

/** @type {number[]|null} */
export const macro = null;
