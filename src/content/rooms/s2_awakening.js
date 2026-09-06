// S2 AWAKENING — tier two, and the BARRIER gate.
//
// The Foundry loop puts the player back on this floor (06-revision-1 §A3), and the
// door out of the tier is the one explicit lock in the game: a slag block. Pin it
// and the recall shatters it — the whole block, because a door that opens one
// sixteenth of the way is not a door.
//
// The Foundry's own door is up the two steps on the east wall, above the gate the
// player crossed to get here, which is what makes the Spine a ruler and not a
// corridor.

export const id = 's2_awakening';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D..............................D
D..............................D
#...........................####
#..............................#
#.......S.................######
D.......S......................D
D.......S...........L..........D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_down', at: [31, 12], to: 's1_floor:d_up', requires: null },
  { id: 'd_up', at: [0, 12], to: 's3_throat:d_down', requires: 'deepPin' },
  { id: 'd_foundry', at: [31, 7], to: 'f1_vestibule:d_w', requires: null },
  // The Foundry loop comes back out onto this floor, beside the gate A2 opens.
  { id: 'd_out', at: [0, 7], to: 'f8_flue:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['deepPin'];

// The first visit is a walk up two steps to the Foundry's door; the Barrier gate is
// the *second* visit, on the way back from it (06-revision-1 §A3).
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[28, 12], [24, 12], [27, 9], [30, 7], [31, 7]]) };

/**
 * With Deep Pin in hand the tier's own gate is the job: pin the slag, recall, and
 * the whole block goes. The Ascent walks the same line, faster.
 * @type {import('../../core/types.js').RouteVariant[]}
 */
export const variants = [
  { needs: ['deepPin'], route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[28, 12], [12, 12, 'throw:l'], [12, 12, 'recall'], [4, 12], [0, 12]]) },
];

/** @type {number[]|null} */
export const macro = null;
