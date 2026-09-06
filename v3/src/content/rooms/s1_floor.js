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
// The east end of the floor is the hatch down to the Core. It has been visible
// since minute one and it stays shut until Twin Pin; the void itself — fourteen
// tiles of it, and the chain-zip that crosses it — is on the other side, in K1.
// The two dead posts overhead are what it looks like from up here.

export const id = 's1_floor';

export const tiles = `
################################
#..............................#
D.......................W......#
D.......................W......#
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
D..............................D
D...........L..................D
################################`;
//  # stone  W wood  M metal  S slag  c crumble  . empty  = one-way  ^ spike  D door  L lantern  ~ water  o pickup

/** @type {import('../../core/types.js').Door[]} */
export const doors = [
  { id: 'd_w', at: [0, 19], to: 'r5_hollow:d_e', requires: null },
  { id: 'd_up', at: [0, 10], to: 's2_awakening:d_down', requires: 'zip' },
  { id: 'd_core', at: [31, 19], to: 'k1_seal:d_w', requires: 'twinPin' },
  // Where the Plunge lands: high on the west wall, still falling.
  { id: 'd_plunge', at: [0, 3], to: 'x5_plunge:d_out', requires: 'twinPin' },
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
/**
 * The floor is walked three times. On the way out of the Roots it is the Height
 * gate and the climb to S2; after the Plunge it is the hatch at the east end, which
 * has been shut and visible since minute one; and on the Ascent it is the climb
 * again, with the void behind it.
 * @type {import('../../core/types.js').RouteVariant[]}
 */
export const variants = [
  // The Plunge lands high on the west wall and the fall stops on the upper shelf,
  // so this route starts up there and walks off its east lip rather than pretending
  // the player is on the floor.
  { needs: ['twinPin'], route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[10, 10], [20, 10], [24, 19], [28, 19], [31, 19]]) },
  { flags: ['ascent'], route: /** @type {import('../../core/types.js').Waypoint[]} */ ([[3, 19], [16, 19, 'climb:ur'], [10, 10], [0, 10]]) },
];


/** @type {number[]|null} */
export const macro = null;
