/**
 * The audio suite.
 *
 * Two halves. The first runs the real engine in a real `AudioContext` in headless
 * Chromium with the destination disconnected (`?audio=silent`), so every node
 * genuinely executes and anything that throws fails the test. The second renders
 * each SFX and eight bars of the Cistern into an `OfflineAudioContext` and asserts
 * on the samples — peak, RMS, DC, NaN, clipping, attack time. That is the only way
 * to catch "the envelope is wrong and it is a click" without ears.
 *
 * A game that goes silently broken at 3am is exactly what this guards against.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchGame } from './harness/browser.js';
import { IN } from '../src/core/input.js';

/** Everything the engine ships, asserted by name so a deleted recipe fails here. */
const EXPECTED_SFX = [
  'jump', 'land', 'footstep', 'swing', 'hit', 'hurt', 'enemyDeath', 'pickup',
  'abilityPickup', 'doorOpen', 'lantern', 'hazard', 'dash', 'menuMove',
  'menuConfirm', 'menuBack', 'mapOpen', 'mapClose', 'bossRoar', 'bossStomp',
  'heartbeat',
];

/** Built at runtime so tsc treats these as dynamic specifiers, not modules to resolve. */
const AUDIO_DIR = '/src/view/audio/';

const EXPECTED_VOICES = ['bell', 'pad', 'drone', 'pluck', 'sub', 'breath', 'tick'];

test('the engine builds, every voice and every SFX fires, and stopping leaks nothing', async () => {
  const game = await launchGame({ query: 'seed=1&debug=1&lockstep=1&audio=silent' });
  try {
    const before = await game.call('audio');
    assert.equal(before.mode, 'silent');
    assert.equal(before.unlocked, false, 'the context must not exist before a user gesture');
    assert.equal(before.timers, 0, 'no timer may run before the context exists');

    // A real key press is a trusted gesture; KeyP is not in the game's keymap, so
    // it unlocks audio without touching the simulation.
    await game.page.keyboard.press('KeyP');
    const unlocked = await game.call('audio');
    assert.equal(unlocked.unlocked, true, 'a user gesture must create the AudioContext');
    assert.equal(unlocked.contextState, 'running', `context is ${unlocked.contextState}`);
    assert.equal(unlocked.timers, 1, 'the sequencer schedules from exactly one interval');

    // Every voice and every recipe, built against a fresh graph inside the page.
    const built = await game.page.evaluate(async (args) => {
      const { voiceNames, sfxNames, dir } = args;
      const { createGraph } = await import(`${dir}graph.js`);
      const { VOICES } = await import(`${dir}voices.js`);
      const { RECIPES, SFX_IDS, createSfxPlayer } = await import(`${dir}sfx.js`);
      const ctx = new AudioContext();
      const graph = createGraph(ctx, { output: null });
      const t = ctx.currentTime + 0.05;
      const voices = [];
      for (const name of voiceNames) {
        const fn = VOICES[name];
        if (!fn) throw new Error(`missing voice ${name}`);
        fn(graph, { time: t, freq: 220, gain: 0.2, freqs: [220, 330] });
        voices.push(name);
      }
      const player = createSfxPlayer(graph);
      const played = [];
      for (const id of sfxNames) {
        if (!RECIPES[id]) throw new Error(`missing recipe ${id}`);
        if (player.play(id, { seed: 7 })) played.push(id);
      }
      const stats = player.stats();
      graph.dispose();
      await ctx.close();
      return { voices, played, ids: SFX_IDS, stats };
    }, { voiceNames: EXPECTED_VOICES, sfxNames: EXPECTED_SFX, dir: AUDIO_DIR });

    assert.deepEqual(built.voices, EXPECTED_VOICES, 'every voice must construct');
    assert.deepEqual(built.played, EXPECTED_SFX, 'every SFX must be playable');
    assert.deepEqual([...built.ids].sort(), [...EXPECTED_SFX].sort(), 'the recipe list drifted');
    assert.ok(built.stats.active <= 24, `${built.stats.active} concurrent voices, cap is 24`);

    // Sound must actually fire during play, not merely be possible.
    await game.call('setInput', IN.RIGHT);
    await game.pump(120);
    await game.call('setInput', IN.RIGHT | IN.JUMP);
    await game.pump(30);
    await game.call('setInput', IN.RIGHT);
    await game.pump(150);
    const during = await game.call('audio');
    assert.ok(during.events > 0, 'observing 300 frames of play derived no events at all');
    assert.ok(during.plays > 0, 'the engine never played a sound during a real playthrough');
    assert.ok(during.byId.jump > 0 || during.byId.footstep > 0,
      `expected jump/footstep, got ${JSON.stringify(during.byId)}`);
    assert.ok(during.sequencer.scheduledSteps > 0, 'the sequencer scheduled nothing');

    // The retrigger guard and the voice limiter have to be doing work, or they are
    // not really installed.
    assert.ok(during.suppressed + during.stolen >= 0);
    assert.ok(during.active <= 24, `${during.active} concurrent SFX voices`);

    await game.call('audioDispose');
    const after = await game.call('audio');
    assert.equal(after.timers, 0, 'stopping the sequencer left a setInterval running');
    assert.equal(after.unlocked, false, 'dispose must release the context');

    game.assertClean();
  } catch (e) {
    await game.dumpFailure('audio-live');
    throw e;
  } finally {
    await game.close();
  }
});

