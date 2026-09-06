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
const BATCH = 30;

test('the bot plays the whole route in the browser, and Node agrees frame for frame', async () => {
  const game = await launchGame({ query: 'seed=1&debug=1&lockstep=1&bot=1' });
  /** @type {{intent: string, tick: number}[]} */
  const beats = [];
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
        continue;
      }

      const goal = intent.go;
      while ((await game.call('room')) !== goal && pumped < FRAME_BUDGET) {
        await game.pump(BATCH);
        pumped += BATCH;
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

    // Let the bot finish the last room's route rather than stopping at its door.
    await game.pumpUntil('botDone', { batch: BATCH, maxFrames: FRAME_BUDGET - pumped, label: 'bot finishes the final room' });

    const finalTick = await game.call('tick');
    assert.ok(finalTick <= FRAME_BUDGET, `route took ${finalTick} frames, budget is ${FRAME_BUDGET}`);
    assert.equal(await game.call('room'), 't3_ceiling');
    assert.deepEqual(await game.call('violations'), []);
    assert.deepEqual(await game.call('errors'), []);
    game.assertClean();

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
