#!/usr/bin/env node
/**
 * The completability solver (04-architecture §8), as a search over
 * **(room x ability set)** rather than over rooms alone.
 *
 * Rooms alone cannot answer the question the design actually asks. "Is every room
 * reachable" misses the two mistakes that matter when eight agents add content in
 * parallel:
 *
 *  - **an ability required before it is obtainable** — a gate whose key is behind it,
 *    which a room-only fixpoint reports as "unreachable" without saying why;
 *  - **a one-way drop that strands the player** — a place you can get into with the
 *    abilities you have and cannot get out of or finish from.
 *
 * So the state is a room plus the set of abilities you hold when you are standing in
 * it, the search is exhaustive over that product (five abilities: 32 sets, a handful
 * of rooms — milliseconds), and "completable" means *the goal is reachable from every
 * state that is itself reachable*. That is the property "you can never be stranded"
 * actually means.
 */

import { ROOM_IDS, ROOM_MODULES } from '../src/content/rooms/index.js';
import { START } from '../src/content/world.js';
import { ABILITY_IDS, ABILITY_ORDER } from '../src/core/abilities/index.js';

/** Bit per ability, in ladder order, so a set is one integer. */
const BIT = new Map(ABILITY_IDS.map((id, i) => [id, 1 << i]));

/**
 * @typedef {object} Reachability
 * @property {string[]} reachable      room ids, sorted
 * @property {string[]} unreachable    room ids, sorted
 * @property {string[]} owned          ability ids obtainable, sorted
 * @property {string[]} blockedDoors   'room:door requires X' for every gate never opened
 * @property {string[]} stranded       'room with {abilities}' states the ending cannot be reached from
 * @property {string[]} outOfOrder     abilities whose room needs an ability earned later
 * @property {string} goal             the last room in the ladder, the one a run has to reach
 */

/** @param {string} roomId @param {number} bits @returns {string} */
function key(roomId, bits) {
  return `${roomId}#${bits}`;
}

/** @param {number} bits @returns {string} */
function nameOf(bits) {
  return ABILITY_IDS.filter((id) => bits & (BIT.get(id) ?? 0)).join('+') || 'nothing';
}

/**
 * Abilities picked up by standing in this room, folded into the set you arrive with.
 * @param {string} roomId
 * @param {number} bits
 * @returns {number}
 */
function collect(roomId, bits) {
  let out = bits;
  for (const pickup of ROOM_MODULES[roomId]?.pickups ?? []) {
    const ability = /** @type {{ability?: string}} */ (pickup).ability;
    if (pickup.kind === 'ability' && ability) out |= BIT.get(ability) ?? 0;
  }
  return out;
}

/**
 * @param {string} roomId
 * @param {number} bits
 * @returns {{room: string, bits: number}[]} every state one door away
 */
function exits(roomId, bits) {
  /** @type {{room: string, bits: number}[]} */
  const out = [];
  for (const door of ROOM_MODULES[roomId]?.doors ?? []) {
    if (door.requires && !(bits & (BIT.get(door.requires) ?? 0))) continue;
    const [toRoom] = door.to.split(':');
    if (toRoom) out.push({ room: toRoom, bits: collect(toRoom, bits) });
  }
  return out;
}

