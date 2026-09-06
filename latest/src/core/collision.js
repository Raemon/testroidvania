/**
 * Swept AABB against the tilemap. This is the one place "solid" is decided.
 *
 * Boxes are half-open: a box at x with width w occupies [x, x+w), so touching a
 * face is never an overlap. X is resolved before Y, and every sweep stops the box
 * flush against the blocking face — the player can therefore never end up inside a
 * solid tile, which invariant 7 re-checks every frame.
 */

import { TILE, CEILING_CORNER_CORRECTION, LEDGE_NUDGE, FALLING_EDGE_SNAP } from './constants.js';
import { tileAt } from '../content/tiles.js';

/** @typedef {import('./types.js').Room} Room */
/** @typedef {import('./types.js').AABB} AABB */

/**
 * @param {Room} room
 * @param {number} tx
 * @param {number} ty
 * @returns {string} '#' outside the room, so the world is closed
 */
export function glyphAt(room, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return '#';
  return room.grid[ty]?.[tx] ?? '#';
}

/** @param {Room} room @param {number} tx @param {number} ty @returns {boolean} */
export function solidAt(room, tx, ty) {
  return tileAt(glyphAt(room, tx, ty)).solid;
}

/** @param {Room} room @param {number} tx @param {number} ty @returns {boolean} */
export function oneWayAt(room, tx, ty) {
  return tileAt(glyphAt(room, tx, ty)).oneWay;
}

/**
 * @param {Room} room @param {number} x @param {number} y world units
 * @returns {boolean} true if this point is inside a water volume
 */
export function inWater(room, x, y) {
  return tileAt(glyphAt(room, Math.floor(x / TILE), Math.floor(y / TILE))).water;
}

/**
 * @param {Room} room
 * @param {number} x
 * @param {number} y
 * @returns {-1|0|1} which way the water at this point is pushing, 0 for none
 */
export function currentAt(room, x, y) {
  return tileAt(glyphAt(room, Math.floor(x / TILE), Math.floor(y / TILE))).current;
}

/** @param {number} v @returns {number} */
function tileIndex(v) {
  return Math.floor(v / TILE);
}

/** Inclusive tile range covered by the half-open interval [lo, hi). */
function spanLo(/** @type {number} */ lo) { return tileIndex(lo); }
function spanHi(/** @type {number} */ hi) { return Math.ceil(hi / TILE) - 1; }

/**
 * @param {Room} room
 * @param {AABB} box
 * @returns {boolean} true if the box overlaps any fully-solid tile
 */
export function overlapsSolid(room, box) {
  for (let ty = spanLo(box.y); ty <= spanHi(box.y + box.h); ty++) {
    for (let tx = spanLo(box.x); tx <= spanHi(box.x + box.w); tx++) {
      if (solidAt(room, tx, ty)) return true;
    }
  }
  return false;
}

/**
 * @param {Room} room
 * @param {AABB} box
 * @returns {import('./types.js').Material|null} the material directly under the
 *   box's feet — what a footstep or a landing lands on
 */
export function materialUnder(room, box) {
  const ty = tileIndex(box.y + box.h);
  for (let tx = spanLo(box.x); tx <= spanHi(box.x + box.w); tx++) {
    const def = tileAt(glyphAt(room, tx, ty));
    if (def.solid || def.oneWay) return def.material;
  }
  return null;
}

/**
 * @param {AABB} a @param {AABB} b @returns {boolean} true if the spans overlap in x
 */
