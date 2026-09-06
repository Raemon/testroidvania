/**
 * The Lantern & Ink palette (05-aesthetic §2).
 *
 * Every colour belongs to a *value band* with a fixed lightness role; a region
 * only changes the hue. Depth reads as value — farthest is lightest, foreground
 * terrain is the darkest thing on screen — which is the one rule that makes a
 * flat 2D scene look composed, so nothing here should be picked by eye alone.
 *
 * Hazard, player and UI colours are deliberately region-invariant: the things
 * that kill you and the thing you are must never change meaning between areas.
 */

/**
 * @typedef {object} Region
 * @property {string} id
 * @property {string} voidTop     sky/abyss gradient, band Void (L 10-12)
 * @property {string} voidBottom
 * @property {boolean} litFromBelow  Foundry: the void gradient is brighter at the floor
 * @property {string} far         parallax 0.2 silhouettes (L 15-18)
 * @property {string} mid         parallax 0.45/0.7 silhouettes (L 20-26)
 * @property {string} fog         fog planes, darkness tint, entity backlight (L 30-38)
 * @property {string} terrain     collidable foreground (L 3-5)
 * @property {string} edge        terrain bevel (L 38-46)
 * @property {string} enemy       enemy body (L 30-36)
 * @property {string} accent      eyes, bioluminescence, glow (L 75-88)
 * @property {number} darkness    overlay alpha; capped at 0.55 everywhere (06 §D5)
 */

/** @type {Record<string, Region>} */
export const REGIONS = {
  spine: {
    id: 'spine',
    voidTop: '#12161C', voidBottom: '#0A0D12', litFromBelow: false,
    far: '#1A2029', mid: '#252D38', fog: '#3A4553',
    terrain: '#080A0D', edge: '#4E5A68', enemy: '#2C3644', accent: '#9FB3C8',
    darkness: 0.44,
  },
  cistern: {
    id: 'cistern',
    voidTop: '#0F1A24', voidBottom: '#070E15', litFromBelow: false,
    far: '#16283A', mid: '#1E3A4E', fog: '#2A5468',
    terrain: '#070B10', edge: '#3C6A7C', enemy: '#24384A', accent: '#5FE3D0',
    darkness: 0.5,
  },
  ossuary: {
    id: 'ossuary',
    voidTop: '#150F22', voidBottom: '#0B0714', litFromBelow: false,
    far: '#221A36', mid: '#2F2549', fog: '#4A3B6B',
    terrain: '#0A0710', edge: '#6B5A8C', enemy: '#3A2E52', accent: '#C9A0FF',
    // 05 asks for 0.70 here; 06 §D5 caps every region at 0.55 and that cap wins.
    darkness: 0.55,
  },
  foundry: {
    id: 'foundry',
    voidTop: '#140906', voidBottom: '#2E1810', litFromBelow: true,
    far: '#2E1810', mid: '#452416', fog: '#6B3A22',
    terrain: '#0D0604', edge: '#8C4E2E', enemy: '#4A2A1C', accent: '#FFB84D',
    darkness: 0.5,
  },
  verdant: {
    id: 'verdant',
    voidTop: '#0F1A12', voidBottom: '#070E09', litFromBelow: false,
    far: '#1A2C1B', mid: '#29402A', fog: '#4A6A3E',
    terrain: '#060A06', edge: '#6E8C4A', enemy: '#2E4230', accent: '#C8F26A',
    darkness: 0.4,
  },
  core: {
    // The Lantern Heart: the value structure inverts. Having spent the whole game
    // in the dark, brightness is the payoff, so this is the one bright region.
    id: 'core',
    voidTop: '#E8E0CC', voidBottom: '#C8BFA6', litFromBelow: false,
    far: '#D2C8AE', mid: '#B8AC90', fog: '#8C8068',
    terrain: '#2A2418', edge: '#6B5D44', enemy: '#4A4032', accent: '#FFD97A',
    darkness: 0.18,
  },
};

/** Room id prefix -> region, per 00-BIBLE §3. */
const PREFIX = /** @type {Record<string, string>} */ ({
  s: 'spine', r: 'verdant', f: 'foundry', c: 'cistern', x: 'ossuary', k: 'core', e: 'core',
});

/**
 * @param {string} roomId
 * @returns {Region} the tutorial `t*` rooms fall through to Cistern
 */
export function regionFor(roomId) {
  const key = PREFIX[roomId.slice(0, 1).toLowerCase()] ?? 'cistern';
  return REGIONS[key] ?? /** @type {Region} */ (REGIONS['cistern']);
}

/** Region-invariant colours. */
export const INK = '#0B0D12';
export const CREAM = '#F3E9D2';
export const CREAM_DIM = '#9C8F78';
export const HAZARD = '#FF4D5A';
export const HAZARD_HI = '#FFD3A0';

export const PLAYER = {
  body: '#EFE4C8',
  ink: '#1A1410',
  core: '#FFF1C9',
  flame: '#FFB347',
  scarf: '#B8452E',
};

/**
 * Materials are told apart by edge colour and hatch, not by fill (00-BIBLE §5).
 * That is load-bearing for gating, so these do not shift with the region — a
 * warm edge means wood in every room in the game.
 * @typedef {object} MaterialLook
 * @property {string} edge
 * @property {string} hatch
 * @property {'grain'|'crack'|'rivet'} pattern
 */
/** @type {Record<string, MaterialLook>} */
export const MATERIALS = {
  wood: { edge: '#B4783C', hatch: '#7A4E22', pattern: 'grain' },
  stone: { edge: '#5E7A8C', hatch: '#2A3742', pattern: 'crack' },
  metal: { edge: '#CFDCE8', hatch: '#7C8C9C', pattern: 'rivet' },
};

/** @param {string} name @returns {MaterialLook} */
export function materialLook(name) {
  return MATERIALS[name] ?? /** @type {MaterialLook} */ (MATERIALS['stone']);
}

/**
 * `#rrggbb` -> `rgba(r,g,b,a)`. ctxGuard rejects malformed colour strings, so the
 * alpha is clamped and rounded here rather than trusted from a caller's maths.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function rgba(hex, alpha) {
  const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/**
 * Move a hex colour toward black (t<0) or white (t>0) by |t|.
 * @param {string} hex
 * @param {number} t  -1..1
 * @returns {string}
 */
export function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const to = t < 0 ? 0 : 255;
  const k = Math.min(1, Math.abs(t));
  /** @param {number} c */
  const mix = (c) => Math.round(c + (to - c) * k);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
