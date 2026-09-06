// C3 CHANNEL — the Cistern's horizontal verb, stated once and plainly.
//
// Three sluices in the floor and drifters holding station four tiles above the
// run, which is a tile *inside* the arc of a full jump. That is the room: it can
// be walked, but it cannot be walked slowly and it cannot be jumped lazily,
// because a drifter that has finished its approach is hanging exactly where the
// top of the next jump is.
//
// The Shell stands in the second sluice, on its floor, and it is what a mistimed
// jump now costs. A sluice used to be two seconds; this one is armour facing the
// way you fell in, in a pit two tiles deep, and the answer is the Shell's own
// answer — get above it, or do not be down there at all.

export const id = 'c4_channel';

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
#########~~~~####~~~~~####~~~~##
#########~~~~####~~~~~####~~~~##
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'c3_basin:d_e', requires: null },
  { id: 'd_e', at: [31, 12], to: 'c5_undercroft:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'drifter', at: [15, 8] }, { kind: 'drifter', at: [24, 8] }, { kind: 'shell', at: [19, 14] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [{ kind: 'rail', at: [17, 12], to: [21, 12] }];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [8, 12], [14, 12], [16, 12], [24, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
