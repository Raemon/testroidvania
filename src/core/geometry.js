/**
 * Box maths with no dependencies, so anything in the sim can ask "do these
 * overlap" without dragging in the room registry.
 */

/** @typedef {import('./types.js').AABB} AABB */

/**
 * Half-open, matching the collision sweep: touching a face is not an overlap.
 * @param {AABB} a
 * @param {AABB} b
 * @returns {boolean}
 */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** @param {AABB} box @returns {{x:number, y:number}} */
export function centre(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @returns {number} */
export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Shortest distance from a point to a segment. The recall beam is a segment and
 * "what did it cut on the way home" is this question, asked once per entity.
 * @param {number} px @param {number} py
 * @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by
 * @returns {number}
 */
export function pointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(px, py, ax, ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return distance(px, py, ax + t * dx, ay + t * dy);
}
