/**
 * The room registry. Adding a room is a new file plus one alphabetically-sorted
 * line here — never a restructure of this file (AGENTS.md rule 4).
 */

import { compileRoom } from '../room-format.js';
import * as o1_arrival from './o1_arrival.js';
import * as o2_gaps from './o2_gaps.js';
import * as o3_drop from './o3_drop.js';
import * as o4_step from './o4_step.js';
import * as o5_ladder from './o5_ladder.js';
import * as o6_weapon from './o6_weapon.js';

/** @type {Record<string, import('../room-format.js').RoomModule>} */
export const ROOM_MODULES = {
  o1_arrival,
  o2_gaps,
  o3_drop,
  o4_step,
  o5_ladder,
  o6_weapon,
};

export const ROOM_IDS = Object.keys(ROOM_MODULES).sort();

/** @type {Map<string, import('../../core/types.js').Room>} */
const compiled = new Map();

/**
 * Compiled rooms are immutable and shared by every state that references them,
 * so compiling once is both a speed win and what keeps `hash()` cheap.
 * @param {string} id
 * @returns {import('../../core/types.js').Room|null}
 */
export function getRoom(id) {
  const cached = compiled.get(id);
  if (cached) return cached;
  const mod = ROOM_MODULES[id];
  if (!mod) return null;
  const room = compileRoom(mod);
  compiled.set(id, room);
  return room;
}
