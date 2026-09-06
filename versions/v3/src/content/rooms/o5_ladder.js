// Beat 7 of 06-revision-1 §F: THE PIN IS A LADDER — the spacing lesson, and the
// single most important teaching room in the game.
//
// The wall is **6 tiles**. It was 5, and at 5 the horizontal throw missed the top
// by 9.3px — which every platformer player reads as "I mistimed the jump", not as
// "stand somewhere else". At 6 the same throw misses by 25.3px: a clean no, and
// the room's whole lesson is that the answer is where you stand.
//
// The answer: two tiles back, a 45-degree throw. The Pin lands 40px up (the hand
// is 14px below the feet and the diagonal rises one px per px of run, so a hand
// 24px from the face puts the shelf 40px up), the hop onto it is easy, and the
// jump off it clears the top with 15px to spare.

export const id = 'o5_ladder';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................D
#..............................D
#.....................WWWWWWWWW#
#.....................WWWWWWWWW#
#.....................WWWWWWWWW#
#.....................WWWWWWWWW#
D.....................WWWWWWWWW#
D.....................WWWWWWWWW#
######################WWWWWWWWW#
######################WWWWWWWWW#
######################WWWWWWWWW#
######################WWWWWWWWW#`;
//  # stone  W wood  M metal  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 6], to: 'o6_weapon:d_w', requires: null },
  { id: 'd_w', at: [0, 12], to: 'o4_step:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

/** Waypoints for the servo, in tile coords; y is the tile the feet rest on. */
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [12, 12], [19, 12, 'throw:ur'], [21, 9], [24, 6], [31, 6]]) };

/** @type {number[]|null} */
export const macro = null;
