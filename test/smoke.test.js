/**
 * The browser smoke test: the page loads, 300 frames of the real loop run, nothing
 * logged an error, the screen is not black, and the HUD is populated.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchGame } from './harness/browser.js';
import { IN } from '../src/core/input.js';

test('the page boots, runs 300 frames, draws, and populates the HUD', async () => {
  const game = await launchGame();
  try {
    assert.equal(await game.call('room'), 't1_flat');
    assert.equal(await game.call('tick'), 0, 'nothing may run before the harness pumps');

    const size = await game.call('canvasSize');
    assert.ok(size.width > 0 && size.height > 0, `canvas is ${size.width}x${size.height}`);

    await game.pump(60);
    const before = await game.probe();
    // The "did the screen change" probe is only meaningful while the player moves;
    // a still frame that never changes is correct behaviour, not a stopped renderer.
    await game.call('setInput', IN.RIGHT);
    await game.pump(240);
    assert.equal(await game.call('tick'), 300, 'lockstep must be exactly one step per frame');

    const after = await game.probe();
    assert.ok(after.nonBackground > 0.02 && after.nonBackground < 0.98,
      `screen is ${(after.nonBackground * 100).toFixed(1)}% non-background; expected 2%-98%`);
    assert.ok(after.distinctColors > 3, `only ${after.distinctColors} distinct colours drawn`);
    assert.ok(after.playerVisible, 'the player is not visible at its own projected screen position');
    assert.notEqual(after.gridHash, before.gridHash, 'the screen never changed across 300 frames');

    await game.assertHudMatchesState();
    const hud = await game.call('hud');
    assert.equal(hud['hud-room'], 't1_flat');
    assert.equal(hud['hud-hp'], '5');
    assert.equal(hud['hud-errors'], '0');
    for (const [id, text] of Object.entries(hud)) {
      assert.ok(String(text).length > 0, `HUD field ${id} is empty`);
    }

    const stats = await game.call('drawStats');
    assert.ok(stats.peakCalls > 0 && stats.peakCalls < 5000, `peak draw calls per frame was ${stats.peakCalls}`);
    assert.deepEqual(await game.call('errors'), [], 'the sim recorded errors');
    game.assertClean();
  } catch (e) {
    await game.dumpFailure('smoke');
    throw e;
  } finally {
    await game.close();
  }
});

test('keyboard input drives the real player through the real loop', async () => {
  const game = await launchGame();
  try {
    await game.pump(10);
    const before = await game.call('state');
    await game.page.keyboard.down('ArrowRight');
    await game.pump(60);
    await game.page.keyboard.up('ArrowRight');
    const after = await game.call('state');
    assert.ok(after.player.x > before.player.x + 50,
      `holding right moved the player only ${(after.player.x - before.player.x).toFixed(1)}px`);

    await game.page.keyboard.down('KeyZ');
    await game.pump(6);
    assert.ok((await game.call('state')).player.vy < 0, 'Z must jump');
    await game.page.keyboard.up('KeyZ');
    game.assertClean();
  } catch (e) {
    await game.dumpFailure('smoke-keyboard');
    throw e;
  } finally {
    await game.close();
  }
});
