// Beat 8 of 06-revision-1 §F: THE PIN IS A WEAPON, and then it runs out.
//
// The crawler patrols the floor in front of a two-tile wood block, so it is always
// within carry range of something pinnable: the throw always nails it. Jab, and
// recall — and the light comes back to the hand at the moment the player is
// watching the crawler instead of the Pin. (The floor here used to have a two-tile
// pit in it, which the player walked into on the way to the pinned crawler; the
// beat was "pin it, walk, fall in a hole, get bitten". What is left of it is a
// one-tile notch — deep enough to turn the crawler round, which is what bounded
// its patrol to carry range of the wood, and too shallow to fall into.)
//
// East of the block: a 4-tile STONE wall, and a **charger on the floor in front of
// it**. It used to sit on the ledge on top, out of reach, twitching. On the floor
// it teaches two things for free. It cannot be pinned — there is nothing pinnable
// behind it, only stone — which is the mass/material rule stated in one throw. And
// because line-of-sight enemies chase *the light* and not the player (§D2), the
// way past it is to throw the Pin into the pen and go over the top while it runs
// at the light: the decoy the design promises and never showed.
//
// The throw that starts the decoy is also the first `pin.reject` in the game: the
// Pin hitting stone it cannot bite, two frames of flash, and no embed.

export const id = 'o6_weapon';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................D
#..............................D
#.......................########
#.......................########
D.................WW....########
D.................WW....########
##############.###WW############
##################WW############
##################WW############
##################WW############`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'o5_ladder:d_e', requires: null },
  { id: 'd_e', at: [31, 8], to: 'r1_gate:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'crawler', at: [16, 12] }, { kind: 'charger', at: [22, 12] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [6, 12], [10, 12, 'throw:r'], [16, 12, 'jab:r'], [16, 12, 'recall'], [19, 10], [19, 10, 'throw:r'], [26, 8], [26, 8, 'recall'], [31, 8]]) };

/** @type {number[]|null} */
export const macro = null;
