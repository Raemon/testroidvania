// F2 CONVEYOR — the Turret, and the rule that makes the Foundry a timing region.
//
// The gun is mast-mounted at the west end of the trench, so every step of the
// route runs *away* from it. That is not decoration: a bolt is aimed at where the
// light was 32 frames ago and travels at 2.4 against a run of 2.6, so it can never
// catch someone who keeps going and always catches someone who stops. Wait, go,
// wait — with the waiting done out of the lane.
//
// The Pin is the other answer. Thrown down the trench it is the nearest light the
// gun can see (§D2) and it will hammer that instead, which is the room where
// "where does my light go" first buys something.
//
// The slag plate in the nook over the east end is BARRIER TEASE #1: stone, so the
// Pin cannot even reach it until A2.

export const id = 'f2_conveyor';

export const tiles = `
################################
#.....M...................######
#.....M...................######
#.....M...................######
#.....M...................######
#.....M...................######
#.........................######
#.........................######
D.........................######
D.........................S...##
#####.....................S.L.##
#####.....................######
#####..........................#
#####..........................D
#####..........................D
################^^#####^^#######
################^^#####^^#######
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 9], to: 'f1_vestibule:d_e', requires: null },
  { id: 'd_e', at: [31, 14], to: 'f3_crucible:d_w', requires: null },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [{ kind: 'turret', at: [6, 6] }];

/**
 * The one conveyor in the Foundry with its power still on. It sweeps the six tiles
 * over the second spike pair, which is what makes this room a *timing* room rather
 * than a room about a gun: the bolt says go, and the conveyor says when.
 */
/** @type {{kind:string, at:[number,number], to:[number,number], running?:boolean}[]} */
export const rails = [{ kind: 'rail', at: [19, 13], to: [24, 13], running: true }];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[2, 9], [4, 9], [9, 14], [14, 14], [21, 14], [29, 14], [31, 14]]) };

/** @type {number[]|null} */
export const macro = null;
