/**
 * The audio suite.
 *
 * Two halves. The first runs the real engine in a real `AudioContext` in headless
 * Chromium with the destination disconnected (`?audio=silent`), so every node
 * genuinely executes and anything that throws fails the test. The second renders
 * each SFX and the first eight bars of the Cistern into an `OfflineAudioContext`
 * and asserts on the samples — peak, RMS, DC offset, NaN, clipping, attack time.
 * That is the only way to catch "the envelope is wrong and it is a click" without
 * ears, and a game that goes silently broken at 3am is what it guards against.
 *
 * One browser, two pages, for the whole file: the suite has a wall-clock budget
 * (AGENTS.md rule 6) and a browser launch costs about a second.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchGame } from './harness/browser.js';
import { IN } from '../src/core/input.js';

/** Built at runtime so tsc treats these as dynamic specifiers, not modules to resolve. */
const AUDIO_DIR = '/src/view/audio/';

/** Everything the engine ships, asserted by name so a deleted recipe fails here. */
const EXPECTED_SFX = [
  'jump', 'land', 'footstep', 'swing', 'hit', 'hurt', 'enemyDeath', 'pickup',
  'abilityPickup', 'doorOpen', 'lantern', 'hazard', 'dash', 'menuMove',
  'menuConfirm', 'menuBack', 'mapOpen', 'mapClose', 'bossRoar', 'bossStomp',
  'heartbeat',
];

const EXPECTED_VOICES = ['bell', 'pad', 'drone', 'pluck', 'sub', 'breath', 'tick'];

/** @type {Awaited<ReturnType<typeof launchGame>> | null} */
let live = null;
/** @type {import('playwright').Page | null} */
let quiet = null;

async function liveGame() {
  live ??= await launchGame({ query: 'seed=1&debug=1&lockstep=1&audio=silent' });
  return live;
}

/**
 * A second page in the same browser context, loaded with `?mute=1`. It doubles as
 * the offline render bench: `OfflineAudioContext` needs an origin that can serve
 * the modules and nothing else.
 * @returns {Promise<import('playwright').Page>}
 */
