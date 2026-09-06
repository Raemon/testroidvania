// F4 VENTS — the trough, and the two things across it you cannot have.
//
// The gantry runs out over eleven tiles of open vent and drops you on the near
// side of it. Eleven tiles is past a throw (176px is exactly the Pin's range) and
// four times a jump, with nothing pinnable in between and a dead conveyor parked
// over the middle: the GAP GATE, stated the way §B defines it, twelve minutes
// before Reel exists. The lantern on the far plinth is the reason to remember it.
//
// The chargers live in the trough. They can see you, they dash at your light, and
// the trough wall stops them every time — which is the same lesson as F1's slats
// told from the other side, and the reason falling in is the mistake this room
// punishes.

export const id = 'f4_vents';

export const tiles = `
################################
#...................############
#...................############
#...................############
#...................############
#...................S....#######
D...................S.L..#######
D...................############
#################..............#
#################..............#
#..............................#
#..............................#
#..............................#
#..............................#
#.L............................#
####...........................#
####...........................D
####...........................D
####^^^^^^^^^^^#################
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 7], to: 'f3_crucible:d_e', requires: null },
  { id: 'd_e', at: [31, 17], to: 'f5_antechamber:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'charger', at: [7, 18] }, { kind: 'charger', at: [12, 18] }];

/** Parked over the trough: the ferry that only A3 can start. */
/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [{ kind: 'rail', at: [8, 15], to: [11, 15] }];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 7], [9, 7], [16, 7], [20, 17], [26, 17], [29, 17], [31, 17]]) };

/** @type {number[]|null} */
export const macro = null;
