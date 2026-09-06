// C3 CHANNEL — the Cistern's horizontal verb, stated once and plainly.
//
// Four sluices in the floor, none of them deep enough to cost more than two
// seconds, and drifters holding station five tiles above the run. The drifters are
// the reason the sluices matter: the room can be walked, but it cannot be walked
// *slowly*, because a drifter that has finished its approach is standing exactly
// where the next jump starts.

export const id = 'c4_channel';

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
D..............................D
#########~~~~####~~~~~####~~~~##
#########~~~~####~~~~~####~~~~##
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 'c3_basin:d_e', requires: null },
  { id: 'd_e', at: [31, 12], to: 'c5_undercroft:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'drifter', at: [15, 7] }, { kind: 'drifter', at: [24, 6] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 12], [8, 12], [14, 12], [16, 12], [24, 12], [31, 12]]) };

/** @type {number[]|null} */
export const macro = null;
