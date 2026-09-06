// K1 SEAL — the first room of the Core, and the Hazard gate (06-revision-1 §B).
//
// A void field thirteen tiles wide. One throw reaches eleven and a Zip never goes
// further than the Pin did, so a single Pin cannot cross it: this is the room Twin
// Pin exists for. One dead beam spans the ceiling above the void. Throw the first
// Pin up into it, zip, and hang under it; then — with nothing at all underneath —
// throw the *second* Pin at the far cliff and zip again. Chain-zip: the same button
// the player has been pressing since minute three (§C), asked for twice in a row.
//
// The anchor overhead is a ceiling beam rather than a pillar, and that is the whole
// design of the room. Hanging off the side of a pillar puts your shoulder against
// it, and the second throw buries itself in the thing you are already holding. A
// ceiling pin leaves you dangling in clear air with the whole void in front of you.
//
// The far cliff's face is wood for the same reason the beam is: the Core is dead
// machinery, and the two things in it the Pin can still bite are the two things the
// room is about.
//
// The fall is the room's tension. Throwing lets go, and the throw plus the flight
// spend about a third of the seven tiles under you — enough that a human has to
// mean it, not so little that it has to be frame-perfect.

export const id = 'k1_seal';

export const tiles = `
################################
#..............................#
#..............................D
#.........WWWWW................D
#....................W##########
#....................W##########
#....................W##########
#....................W##########
#....................W##########
D....................W##########
D....................W##########
########.............W##########
########^^^^^^^^^^^^^W##########
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 10], to: 's1_floor:d_core', requires: null },
  { id: 'd_e', at: [31, 3], to: 'k4_threshold:d_w', requires: null },
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
    [5, 10, 'chain:ur'],
    [11, 5, 'chain:r'],
    [20, 5, 'mantle'],
    [26, 3],
    [31, 3],
  ]),
};

/** @type {number[]|null} */
export const macro = null;
