// X3 WATCH — the Apex miniboss.
//
// The Sentinel is a scaled-up Shell running Charger AI: no new behaviour, only a
// bigger silhouette and two stone shoulder plates. Its armour is the Shell's — only
// above or behind — so the plates are not decoration, they are the way in.
//
// The way on is the shelf in the west corner, two tiles up. That is deliberate: a
// Charger's dash ends in knockback, and a floor-level door on the far side of an
// arena is a fight you can be shoved out of instead of winning.

export const id = 'x1_sentinel';

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
D..............................#
D..............................#
####...........................#
#..........................L...D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 12], to: 'x3_buttress:d_w', requires: null },
  { id: 'd_w', at: [0, 10], to: 'x4_shrine:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'sentinel', at: [20, 12] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['deepPin'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[26, 12], [26, 12, 'fight'], [6, 12], [0, 10]]) };

/** @type {number[]|null} */
export const macro = null;
