/**
 * SENTINEL — the Apex miniboss: **a scaled-up Shell with Charger AI.**
 *
 * The design says reuse, not write, so this file does exactly that: the update
 * function *is* the Charger's, and the armour rule *is* the Shell's (`base.js`
 * lists `sentinel` alongside `shell`). What is new is the size, the health, and one
 * **stone shoulder plate** — the pinnable part, which by the Apex the player has had
 * Deep Pin for two regions.
 */


import { update as chargerUpdate } from '../entities/charger.js';
import { spawnBoss, hatchParts } from './base.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'sentinel';
export const rig = 'knight';

const SENTINEL_HP = 10;
const SENTINEL_W = 34;
const SENTINEL_H = 30;

/** @type {import('./index.js').BossDef} */
export const boss = { id: 'sentinel', name: 'Sentinel', maxHp: SENTINEL_HP, grants: 'twinPin' };

/**
 * Shoulder plates, one each side, at hand height and standing proud of the body so
 * a straight throw reaches the plate before it reaches the armour.
 */
const PARTS = /** @type {const} */ ([
  { offX: -6, offY: 8, swing: 0, material: 'stone' },
  { offX: SENTINEL_W - 8, offY: 8, swing: 0, material: 'stone' },
]);

/**
 * @param {number} id @param {string} roomId @param {number} tx @param {number} ty
 * @returns {Entity}
 */
export function spawn(id, roomId, tx, ty) {
  const e = spawnBoss({ id, kind, roomId, tx, ty, w: SENTINEL_W, h: SENTINEL_H, hp: SENTINEL_HP });
  // The Charger machine starts dormant and wakes on a light, which is the whole
  // point of putting one in a dark room at the top of the map.
  return { ...e, mode: 'dormant', timers: { ...e.timers, mode: 0 } };
}

/** @param {Readonly<Entity>} e @param {Readonly<GameState>} s @param {number} nextId @returns {Entity[]} */
export function hatch(e, s, nextId) {
  return hatchParts(e, nextId, [...PARTS]);
}

/**
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
export function update(e, s) {
  const open = s.entities.some((x) => x.timers.owner === e.id && x.pinned);
  const born = (e.timers.born ?? 0) + 1;
  const stepped = chargerUpdate({ ...e, timers: { ...e.timers, born } }, s);
  return { ...stepped, timers: { ...stepped.timers, guard: open ? 0 : 1 } };
}
