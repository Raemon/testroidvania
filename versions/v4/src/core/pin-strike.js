/**
 * One throw against one body. This is where 00-BIBLE §6's mass rule lives: **light
 * enemies can be nailed to a wall, heavy ones take the damage and drop the Pin** —
 * and a light enemy standing in front of *metal* cannot be pinned at all, so combat
 * reads off exactly the same material language as traversal.
 *
 * A boss's explicitly pinnable part is the third case: it takes the Pin into itself
 * with no wall behind it, gated by the same three-way read.
 */

import {
  TILE, PIN_PINNED_FRAMES, PIN_THROW_DAMAGE, PIN_CARRY_RANGE,
} from './constants.js';
import { glyphAt, overlapsSolid } from './collision.js';
import { tileAt } from '../content/tiles.js';
import { damageEntity } from './entities/index.js';
import { bitesMaterial } from './abilities/deepPin.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Entity} Entity */
/** @typedef {import('./types.js').Pin} Pin */
/** @typedef {import('./types.js').Room} Room */

/**
 * @param {GameState} s
 * @param {Room} room
 * @param {Pin} pin
 * @param {Entity} target
 * @returns {{pin: Pin, entity: Entity}}
 */
export function strikeEntity(s, room, pin, target) {
  const hurt = damageEntity(target, PIN_THROW_DAMAGE, pin.x, pin.y);
  const dropped = { pin: { ...pin, inert: true, vx: 0, vy: 0 }, entity: hurt };
  if (hurt.hp <= 0 || target.mass !== 0) return dropped;

  // An explicitly pinnable part takes the Pin into itself, no wall required. Which
  // parts those are is the same read as terrain, which is what makes "find the
  // pinnable part while the rest is metal" legible without a legend.
  if (target.pinMaterial && bitesMaterial(target.pinMaterial, s.progress.abilities)) {
    return nail(pin, hurt, target.x, target.y, target);
  }
  const wall = wallBehind(s, room, pin, target);
  if (!wall) return dropped;
  return nail(pin, hurt, wall.x, wall.y, target);
}

/**
 * @param {Pin} pin @param {Entity} hurt
 * @param {number} x @param {number} y @param {Readonly<Entity>} target
 * @returns {{pin: Pin, entity: Entity}}
 */
function nail(pin, hurt, x, y, target) {
  return {
    pin: {
      ...pin, state: 'pinned', hostId: target.id, hostTimer: PIN_PINNED_FRAMES,
      vx: 0, vy: 0, x: x + target.w / 2, y: y + target.h / 2,
    },
    entity: { ...hurt, x, y, vx: 0, vy: 0, pinned: true, stun: PIN_PINNED_FRAMES },
  };
}

/**
 * @param {GameState} s @param {Room} room @param {Readonly<Pin>} pin @param {Readonly<Entity>} target
 * @returns {{x:number, y:number}|null} where the body ends up, flat against the
 *   pinnable surface behind it, or null if there is none within 48px
 */
function wallBehind(s, room, pin, target) {
  const speed = Math.hypot(pin.vx, pin.vy) || 1;
  const ux = pin.vx / speed;
  const uy = pin.vy / speed;
  let x = target.x;
  let y = target.y;
  for (let d = 1; d <= PIN_CARRY_RANGE; d++) {
    const nx = target.x + ux * d;
    const ny = target.y + uy * d;
    const box = { x: nx, y: ny, w: target.w, h: target.h };
    if (overlapsSolid(room, box)) return frontBites(s, room, box, ux, uy) ? { x, y } : null;
    x = nx;
    y = ny;
  }
  return null;
}

/**
 * @param {GameState} s @param {Room} room @param {import('./types.js').AABB} box
 * @param {number} ux @param {number} uy
 * @returns {boolean} true if the surface the body was carried into takes the Pin
 */
function frontBites(s, room, box, ux, uy) {
  const px = box.x + box.w / 2 + ux * (box.w / 2 + 1);
  const py = box.y + box.h / 2 + uy * (box.h / 2 + 1);
  const def = tileAt(glyphAt(room, Math.floor(px / TILE), Math.floor(py / TILE)));
  return def.solid && def.pinnable && bitesMaterial(def.material, s.progress.abilities);
}
