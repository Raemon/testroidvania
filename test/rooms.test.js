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

test('the three rooms form one connected chain the bot walks end to end', () => {
  const result = runBot(newRun(1), { maxFrames: 1500 });
  assertFinished(result, 'full chain');
  assert.equal(result.state.room, 't3_ceiling', 'the chain must end in the last room');
  assert.ok(result.frames < 900, `chain took ${result.frames} frames`);
});
