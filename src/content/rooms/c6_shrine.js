// C5 SHRINE — Reel, at the top of four steps and a shallow pool.
//
// Shrines are the only rooms in the game with nothing in them. Four steps, no
// enemies, no water deep enough to matter: the beat exists so that the thirty
// seconds after the pedestal are spent looking at the Weir next door and not at a
// health bar.

export const id = 'c6_shrine';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..........................o...D
#..........................#####
#..........................#####
#......................#########
#......................#########
#...............################
#...............################
#........#######################
D~~~L~~~~#######################
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 13], to: 'c5_undercroft:d_e', requires: null },
  { id: 'd_e', at: [31, 5], to: 'c7_weir:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [{ id: 'a_reel', kind: 'ability', at: [27, 5], ability: 'reel' }];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 13], [12, 11], [19, 9], [25, 7], [27, 5], [31, 5]]) };

/** @type {number[]|null} */
export const macro = null;
