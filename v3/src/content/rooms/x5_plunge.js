// X6 THE PLUNGE — a hundred and fifty tiles of nothing to do.
//
// This room is the payment. Every other room in the Apex asks for something; this
// one asks for the direction you are already falling. Twenty seconds earlier the
// player took the second Pin off a pedestal four tiles from this door, and the
// only thing that happens in here is that the Vessel goes past in the order it was
// climbed — crumble, then rivets, then roots, then the Cistern's overflow, then
// the Spine's own stone — and then the floor of the world arrives.
//
// It is deliberately empty. Nothing to dodge, nothing to time, no lantern, no
// enemy. The shaft's east half is kept clear the whole way down so that the fall
// is never interrupted by a ledge the player did not ask for.

export const id = 'x5_plunge';

export const tiles = `
################
#..............#
#..............#
#..............D
#..............D
#..............#
#..............#
#ccccc.........#
#ccccc.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#ccccc.........#
#ccccc.........#
#..............#
#..............#
#.....cc.......#
#..............#
#..............#
#ccccc.........#
#ccccc.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#ccccc.........#
#ccccc.........#
#..............#
#.....MM.......#
#..............#
#..............#
#..............#
#MMMMM.........#
#MMMMM.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#MMMMM.........#
#MMMMM.........#
#.....MM.......#
#..............#
#..............#
#..............#
#..............#
#MMMMM.........#
#MMMMM.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#MMMMM.........#
#MMMMMMM.......#
#..............#
#..............#
#..............#
#..............#
#..............#
#WWWWW.........#
#WWWWW.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#WWWWWWW.......#
#WWWWW.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#WWWWW.........#
#WWWWW.........#
#..............#
#..............#
#..............#
#..............#
#.....WW.......#
#WWWWW.........#
#WWWWW.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#~~~~~.........#
#~~~~~.........#
#..............#
#..............#
#..............#
#.....~~.......#
#..............#
#~~~~~.........#
#~~~~~.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#~~~~~.........#
#~~~~~.........#
#..............#
#..............#
#.....~~.......#
#..............#
#..............#
#~~~~~.........#
#~~~~~.........#
#..............#
#..............#
#..............#
#..............#
#..............#
######.........#
######.........#
#..............#
#.....##.......#
#..............#
#..............#
#..............#
######.........#
######.........#
#..............#
#..............#
#..............#
#..............#
#..............#
######.........#
######.........#
#.....##.......#
#..............#
#..............#
#..............#
#..............#
######.........#
######.........#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............#
#..............D
#..............D
################
################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_top', at: [15, 4], to: 'x4_shrine:d_w', requires: null },
  // The floor of the Vessel. It is sealed to anyone coming the other way for the
  // same reason the hatch beside it is: a void shaft is a hazard gate, and the
  // second light is what makes it passable.
  { id: 'd_out', at: [15, 149], to: 's1_floor:d_plunge', requires: 'twinPin' },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['twinPin'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[13, 4], [12, 149], [15, 149]]) };

/** @type {number[]|null} */
export const macro = null;
