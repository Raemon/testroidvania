// X2 BUTTRESS — the BLIND gate, and the only mandatory bank in the game.
//
// §A2 threw out the old Surface gate because bouncing off a wall does not get you
// up it. What is left is this: the one pinnable surface in the room is the wood
// strip behind the buttress, and the buttress stands between it and every tile a
// player can stand on. There is no straight line. The riveted plate on the west
// wall is the answer — bank around the corner, ride the Pin up, kick off onto the
// plate, and the door is at the top of it.
//
// The wood is three columns wide for the same reason S4's is: one column left a
// twelve-pixel window of floor to make the bank from, which is a coin flip and not
// a gate. It is the same shape as the Spine's own S4 gate, mirrored, one region
// later and with the floor taken out from under it. Nothing lives in here: a room that
// teaches a verb should only ever ask for the verb, which is why the Roots' own
// gate room is empty too.

export const id = 'x3_buttress';

export const tiles = `
################################
#..............................#
#....cc.......................c#
#...........#.................c#
D...........#..................#
D..........WWW.................#
#MMMMMMM...WWW.................#
#MMMMMMM...WWW.................#
#MMMMMMM...#####################
#MMMMMMM.......................#
#MMMMMMM.......................#
#MMMMMMM.......................#
#MMMMMMM.......................#
D..............................D
D........................L.....D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 14], to: 'x2_stair:d_w', requires: null },
  { id: 'd_w', at: [0, 5], to: 'x1_sentinel:d_e', requires: 'ricochet' },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip', 'ricochet'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[28, 14], [11, 14, 'climb:ul'], [5, 5], [0, 5]]) };

/** @type {number[]|null} */
export const macro = null;
