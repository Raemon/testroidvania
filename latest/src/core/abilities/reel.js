/**
 * A3 REEL. The recall drags whatever the Pin is in back to you at 6 px/f.
 *
 * Only three things can be dragged: **enemies, rail platforms on their own tracks,
 * and levers.** Free-body crates were cut (06-revision-1 §C) — a dynamic solid that
 * collides with terrain, the player and other crates is a classic all-night bug for
 * one puzzle, and the rail's track is a better constraint than a physics body.
 *
 * The rule that keeps Recall unconditional (§G) is here: a drag **stops at the first
 * obstacle and the Pin comes home alone**. Nothing about Reel can make the recall
 * wait for the thing it is dragging, so nothing about Reel can strand the player.
 */

import { REEL_SPEED, REEL_FRAMES } from '../constants.js';
import { overlapsSolid } from '../collision.js';

/** @typedef {import('../types.js').AbilityId} AbilityId */
/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').Prop} Prop */
/** @typedef {import('../types.js').Pin} Pin */
/** @typedef {import('../types.js').Room} Room */

export const id = /** @type {AbilityId} */ ('reel');
export const name = 'Reel';
export const gate = 'gap';

/** @param {readonly AbilityId[]} abilities @returns {boolean} */
export function owned(abilities) {
  return abilities.includes('reel');
}

/**
 * Mark whatever this Pin is in as being dragged home. Called on the recall press,
 * after which the Pin's own flight is none of this file's business.
 * @param {Readonly<GameState>} s
 * @param {Readonly<Pin>} pin
 * @returns {{entities: Entity[], props: Prop[]}}
 */
export function startReel(s, pin) {
  const entities = /** @type {Entity[]} */ (s.entities.slice());
  const props = /** @type {Prop[]} */ (s.props.slice());
  if (!owned(s.progress.abilities)) return { entities, props };
  const toX = s.player.x + s.player.w / 2;
  const toY = s.player.y + s.player.h / 2;
  return {
    entities: entities.map((e) => (
      e.id === pin.hostId ? { ...e, reel: REEL_FRAMES, targetX: toX, targetY: toY } : e
    )),
    props: props.map((p) => (p.id === pin.propId ? { ...p, reel: REEL_FRAMES } : p)),
  };
}

/**
 * One frame of dragging. Entities walk the straight line to where the player stood
 * when the recall started; rails ride their own track toward the player's end.
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageReel(s) {
  if (!s.entities.some((e) => e.reel > 0) && !s.props.some((p) => p.reel > 0)) return s;
  return { ...s, entities: s.entities.map((e) => dragEntity(s.roomData, e)) };
}

/**
 * @param {Room} room
 * @param {Entity} e
 * @returns {Entity}
 */
function dragEntity(room, e) {
  if (e.reel <= 0) return e;
  const dx = e.targetX - (e.x + e.w / 2);
  const dy = e.targetY - (e.y + e.h / 2);
  const dist = Math.hypot(dx, dy);
  if (dist <= REEL_SPEED) return { ...e, reel: 0 };
  const nx = e.x + (dx / dist) * REEL_SPEED;
  const ny = e.y + (dy / dist) * REEL_SPEED;
  // Stops at the first obstacle. It does not squeeze, and it does not push.
  if (overlapsSolid(room, { x: nx, y: ny, w: e.w, h: e.h })) return { ...e, reel: 0, vx: 0, vy: 0 };
  return { ...e, x: nx, y: ny, vx: 0, vy: 0, reel: e.reel - 1 };
}
