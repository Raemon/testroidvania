/**
 * Per-room traversal in isolation — the bisector. When the playthrough breaks,
 * whichever room test broke alongside it names the culprit (04-architecture §7).
 *
 * AGENTS.md rule 5: a room without a passing entry here is not done.
 */

import './harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_IDS, ROOM_MODULES, getRoom } from '../src/content/rooms/index.js';
import { TILE, PLAYER_W } from '../src/core/constants.js';
import { step } from '../src/core/step.js';
import { isBoss } from '../src/core/bosses/index.js';
import { newRun, runBot, assertFinished } from './harness/run.js';

/**
 * Every room must be traversable from its own route's first waypoint, carrying
 * exactly the abilities its own `needs` declares — no more. That is what makes this
 * a gate test as well as a traversal test: a Spine room whose route says `climb`
 * proves the Height gate is crossable with Zip and with nothing else.
 */
for (const id of ROOM_IDS) {
  test(`${id}: the servo walks its route end to end`, () => {
    const room = getRoom(id);
    assert.ok(room, `room ${id} did not compile`);
    const needs = ROOM_MODULES[id]?.needs ?? [];
    const boss = room.spawns.find((sp) => isBoss(sp.kind));

    const start = newRun(1, id);
    const result = runBot(
      { ...start, progress: { ...start.progress, abilities: needs.slice() } },
      {
        maxFrames: boss ? 9000 : 1200,
        // Leaving the room through its exit door is success too.
        until: (s) => s.room !== id,
      },
    );
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
    if (boss) {
      // A boss room costs health by design. What it must not do is cost the run,
      // and it must actually end with the boss dead rather than walked around.
      assert.ok(result.state.player.hp >= 1, `${id}: the boss killed the bot`);
      assert.ok(
        result.state.progress.bossesKilled.includes(boss.kind),
        `${id}: the route finished without killing the ${boss.kind}`,
      );
    } else {
      assert.equal(result.state.player.hp, result.state.player.maxHp, `${id}: the route must not cost health`);
    }
    assert.deepEqual(result.state.errors, [], `${id}: step() reported errors`);
  });
}

test('the opening is one connected chain the bot walks end to end, unaided', () => {
  // The opening is the six `o` rooms: arrival to the stone wall the Pin cannot
  // solve. It is no longer where the game stops, so the test is "the bot walked
  // out of it", not "the bot ended in it".
  const result = runBot(newRun(1), { maxFrames: 2400, until: (s) => !s.room.startsWith('o') });
  assertFinished(result, 'the opening');
  assert.ok(!result.state.room.startsWith('o'), `the bot never left the opening; it stopped in ${result.state.room}`);
  assert.equal(result.state.player.hp, result.state.player.maxHp, 'the opening must cost no health');
  assert.equal(result.state.progress.deaths, 0, 'and no deaths');
  assert.ok(
    result.state.progress.lanternsLit.length >= 1,
    'the bot must walk through the first save-lantern; it is on the critical path',
  );
  assert.ok(result.frames < 1800, `the opening took ${result.frames} frames`);
});

test('the unaided run plays the Roots and the Foundry end to end, and kills the Stoker on the way', () => {
  // The browser playthrough is bounded by render cost (see routes.js), so the run
  // itself is proved here: one bot, no abilities granted, from the first frame to
  // the Cistern's door — the opening, the Roots, Zip, the Spine's first Height
  // gate, the whole Foundry, the Stoker, Deep Pin, and the slag gate out.
  const result = runBot(newRun(1), { maxFrames: 9000, until: (s) => s.room === 's3_throat' });
  assertFinished(result, 'the unaided run');
  assert.equal(result.state.room, 's3_throat', 'the run must reach Spine tier three');
  assert.deepEqual(result.state.progress.abilities, ['zip', 'deepPin'], 'both region abilities, in ladder order');
  assert.deepEqual(result.state.progress.bossesKilled, ['stoker'], 'the Stoker must actually fall');
  assert.ok(result.state.player.hp >= 4, `the run cost ${result.state.player.maxHp - result.state.player.hp} health outside the arena`);
  assert.equal(result.state.progress.deaths, 0, 'and no deaths');
  assert.ok(
    result.state.progress.lanternsLit.length >= 8,
    `only ${result.state.progress.lanternsLit.length} lanterns lit; the checkpoint density is every 2-3 rooms`,
  );
  assert.deepEqual(result.state.errors, []);
});

test('the bot uses the Pin: it throws, stands on it, jabs an enemy and recalls', () => {
  const seen = new Set();
  let killed = false;
  const result = runBot(newRun(1), {
    maxFrames: 2400,
    until: (s) => !s.room.startsWith('o'),
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
