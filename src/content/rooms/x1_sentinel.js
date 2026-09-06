// X4 WATCH — the Apex miniboss, and the room that hands over A5 Twin Pin.
//
// The Sentinel is a scaled-up Shell running Charger AI: no new behaviour, only a
// bigger silhouette and two stone shoulder plates. Its armour is the Shell's — only
// above or behind — so the plates are not decoration, they are the way in.

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
#..............................#
#..............................#
#..............................D
#.....o....................L...D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 12], to: 's4_gallery:d_apex', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'sentinel', at: [20, 12] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [{ id: 'a_twinPin', kind: 'ability', at: [6, 12], ability: 'twinPin', afterBoss: 'sentinel' }];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[26, 12], [26, 12, 'fight'], [6, 12], [29, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
