// E1 HULL — the ending (02-world-structure §6, denouement).
//
// The Crown opens onto the outside of the Vessel and the player runs right along a
// flat hull. Four beacons stand along it, one per region, and they light as they
// are passed: olive, ember, teal, violet, in the order the run went through them.
// Behind the runner, every save-lantern the run lit comes back on — which is what
// makes the ending longer and brighter for a player who explored, and is the whole
// payoff §D4 promised when it made unlit lanterns the collectible.
//
// Nothing here can hurt you and nothing here can be failed. The room is a corridor
// with no ceiling to speak of and one direction to go in, on purpose: the last
// thing the game asks of the player is to hold right.

export const id = 'e1_hull';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D......L......L......L......L..#
D..............................#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 7], to: 's5_crown:d_crown', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = {
  route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 7], [12, 7], [22, 7], [29, 7]]),
};

/** @type {number[]|null} */
export const macro = null;
