// S1 FLOOR — the bottom of the Spine, and the tier the Roots loop deposits you at.
//
// 06-revision-1 §A3: every region exit lands at the tier *floor*, and the next
// region's door sits above the tier's gate. So the Foundry is not here — it is in
// S2, on the far side of the HEIGHT GATE, which the player crosses within a minute
// of picking up Zip.
//
// The gate, measured against §B: the ledge is **9 tiles** up. A bare jump is 3.5
// and the best the base kit can do on wood is 6.5, so it is a real gate. The wood
// pillar is in the throw lane at exactly the diagonal the reach table describes:
// stand seven tiles out, throw up-right, and the Pin lands eight tiles up.
//
// The east wall is the void column down to the Core — the Hazard gate, eight tiles
// of it, with two wood posts to chain-zip between once Twin Pin exists.

export const id = 's1_floor';

export const tiles = `
################################
#..............................#
#.......................W......#
#.......................W......#
#.......................W......#
#.......................W......#
#.......................W......#
#.......................W......#
#.......................W......#
D.......................W......#
D.......................W......#
#####################...W......#
#.......................W......#
#.......................W......#
#.......................W......#
#.......................W......#
#........................W...W.#
#........................W...W.#
#..............................#
D...........L..........^^^^^^^^D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 19], to: 'o7_shrine:d_e', requires: null },
  { id: 'd_up', at: [0, 10], to: 's2_awakening:d_down', requires: 'zip' },
  { id: 'd_core', at: [31, 19], to: 'k1_seal:d_w', requires: 'twinPin' },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip'];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[3, 19], [16, 19, 'climb:ur'], [10, 10], [0, 10]]) };

/** @type {number[]|null} */
export const macro = null;
