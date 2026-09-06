/**
 * The tile vocabulary. A room's ASCII grid is looked up here one glyph at a time;
 * this table is the only place "solid" is defined for content.
 *
 * Materials are the bible's §5 three-way read (wood / stone / metal) and are what
 * the Pin gating and the renderer's edge treatment both key off, so a tile carries
 * its material even when nothing reads it yet.
 */

/** @typedef {import('../core/types.js').Material} Material */

/**
 * @typedef {object} TileDef
 * @property {string} glyph
 * @property {string} name
 * @property {boolean} solid     blocks movement on all four sides
 * @property {boolean} oneWay    blocks only downward movement, from above
 * @property {number} damage     contact damage per touch, 0 for none
 * @property {Material|null} material
 * @property {boolean} pinnable  the Pin embeds here (stone needs Deep Pin; Phase 2)
 * @property {boolean} crumble   gives way instead of holding the Pin (§G)
 * @property {boolean} lantern   a save-lantern, lit by walking through it (§E)
 * @property {boolean} slag      the Barrier gate: pin it, and the recall shatters it (A2)
 * @property {boolean} water     a water volume (§G: the Pin sinks slowly and stays lit)
 * @property {-1|0|1} current    a push volume's direction; 0 for still water and for
 *   everything that is not water at all
 * @property {boolean} door      a room transition
 */

/** @type {Record<string, TileDef>} */
export const TILES = {
  '.': { glyph: '.', name: 'empty', solid: false, oneWay: false, damage: 0, material: null, pinnable: false, crumble: false, lantern: false, slag: false, water: false, current: 0, door: false },
  '#': { glyph: '#', name: 'stone', solid: true, oneWay: false, damage: 0, material: 'stone', pinnable: true, crumble: false, lantern: false, slag: false, water: false, current: 0, door: false },
  'W': { glyph: 'W', name: 'wood', solid: true, oneWay: false, damage: 0, material: 'wood', pinnable: true, crumble: false, lantern: false, slag: false, water: false, current: 0, door: false },
  'M': { glyph: 'M', name: 'metal', solid: true, oneWay: false, damage: 0, material: 'metal', pinnable: false, crumble: false, lantern: false, slag: false, water: false, current: 0, door: false },
  // A one-way platform is not pinnable: the Pin passes straight through it (§G).
  '=': { glyph: '=', name: 'platform', solid: false, oneWay: true, damage: 0, material: 'wood', pinnable: false, crumble: false, lantern: false, slag: false, water: false, current: 0, door: false },
  'c': { glyph: 'c', name: 'crumble', solid: true, oneWay: false, damage: 0, material: 'wood', pinnable: false, crumble: true, lantern: false, slag: false, water: false, current: 0, door: false },
  '^': { glyph: '^', name: 'spike', solid: false, oneWay: false, damage: 1, material: null, pinnable: false, crumble: false, lantern: false, slag: false, water: false, current: 0, door: false },
  'D': { glyph: 'D', name: 'door', solid: false, oneWay: false, damage: 0, material: null, pinnable: false, crumble: false, lantern: false, slag: false, water: false, current: 0, door: true },
  'L': { glyph: 'L', name: 'lantern', solid: false, oneWay: false, damage: 0, material: null, pinnable: false, crumble: false, lantern: true, slag: false, water: false, current: 0, door: false },
  'o': { glyph: 'o', name: 'pickup', solid: false, oneWay: false, damage: 0, material: null, pinnable: false, crumble: false, lantern: false, slag: false, water: false, current: 0, door: false },
  '~': { glyph: '~', name: 'water', solid: false, oneWay: false, damage: 0, material: null, pinnable: false, crumble: false, lantern: false, slag: false, water: true, current: 0, door: false },
  // The Barrier gate. Stone, so the Pin cannot even reach it before Deep Pin, and
  // the only tile in the game that a recall destroys.
  'S': { glyph: 'S', name: 'slag', solid: true, oneWay: false, damage: 0, material: 'stone', pinnable: true, crumble: false, lantern: false, slag: true, water: false, current: 0, door: false },
  // Currents: water that pushes. The Cistern's second hazard (02 §2), and the one
  // that makes its water a decision — a current you swim against is a wall and one
  // you ride is a shortcut, out of the same tile with the arrow turned round.
  '>': { glyph: '>', name: 'current-east', solid: false, oneWay: false, damage: 0, material: null, pinnable: false, crumble: false, lantern: false, slag: false, water: true, current: 1, door: false },
  '<': { glyph: '<', name: 'current-west', solid: false, oneWay: false, damage: 0, material: null, pinnable: false, crumble: false, lantern: false, slag: false, water: true, current: -1, door: false },
};

/** Glyphs that are legal in a room grid. */
export const GLYPHS = Object.keys(TILES);

/**
 * @param {string} glyph
 * @returns {TileDef} the empty tile for anything unknown, so a bad glyph is a
 *   content-test failure rather than a crash mid-frame
 */
export function tileAt(glyph) {
  return TILES[glyph] ?? /** @type {TileDef} */ (TILES['.']);
}

/** @param {string} glyph @returns {boolean} */
export function isSolidGlyph(glyph) {
  return tileAt(glyph).solid;
}

/** @param {string} glyph @returns {boolean} */
export function isOneWayGlyph(glyph) {
  return tileAt(glyph).oneWay;
}

/** @param {string} glyph @returns {boolean} */
export function isDoorGlyph(glyph) {
  return tileAt(glyph).door;
}