function overlapsX(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

/**
 * @param {Room} room
 * @param {AABB} box
 * @param {readonly AABB[]} [platforms] dynamic one-way surfaces, e.g. an embedded Pin
 * @returns {boolean} true if any standable surface sits directly under the box's feet
 */
export function isSupported(room, box, platforms = []) {
  const feet = box.y + box.h;
  for (const p of platforms) {
    if (Math.abs(feet - p.y) <= 1e-9 && overlapsX(box, p)) return true;
  }
  const ty = tileIndex(feet);
  if (Math.abs(feet - ty * TILE) > 1e-9) return false;
  for (let tx = spanLo(box.x); tx <= spanHi(box.x + box.w); tx++) {
    if (solidAt(room, tx, ty) || oneWayAt(room, tx, ty)) return true;
  }
  return false;
}

/**
 * Horizontal sweep. Only fully-solid tiles block; one-ways never do.
 * @param {Room} room
 * @param {AABB} box
 * @param {number} dx
 * @returns {{ x:number, hit:boolean, faceTop:number }} `faceTop` is the top face of
 *   the blocking tile column, used by the ledge nudge; NaN-free by construction.
 */
export function sweepX(room, box, dx) {
  if (dx === 0) return { x: box.x, hit: false, faceTop: 0 };
  const tyLo = spanLo(box.y);
  const tyHi = spanHi(box.y + box.h);
  if (dx > 0) {
    const right = box.x + box.w;
    const target = right + dx;
    for (let tx = tileIndex(right); tx * TILE < target; tx++) {
      const face = tx * TILE;
      if (face < right) continue;
      for (let ty = tyLo; ty <= tyHi; ty++) {
        if (solidAt(room, tx, ty)) return { x: face - box.w, hit: true, faceTop: highestSolidTop(room, tx, tyLo, tyHi) };
      }
    }
    return { x: box.x + dx, hit: false, faceTop: 0 };
  }
  const target = box.x + dx;
  for (let tx = tileIndex(box.x - 1e-9); (tx + 1) * TILE > target; tx--) {
    const face = (tx + 1) * TILE;
    if (face > box.x) continue;
    for (let ty = tyLo; ty <= tyHi; ty++) {
      if (solidAt(room, tx, ty)) return { x: face, hit: true, faceTop: highestSolidTop(room, tx, tyLo, tyHi) };
    }
  }
  return { x: box.x + dx, hit: false, faceTop: 0 };
}

/**
 * Top face of the topmost solid tile in a column, within the rows the box spans.
 * @param {Room} room @param {number} tx @param {number} tyLo @param {number} tyHi
 * @returns {number}
 */
function highestSolidTop(room, tx, tyLo, tyHi) {
  for (let ty = tyLo; ty <= tyHi; ty++) if (solidAt(room, tx, ty)) return ty * TILE;
  return tyHi * TILE;
}

/**
 * Vertical sweep. One-way tiles block only downward motion and only when the box
 * started at or above their top face, which is what makes them passable from below.
 * @param {Room} room
 * @param {AABB} box
 * @param {number} dy
 * @param {boolean} ignoreOneWay
 * @param {readonly AABB[]} [platforms] dynamic one-way surfaces, e.g. an embedded Pin
 * @returns {{ y:number, hit:boolean, landedOnOneWay:boolean, overlap:number, shift:number }}
 *   `overlap` is how much of the foot is supported by the landed-on tiles and
 *   `shift` the x correction the falling-edge snap wants; both 0 when not landing.
 */
export function sweepY(room, box, dy, ignoreOneWay, platforms = []) {
  if (dy === 0) return { y: box.y, hit: false, landedOnOneWay: false, overlap: 0, shift: 0 };
  if (dy > 0 && !ignoreOneWay && platforms.length) {
    const tiles = sweepYTiles(room, box, dy, ignoreOneWay);
    const plat = sweepYPlatforms(box, dy, platforms);
    // Whichever surface the feet meet first wins; a tie goes to the terrain,
    // which is the one the player can never fall through.
    if (plat && (!tiles.hit || plat.y < tiles.y)) return plat;
    return tiles;
  }
  return sweepYTiles(room, box, dy, ignoreOneWay);
}

/**
 * @param {AABB} box @param {number} dy @param {readonly AABB[]} platforms
 * @returns {{ y:number, hit:boolean, landedOnOneWay:boolean, overlap:number, shift:number }|null}
 */
function sweepYPlatforms(box, dy, platforms) {
  const bottom = box.y + box.h;
  let best = Infinity;
  /** @type {AABB|null} */
  let hit = null;
  for (const p of platforms) {
    if (!overlapsX(box, p)) continue;
    if (bottom > p.y + 1e-9 || bottom + dy < p.y) continue;
    if (p.y < best) { best = p.y; hit = p; }
  }
  if (!hit) return null;
  const left = Math.max(box.x, hit.x);
  const right = Math.min(box.x + box.w, hit.x + hit.w);
  return { y: best - box.h, hit: true, landedOnOneWay: true, overlap: Math.max(0, right - left), shift: 0 };
}

/**
 * @param {Room} room @param {AABB} box @param {number} dy @param {boolean} ignoreOneWay
 * @returns {{ y:number, hit:boolean, landedOnOneWay:boolean, overlap:number, shift:number }}
 */
function sweepYTiles(room, box, dy, ignoreOneWay) {
  const txLo = spanLo(box.x);
  const txHi = spanHi(box.x + box.w);
  if (dy > 0) {
    const bottom = box.y + box.h;
    const target = bottom + dy;
    for (let ty = tileIndex(bottom); ty * TILE < target; ty++) {
      const face = ty * TILE;
      if (face < bottom) continue;
      let solidHit = false;
      let oneWayHit = false;
      for (let tx = txLo; tx <= txHi; tx++) {
        if (solidAt(room, tx, ty)) solidHit = true;
        else if (!ignoreOneWay && oneWayAt(room, tx, ty)) oneWayHit = true;
      }
      if (solidHit || oneWayHit) {
        const { overlap, shift } = footSupport(room, box, ty, ignoreOneWay);
        return { y: face - box.h, hit: true, landedOnOneWay: !solidHit && oneWayHit, overlap, shift };
      }
    }
    return { y: box.y + dy, hit: false, landedOnOneWay: false, overlap: 0, shift: 0 };
  }
  const target = box.y + dy;
  for (let ty = tileIndex(box.y - 1e-9); (ty + 1) * TILE > target; ty--) {
    const face = (ty + 1) * TILE;
    if (face > box.y) continue;
    for (let tx = txLo; tx <= txHi; tx++) {
      if (solidAt(room, tx, ty)) return { y: face, hit: true, landedOnOneWay: false, overlap: 0, shift: 0 };
    }
  }
  return { y: box.y + dy, hit: false, landedOnOneWay: false, overlap: 0, shift: 0 };
}

/**
 * How many units of the foot rest on standable tiles in row `ty`, and the x shift
 * that would centre the foot on them (03-game-feel §1.1 "falling-edge nudge").
 * @param {Room} room @param {AABB} box @param {number} ty @param {boolean} ignoreOneWay
 * @returns {{ overlap:number, shift:number }}
 */
function footSupport(room, box, ty, ignoreOneWay) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let tx = spanLo(box.x); tx <= spanHi(box.x + box.w); tx++) {
    const standable = solidAt(room, tx, ty) || (!ignoreOneWay && oneWayAt(room, tx, ty));
    if (!standable) continue;
    lo = Math.min(lo, tx * TILE);
    hi = Math.max(hi, (tx + 1) * TILE);
  }
  if (lo === Infinity) return { overlap: 0, shift: 0 };
  const left = Math.max(box.x, lo);
  const right = Math.min(box.x + box.w, hi);
  const overlap = Math.max(0, right - left);
  if (overlap <= 0 || overlap > FALLING_EDGE_SNAP) return { overlap, shift: 0 };
  const shift = box.x < lo ? Math.min(FALLING_EDGE_SNAP, lo - box.x) : Math.max(-FALLING_EDGE_SNAP, hi - (box.x + box.w));
  return { overlap, shift };
}

