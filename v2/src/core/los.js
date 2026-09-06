/**
 * Line of sight over the tilemap: a DDA walk from one point to another that stops
 * at the first solid tile.
 *
 * It exists for 06-revision-1 §D2 — enemies acquire *the nearest light inside their
 * line of sight*, which may be a Pin the player threw across the room. That single
 * substitution is what turns "the Pin is also a lantern" from decoration into a
 * decision, so the sight test has to be sim-side and exact, not a renderer guess.
 */

import { TILE } from './constants.js';
import { solidAt } from './collision.js';

/** @typedef {import('./types.js').Room} Room */

/**
 * @param {Room} room
 * @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by
 * @returns {boolean} true if nothing solid stands between the two points
 */
export function hasLineOfSight(room, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (TILE / 2));
  if (steps <= 0) return true;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (solidAt(room, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

/**
 * The nearest light this eye can actually see.
 * @param {Room} room
 * @param {number} eyeX @param {number} eyeY
 * @param {readonly import('./types.js').Light[]} lights
 * @param {number} range
 * @returns {import('./types.js').Light|null}
 */
export function nearestVisibleLight(room, eyeX, eyeY, lights, range) {
  /** @type {import('./types.js').Light|null} */
  let best = null;
  let bestDist = Infinity;
  for (const light of lights) {
    const d = Math.hypot(light.x - eyeX, light.y - eyeY);
    // The light's own radius counts: a big hole is visible from further away.
    if (d > range + light.r) continue;
    if (d >= bestDist) continue;
    if (!hasLineOfSight(room, eyeX, eyeY, light.x, light.y)) continue;
    best = light;
    bestDist = d;
  }
  return best;
}
