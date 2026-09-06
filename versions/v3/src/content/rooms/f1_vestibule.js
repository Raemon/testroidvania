// F1 VESTIBULE — the Foundry's front room: a bench, a vent, and a caged charger.
//
// 02-world-structure gives the Foundry one verb, **timing**, and this room states
// the two things it will be timing against: an ember vent that is a hole in the
// floor rather than a decoration, and a Charger, which is introduced from above
// with slats between it and you.
//
// The slats are the honest version of a tutorial: the thing dashing at the light
// under your feet is exactly the thing that will be loose in F4, and the only
// reason it cannot reach you is that you are standing on the roof of its bay. The
// unlit lantern down there is the price of finding that out.

export const id = 'f1_vestibule';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D..............................#
D...L..........................#
#########......................#
#########......................#
#########......................#
##############.................#
##############.................D
##############.................D
################^^##======######
################^^##......######
####################....L.######
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 8], to: 's2_awakening:d_foundry', requires: null },
  { id: 'd_e', at: [31, 14], to: 'f2_conveyor:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'charger', at: [22, 17] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 8], [6, 8], [11, 11], [14, 14], [19, 14], [26, 14], [31, 14]]) };

/** @type {number[]|null} */
export const macro = null;