/**
 * @typedef {object} MoveResult
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {boolean} grounded
 * @property {boolean} hitCeiling
 * @property {boolean} hitWall
 * @property {boolean} onOneWay
 */

/**
 * Full one-frame resolution: X then Y, with the three forgiveness rules from
 * 03-game-feel §1.1 (ledge nudge, ceiling corner correction, falling-edge snap).
 *
 * @param {Room} room
 * @param {AABB} box
 * @param {number} vx
 * @param {number} vy
 * @param {boolean} ignoreOneWay
 * @param {readonly AABB[]} [platforms] dynamic one-way surfaces, e.g. an embedded Pin
 * @returns {MoveResult}
 */
export function moveBox(room, box, vx, vy, ignoreOneWay, platforms = []) {
  let x = box.x;
  let y = box.y;
  let outVx = vx;
  let outVy = vy;
  let hitWall = false;
  let hitCeiling = false;

  const xr = sweepX(room, { x, y, w: box.w, h: box.h }, vx);
  x = xr.x;
  if (xr.hit) {
    const feet = y + box.h;
    const lip = feet - xr.faceTop;
    // Ledge nudge: a lip no taller than 3px is stepped over instead of blocking.
    if (lip > 0 && lip <= LEDGE_NUDGE) {
      const lifted = { x: box.x, y: y - lip, w: box.w, h: box.h };
      const retry = sweepX(room, lifted, vx);
      if (!retry.hit && !overlapsSolid(room, { x: retry.x, y: lifted.y, w: box.w, h: box.h })) {
        x = retry.x;
        y = lifted.y;
      } else {
        hitWall = true;
        outVx = 0;
      }
    } else {
      hitWall = true;
      outVx = 0;
    }
  }

  const yBefore = y;
  const yr = sweepY(room, { x, y, w: box.w, h: box.h }, vy, ignoreOneWay, platforms);
  y = yr.y;
  let grounded = false;
  let onOneWay = false;
  if (yr.hit) {
    if (vy > 0) {
      grounded = true;
      onOneWay = yr.landedOnOneWay;
      outVy = 0;
      if (yr.shift !== 0) {
        const snapped = { x: x + yr.shift, y, w: box.w, h: box.h };
        if (!overlapsSolid(room, snapped)) x = snapped.x;
      }
    } else {
      // Ceiling corner correction: nudge up to 4px sideways out of a corner and
      // keep climbing, rather than killing the jump on a shoulder-width miss.
      const nudge = ceilingCorner(room, { x, y: yBefore, w: box.w, h: box.h }, vy);
      if (nudge !== 0) {
        const shifted = { x: x + nudge, y: yBefore, w: box.w, h: box.h };
        const retry = sweepY(room, shifted, vy, ignoreOneWay);
        if (!retry.hit) {
          x = shifted.x;
          y = retry.y;
        } else {
          hitCeiling = true;
          outVy = 0;
        }
      } else {
        hitCeiling = true;
        outVy = 0;
      }
    }
  }
  return { x, y, vx: outVx, vy: outVy, grounded, hitCeiling, hitWall, onOneWay };
}

/**
 * @param {Room} room
 * @param {AABB} box
 * @param {number} vy
 * @returns {number} the smallest horizontal shift within 4px that clears the
 *   ceiling, or 0 if none does
 */
function ceilingCorner(room, box, vy) {
  for (let d = 1; d <= CEILING_CORNER_CORRECTION; d++) {
    for (const dir of /** @type {const} */ ([-1, 1])) {
      const shifted = { x: box.x + d * dir, y: box.y, w: box.w, h: box.h };
      if (overlapsSolid(room, shifted)) continue;
      if (!sweepY(room, shifted, vy, true).hit) return d * dir;
    }
  }
  return 0;
}
