/**
 * Every boss, against the contract in `src/core/bosses/index.js`.
 *
 * The two things asserted for all of them are the two that make a boss a boss:
 * **its policy can kill it**, and **it can kill the player**. A boss that fails the
 * first is a wall; one that fails the second is scenery. Both are checked by running
 * the actual fight, because a boss is a state machine and the only honest test of a
 * state machine is to play against it.
 *
 * The policies are reactive — `(observation) -> input bits` — not input tapes. A tape
 * is written against one exact sequence of boss frames and walks into a wall the
 * first time the boss changes its mind; a policy has to read the telegraph.
 */

import './harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES, isBoss } from '../src/core/bosses/index.js';
import { POLICIES } from '../src/bot/policies/index.js';
import { ROOM_IDS, ROOM_MODULES, getRoom } from '../src/content/rooms/index.js';
import { ENTITY_KINDS } from '../src/core/entities/index.js';
import { TILE, PIN_HIT_W } from '../src/core/constants.js';
import { observe } from '../src/bot/api.js';
import { step } from '../src/core/step.js';
import { check, formatViolation } from '../src/core/invariants.js';
import { newRun } from './harness/run.js';

/** @typedef {import('../src/core/types.js').GameState} GameState */

/** The room each boss stands in, found from the content rather than named twice. */
const arenas = new Map(
  ROOM_IDS.flatMap((id) => (getRoom(id)?.spawns ?? [])
    .filter((sp) => isBoss(sp.kind))
    .map((sp) => /** @type {[string, string]} */ ([sp.kind, id]))),
);

/**
 * Run a fight to a conclusion under `drive`, checking invariants every frame.
 * @param {string} roomId
 * @param {(s: GameState) => number} drive
 * @param {number} frames
 * @param {boolean} [midArena] start in the middle rather than on the doorstep, so a
 *   passive test measures the boss rather than how far knockback carries you out
 * @returns {GameState}
 */
function fight(roomId, drive, frames, midArena = false) {
  const start = newRun(1, roomId);
  const needs = ROOM_MODULES[roomId]?.needs ?? [];
  let s = { ...start, progress: { ...start.progress, abilities: needs.slice() } };
  if (midArena) {
    // Stand next to the boss, on the side away from the door: a passive test is
    // about whether the boss can kill you, not about how far knockback carries you.
    const room = getRoom(roomId);
    const boss = room?.spawns.find((sp) => isBoss(sp.kind));
    const bossX = (boss?.at[0] ?? 0) * TILE;
    const doorX = (room?.doors[0]?.at[0] ?? 0) * TILE;
    s = { ...s, player: { ...s.player, x: doorX < bossX ? bossX + 40 : bossX - 40 } };
  }
  for (let f = 0; f < frames; f++) {
    const prev = s;
    const input = drive(s);
    s = step(s, input);
    const violations = check(prev, s, input);
    assert.equal(violations.length, 0, `${roomId} frame ${f}: ${violations.map(formatViolation).join('; ')}`);
    if (s.player.hp <= 0 || !s.entities.some((e) => isBoss(e.kind))) return s;
  }
  return s;
}

test('every boss is registered as an entity kind and has a room to stand in', () => {
  for (const id of Object.keys(BOSSES)) {
    assert.ok(ENTITY_KINDS[id], `boss '${id}' is not an entity kind — nothing can spawn it`);
    assert.ok(arenas.get(id), `boss '${id}' has no room; a boss with no arena is unreachable content`);
  }
});

test('every boss has a reactive policy', () => {
  for (const id of Object.keys(BOSSES)) {
    assert.equal(typeof POLICIES[id], 'function', `boss '${id}' ships without a policy that can beat it`);
  }
});

for (const [id, def] of Object.entries(BOSSES)) {
  const roomId = arenas.get(id) ?? '';

  test(`${id}: its policy kills it`, () => {
    const policy = POLICIES[id];
    assert.ok(policy, `no policy for ${id}`);
    const end = fight(roomId, (s) => policy(observe(s)), 9000);
    assert.ok(end.player.hp > 0, `the ${id} killed the bot instead`);
    assert.ok(
      end.progress.bossesKilled.includes(id),
      `the policy could not kill the ${id} (${def.maxHp} HP) in 9000 frames`,
    );
  });

  test(`${id}: it kills a player who does nothing`, () => {
    // The other half. A boss that cannot kill you is scenery with a health bar.
    const end = fight(roomId, () => 0, 9000, true);
    assert.equal(end.room, roomId, `the ${id} shoved the bot out of its own arena`);
    assert.equal(end.player.hp, 0, `standing still in front of the ${id} costs nothing`);
  });

  test(`${id}: it is guarded until one of its parts is held`, () => {
    const start = newRun(1, roomId);
    let s = start;
    for (let f = 0; f < 40; f++) s = step(s, 0);
    const root = s.entities.find((e) => e.kind === id);
    assert.ok(root, `${id} did not spawn`);
    assert.ok((root?.timers.guard ?? 0) > 0, `${id} is open with all its plates up`);

    const parts = s.entities.filter((e) => e.timers.owner === root?.id);
    assert.ok(parts.length > 0, `${id} hatched no pinnable part — the fight has no way in`);
    for (const part of parts) {
      assert.ok(part.pinMaterial, `a part of ${id} has no material, so nothing decides whether the Pin bites`);
      assert.notEqual(part.pinMaterial, 'metal', `a metal part of ${id} can never be pinned — that seals the fight`);
      assert.equal(part.mass, 0, `a heavy part of ${id} can never be pinned (00-BIBLE §6)`);
      // Geometry, not decoration: a part flush with the armour is a part a level
      // throw never reaches, because the body is in front of it. The swing counts
      // against it, since the throw has to connect at the *worst* point of the sweep.
      const offX = part.timers.offX ?? 0;
      const swing = part.timers.swing ?? 0;
      const proud = Math.max(-offX, offX + part.w - root.w) - swing;
      assert.ok(
        proud >= PIN_HIT_W / 2,
        `a part of ${id} stands ${proud}px proud of the body at the worst of its sweep; a throw meets the armour first`,
      );
    }
  });
}
