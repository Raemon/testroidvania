// S4 GALLERY — tier four, and the BLIND gate.
//
// 06-revision-1 §A2 threw out the old Surface gate: bouncing off a wall does not get
// you *up* it. What replaced it is this room. There is exactly one pinnable surface
// — the wood block on the shelf — and the shelf it stands on is what stops every
// straight line from below. No throw from anywhere you can stand reaches it.
//
// The answer is the riveted east wall: bank off the metal, round the shelf, and the
// Pin lands in the wood. Then zip to it, kick east, and the door is on top of the
// rivets. That door is the only way on: the Apex is entered from the S5 landing a
// tier above (§A3), so this gate is climbed *on the way in*, ninety seconds after
// the Diver hands you Ricochet, and not for the first time on the Ascent.
//
// The wood is three columns wide, which is the difference between a gate and a
// coin flip: one column left a twelve-pixel window of floor to stand on and make
// the bank from. Three leaves twenty-four, which is a two-tile stand.
//
// There is a hatch in the west end of the gallery floor and a beam over it, and on
// the way in they are a tease and nothing else: a straight throw up through the
// hatch bites the beam, and a Zip leaves you hanging under it with one Pin, no way
// on, and nothing to do but let go. The Ascent is when that changes. With the
// second light you throw *from* the hang — down and right, into the gallery roof —
// and the fall between the two throws is the whole trick, exactly as K1 taught it.
// That is what puts A5 in the finale: the last tier of the climb is the chain-zip,
// over a floor the void is in the middle of eating.

export const id = 's4_gallery';

export const tiles = `
################################
#..............................#
#..............................#
#.WW...............#...........#
#..................#...........D
#.................#WWW.........D
#.................#WWW..MMMMMMM#
#.................#WWW..MMMMMMM#
##..##################..MMMMMMM#
#.......................MMMMMMM#
#.......................MMMMMMM#
#.......................MMMMMMM#
#.......................MMMMMMM#
D..............................D
D.....L........................D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_down', at: [31, 14], to: 's3_throat:d_up', requires: null },
  { id: 'd_up', at: [31, 5], to: 's5_crown:d_down', requires: 'ricochet' },
];

/** @type {{kind:string, at:[number,number]}[]} */
export const spawns = [];

/** @type {{kind:string, at:[number,number], to:[number,number]}[]} */
export const rails = [];

/** @type {{id:string, kind:string, at:[number,number], ability?:import('../../core/types.js').AbilityId, afterBoss?:string}[]} */
export const pickups = [];

/** Abilities this room's own route needs; the room test grants exactly these. */
/** @type {import('../../core/types.js').AbilityId[]} */
export const needs = ['zip', 'ricochet'];

// Ricochet is already in hand when the player first reaches this tier — it came
// from the Diver, two rooms ago — and the gate is climbed with it there and then.
export const hints = { route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[24, 14], [18, 14], [18, 14, 'climb:ur'], [26, 5], [31, 5]]) };

/**
 * The Ascent takes the hatch, not the bank. Same room, same door, and the only
 * tier of the climb that asks for the ability the Apex handed over last.
 * @type {import('../../core/types.js').RouteVariant[]}
 */
export const variants = [
  {
    needs: ['deepPin', 'twinPin'],
    flags: ['ascent'],
    route: /** @type {import('../../core/types.js').Waypoint[]} */ ([
      [2, 14],
      [2, 14, 'chain:u'],
      [2, 4, 'chain:dr'],
      [6, 7],
      [16, 7],
      [20, 4],
      [26, 5],
      [31, 5],
    ]),
  },
];

/** @type {number[]|null} */
export const macro = null;
