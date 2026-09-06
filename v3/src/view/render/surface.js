/**
 * Offscreen canvas helper.
 *
 * Everything static in this renderer — parallax skylines, terrain bevels, glow
 * sprites, the vignette — is drawn once into one of these and then blitted. That
 * is the whole performance strategy: the per-frame cost of a layer should be one
 * `drawImage`, not a few hundred path operations.
 */

/**
 * @typedef {object} Surface
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctx
 * @property {number} w
 * @property {number} h
 */

/**
 * @param {number} w
 * @param {number} h
 * @param {boolean} [opaque] the surface covers every pixel it owns, so it can be
 *   allocated without an alpha channel and blitted as a straight copy
 * @returns {Surface}
 */
export function createSurface(w, h, opaque = false) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d', opaque ? { alpha: false } : undefined);
  if (!ctx) throw new Error('surface: 2d context unavailable');
  return { canvas, ctx, w: canvas.width, h: canvas.height };
}

/**
 * A small cache of surfaces built on first use and kept forever. Keys are strings
 * so a caller can compose one from whatever makes its drawing unique (region id,
 * room id, colour + radius).
 */
export class SurfaceCache {
  constructor() {
    /** @type {Map<string, Surface>} */
    this.map = new Map();
  }

  /**
   * @param {string} key
   * @param {() => Surface} build
   * @returns {Surface}
   */
  get(key, build) {
    const found = this.map.get(key);
    if (found) return found;
    const made = build();
    this.map.set(key, made);
    return made;
  }
}
