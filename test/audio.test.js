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

/** Every region the sequencer can be handed, asserted by name. */
const EXPECTED_REGIONS = ['cistern', 'ending', 'foundry', 'ossuary', 'spine', 'verdant'];

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

// These render audio offline, which is CPU-bound and competes with whatever
// else is running on the machine. The global 15s ceiling exists to catch
// hangs; slow-but-honest work needs more room, or the suite goes flaky and
// a flaky suite is one nobody runs.
const AUDIO_TIMEOUT_MS = 60000;

test('the engine builds, every voice and every SFX fires, and stopping leaks nothing', { timeout: AUDIO_TIMEOUT_MS }, async () => {
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
    await game.pump(60);
    await game.call('setInput', IN.RIGHT | IN.JUMP);
    await game.pump(20);
    await game.call('setInput', IN.RIGHT);
    await game.pump(40);
    const during = await game.call('audio');
    assert.ok(during.events > 0, 'observing 120 frames of play derived no events at all');
    assert.ok(during.plays > 0, 'the engine never played a sound during a real playthrough');
    assert.ok(during.byId.jump > 0 || during.byId.footstep > 0 || during.byId.land > 0,
      `expected movement sounds, got ${JSON.stringify(during.byId)}`);
    assert.ok(during.sequencer.scheduledSteps > 0, 'the sequencer scheduled nothing');
    assert.ok(during.active <= 24, `${during.active} concurrent SFX voices, cap is 24`);

    // The lookahead clock has to keep running on its own, against real time and
    // not against the frame pump. Half a second at 72 BPM is two-and-a-bit
    // sixteenths, and the scheduler works 120 ms ahead of that.
    await game.page.waitForTimeout(500);
    const later = await game.call('audio');
    assert.ok(later.sequencer.scheduledSteps >= during.sequencer.scheduledSteps + 2,
      `the sequencer scheduled ${later.sequencer.scheduledSteps - during.sequencer.scheduledSteps} steps in half a second of real time`);

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

test('?mute=1 makes the engine a complete no-op', { timeout: AUDIO_TIMEOUT_MS }, async () => {
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

/** dBFS from a linear amplitude. */
const dB = (/** @type {number} */ v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

/**
 * How much of a sound lives where a laptop speaker can reproduce it, in dBFS.
 *
 * The failure this catches: a sound whose energy is all sub. `land`, `bossStomp`,
 * `heartbeat` and `doorOpen` — the game's entire vocabulary of weight — measured
 * spectral centroids of 58-90 Hz, which on the speakers most people play browser
 * games on is silence. Peak and RMS say nothing about it: a sound can be loud on
 * the meter and absent in the room.
 * @param {{rms100:number, bands:Record<string, number>}} m
 * @returns {number}
 */
function audibleBandDb(m) {
  let e = 0;
  for (const band of ['250-500', '500-1000', '1000-2000', '2000-4000']) e += Math.pow(10, (m.bands[band] ?? -120) / 10);
  return dB(m.rms100) + 10 * Math.log10(e + 1e-12);
}

test('every SFX renders to a buffer that is audible, unclipped and finite', { timeout: AUDIO_TIMEOUT_MS }, async () => {
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
    // click. Note this is time-to-*peak*, so it is only meaningful for a
    // single-hit recipe; for enemyDeath's three ticks or abilityPickup's rising
    // bells a large value says nothing about whether the first event clicks.
    assert.ok(r.attackMs >= 0.9, `${r.id}: ${r.attackMs} ms attack — that is a click`);

    // Level, not just presence. `peak > 0.005` passes for a sound 40 dB under the
    // music, which is what the footstep was: -46.7 dBFS over its first 100 ms.
    assert.ok(dB(r.rms100) > -48,
      `${r.id}: ${dB(r.rms100).toFixed(1)} dBFS over its first 100 ms — under the score at every intensity`);
    assert.ok(audibleBandDb(r) > -56,
      `${r.id}: only ${audibleBandDb(r).toFixed(1)} dBFS above 250 Hz (centroid ${Math.round(r.centroidHz)} Hz) — inaudible on a laptop`);
  }

  // The three sounds the player's own movement makes are the ones that must sit
  // over the score rather than under it.
  for (const id of ['jump', 'land', 'footstep']) {
    const r = measured.find((m) => m.id === id);
    assert.ok(r && dB(r.rms100) > -44, `${id}: ${dB(r?.rms100 ?? 0).toFixed(1)} dBFS — movement has gone quiet again`);
  }
});

test('eight bars of the Cistern render, and intensity actually adds layers', { timeout: AUDIO_TIMEOUT_MS }, async () => {
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

test('no region is a sub-bass rumble with a tune on top', { timeout: AUDIO_TIMEOUT_MS }, async () => {
  const page = await quietPage();
  // Every region, not the default one. The sub-bass fix landed in the Cistern and
  // stayed there for four more regions because this guard called `renderMusic()`
  // with no argument, and `renderMusic`'s default region is the Cistern. Four
  // fifths of the game measured 44-61% of its power under 120 Hz and the suite
  // was green. A guard that checks one of five is not a guard.
  const rendered = await page.evaluate(async (dir) => {
    const m = await import(`${dir}offline.js`);
    const { REGIONS } = await import(`${dir}regions/index.js`);
    /** @type {any[]} */
    const out = [];
    for (const region of Object.keys(REGIONS)) {
      for (const intensity of [0, 1]) out.push(await m.renderMusic({ region, bars: 4, intensity, tail: 0.5 }));
    }
    return out;
  }, AUDIO_DIR);

  assert.equal(rendered.length, EXPECTED_REGIONS.length * 2, 'a region went missing from the sweep');
  for (const r of rendered) {
    // The D1 drone was -27 dBFS RMS against -32.3 for the entire rest of the
    // arrangement, putting 77% of the music's power under 60 Hz: inaudible on a
    // laptop, and eating the headroom of everything that is not.
    assert.ok(r.bands['20-60'] < -8,
      `${r.id}: the 20-60 Hz band is ${r.bands['20-60'].toFixed(1)} dB below the whole mix — the sub is the mix again`);
    assert.ok(r.subShare < 0.35,
      `${r.id}: ${(r.subShare * 100).toFixed(0)}% of the music's power is under 120 Hz`);
    assert.ok(r.centroidHz > 300,
      `${r.id}: spectral centroid ${Math.round(r.centroidHz)} Hz — the music has sunk back under the speaker`);
  }
});

test('every chord of the progression is the same size', { timeout: AUDIO_TIMEOUT_MS }, async () => {
  const page = await quietPage();
  const pads = await page.evaluate(async (dir) => {
    const m = await import(`${dir}offline.js`);
    return m.renderPads();
  }, AUDIO_DIR);

  assert.equal(pads.length, 4);
  const levels = pads.map((/** @type {any} */ p) => 20 * Math.log10(p.rms));
  const spread = Math.max(...levels) - Math.min(...levels);
  // With a fixed filter cutoff the pad's loudness tracked its voicing rather than
  // the music: Cmaj7, the chord the progression lifts to, rendered 4.5 dB quieter
  // than Dm9. A filter that keytracks makes the four chords the same size.
  assert.ok(spread < 2.5,
    `the four chords span ${spread.toFixed(1)} dB (${pads.map((/** @type {any} */ p, /** @type {number} */ i) => `${p.id} ${levels[i].toFixed(1)}`).join(', ')}) — the pad filter has stopped keytracking`);
});
