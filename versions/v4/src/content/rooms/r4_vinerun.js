// R4 VINE RUN — Zip again, with the floor made of thorns.
//
// You come in ten tiles above the gully and there is no way back up: the drop is
// the room saying the loop only goes one way. The thorn strip is a hole in the
// floor rather than spikes standing on it, so it reads as a gap and is crossed
// like one.
//
// The second mandatory Height gate: nine tiles, root in the lane, exit on the
// ledge. A crawler paces the far end of the gully behind its post, in reach of a
// throw and out of reach of anything else.

export const id = 'r4_vinerun';

export const tiles = `
################################
#................W.............#
#................W.............#
#................W.............#
#................W.............#
#................W.............#
#................W.............#
D................W.............#
D................W.............D
######...........W.............D
######...........W...###########
######...........W.............#
######...........W.............#
######...........W.............#
######...........W.............#
######...........W.............#
######.........................#
######.........................#
######.....................W...#
###########^^^##################
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 8], to: 'r3_canopy:d_e', requires: null },
  { id: 'd_e', at: [31, 9], to: 'r5_hollow:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'crawler', at: [29, 18] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 8], [5, 8], [8, 18], [16, 18], [25, 18, 'climb:ul'], [27, 9], [31, 9]]) };

/** @type {number[]|null} */
export const macro = null;
