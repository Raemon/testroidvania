// F5 ANTECHAMBER — the bench before the door.
//
// Nothing in it. 02-world-structure §4 puts a rest beat in front of every boss and
// AGENTS' checkpoint rule puts a save-lantern there; this room is both, and the
// two metal ribs are the only warning that the next room is riveted shut.

export const id = 'f5_antechamber';

export const tiles = `
################################
#.......M..............M.......#
#.......M..............M.......#
#.......M..............M.......#
#.......M..............M.......#
#.......M..............M.......#
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
  { id: 'd_w', at: [0, 12], to: 'f4_vents:d_e', requires: null },
  { id: 'd_e', at: [31, 12], to: 'f6_stoker:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [10, 12], [16, 12], [24, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
