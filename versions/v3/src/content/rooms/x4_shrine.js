// X5 SHRINE — Twin Pin, at the top of the last climb in the game.
//
// The room is the Roots' vine run mirrored: the same needle of wood, the same
// eight-tile diagonal, the same kick onto the same shelf — except that the run to
// the throwing mark is now a ledge with nothing under it, and the player has spent
// forty minutes since the last time this shape was the whole lesson.
//
// The pedestal sits four tiles from the door because the door is the Plunge, and
// the Plunge is what a second light is for.

export const id = 'x4_shrine';

export const tiles = `
################################
#.............W................#
#.............W........cc......#
#.............W................#
#.............W................#
#.............W...cc...........#
#.............W................#
#.............W................D
D.............W................D
D.o...........W...........######
###########...W...........######
#.............W...........######
#.............W...........######
#.............W...........######
#.............W...........######
#.............W...........######
#.........................######
#.........................######
#...c.....................######
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 8], to: 'x1_sentinel:d_w', requires: null },
  { id: 'd_w', at: [0, 9], to: 'x5_plunge:d_top', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'drifter', at: [20, 4] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [{ id: 'a_twinPin', kind: 'ability', at: [2, 9], ability: 'twinPin' }];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[29, 8], [26, 8], [23, 18], [15, 18], [6, 18, 'climb:ur'], [4, 9], [2, 9], [0, 9]]) };

/** @type {number[]|null} */
export const macro = null;
