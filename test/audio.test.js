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
  'zipArrive', 'wallKick', 'crumble', 'splash', 'bossPhase', 'bossDeath',
  'ascentRise', 'ascentTier', 'voidNear', 'finale',
  'heartbeat',
];

/**
 * Every `state.events` kind the observer turns into a sound, asserted by name.
 * The sim emitted all of these into nothing while the observer diffed state: the
 * Zip, the wall-kick, crumbling tiles, water, every boss beat past the roar, the
 * whole ascent, and the end of the game.
 */
const EXPECTED_EVENT_SOUNDS = [
  'ascent.start', 'ascent.tier', 'ascent.void', 'boss.death', 'boss.phase',
  'boss.roar', 'boss.stomp', 'crumble.break', 'footstep', 'game.complete',
  'water.enter', 'water.exit', 'wallkick', 'zip.arrive', 'zip.start',
];

const EXPECTED_VOICES = ['bell', 'pad', 'drone', 'pluck', 'sub', 'breath', 'tick'];

/** Every region the sequencer can be handed, asserted by name. */
const EXPECTED_REGIONS = ['cistern', 'ending', 'foundry', 'ossuary', 'spine', 'verdant'];

/**
 * A state skeleton with only the fields the observer reads. Written out rather
 * than snapshotted from a running game so the test says what the observer's
 * contract with the sim actually is.
 * @param {object} [over]
 * @returns {any}
 */
function bareState(over = {}) {
  return {
    tick: 100,
    room: 'e1_hull',
    roomData: { hazards: [], lanterns: [] },
    input: 0,
    prevInput: 0,
    player: { x: 100, y: 100, w: 12, h: 24, vy: 0, hp: 5, maxHp: 5, grounded: true, jumpFrames: 0, jabFrames: 0, hurtFrames: 0, facing: 1, inWater: false },
    pin: { state: 'held', clang: 0, x: 100, y: 100, dirX: 1 },
    entities: [],
    progress: { pickupsTaken: [], abilities: [], lanternsLit: [] },
    events: [],
    ...over,
  };
}

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

test('no region is a sub-bass rumble, and no two regions are the same music', { timeout: AUDIO_TIMEOUT_MS }, async () => {
  const page = await quietPage();
  // Every region, not the default one. The sub-bass fix landed in the Cistern and
  // stayed there for four more regions because this guard called `renderMusic()`
  // with no argument, and `renderMusic`'s default region is the Cistern. Four
  // fifths of the game measured 44-61% of its power under 120 Hz and the suite was
  // green. A guard that checks one of five is not a guard.
  //
  // The second half is the other fault the same blindness hid: every region said
  // `layers: CISTERN.layers` — the same array object — so the bells struck on the
  // same 16ths everywhere and Verdant and the Ossuary measured 2.9 dB apart across
  // the whole spectrum. One render sweep answers both questions, so they share a
  // test rather than paying for the renders twice.
  //
  // Two bars a region, not eight: twelve renders is most of this file's 20 s
  // ceiling, and a mix fault is a property of the arrangement, not of bar seven.
  const { rendered, distances, shared } = await page.evaluate(async (dir) => {
    const m = await import(`${dir}offline.js`);
    const { REGIONS } = await import(`${dir}regions/index.js`);
    const ids = Object.keys(REGIONS);
    /** @type {any[]} */
    const rendered = [];
    /** @type {Record<string, any>} */
    const quiet = {};
    for (const region of ids) {
      for (const intensity of [0, 1]) {
        const r = { region, ...await m.renderMusic({ region, bars: 2, intensity, tail: 0.4 }) };
        rendered.push(r);
        if (intensity === 0) quiet[region] = r;
      }
    }
    /** @type {{a: string, b: string, db: number}[]} */
    const distances = [];
    /** @type {{a: string, b: string}[]} */
    const shared = [];
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) continue;
        distances.push({ a, b, db: m.spectralDistance(quiet[a], quiet[b]) });
        if (REGIONS[a]?.layers === REGIONS[b]?.layers) shared.push({ a, b });
      }
    }
    return { rendered, distances, shared };
  }, AUDIO_DIR);

  assert.deepEqual([...new Set(rendered.map((/** @type {any} */ r) => r.region))].sort(), EXPECTED_REGIONS,
    'a region went missing from the sweep');
  for (const r of rendered) {
    assert.equal(r.nan, 0, `${r.id}: ${r.nan} non-finite samples`);
    assert.equal(r.clipped, 0, `${r.id}: ${r.clipped} samples above 0 dBFS`);
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

  assert.deepEqual(shared, [], `regions sharing one layers array: ${shared.map((/** @type {any} */ x) => `${x.a}/${x.b}`).join(', ')}`);
  for (const d of distances) {
    assert.ok(d.db > 6,
      `${d.a} and ${d.b} are ${d.db.toFixed(1)} dB apart across the spectrum — that is the same material twice`);
  }
});

