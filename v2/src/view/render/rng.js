/**
 * The cosmetic random stream.
 *
 * This is a *separate* generator from `state.rng` and the simulation never reads
 * it. Sharing the sim's stream would make the number of particles a room spawned
 * change the outcome of the next enemy's coin flip, which is exactly the kind of
 * coupling the purity boundary exists to prevent.
 *
 * It is still seeded and still reproducible, so a screenshot taken at a given
 * tick with a given seed is byte-identical on the next run.
 */

/** @param {number} seed @returns {() => number} a 0..1 generator (mulberry32) */
export function cosmeticRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stable 32-bit hash of a string, for deriving a per-room or per-region seed.
 * @param {string} s
 * @returns {number}
 */
export function seedFrom(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Deterministic value noise in 0..1 from an integer. Used where a value must be
 * "random-looking" but recomputable from the frame number alone (flicker, grain
 * offsets), so nothing has to be carried between frames.
 * @param {number} n
 * @returns {number}
 */
export function hashNoise(n) {
  let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}
