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
 */

/** @type {Record<string, TileDef>} */
export const TILES = {
  '.': { glyph: '.', name: 'empty', solid: false, oneWay: false, damage: 0, material: null, pinnable: false },
  '#': { glyph: '#', name: 'stone', solid: true, oneWay: false, damage: 0, material: 'stone', pinnable: true },
  'W': { glyph: 'W', name: 'wood', solid: true, oneWay: false, damage: 0, material: 'wood', pinnable: true },
  'M': { glyph: 'M', name: 'metal', solid: true, oneWay: false, damage: 0, material: 'metal', pinnable: false },
  '=': { glyph: '=', name: 'platform', solid: false, oneWay: true, damage: 0, material: 'wood', pinnable: true },
  '^': { glyph: '^', name: 'spike', solid: false, oneWay: false, damage: 1, material: null, pinnable: false },
  'D': { glyph: 'D', name: 'door', solid: false, oneWay: false, damage: 0, material: null, pinnable: false },
  'o': { glyph: 'o', name: 'pickup', solid: false, oneWay: false, damage: 0, material: null, pinnable: false },
  '~': { glyph: '~', name: 'water', solid: false, oneWay: false, damage: 0, material: null, pinnable: false },
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
