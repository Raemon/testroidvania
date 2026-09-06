// K4 THRESHOLD — a save-lantern, and silence.
//
// 02-world-structure §4 gives minute 50 an intensity of 1, alone between a 4 and a
// 5. It is the only rest beat in the last ten minutes and it is not decoration: the
// Anchor is the hardest fight in the game and a player who walks into it out of a
// corridor of void fields arrives already spent.
//
// So: no enemies, no hazard, no gate, nothing to solve. A flat floor, a lantern in
// the middle of it, and a door at each end. Everything the room does, it does by
// not doing anything.

export const id = 'k4_threshold';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D..............................D
D.............L................D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 7], to: 'k1_seal:d_e', requires: null },
  { id: 'd_e', at: [31, 7], to: 'k5_anchor:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = {
  route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[3, 7], [14, 7], [26, 7], [31, 7]]),
};

/** @type {number[]|null} */
export const macro = null;
