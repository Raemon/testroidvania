/**
 * Input is one 16-bit number per frame (04-architecture §3). That is what makes a
 * playthrough a 432 KB tape and a bug report a reproducible artifact.
 */

/** @typedef {import('./types.js').InputMask} InputMask */

export const IN = {
  LEFT: 1,
  RIGHT: 2,
  UP: 4,
  DOWN: 8,
  JUMP: 16,
  ATTACK: 32,
  THROW: 64,
  ZIP: 128,
  PAUSE: 256,
  MAP: 512,
};

/** Every bit, for masking a raw source down to what the sim understands. */
export const IN_ALL = Object.values(IN).reduce((a, b) => a | b, 0);

/**
 * @param {InputMask} input
 * @param {number} bit
 * @returns {boolean}
 */
export function isDown(input, bit) {
  return (input & bit) !== 0;
}

/**
 * @param {InputMask} input
 * @param {InputMask} prevInput
 * @param {number} bit
 * @returns {boolean}
 */
export function justPressed(input, prevInput, bit) {
  return (input & bit) !== 0 && (prevInput & bit) === 0;
}

/**
 * @param {InputMask} input
 * @param {InputMask} prevInput
 * @param {number} bit
 * @returns {boolean}
 */
export function justReleased(input, prevInput, bit) {
  return (input & bit) === 0 && (prevInput & bit) !== 0;
}

/**
 * Horizontal intent, with both directions cancelling to neutral.
 * @param {InputMask} input
 * @returns {-1|0|1}
 */
export function axisX(input) {
  const l = isDown(input, IN.LEFT) ? 1 : 0;
  const r = isDown(input, IN.RIGHT) ? 1 : 0;
  return /** @type {-1|0|1} */ (r - l);
}

/**
 * @param {InputMask} input
 * @returns {-1|0|1} -1 is up, matching screen-space y
 */
export function axisY(input) {
  const u = isDown(input, IN.UP) ? 1 : 0;
  const d = isDown(input, IN.DOWN) ? 1 : 0;
  return /** @type {-1|0|1} */ (d - u);
}