async function quietPage() {
  if (quiet) return quiet;
  const game = await liveGame();
  const origin = new URL(game.page.url()).origin;
  const page = await game.page.context().newPage();
  await page.goto(`${origin}/?seed=1&debug=1&lockstep=1&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(/** @type {any} */ (globalThis).__HARNESS__), undefined, { timeout: 8000 });
  quiet = page;
  return page;
}

after(async () => {
  await live?.close();
});

test('the engine builds, every voice and every SFX fires, and stopping leaks nothing', async () => {
  const game = await liveGame();
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
    await game.pump(90);
    await game.call('setInput', IN.RIGHT | IN.JUMP);
    await game.pump(30);
    await game.call('setInput', IN.RIGHT);
    await game.pump(60);
    const during = await game.call('audio');
    assert.ok(during.events > 0, 'observing 180 frames of play derived no events at all');
    assert.ok(during.plays > 0, 'the engine never played a sound during a real playthrough');
    assert.ok(during.byId.jump > 0 || during.byId.footstep > 0 || during.byId.land > 0,
      `expected movement sounds, got ${JSON.stringify(during.byId)}`);
    assert.ok(during.sequencer.scheduledSteps > 0, 'the sequencer scheduled nothing');
    assert.ok(during.active <= 24, `${during.active} concurrent SFX voices, cap is 24`);

    await game.call('audioDispose');
    const stopped = await game.call('audio');
    assert.equal(stopped.timers, 0, 'stopping the sequencer left a setInterval running');
    assert.equal(stopped.unlocked, false, 'dispose must release the context');

    game.assertClean();
  } catch (e) {
    await game.dumpFailure('audio-live');
    throw e;
  }
});

test('?mute=1 makes the engine a complete no-op', async () => {
  const page = await quietPage();
  await page.keyboard.press('KeyP');
  await page.evaluate((bits) => /** @type {any} */ (globalThis).__HARNESS__.setInput(bits), IN.RIGHT | IN.JUMP);
  await page.evaluate((n) => /** @type {any} */ (globalThis).__PUMP__(n), 120);
  const stats = await page.evaluate(() => /** @type {any} */ (globalThis).__HARNESS__.audio());
  assert.equal(stats.mode, 'off');
  assert.equal(stats.unlocked, false, 'mute=1 must never create an AudioContext');
  assert.equal(stats.events, 0, 'mute=1 must not even diff state');
  assert.equal(stats.plays, 0);
  assert.equal(stats.timers, 0, 'mute=1 must not start the sequencer');
  assert.equal(stats.sequencer, null);
});

test('every SFX renders to a buffer that is audible, unclipped and finite', async () => {
  const page = await quietPage();
  /** @type {any[]} */
  const measured = [];
  // Batched so no single evaluate holds the page for seconds on end.
  for (let i = 0; i < EXPECTED_SFX.length; i += 7) {
    measured.push(...await page.evaluate(async (args) => {
      const m = await import(`${args.dir}offline.js`);
      const out = [];
      for (const id of args.ids) out.push(await m.renderSfx(id, { seconds: 1.2 }));
      return out;
    }, { ids: EXPECTED_SFX.slice(i, i + 7), dir: AUDIO_DIR }));
  }

  assert.equal(measured.length, EXPECTED_SFX.length);
  for (const r of measured) {
    assert.equal(r.nan, 0, `${r.id}: ${r.nan} non-finite samples`);
    assert.equal(r.clipped, 0, `${r.id}: ${r.clipped} samples above 0 dBFS (peak ${r.peak})`);
    assert.ok(r.peak > 0.005, `${r.id}: silent (peak ${r.peak})`);
    assert.ok(r.peak <= 1, `${r.id}: peak ${r.peak} exceeds full scale`);
    assert.ok(Math.abs(r.dc) < 0.002, `${r.id}: DC offset ${r.dc}`);
    assert.ok(r.durationMs > 8, `${r.id}: only ${r.durationMs} ms long — that is a click, not a sound`);
    // A rise from silence to peak in under a millisecond is the classic web-audio
    // click; every envelope in 05 §6d has at least a 1 ms attack.
    assert.ok(r.attackMs >= 0.9, `${r.id}: ${r.attackMs} ms attack — that is a click`);
  }
});

test('eight bars of the Cistern render, and intensity actually adds layers', async () => {
  const page = await quietPage();
  const [exploring, boss] = await page.evaluate(async (dir) => {
    const m = await import(`${dir}offline.js`);
    return [
      await m.renderMusic({ bars: 8, intensity: 0, tail: 1.0 }),
      await m.renderMusic({ bars: 8, intensity: 1, tail: 1.0 }),
    ];
  }, AUDIO_DIR);

  for (const r of [exploring, boss]) {
    assert.equal(r.steps, 128, 'eight bars is 128 sixteenths');
    assert.equal(r.nan, 0, `${r.id}: ${r.nan} non-finite samples`);
    assert.equal(r.clipped, 0, `${r.id}: ${r.clipped} samples above 0 dBFS`);
    assert.ok(r.peak > 0.02 && r.peak < 0.8, `${r.id}: peak ${r.peak} out of range`);
    assert.ok(r.rms > 0.005, `${r.id}: RMS ${r.rms} — the music is effectively silent`);
    assert.ok(Math.abs(r.dc) < 0.01, `${r.id}: DC offset ${r.dc}`);
    assert.ok(r.durationMs > 20000, `${r.id}: only ${r.durationMs} ms of music in eight bars`);
  }
  assert.ok(boss.peak > exploring.peak * 1.1,
    `intensity 1 (${boss.peak}) is not louder than intensity 0 (${exploring.peak}) — layers are not being added`);
});
