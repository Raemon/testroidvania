// R5 SHRINE — the A1 gauntlet, and the ability that changes the game.
//
// 06-revision-1 §A1: Zip lands at ~minute 3, not minute 6. So this is the room
// straight after the crawler, it has no enemies, and it is three rising beats of
// nothing but wood: throw, stand, throw again, and then the pedestal.
//
// Everything east of the pedestal is the Roots exit, which drops the player at the
// Spine's tier-1 floor (§A3) with the Foundry door waiting above the gate.

export const id = 'o7_shrine';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#.......WW.....................#
D.......WW...........o..L......D
#.......WW.....................#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 8], to: 'o6_weapon:d_e', requires: null },
  { id: 'd_e', at: [31, 8], to: 's1_floor:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId}[]} */
export const pickups = [
  { id: 'a_zip', kind: 'ability', at: [21, 8], ability: 'zip' },
];

/** Abilities the room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 8], [5, 8, 'throw:r'], [5, 8, 'recall'], [12, 8], [21, 8], [31, 8]]) };

/** @type {number[]|null} */
export const macro = null;
