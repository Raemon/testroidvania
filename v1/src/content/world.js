/**
 * The world graph: where a run starts, and the door pairings derived from the
 * rooms themselves. Doors are declared once, on the room that owns them, and the
 * graph is computed — so a door can never disagree with its own room file.
 */

import { ROOM_IDS, ROOM_MODULES } from './rooms/index.js';

/** Where a new run begins. `at` is the tile the player's feet rest on. */
export const START = {
  room: 't1_flat',
  at: /** @type {[number, number]} */ ([3, 12]),
};

/**
 * @typedef {object} WorldEdge
 * @property {string} fromRoom
 * @property {string} fromDoor
 * @property {string} toRoom
 * @property {string} toDoor
 * @property {import('../core/types.js').AbilityId|null} requires
 */

/** @returns {WorldEdge[]} one edge per door, in room-then-door id order */
export function worldEdges() {
  /** @type {WorldEdge[]} */
  const edges = [];
  for (const roomId of ROOM_IDS) {
    const mod = ROOM_MODULES[roomId];
    if (!mod) continue;
    for (const door of [...mod.doors].sort((a, b) => a.id.localeCompare(b.id))) {
      const [toRoom = '', toDoor = ''] = door.to.split(':');
      edges.push({ fromRoom: roomId, fromDoor: door.id, toRoom, toDoor, requires: door.requires });
    }
  }
  return edges;
}

/**
 * @param {string} roomId
 * @param {string} doorId
 * @returns {import('../core/types.js').Door|null}
 */
export function findDoor(roomId, doorId) {
  return ROOM_MODULES[roomId]?.doors.find((d) => d.id === doorId) ?? null;
}
