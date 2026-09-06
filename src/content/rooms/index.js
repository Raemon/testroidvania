/**
 * The room registry. Adding a room is a new file plus one alphabetically-sorted
 * line here — never a restructure of this file (AGENTS.md rule 4).
 */

import { compileRoom } from '../room-format.js';
import * as t1_flat from './t1_flat.js';
import * as t2_gap from './t2_gap.js';
import * as t3_ceiling from './t3_ceiling.js';

/** @type {Record<string, import('../room-format.js').RoomModule>} */
export const ROOM_MODULES = {
  t1_flat,
  t2_gap,
  t3_ceiling,
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
