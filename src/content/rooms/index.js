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
import * as o7_shrine from './o7_shrine.js';
import * as s1_floor from './s1_floor.js';
import * as s2_awakening from './s2_awakening.js';
import * as s3_throat from './s3_throat.js';
import * as s4_gallery from './s4_gallery.js';
import * as s5_crown from './s5_crown.js';
import * as f1_stoker from './f1_stoker.js';
import * as c1_diver from './c1_diver.js';
import * as x1_sentinel from './x1_sentinel.js';
import * as k1_seal from './k1_seal.js';

/** @type {Record<string, import('../room-format.js').RoomModule>} */
export const ROOM_MODULES = {
  o1_arrival,
  o2_gaps,
  o3_drop,
  o4_step,
  o5_ladder,
  o6_weapon,
  o7_shrine,
  s1_floor,
  s2_awakening,
  s3_throat,
  s4_gallery,
  s5_crown,
  f1_stoker,
  c1_diver,
  x1_sentinel,
  k1_seal,
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
