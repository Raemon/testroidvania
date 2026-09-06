/**
 * SENTINEL — the Apex miniboss: **a scaled-up Shell with Charger AI.**
 *
 * The design says reuse, not write, so this file does exactly that: the update
 * function *is* the Charger's, and the armour rule *is* the Shell's (`base.js`
 * lists `sentinel` alongside `shell`). What is new is the size, the health, and one
 * **stone shoulder plate** — the pinnable part, which by the Apex the player has had
 * Deep Pin for two regions.
 *
 * The one thing it does not borrow is what happens when a plate is taken. Every
 * other boss stops dead while a Pin is in it (`base.js` rule 2), and the Sentinel
 * used to keep charging — at the light, which since the plate freezes where it was
 * pinned meant it charged *away from its own handle* while its guard was down. So
 * it has the `open` rule now, in the only form a Charger can state it: **the pinned
 * plate is the light it goes for.** It breaks off, walks to the plate, and stands
 * there with its back to wherever the throw came from. That is the Shell's "get an
 * angle" lesson, told by the thing the Apex built to teach it.
 */


import { update as chargerUpdate } from '../entities/charger.js';
import { moveEntity } from '../entities/index.js';
import { spawnBoss, hatchParts, tick, enter } from './base.js';

/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').GameState} GameState */

export const kind = 'sentinel';
export const rig = 'knight';

const SENTINEL_HP = 10;
const SENTINEL_W = 34;
const SENTINEL_H = 30;
/** Walking pace, not a dash: the plate is a light it is drawn to, not one it hunts. */
const SENTINEL_OPEN_SPEED = 0.9;
/** Close enough to the plate to stop. Wider than a step, so it cannot judder. */
const SENTINEL_OPEN_REACH = 6;

/** @type {import('./index.js').BossDef} */
export const boss = { id: 'sentinel', name: 'Sentinel', maxHp: SENTINEL_HP, grants: 'twinPin' };

/**
 * Shoulder plates, one each side, at hand height and standing proud of the body so
 * a straight throw reaches the plate before it reaches the armour.
 */
const PARTS = /** @type {const} */ ([
  { offX: -10, offY: 8, swing: 0, material: 'stone' },
  { offX: SENTINEL_W - 4, offY: 8, swing: 0, material: 'stone' },
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
  const { e: base, open } = tick(e, s);
  if (open) return walkToPlate(enter(base, s, 'open', 0), s);
  // The Pin came out of the plate: back to the machine, from the top. Dormant and
  // not mid-dash, so the fight restarts with the twenty frames of windup that make
  // a Charger readable.
  if (base.mode === 'open') return enter(moveEntity(s.roomData, base, 0), s, 'dormant', 0);
  return chargerUpdate(base, s);
}

/**
 * Held open: it goes to the plate and stops there. Its back is to whoever threw,
 * which is the only shape of this fight the Apex was ever trying to teach.
 * @param {Entity} e
 * @param {Readonly<GameState>} s
 * @returns {Entity}
 */
function walkToPlate(e, s) {
  const plate = s.entities.find((x) => x.timers.owner === e.id && x.pinned);
  if (!plate) return moveEntity(s.roomData, e, 0);
  const dx = plate.x + plate.w / 2 - (e.x + e.w / 2);
  if (Math.abs(dx) <= SENTINEL_OPEN_REACH) return moveEntity(s.roomData, e, 0);
  const facing = /** @type {-1|1} */ (dx < 0 ? -1 : 1);
  return { ...moveEntity(s.roomData, { ...e, facing }, facing * SENTINEL_OPEN_SPEED), facing };
}
