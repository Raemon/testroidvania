/**
 * THE CENTREPIECE (04-architecture §7).
 *
 * The bot walks the whole route in real Chromium, through the real loop, the real
 * `step()` and the real renderer, with invariants running every frame and the HUD
 * compared to state at every intent boundary. Then the input tape the browser
 * actually produced is replayed in Node and the two final hashes must match — the
 * strongest single assertion in the suite, because if it passes the view provably
 * did not perturb the sim.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchGame } from './harness/browser.js';
import { hash } from '../src/core/hash.js';
import { ROUTE, ROUTE_EXPECTED_FRAMES } from '../src/content/routes.js';
import { newRun, replay } from './harness/run.js';

/** Global budget: past this the bot is wandering, which is nearly always a game bug. */
const FRAME_BUDGET = Math.ceil(ROUTE_EXPECTED_FRAMES * 1.5);
// Frames per round trip. Every batch costs five page evaluations at ~35ms, so the
// batch size — not the frame count — is what the route's length costs in wall
// clock. 60 is still well inside the shortest room the bot can pass through.
const BATCH = 60;

test('the bot plays the whole route in the browser, and Node agrees frame for frame', async () => {
  const game = await launchGame({ query: 'seed=1&debug=1&lockstep=1&bot=1' });
  /** @type {{intent: string, tick: number}[]} */
  const beats = [];
  /** @type {string[]} */
  const pinStates = [];
  try {
    await game.call('recordFrom', 0);

    let pumped = 0;

    for (const intent of ROUTE) {
      if ('expect' in intent) {
        const state = await game.call('state');
        if (intent.expect.room) assert.equal(state.room, intent.expect.room, 'route expectation');
        if (intent.expect.hpAtLeast !== undefined) {
          assert.ok(state.player.hp >= intent.expect.hpAtLeast, `hp ${state.player.hp} < ${intent.expect.hpAtLeast} in ${state.room}`);
        }
        if (intent.expect.abilities) assert.deepEqual(state.progress.abilities, intent.expect.abilities);
        if (intent.expect.lanternsAtLeast !== undefined) {
          assert.ok(
            state.progress.lanternsLit.length >= intent.expect.lanternsAtLeast,
            `only ${state.progress.lanternsLit.length} lantern(s) lit in ${state.room}`,
          );
        }
        continue;
      }

      const goal = intent.go;
      while ((await game.call('room')) !== goal && pumped < FRAME_BUDGET) {
        await game.pump(BATCH);
        pumped += BATCH;
        pinStates.push((await game.call('observe')).pin.state);
        if (await game.call('botStuck')) {
          assert.fail(`bot gave up before reaching '${goal}' at tick ${await game.call('tick')} in room ${await game.call('room')}`);
        }
      }
      assert.equal(await game.call('room'), goal, `never reached '${goal}' within ${FRAME_BUDGET} frames`);

      // Intent boundary: HUD/sim agreement, pixel sanity, and a recorded beat.
      await game.assertHudMatchesState();
      const probe = await game.probe();
      assert.ok(probe.nonBackground > 0.02 && probe.nonBackground < 0.98,
        `at '${goal}' the screen is ${(probe.nonBackground * 100).toFixed(1)}% non-background`);
      assert.ok(probe.playerVisible, `at '${goal}' the player is not drawn at its own screen position`);
      beats.push({ intent: goal, tick: await game.call('tick') });
    }

    // The bot does not stop here — the world continues past the route's last
    // intent — so the run ends where the route ends. That the bot keeps going,
    // unaided, all the way to the slag gate is asserted in `rooms.test.js`, in
    // Node, where the frames are free.

    const finalTick = await game.call('tick');
    assert.ok(finalTick <= FRAME_BUDGET, `route took ${finalTick} frames, budget is ${FRAME_BUDGET}`);
    assert.equal(await game.call('room'), 'r2_trunk', 'the route ends where routes.js says it ends');
    assert.deepEqual(await game.call('violations'), []);
    assert.deepEqual(await game.call('errors'), []);
    game.assertClean();

    // The opening is a teaching sequence, so assert it was actually taught: the
    // bot learned the Pin in the browser, not only in Node.
    const end = await game.call('state');
    assert.equal(end.player.hp, end.player.maxHp, 'the opening must cost no health');
    assert.equal(end.progress.deaths, 0);
    assert.ok(end.progress.lanternsLit.length >= 1, 'the save-lantern was never walked through');
    assert.equal(end.pin.state, 'held', 'the opening ends with the Pin back in hand');
    assert.deepEqual(pinStates.filter((k) => ['embedded', 'pinned', 'returning'].includes(k)).length > 0, true,
      `the bot never used the Pin in the browser; it only saw ${[...new Set(pinStates)].join(', ')}`);

    // --- The cross-environment assertion -----------------------------------
    const tape = await game.call('tape');
    const browserHash = await game.call('hash');
    assert.equal(tape.length, finalTick, 'the recorded tape must be exactly one entry per simulated frame');

    const nodeState = replay(newRun(1), tape);
    assert.equal(
      hash(nodeState),
      browserHash,
      `browser and Node diverged replaying the same ${tape.length}-frame tape` +
      ` (node ended in ${nodeState.room} at ${nodeState.player.x.toFixed(2)},${nodeState.player.y.toFixed(2)})`,
    );
    assert.equal(nodeState.tick, finalTick);
  } catch (e) {
    await game.dumpFailure('playthrough');
    if (e instanceof Error) e.message += `\n  beats: ${beats.map((b) => `${b.intent}@${b.tick}`).join(' -> ') || '(none)'}`;
    throw e;
  } finally {
    await game.close();
  }
});
