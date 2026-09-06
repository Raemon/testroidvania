// C6/C9 — the Cistern's shrine and the Diver, folded into one room.
//
// The region hands over two abilities: A3 Reel from the shrine on the way in, and
// A4 Ricochet from the Diver on the way out. The Diver's **fins are stone**, which
// by this point in the ladder means Deep Pin freezes one mid-sweep — the ability the
// player got two regions ago, used offensively for the first time.

export const id = 'c1_diver';

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
D....L..o.................o....#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 's3_throat:d_cistern', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'diver', at: [22, 12] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [
  { id: 'a_reel', kind: 'ability', at: [8, 12], ability: 'reel' },
  { id: 'a_ricochet', kind: 'ability', at: [26, 12], ability: 'ricochet', afterBoss: 'diver' },
];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[4, 12], [8, 12], [12, 12, 'fight'], [26, 12], [2, 12], [0, 12]]) };

/** @type {number[]|null} */
export const macro = null;
