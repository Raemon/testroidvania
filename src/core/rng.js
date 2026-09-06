/**
 * mulberry32, threaded as a value. There is no module-level state on purpose:
 * a replay must reproduce bit-exactly no matter what else read the stream.
 *
 *   const [roll, rng] = nextFloat(state.rng);
 *   return { ...state, rng, ... };
 */

/** @typedef {import('./types.js').Seed} Seed */

/**
 * @param {Seed} seed
 * @returns {[number, Seed]} a float in [0,1) and the next seed
 */
export function nextFloat(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

/**
 * @param {Seed} seed
 * @param {number} n exclusive upper bound; n <= 0 yields 0
 * @returns {[number, Seed]}
 */
export function nextInt(seed, n) {
  const [f, next] = nextFloat(seed);
  return [n > 0 ? Math.floor(f * n) : 0, next];
}

/**
 * Normalize an arbitrary number into a valid 32-bit seed.
 * @param {number} n
 * @returns {Seed}
 */
export function toSeed(n) {
  return (Math.floor(n) >>> 0) || 1;
}
