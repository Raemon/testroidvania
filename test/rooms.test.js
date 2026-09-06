/**
 * Per-room traversal in isolation — the bisector. When the playthrough breaks,
 * whichever room test broke alongside it names the culprit (04-architecture §7).
 *
 * AGENTS.md rule 5: a room without a passing entry here is not done.
 */

import './harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_IDS, getRoom } from '../src/content/rooms/index.js';
import { TILE, PLAYER_W } from '../src/core/constants.js';
import { step } from '../src/core/step.js';
import { newRun, runBot, assertFinished } from './harness/run.js';

/** Every room must be traversable from its own route's first waypoint. */
for (const id of ROOM_IDS) {
  test(`${id}: the servo walks its route end to end`, () => {
    const room = getRoom(id);
    assert.ok(room, `room ${id} did not compile`);

    // createInitialState places a non-start room's player on its first waypoint.
    const result = runBot(newRun(1, id), {
      maxFrames: 1200,
      // Leaving the room through its exit door is success too.
      until: (s) => s.room !== id,
    });
    assertFinished(result, `${id} traversal`);

    const last = room.route[room.route.length - 1];
    const leftTheRoom = result.state.room !== id;
    if (!leftTheRoom && last) {
      const cx = result.state.player.x + PLAYER_W / 2;
      assert.ok(
        Math.abs(cx - (last[0] * TILE + TILE / 2)) < 24,
        `${id}: bot stopped at x=${cx.toFixed(1)}, last waypoint is x=${last[0] * TILE + TILE / 2}`,
      );
    }
    assert.equal(result.state.player.hp, result.state.player.maxHp, `${id}: the route must not cost health`);
    assert.deepEqual(result.state.errors, [], `${id}: step() reported errors`);
  });
}

test('the opening is one connected chain the bot walks end to end, unaided', () => {
  const result = runBot(newRun(1), { maxFrames: 2400 });
  assertFinished(result, 'the opening');
  assert.equal(result.state.room, 'o6_weapon', 'the opening ends at the stone wall the Pin cannot solve');
  assert.equal(result.state.player.hp, result.state.player.maxHp, 'the opening must cost no health');
  assert.equal(result.state.progress.deaths, 0, 'and no deaths');
  assert.ok(
    result.state.progress.lanternsLit.length >= 1,
    'the bot must walk through the first save-lantern; it is on the critical path',
  );
  assert.ok(result.frames < 1800, `the opening took ${result.frames} frames`);
});

test('the bot uses the Pin: it throws, stands on it, jabs an enemy and recalls', () => {
  const seen = new Set();
  let killed = false;
  const result = runBot(newRun(1), {
    maxFrames: 2400,
    until: () => false,
  });
  assertFinished(result, 'the opening');
  // Replaying the bot's own tape is how we see the states it passed through.
  let s = newRun(1);
  for (const input of result.tape) {
    s = step(s, input);
    seen.add(s.pin.state);
    if (s.player.perch) seen.add('perch');
    if (s.player.jabFrames > 0) seen.add('jab');
    if (s.room === 'o6_weapon' && s.entities.every((e) => e.kind !== 'crawler')) killed = true;
  }
  for (const beat of ['flying', 'embedded', 'pinned', 'returning', 'perch', 'jab']) {
    assert.ok(seen.has(beat), `the bot never reached '${beat}' — it did not learn the Pin`);
  }
  assert.ok(killed, 'the bot never killed the crawler in o6_weapon');
});
