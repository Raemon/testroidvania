// S5 CROWN — the summit, the landing, and the door out onto the Apex.
//
// The Crown door itself stays sealed until the finale (06-revision-1 §A3), so on
// the way up this room is a landing, a save-lantern, and two steps to the hatch in
// the west wall. §A3 puts the Apex door *here*, at the S5 landing, and that is the
// whole reason the Blind gate one tier below gets climbed on the way in rather
// than being met for the first time at minute 35 with a chaser behind you.
//
// There is nothing here to fight. The Ascent is the finale, and this is where it
// ends: the second time through, the Crown is open and the run goes east.
//
// "Sealed until the finale" is a flag and not an ability, because it is not
// something the player carries — it is something that happened. The Anchor's death
// sets it, and the east door opens onto the outside of the Vessel.

export const id = 's5_crown';

export const tiles = `
################################
#..............................#
#..............................#
#..............................#
D..............................#
D..............................#
####...........................#
#..............................#
#...====.......................#
D..............................D
D...............L..............D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_down', at: [0, 10], to: 's4_gallery:d_up', requires: null },
  { id: 'd_apex', at: [0, 5], to: 'x2_stair:d_e', requires: null },
  { id: 'd_crown', at: [31, 10], to: 'e1_hull:d_w', requires: null, sealedUntil: 'ascent' },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = [];

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[16, 10], [6, 10], [6, 7], [2, 5], [0, 5]]) };

/**
 * The Ascent ends here, and the Crown opens east onto the hull of the Vessel.
 * @type {import('../../core/types.js').RouteVariant[]}
 */
export const variants = [
  { flags: ['ascent'], route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[4, 10], [16, 10], [28, 10], [31, 10]]) },
];

/** @type {number[]|null} */
export const macro = null;