test("every region's boss lead is in that region's own key", { timeout: AUDIO_TIMEOUT_MS }, async () => {
  const page = await quietPage();
  // The Cistern's D-Dorian phrase was the `lead` layer of every region,
  // transposed nowhere. Against the Ossuary's F# Phrygian — the Sentinel and the
  // Anchor, the last two fights in the game — it scored 16 non-chord tones and 14
  // semitone clashes over the progression: the final boss had the most dissonant
  // music in the game, by accident.
  const measured = await page.evaluate(async (dir) => {
    const m = await import(`${dir}offline.js`);
    const { REGIONS } = await import(`${dir}regions/index.js`);
    return Object.keys(REGIONS).map((id) => m.leadDissonance(id));
  }, AUDIO_DIR);

  for (const r of measured) {
    if (r.sounded === 0) continue;
    if (r.region === 'cistern') {
      // The Cistern's lead is 05 §6b's phrase note for note, in the key it was
      // written in; its three clashes are passing tones and are the material.
      assert.ok(r.clashes <= 3, `cistern: ${r.clashes} semitone clashes — the template drifted`);
      continue;
    }
    assert.equal(r.clashes, 0,
      `${r.region}: ${r.clashes} semitone clashes in ${r.sounded} lead notes — the lead is in someone else's key`);
    assert.equal(r.nonChord, 0, `${r.region}: ${r.nonChord} non-chord tones in the lead`);
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

test('every sound the sim emits reaches the engine', async () => {
  const { EVENT_SOUNDS } = await import('../src/view/audio/observer.js');
  const { RECIPES } = await import('../src/view/audio/sfx.js');
  const { EVENT_KINDS } = await import('../src/core/events.js');

  // `footstep` is wired by hand rather than through the table, because the
  // material it carries picks the recipe's variant.
  const wired = [...Object.keys(EVENT_SOUNDS), 'footstep'].sort();
  assert.deepEqual(wired, [...EXPECTED_EVENT_SOUNDS].sort(),
    'the set of sim events audio listens for drifted');

  for (const kind of wired) {
    assert.ok(EVENT_KINDS.includes(kind),
      `audio listens for '${kind}', which the sim does not emit — a name nobody is listening for is exactly the fault this guards`);
  }
  for (const [kind, sound] of Object.entries(EVENT_SOUNDS)) {
    assert.ok(RECIPES[sound.id], `'${kind}' plays '${sound.id}', which is not a recipe`);
  }
});

test('the game does not end on the Ossuary, and the ending resolves', async () => {
  const { REGIONS } = await import('../src/view/audio/regions/index.js');
  const { createAudio } = await import('../src/view/audio.js');

  const ending = REGIONS.ending;
  assert.ok(ending, 'there is no ending material');
  // The Hull wears the Ossuary's palette, so without its own material the run
  // ends on F# Phrygian's bII — the region's "unease" chord — under the credits.
  const first = ending.chords[0];
  const last = ending.chords[ending.chords.length - 1];
  assert.equal(first?.name, last?.name, 'the ending does not come home to the chord it left');
  for (const chord of ending.chords) {
    const root = chord.pad[0] ?? 0;
    assert.ok(chord.pad.some((/** @type {number} */ m) => (m - root) % 12 === 4),
      `the ending's ${chord.name} has no major third — 05 §7.5 asks for the drone to change to major`);
  }

  // And the engine actually goes there: `game.complete` was playing nothing at
  // all, so the last thing the player heard was whatever the Hull was doing.
  const engine = createAudio({ mode: 'silent', gestureTarget: null });
  const prev = bareState();
  const next = bareState({ tick: 101, events: [{ kind: 'game.complete', x: 100, y: 100, material: null, id: null }] });
  assert.equal(engine.stats().region, 'cistern');
  engine.observe(prev, next);
  assert.equal(engine.stats().region, 'ending', 'game.complete did not move the score to the ending');
  assert.equal(engine.stats().ended, true);
  engine.dispose();
});
