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
import * as r1_gate from './r1_gate.js';
import * as r2_trunk from './r2_trunk.js';
import * as r3_canopy from './r3_canopy.js';
import * as r4_vinerun from './r4_vinerun.js';
import * as r5_hollow from './r5_hollow.js';
import * as f1_vestibule from './f1_vestibule.js';
import * as f2_conveyor from './f2_conveyor.js';
import * as f3_crucible from './f3_crucible.js';
import * as f4_vents from './f4_vents.js';
import * as f5_antechamber from './f5_antechamber.js';
import * as f6_stoker from './f6_stoker.js';
import * as f7_slagway from './f7_slagway.js';
import * as f8_flue from './f8_flue.js';
import * as c1_diver from './c1_diver.js';
import * as c2_sluice from './c2_sluice.js';
import * as c3_basin from './c3_basin.js';
import * as c4_channel from './c4_channel.js';
import * as c5_undercroft from './c5_undercroft.js';
import * as c6_shrine from './c6_shrine.js';
import * as c7_weir from './c7_weir.js';
import * as c8_rapids from './c8_rapids.js';
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
  r1_gate,
  r2_trunk,
  r3_canopy,
  r4_vinerun,
  r5_hollow,
  f1_vestibule,
  f2_conveyor,
  f3_crucible,
  f4_vents,
  f5_antechamber,
  f6_stoker,
  f7_slagway,
  f8_flue,
  c1_diver,
  c2_sluice,
  c3_basin,
  c4_channel,
  c5_undercroft,
  c6_shrine,
  c7_weir,
  c8_rapids,
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
