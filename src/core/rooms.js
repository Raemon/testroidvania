/**
 * Room load and door transition resolution.
 *
 * A door fires when the player's hitbox overlaps the door's tile, which is only
 * reachable by walking into the room's border wall — so a transition is always a
 * deliberate act, and arriving one tile inside the partner door means the player
 * never bounces straight back.
 */

import { TILE } from './constants.js';
import { getRoom } from '../content/rooms/index.js';
import { findDoor } from '../content/world.js';
import { overlaps } from './geometry.js';

/** @typedef {import('./types.js').Room} Room */
/** @typedef {import('./types.js').Door} Door */
/** @typedef {import('./types.js').AABB} AABB */
/** @typedef {import('./types.js').AbilityId} AbilityId */

export { getRoom, overlaps };

/**
 * Where a body of size w x h stands when its feet rest on the bottom of tile
 * (tx, ty), horizontally centred on that tile.
 * @param {number} tx
 * @param {number} ty
 * @param {number} w
 * @param {number} h
 * @returns {{x:number, y:number}}
 */
export function standOn(tx, ty, w, h) {
  return { x: tx * TILE + (TILE - w) / 2, y: (ty + 1) * TILE - h };
}

/**
 * Where the player materialises after coming through `door` into `room`. Side
 * doors put the player one tile inside; that offset is what invariant 11 checks.
 * @param {Room} room
 * @param {Door} door
 * @param {number} w
 * @param {number} h
 * @returns {{x:number, y:number}}
 */
export function doorEntry(room, door, w, h) {
  const [tx, ty] = door.at;
  const y = (ty + 1) * TILE - h;
  if (tx === 0) return { x: TILE + 1, y };
  if (tx === room.w - 1) return { x: (room.w - 1) * TILE - w - 1, y };
  if (ty === 0) return { x: tx * TILE + (TILE - w) / 2, y: TILE + 1 };
  return { x: tx * TILE + (TILE - w) / 2, y: (room.h - 1) * TILE - h - 1 };
}

/**
 * @param {Room} room
 * @param {AABB} box
 * @param {AbilityId[]} abilities
 * @returns {Door|null} the door the box is standing in, if it is passable
 */
export function doorUnder(room, box, abilities) {
  for (const door of room.doors) {
    if (door.requires && !abilities.includes(door.requires)) continue;
    const [tx, ty] = door.at;
    if (overlaps(box, { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })) return door;
  }
  return null;
}

/**
 * @param {Door} door
 * @returns {{room: Room, door: Door}|null} the partner side of a transition, or
 *   null when the content is malformed (which `content.test.js` catches statically)
 */
export function resolvePartner(door) {
  const [toRoomId = '', toDoorId = ''] = door.to.split(':');
  const room = getRoom(toRoomId);
  if (!room) return null;
  const partner = findDoor(toRoomId, toDoorId);
  if (!partner) return null;
  return { room, door: partner };
}

/**
 * Crumble a tile out of the room (§G: the Pin bites, the tile gives way).
 *
 * The compiled room is immutable shared content, so a broken tile produces a
 * *derived* room rather than mutating the registry's copy. `brokenTiles` travels
 * in the state so a save can rebuild that derived room instead of freezing it.
 *
 * @param {Room} room
 * @param {readonly string[]} brokenTiles
 * @param {number} tx
 * @param {number} ty
 * @returns {{room: Room, brokenTiles: string[]}}
 */
export function breakTile(room, brokenTiles, tx, ty) {
  const key = `${tx},${ty}`;
  if (brokenTiles.includes(key)) return { room, brokenTiles: /** @type {string[]} */ (brokenTiles.slice()) };
  return { room: withoutTile(room, tx, ty), brokenTiles: [...brokenTiles, key].sort() };
}

/**
 * @param {Room} room
 * @param {readonly string[]} brokenTiles
 * @returns {Room} the room with every recorded tile crumbled away
 */
export function applyBroken(room, brokenTiles) {
  let out = room;
  for (const key of brokenTiles) {
    const [tx, ty] = key.split(',').map(Number);
    if (Number.isInteger(tx) && Number.isInteger(ty)) out = withoutTile(out, Number(tx), Number(ty));
  }
  return out;
}

/** @param {Room} room @param {number} tx @param {number} ty @returns {Room} */
function withoutTile(room, tx, ty) {
  const grid = room.grid.map((row, y) => (y === ty ? row.slice(0, tx) + '.' + row.slice(tx + 1) : row));
  return { ...room, grid };
}
