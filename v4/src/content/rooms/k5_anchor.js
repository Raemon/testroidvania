// K5 ANCHOR — the last fight, in the deepest room.
//
// **Two phases only** (06-revision-1 §C cut the third). It walks the floor and
// slams; at half health it leaves the floor and comes straight at you, ignoring
// terrain, because what it rides on is not standing on anything. Its pinnable parts
// are stone rings, which is why this fight is behind Deep Pin and not before it.
//
// The arena is a flat box with a low ceiling and no furniture. A boss whose second
// phase ignores walls does not want a room with places to hide: the only defence in
// phase two is distance, and distance is what the room is for.
//
// There is no door out of the east side. When the Anchor falls the floor goes with
// it and the finale takes over (`src/core/ascent.js`), so the way on is not a door
// the player walks through — it is the room disappearing.

export const id = 'k5_anchor';

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
D..............................#
D..............................#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 11], to: 'k4_threshold:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'anchor', at: [22, 11] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip', 'deepPin'];

export const hints = {
  route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[4, 11], [8, 11, 'fight'], [8, 11]]),
};

/** @type {number[]|null} */
export const macro = null;
