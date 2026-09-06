/**
 * Region lookup. Rooms are named by their region's initial (00-BIBLE §3), so the
 * audio region is derived from the room id and the core never has to tell us.
 */

import { CISTERN } from './cistern.js';
import { FOUNDRY } from './foundry.js';
import { OSSUARY } from './ossuary.js';
import { SPINE } from './spine.js';
import { VERDANT } from './verdant.js';

/** @type {Record<string, import('../sequencer.js').Region>} */
export const REGIONS = {
  cistern: CISTERN,
  foundry: FOUNDRY,
  ossuary: OSSUARY,
  spine: SPINE,
  verdant: VERDANT,
};

/**
 * @param {string} roomId
 * @returns {import('../sequencer.js').Region}
 */
export function regionForRoom(roomId) {
  const c = (roomId[0] ?? '').toUpperCase();
  if (c === 'C') return CISTERN;
  if (c === 'F') return FOUNDRY;
  // Roots wears the Verdant palette; Apex and the Core wear the Ossuary's.
  if (c === 'R') return VERDANT;
  if (c === 'X' || c === 'K' || c === 'E') return OSSUARY;
  if (c === 'S') return SPINE;
  // The Phase 1 test rooms (t1_flat, ...) get the one region that is finished, so
  // the playthrough test exercises the shipping material.
  return CISTERN;
}
