/**
 * The world graph: where a run starts, and the door pairings derived from the
 * rooms themselves. Doors are declared once, on the room that owns them, and the
 * graph is computed — so a door can never disagree with its own room file.
 */

import { ROOM_IDS, ROOM_MODULES } from './rooms/index.js';

/** Where a new run begins. `at` is the tile the player's feet rest on. */
export const START = {
  room: 'o1_arrival',
  // Two tiles above the floor: the run opens with a landing, before a key is
  // pressed (03-game-feel §6 beat 0).
  at: /** @type {[number, number]} */ ([3, 10]),
};

/**
 * The Spine, bottom to top. The Ascent is this list in order on a clock, and a
 * checkpoint is an index into it — which is only meaningful because §A3 made every
 * one of these tiers a climb the player has already done once, with the ability
 * that opens it, within a minute of earning it.
 */
export const SPINE_TIERS = /** @type {const} */ ([
  's1_floor', 's2_awakening', 's3_throat', 's4_gallery', 's5_crown',
]);

/** Where a run ends. The reachability solver treats this as the goal. */
export const ENDING_ROOM = 'e1_hull';

/** The flag the Crown door opens on, set when the Anchor falls. */
export const ASCENT_FLAG = 'ascent';

/** The flag set by running out the far edge of the Hull. */
export const COMPLETE_FLAG = 'gameComplete';

/** @param {string} roomId @returns {number} the Spine tier index, or -1 */
export function spineTier(roomId) {
  return SPINE_TIERS.indexOf(/** @type {typeof SPINE_TIERS[number]} */ (roomId));
}

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
