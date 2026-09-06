// Phase 1 test content. Throwaway: real rooms arrive in Phase 3.
// Exercises a 3-tile-tall ceiling corridor: a full jump slams the ceiling, so the
// corner correction and the head-bonk path both run. The spikes behind the end
// wall are unreachable on purpose — they exist so the hazard renderer has content.

export const id = 't3_ceiling';

export const tiles = `
################################
#..............................#
#..............................#
#....######################....#
#.........................#....#
D.........................#....#
D.........................#^^^^#
################################
################################
################################
################################
################################
################################
################################
################################
################################
################################`;

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 6], to: 't2_gap:d_e', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{id:string, kind:string, at:[number,number]}[]} */
export const pickups = [];

export const hints = { route: /** @type {[number,number][]} */ ([[1, 6], [12, 6], [25, 6]]) };

/** @type {number[]|null} */
export const macro = null;
