// K1 SEAL — the first room of the Core, and the Hazard gate (06-revision-1 §B).
//
// A void column seventeen tiles wide. One throw reaches eleven and a Zip only ever
// goes as far as the Pin did, so a single Pin cannot cross it: this is the room
// Twin Pin exists for. Two dead posts stand in the void. Throw the first Pin into
// the near post, zip to it, and — hanging there with nothing under you — throw the
// *second* Pin at the far post and zip again. Chain-zip, and the same button the
// player has been pressing since minute three (§C).
//
// The posts are deliberately high above the void: the second throw costs you the
// grip, so the fall while the Pin is in the air is the room's whole tension, and it
// has to be survivable at a human's reaction speed rather than a frame-perfect one.

export const id = 'k1_seal';

export const tiles = `
################################
#..............................#
#...........W.......W..........#
#...........W.......W..........#
#...........W.......W..........#
#...........W.......W..........#
#...........W.......W..........#
#...........W.......W..........#
#...........W.......W..........#
D...........W.......W..........D
D...........W.......W..........D
#######.....W.......W...########
#######^^^^^W^^^^^^^W^^^########
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 10], to: 's1_floor:d_core', requires: null },
  { id: 'd_e', at: [31, 10], to: 'k4_threshold:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip', 'twinPin'];

export const hints = {
  route: /** @type {import('../../core/types.js').Waypoint[]} */ ([
    [3, 10],
    [6, 10, 'chain:ur'],
    [11, 4, 'chain:r'],
    [19, 4, 'mantle'],
    [27, 10],
    [31, 10],
  ]),
};

/** @type {number[]|null} */
export const macro = null;
