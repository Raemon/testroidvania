// F7 STOKER — the Foundry boss, and the room that hands over A2 Deep Pin.
//
// The arena is riveted metal from wall to wall: the Pin clangs off every inch of it,
// including the Stoker itself. The only thing in here it will bite is the pair of
// wooden bellows on the Stoker's flanks, which is the design's best boss idea stated
// as a floor plan — **find the pinnable part while the rest is metal.**
//
// Hold a bellows open and the machine stops, the plates come down, and everything
// hurts it. Let go and it starts slamming again.

export const id = 'f1_stoker';

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
D..............................#
D...L.....................o....#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 's2_awakening:d_foundry', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'stoker', at: [16, 12] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [{ id: 'a_deepPin', kind: 'ability', at: [26, 12], ability: 'deepPin', afterBoss: 'stoker' }];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[8, 12], [8, 12, 'fight'], [26, 12], [2, 12], [0, 12]]) };

/** @type {number[]|null} */
export const macro = null;
