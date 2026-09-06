// C7 RAPIDS — the Cistern's peak, and the first room that asks for two abilities
// in the same breath.
//
// A five-tile sluice you clear on foot, then a seven-tile one you cannot: the raft
// is the only way over the second, and the shell in the water underneath it is
// what the second one costs. Drifters hold the ceiling so the run cannot be paused
// to think about it.
//
// The water under the raft runs *west*, back the way you came. That is the whole
// reason the ferry is worth waiting for: falling off it does not cost you a swim,
// it costs you the sluice, because the current hands you back to the near lip.
//
// The lantern on the east lip is the Cistern's last bench, and the door past it is
// the mouth of the Diver's tank.

export const id = 'c8_rapids';

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
D.........................L....D
#########~~~~#######.......#####
#########~~W#######<<<W<<<<#####
#########~~W#######<<<W<<<<#####
#########~~W#######<<<W<<<<#####
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'c7_weir:d_e', requires: null },
  { id: 'd_e', at: [31, 12], to: 'c1_diver:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'drifter', at: [15, 7] }, { kind: 'drifter', at: [24, 5] }, { kind: 'shell', at: [24, 16] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [{ kind: 'rail', at: [20, 12], to: [25, 12] }];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['deepPin', 'reel'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [8, 12], [13, 12], [14, 12], [18, 12, 'throw:r'], [18, 12, 'recall'], [20, 11], [20, 11, 'ride:25'], [27, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