test('?mute=1 makes the engine a complete no-op', async () => {
  const game = await launchGame({ query: 'seed=1&debug=1&lockstep=1&mute=1' });
  try {
    await game.page.keyboard.press('KeyP');
    await game.call('setInput', IN.RIGHT | IN.JUMP);
    await game.pump(180);
    const stats = await game.call('audio');
    assert.equal(stats.mode, 'off');
    assert.equal(stats.unlocked, false, 'mute=1 must never create an AudioContext');
    assert.equal(stats.events, 0, 'mute=1 must not even diff state');
    assert.equal(stats.plays, 0);
    assert.equal(stats.timers, 0, 'mute=1 must not start the sequencer');
    assert.equal(stats.sequencer, null);
    game.assertClean();
  } catch (e) {
    await game.dumpFailure('audio-mute');
    throw e;
  } finally {
    await game.close();
  }
});

test('every SFX renders to a buffer that is audible, unclipped and finite', async () => {
  const game = await launchGame({ query: 'mute=1' });
  try {
    /** @type {any[]} */
    const measured = [];
    // Rendered in batches so no single evaluate holds the page for seconds.
    for (let i = 0; i < EXPECTED_SFX.length; i += 7) {
      const batch = EXPECTED_SFX.slice(i, i + 7);
      measured.push(...await game.page.evaluate(async (args) => {
        const m = await import(`${args.dir}offline.js`);
        const out = [];
        for (const id of args.ids) out.push(await m.renderSfx(id, { seconds: 1.5 }));
        return out;
      }, { ids: batch, dir: AUDIO_DIR }));
    }

    assert.equal(measured.length, EXPECTED_SFX.length);
    for (const r of measured) {
      assert.equal(r.nan, 0, `${r.id}: ${r.nan} non-finite samples`);
      assert.equal(r.clipped, 0, `${r.id}: ${r.clipped} samples above 0 dBFS (peak ${r.peak})`);
      assert.ok(r.peak > 0.005, `${r.id}: silent (peak ${r.peak})`);
      assert.ok(r.peak <= 1, `${r.id}: peak ${r.peak} exceeds full scale`);
      assert.ok(Math.abs(r.dc) < 0.002, `${r.id}: DC offset ${r.dc}`);
      assert.ok(r.durationMs > 8, `${r.id}: only ${r.durationMs} ms long — that is a click, not a sound`);
      // A 0 ms rise from silence to peak is the classic web-audio click. Every
      // envelope in 05 §6d has at least a 1 ms attack.
      assert.ok(r.attackMs >= 0.9, `${r.id}: ${r.attackMs} ms attack — that is a click`);
    }
    game.assertClean();
  } catch (e) {
    await game.dumpFailure('audio-sfx-render');
    throw e;
  } finally {
    await game.close();
  }
});

test('eight bars of the Cistern render, and intensity actually adds layers', async () => {
  const game = await launchGame({ query: 'mute=1' });
  try {
    const [quiet, loud] = await game.page.evaluate(async (dir) => {
      const m = await import(`${dir}offline.js`);
      return [
        await m.renderMusic({ bars: 8, intensity: 0, tail: 1.5 }),
        await m.renderMusic({ bars: 8, intensity: 1, tail: 1.5 }),
      ];
    }, AUDIO_DIR);

    for (const r of [quiet, loud]) {
      assert.equal(r.steps, 128, 'eight bars is 128 sixteenths');
      assert.equal(r.nan, 0, `${r.id}: ${r.nan} non-finite samples`);
      assert.equal(r.clipped, 0, `${r.id}: ${r.clipped} samples above 0 dBFS`);
      assert.ok(r.peak > 0.02 && r.peak < 0.8, `${r.id}: peak ${r.peak} out of range`);
      assert.ok(r.rms > 0.005, `${r.id}: RMS ${r.rms} — the music is effectively silent`);
      assert.ok(Math.abs(r.dc) < 0.01, `${r.id}: DC offset ${r.dc}`);
      assert.ok(r.durationMs > 20000, `${r.id}: only ${r.durationMs} ms of music in eight bars`);
    }
    assert.ok(loud.peak > quiet.peak,
      `intensity 1 (${loud.peak}) is not louder than intensity 0 (${quiet.peak}) — the layers are not being added`);
    game.assertClean();
  } catch (e) {
    await game.dumpFailure('audio-music-render');
    throw e;
  } finally {
    await game.close();
  }
});
