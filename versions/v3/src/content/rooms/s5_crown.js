// S5 CROWN — the summit, and the end of the ladder.
//
// The Crown door itself stays sealed until the finale (06-revision-1 §A3), so this
// room is a landing and a save-lantern. There is nothing here to fight and nothing
// to climb: the Ascent is the finale, and this is where it ends.
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
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
D..............................D
D...............L..............D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_down', at: [0, 10], to: 's4_gallery:d_up', requires: null },
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

export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[28, 10], [16, 10], [4, 10]]) };

/**
 * The Ascent ends here, and the Crown opens east onto the hull of the Vessel.
 * @type {import('../../core/types.js').RouteVariant[]}
 */
export const variants = [
  { flags: ['ascent'], route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[4, 10], [16, 10], [28, 10], [31, 10]]) },
];

/** @type {number[]|null} */
export const macro = null;
