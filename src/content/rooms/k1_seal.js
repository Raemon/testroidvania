// K5 — the Anchor, and the last fight in the game.
//
// **Two phases only.** A grounded fight, and then at half health the arena floor
// gives way and it comes after you. Phase 3, the Crown, was cut (06-revision-1 §C):
// a third fight to build and tune for sixty seconds of scripted coda, when the
// Ascent is already the finale.

export const id = 'k1_seal';

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
D..............................#
DWW..L.........................#
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 12], to: 's1_floor:d_core', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'anchor', at: [22, 12] }];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[6, 12], [6, 12, 'fight'], [2, 12], [0, 12]]) };

/** @type {number[]|null} */
export const macro = null;
