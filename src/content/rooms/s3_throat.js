// S3 THROAT — tier three, and the GAP gate.
//
// Eleven tiles with no floor, which is past a throw and well past a jump, and
// nothing pinnable in between. The rail platform on the far side is parked: a rail
// that is already running is a free ride, so the reel is the shove that starts it.
// Pin the rail through its core, drag it to your end of its track, ride it back.
//
// The Cistern door is up the steps on the east wall, above this tier's own gate.

export const id = 's3_throat';

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
#.............................##
#..............................#
D...........................###D
D.......................L......D
###########...........##########
###########...........##########
###########^^^^^^^^^^^##########
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_down', at: [31, 12], to: 's2_awakening:d_up', requires: null },
  { id: 'd_up', at: [0, 12], to: 's4_gallery:d_down', requires: 'reel' },
  { id: 'd_cistern', at: [31, 8], to: 'c1_diver:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [{ kind: 'rail', at: [19, 12], to: [10, 12] }];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['deepPin', 'reel'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[26, 12], [23, 12, 'throw:l'], [23, 12, 'recall'], [20, 11], [20, 11, 'ride:11'], [6, 12], [0, 12]]) };

/** @type {number[]|null} */
export const macro = null;
