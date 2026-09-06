// C2 BASIN — the first big water room, two screens of it, and the room the
// Cistern is remembered for.
//
// It is built twice over. The floor of the basin is the way in: a long flat swim
// east with the drifters holding station above it. Nineteen tiles up is the
// gallery, which is the way *out* — the loop comes back through it after the
// Diver, and the four-tile hole in its floor is there so that the walk out is
// spent looking down at the water you crossed on the way in.
//
// The ledge halfway up the east wall carries an unlit lantern. It is visible from
// the water, it is a Zip climb off the wood below it, and nothing needs it.

export const id = 'c3_basin';

export const tiles = `
################################
#..............................#
#..............................#
D..............................D
D..............................D
##############....##############
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#.........................WWWWW#
#.........................L....#
#.........................######
#..............................#
#..............................#
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
#~~~~~~~~~WW~~~~~~~~~~~~~~~~~~~#
D~~~~~~~~~WW~~~~~~~~~~~~~~~~~~~D
D~~~~~~~~~WW~~~~~~~~~~~~~~~~~~~D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 24], to: 'c2_sluice:d_e', requires: null },
  { id: 'd_e', at: [31, 24], to: 'c4_channel:d_w', requires: null },
  { id: 'd_wu', at: [0, 4], to: 'c1_diver:d_e', requires: 'ricochet' },
  { id: 'd_eu', at: [31, 4], to: 'c2_sluice:d_wu', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'drifter', at: [14, 20] }, { kind: 'drifter', at: [24, 19] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 24], [8, 24], [16, 24], [24, 24], [31, 24]]) };

/**
 * The gallery, east to west — the Cistern's exit. The four-tile break at x=14 is
 * the whole reason the walk is worth having: you cross it looking down at the
 * water you crossed on the way in, nineteen tiles below.
 * @type {import('../../core/types.js').RouteVariant[]}
 */
export const variants = [
  { needs: ['ricochet'], route: [[2, 4], [9, 4], [13, 4], [18, 4], [26, 4], [31, 4]] },
];

/** @type {number[]|null} */
export const macro = null;
