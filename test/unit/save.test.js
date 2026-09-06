import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, restore, clone } from '../../src/core/save.js';
import { hash } from '../../src/core/hash.js';
import { step } from '../../src/core/step.js';
import { IN } from '../../src/core/input.js';
import { newRun, runBot } from '../harness/run.js';

test('a snapshot round-trips to an identical hash', () => {
  const start = newRun(7);
  assert.equal(hash(restore(snapshot(start))), hash(start), 'fresh state must round-trip');

  const mid = runBot(start, { maxFrames: 200 }).state;
  assert.equal(hash(restore(snapshot(mid))), hash(mid), 'mid-run state must round-trip');
});

test('a snapshot is compact because compiled room data is looked up, not stored', () => {
  const json = snapshot(newRun(1));
  assert.ok(json.length < 2000, `snapshot was ${json.length} bytes; room data must not be serialized`);
  assert.ok(!json.includes('####'), 'the tile grid must not appear in a save');
});

test('a restored state continues identically to one that never left memory', () => {
  let live = newRun(3);
  for (let i = 0; i < 120; i++) live = step(live, IN.RIGHT);
  const resumed = restore(snapshot(live));

  for (let i = 0; i < 120; i++) {
    live = step(live, IN.RIGHT | (i % 20 === 0 ? IN.JUMP : 0));
  }
  let replayed = resumed;
  for (let i = 0; i < 120; i++) {
    replayed = step(replayed, IN.RIGHT | (i % 20 === 0 ? IN.JUMP : 0));
  }
  assert.equal(hash(replayed), hash(live), 'hidden state outside GameState would show up here');
});

test('clone produces an independent object graph', () => {
  const original = newRun(1);
  const copy = clone(original);
  assert.notEqual(copy.player, original.player);
  assert.equal(copy.roomData, original.roomData, 'compiled room data is shared, being immutable');
  assert.equal(hash(copy), hash(original));
});

test('restore rejects a save it cannot honour', () => {
  assert.throws(() => restore('{"v":99,"state":{}}'), /save version 99/);
  const bad = JSON.parse(snapshot(newRun(1)));
  bad.state.room = 'no_such_room';
  assert.throws(() => restore(JSON.stringify(bad)), /unknown room/);
});
