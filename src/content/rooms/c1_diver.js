// C9 — THE DIVER'S TANK. The Cistern's last room, which is why it is the one the
// Spine has always pointed at.
//
// The fight's shape is "you cannot reach it while it is under", so the answer is
// its **stone fins**: by the Cistern the player has Deep Pin, and freezing a fin
// mid-sweep holds the Diver on the surface long enough to hurt it. That is A2 used
// offensively, and it is the reason its parts are stone and not wood.
//
// The sluice gate on the east wall is shut until the Diver is dead, because it is
// *A4 that opens it* — the pedestal is four tiles from the door, so the ability and
// the first thing it does are ten seconds apart. Through it is the Basin's upper
// gallery: the way out crosses the top of the water the region opened with.
//
// The tank itself is drained to the floor plates. That is not decoration: a Pin
// thrown inside a water volume goes inert where it lands (§G), so a fight whose
// whole answer is a thrown Pin cannot be held in standing water.

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
D..............................D
D........................o.....D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'c8_rapids:d_e', requires: null },
  { id: 'd_e', at: [31, 12], to: 'c3_basin:d_wu', requires: 'ricochet' },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'diver', at: [22, 12] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [
  { id: 'a_ricochet', kind: 'ability', at: [25, 12], ability: 'ricochet', afterBoss: 'diver' },
];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['deepPin'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[4, 12], [8, 12], [12, 12, 'fight'], [25, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
