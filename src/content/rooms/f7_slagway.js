// F7 SLAGWAY — three barriers, and the sixty seconds after A2.
//
// The tunnel runs back west underneath the Conveyor (02-world-structure §3), and
// it is roofed the whole way for one mechanical reason: a slag plate three tiles
// tall would otherwise be jumped rather than broken, and a gate you can walk over
// is not a gate.
//
// Pin a plate and the recall shatters the whole connected run — one throw, one
// recall, one door. Three of them, back to back, is 06-revision-1 §B's "pay off
// once" done three times because the ability deserves it.
//
// The charger under the slats is the region's parting shot: it can see you the
// whole way along and never reach you.

export const id = 'f7_slagway';

export const tiles = `
################################
################################
################################
################################
################################
################################
################################
################################
################################
################################
################################
################################
#.......S.......S.......S......#
D.......S.......S.......S......D
D...L...S.......S.......S......D
###########======###############
###########......###############
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 14], to: 'f6_stoker:d_e', requires: null },
  { id: 'd_e', at: [31, 14], to: 'f8_flue:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'charger', at: [12, 16] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['deepPin'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 14], [5, 14, 'throw:r'], [5, 14, 'recall'], [10, 14], [13, 14, 'throw:r'], [13, 14, 'recall'], [18, 14], [21, 14, 'throw:r'], [21, 14, 'recall'], [28, 14], [31, 14]]) };

/** @type {number[]|null} */
export const macro = null;
