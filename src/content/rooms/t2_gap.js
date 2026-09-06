// Phase 1 test content. Throwaway: real rooms arrive in Phase 3.
// Exercises a 4-tile gap over a shallow pit, then a one-way platform that is the
// only way onto the 4-tile-tall east block — so the route must pass through it
// from below and land on top of it.

export const id = 't2_gap';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................D
#..............................D
#..........................#####
#..........................#####
D....................======#####
D..........................#####
#########....###################
#########....###################
################################
################################
################################
################################`;

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_e', at: [31, 6], to: 't3_ceiling:d_w', requires: null },
  { id: 'd_w', at: [0, 10], to: 't1_flat:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

export const hints = {
  route: /** @type {[number,number][]} */ ([[1, 10], [8, 10], [15, 10], [20, 10], [24, 8], [29, 6], [31, 6]]),
};

/** @type {number[]|null} */
export const macro = null;
