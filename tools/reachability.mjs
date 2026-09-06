#!/usr/bin/env node
/**
 * The completability solver (04-architecture §8). Fixpoint reachability over
 * (room set x ability set):
 *
 *   owned = {}; reachable = {start}
 *   repeat until stable:
 *     expand reachable through every door whose `requires` is a subset of owned
 *     owned |= abilities of every pickup in reachable rooms
 *
 * It answers the owner's actual question — *is the game completable?* — statically,
 * in milliseconds, and reports the two mistakes agents make most when adding rooms
 * in parallel: unreachable content, and an ability gate placed before the ability.
 */

import { ROOM_IDS, ROOM_MODULES } from '../src/content/rooms/index.js';
import { START } from '../src/content/world.js';

/**
 * @typedef {object} Reachability
 * @property {string[]} reachable      room ids, sorted
 * @property {string[]} unreachable    room ids, sorted
 * @property {string[]} owned          ability ids obtainable, sorted
 * @property {string[]} blockedDoors   'room:door requires X' for every gate never opened
 */

/** @returns {Reachability} */
export function solve() {
  /** @type {Set<string>} */
  const reachable = new Set([START.room]);
  /** @type {Set<string>} */
  const owned = new Set();

  for (let pass = 0; pass < ROOM_IDS.length + 8; pass++) {
    const before = reachable.size + owned.size;
    for (const roomId of [...reachable].sort()) {
      const mod = ROOM_MODULES[roomId];
      if (!mod) continue;
      for (const pickup of mod.pickups) {
        const ability = /** @type {{ability?: string}} */ (pickup).ability;
        if (pickup.kind === 'ability' && ability) owned.add(ability);
      }
      for (const door of mod.doors) {
        if (door.requires && !owned.has(door.requires)) continue;
        const [toRoom] = door.to.split(':');
        if (toRoom) reachable.add(toRoom);
      }
    }
    if (reachable.size + owned.size === before) break;
  }

  /** @type {string[]} */
  const blockedDoors = [];
  for (const roomId of ROOM_IDS) {
    if (!reachable.has(roomId)) continue;
    for (const door of ROOM_MODULES[roomId]?.doors ?? []) {
      if (door.requires && !owned.has(door.requires)) {
        blockedDoors.push(`${roomId}:${door.id} requires '${door.requires}', which is never obtainable`);
      }
    }
  }

  return {
    reachable: [...reachable].sort(),
    unreachable: ROOM_IDS.filter((id) => !reachable.has(id)),
    owned: [...owned].sort(),
    blockedDoors,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = solve();
  process.stdout.write(`reachable (${r.reachable.length}): ${r.reachable.join(', ')}\n`);
  process.stdout.write(`abilities: ${r.owned.join(', ') || '(none)'}\n`);
  if (r.unreachable.length) process.stdout.write(`UNREACHABLE: ${r.unreachable.join(', ')}\n`);
  for (const d of r.blockedDoors) process.stdout.write(`BLOCKED: ${d}\n`);
  process.exit(r.unreachable.length || r.blockedDoors.length ? 1 : 0);
}
