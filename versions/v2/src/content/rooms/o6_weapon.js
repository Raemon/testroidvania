// Beat 8 of 06-revision-1 §F: THE PIN IS A WEAPON, and then it runs out.
//
// The crawler patrols the three tiles between a shallow pit and a wood panel, so
// it is always within carry range of something pinnable: the throw always nails
// it. Jab, and recall — and the light comes back to the hand at the moment the
// player is watching the crawler instead of the Pin.
//
// The room ends at a 4-tile STONE wall with a charger prowling on top of it: the
// first thing the Pin cannot solve, and the reason Roots exists.

export const id = 'o6_weapon';

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
#.......................########
#.......................########
D.................WW....########
D.................WW....########
#############..###WW############
#############..###WW############
##################WW############
##################WW############`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'o5_ladder:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'crawler', at: [16, 12] }, { kind: 'charger', at: [26, 8] }];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [6, 12], [10, 12, 'throw:r'], [16, 12, 'jab:r'], [16, 12, 'recall'], [21, 12], [23, 12]]) };

/** @type {number[]|null} */
export const macro = null;
