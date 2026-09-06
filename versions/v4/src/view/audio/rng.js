/**
 * A stateful mulberry32 for the *view* side only.
 *
 * `src/core/rng.js` threads its seed as a value because a replay must reproduce
 * bit-exactly. Audio has the opposite requirement: it must never touch the sim's
 * stream. So this is a separate generator, seeded from `state.tick`, which gives
 * "the same playthrough makes the same noises" without the sim ever knowing audio
 * exists.
 */

/**
 * @param {number} seed
 * @returns {() => number} successive floats in [0, 1)
 */
export function createRng(seed) {
  let s = (Math.floor(seed) >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** 05 §6d: +/-4% on every SFX, so a repeated sound never phases into a buzz. */
export const PITCH_SPREAD = 0.04;

/**
 * @param {() => number} rng
 * @param {number} [spread]
 * @returns {number} a multiplier around 1
 */
export function pitchVary(rng, spread = PITCH_SPREAD) {
  return 1 + (rng() * 2 - 1) * spread;
}