/** @returns {Reachability} */
export function solve() {
  const startBits = collect(START.room, 0);
  /** @type {Map<string, {room: string, bits: number}>} */
  const seen = new Map();
  /** @type {{room: string, bits: number}[]} */
  const queue = [{ room: START.room, bits: startBits }];
  seen.set(key(START.room, startBits), queue[0] ?? { room: START.room, bits: startBits });

  while (queue.length) {
    const at = queue.pop();
    if (!at) break;
    for (const next of exits(at.room, at.bits)) {
      const k = key(next.room, next.bits);
      if (seen.has(k)) continue;
      seen.set(k, next);
      queue.push(next);
    }
  }

  const states = [...seen.values()];
  const reachable = new Set(states.map((s) => s.room));
  const owned = new Set();
  for (const s of states) for (const id of ABILITY_IDS) if (s.bits & (BIT.get(id) ?? 0)) owned.add(id);

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

  // The goal is the deepest room in the ladder: whatever the last ability opens.
  const goal = goalRoom();
  const canFinish = new Set();
  for (const s of states) {
    if (canReach(s, goal, seen)) canFinish.add(key(s.room, s.bits));
  }
  const stranded = states
    .filter((s) => !canFinish.has(key(s.room, s.bits)))
    .map((s) => `${s.room} holding ${nameOf(s.bits)} cannot reach '${goal}'`)
    .sort();

  return {
    reachable: [...reachable].sort(),
    unreachable: ROOM_IDS.filter((id) => !reachable.has(id)),
    owned: [...owned].sort(),
    blockedDoors,
    stranded,
    outOfOrder: ladderViolations(seen),
    goal,
  };
}

/**
 * @param {{room: string, bits: number}} from
 * @param {string} goal
 * @param {Map<string, {room: string, bits: number}>} universe
 * @returns {boolean}
 */
function canReach(from, goal, universe) {
  const seen = new Set([key(from.room, from.bits)]);
  const queue = [from];
  while (queue.length) {
    const at = queue.pop();
    if (!at) break;
    if (at.room === goal) return true;
    for (const next of exits(at.room, at.bits)) {
      const k = key(next.room, next.bits);
      if (seen.has(k) || !universe.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return false;
}

/**
 * The room the run has to end in: the one behind the last rung of the ladder. If no
 * door names the last ability, the goal is whichever room holds the last pickup.
 * @returns {string}
 */
function goalRoom() {
  const last = ABILITY_ORDER[ABILITY_ORDER.length - 1];
  for (const roomId of ROOM_IDS) {
    for (const door of ROOM_MODULES[roomId]?.doors ?? []) {
      if (door.requires === last) return door.to.split(':')[0] ?? roomId;
    }
  }
  return ROOM_IDS[ROOM_IDS.length - 1] ?? START.room;
}

/**
 * Ability ordering: every ability must be obtainable *before* the first gate that
 * asks for it, and the ladder must be earned in `ABILITY_ORDER`. A run that can hold
 * Reel before Zip means the Spine's tiers are not the ruler the design says they are.
 * @param {Map<string, {room: string, bits: number}>} universe
 * @returns {string[]}
 */
function ladderViolations(universe) {
  /** @type {string[]} */
  const out = [];
  for (const { bits } of universe.values()) {
    for (let i = 0; i < ABILITY_ORDER.length; i++) {
      const id = ABILITY_ORDER[i] ?? '';
      if (!(bits & (BIT.get(id) ?? 0))) continue;
      for (let j = 0; j < i; j++) {
        const earlier = ABILITY_ORDER[j] ?? '';
        if (bits & (BIT.get(earlier) ?? 0)) continue;
        const note = `'${id}' is obtainable without '${earlier}', which the ladder puts before it`;
        if (!out.includes(note)) out.push(note);
      }
    }
  }
  return out.sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = solve();
  process.stdout.write(`reachable (${r.reachable.length}): ${r.reachable.join(', ')}\n`);
  process.stdout.write(`abilities: ${r.owned.join(', ') || '(none)'}\n`);
  process.stdout.write(`goal: ${r.goal}\n`);
  if (r.unreachable.length) process.stdout.write(`UNREACHABLE: ${r.unreachable.join(', ')}\n`);
  for (const d of r.blockedDoors) process.stdout.write(`BLOCKED: ${d}\n`);
  for (const d of r.outOfOrder) process.stdout.write(`OUT OF ORDER: ${d}\n`);
  for (const d of r.stranded) process.stdout.write(`STRANDED: ${d}\n`);
  const bad = r.unreachable.length + r.blockedDoors.length + r.outOfOrder.length + r.stranded.length;
  process.exit(bad ? 1 : 0);
}
