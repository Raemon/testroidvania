/**
 * The five determinism checks from 04-architecture §3.
 *
 * A golden-hash failure and a playthrough failure mean different things. Golden
 * says "you changed behaviour — confirm it was intentional, then run
 * `npm run goldens`". Playthrough says "the game is broken". Never the reverse,
 * and never delete either (AGENTS.md rule 3).
 */

import './harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hash, NonFiniteError } from '../src/core/hash.js';
import { step } from '../src/core/step.js';
import { snapshot, restore } from '../src/core/save.js';
import { IN } from '../src/core/input.js';
import { newRun, runBot, replay, replayWithCheckpoints } from './harness/run.js';

const GOLDENS = JSON.parse(readFileSync(new URL('./goldens/route.json', import.meta.url), 'utf8'));

/** A deterministic, seed-independent input tape that exercises every verb we have. */
function scriptedTape(length = 600) {
  /** @type {number[]} */
  const tape = [];
  for (let i = 0; i < length; i++) {
    let bits = 0;
    if (i % 120 < 70) bits |= IN.RIGHT;
    else if (i % 120 < 95) bits |= IN.LEFT;
    if (i % 37 < 6) bits |= IN.JUMP;
    if (i % 53 === 0) bits |= IN.DOWN;
    tape.push(bits);
  }
  return tape;
}

test('1. the same seed and tape replay to the same hashes, twice', () => {
  const tape = scriptedTape();
  const a = replayWithCheckpoints(newRun(1), tape, 25);
  const b = replayWithCheckpoints(newRun(1), tape, 25);
  assert.equal(a.final, b.final);
  assert.deepEqual(a.checkpoints, b.checkpoints);
  assert.equal(a.checkpoints.length, 24, 'expected 24 checkpoint hashes');
});

test('2. the golden hashes still match (regenerate with `npm run goldens` if intentional)', () => {
  const tape = scriptedTape();
  const actual = replayWithCheckpoints(newRun(GOLDENS.seed), tape, GOLDENS.every);
  assert.equal(
    actual.final,
    GOLDENS.scripted.final,
    'behaviour changed. If that was intentional, run `npm run goldens` and review the diff; if not, you broke the sim.',
  );
  assert.deepEqual(actual.checkpoints, GOLDENS.scripted.checkpoints);

  const bot = runBot(newRun(GOLDENS.seed), { maxFrames: 2400 });
  assert.equal(hash(bot.state), GOLDENS.bot.final, 'the bot route hash changed');
  assert.equal(bot.frames, GOLDENS.bot.frames, 'the bot took a different number of frames');
});

test('3. snapshotting mid-run and resuming gives the same hash as never stopping', () => {
  const tape = scriptedTape(1500);
  const straight = replay(newRun(2), tape);

  let split = newRun(2);
  for (let i = 0; i < 1000; i++) split = step(split, tape[i] ?? 0);
  let resumed = restore(snapshot(split));
  for (let i = 1000; i < 1500; i++) resumed = step(resumed, tape[i] ?? 0);

  assert.equal(hash(resumed), hash(straight));
});

test('4. step() does not mutate a deep-frozen state', () => {
  const frozen = deepFreeze(newRun(5));
  const next = step(frozen, IN.RIGHT | IN.JUMP);
  assert.equal(next.tick, 1);
  assert.notEqual(next.player, frozen.player, 'the changed sub-object must be fresh');
  assert.equal(frozen.tick, 0, 'the input state is untouched');

  // And again from a state that has already moved, where aliasing bugs hide.
  let moved = newRun(5);
  for (let i = 0; i < 40; i++) moved = step(moved, IN.RIGHT);
  const after = step(deepFreeze(moved), IN.LEFT);
  assert.equal(after.tick, 41);
});

test('5. hash() throws on any non-finite number, naming the field', () => {
  const s = newRun(1);
  assert.match(hash(s), /^[0-9a-f]{8}$/);
  const broken = { ...s, player: { ...s.player, vx: NaN } };
  assert.throws(() => hash(broken), (e) => e instanceof NonFiniteError && /player\.vx/.test(e.message));
  assert.throws(() => hash({ ...s, player: { ...s.player, y: Infinity } }), NonFiniteError);
});

test('hash() sorts keys, so insertion order is not behaviour', () => {
  assert.equal(hash({ a: 1, b: 2 }), hash({ b: 2, a: 1 }));
  assert.notEqual(hash({ a: 1, b: 2 }), hash({ a: 2, b: 1 }));
});

/**
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const v of Object.values(obj)) deepFreeze(v);
  return obj;
}
