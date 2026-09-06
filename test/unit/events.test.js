/**
 * The per-frame event list. Its whole value is that it is *not* derivable from a
 * state diff, so the things worth asserting are: it is rebuilt every frame, it is
 * part of the hash, and the events the view cannot infer are actually in it.
 */

import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN } from '../../src/core/input.js';
import { step } from '../../src/core/step.js';
import { hash } from '../../src/core/hash.js';
import { EVENT_KINDS } from '../../src/core/events.js';
import { newRun, runBot } from '../harness/run.js';
import { roomFrom, stateIn, run, until } from '../harness/sim.js';

test('the event list is rebuilt every frame, never appended to', () => {
  let s = newRun(1);
  let sawSome = false;
  for (let i = 0; i < 200; i++) {
    s = step(s, i % 20 < 3 ? IN.RIGHT | IN.JUMP : IN.RIGHT);
    assert.ok(s.events.length <= 8, `${s.events.length} events on one frame looks like a log, not a frame`);
    if (s.events.length) sawSome = true;
  }
  assert.ok(sawSome, 'nothing ever emitted an event');
  const quiet = step({ ...s, events: [{ kind: 'jump', x: 0, y: 0, material: null, id: null }] }, 0);
  assert.ok(!quiet.events.some((e) => e.kind === 'jump'), 'last frame’s events must not survive');
});

test('events are real state: they are in the hash', () => {
  const s = newRun(1);
  const withEvent = { ...s, events: [{ kind: 'pin.clang', x: 1, y: 2, material: /** @type {const} */ ('metal'), id: null }] };
  assert.notEqual(hash(s), hash(withEvent));
});

test('every kind the sim emits is declared in EVENT_KINDS', () => {
  const bot = runBot(newRun(1), { maxFrames: 2400 });
  let s = newRun(1);
  const seen = new Set();
  for (const input of bot.tape) {
    s = step(s, input);
    for (const e of s.events) {
      assert.ok(EVENT_KINDS.includes(e.kind), `undeclared event kind '${e.kind}'`);
      seen.add(e.kind);
    }
  }
  // The opening is a teaching sequence; if these are missing it stopped teaching.
  for (const kind of ['pin.throw', 'pin.embed', 'pin.enemy', 'pin.recall', 'pin.catch', 'perch', 'jab', 'enemy.death', 'lantern.light', 'footstep', 'land', 'room.enter']) {
    assert.ok(seen.has(kind), `the opening never emitted '${kind}'`);
  }
});

test('a footstep carries the material under the foot, which no diff could tell you', () => {
  const room = roomFrom(`
##################
#................#
#................#
#................#
WWWWWWWW##########`);
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT, (x) => x.events.some((e) => e.kind === 'footstep'), 'walk on wood', 300);
  const onWood = s.events.find((e) => e.kind === 'footstep');
  assert.equal(onWood?.material, 'wood');

  s = until(s, IN.RIGHT, (x) => x.events.some((e) => e.kind === 'footstep' && e.material === 'stone'), 'walk onto stone', 300);
  assert.ok(s.player.x > 8 * 16, 'and it changed at the seam, not before');
});

test('door.open fires while the player is still walking at the door', () => {
  const bot = runBot(newRun(1), { maxFrames: 2400 });
  let s = newRun(1);
  let openedAt = -1;
  let enteredAt = -1;
  for (const input of bot.tape) {
    s = step(s, input);
    if (openedAt < 0 && s.events.some((e) => e.kind === 'door.open')) openedAt = s.tick;
    if (enteredAt < 0 && s.events.some((e) => e.kind === 'room.enter')) enteredAt = s.tick;
    if (openedAt >= 0 && enteredAt >= 0) break;
  }
  assert.ok(openedAt > 0, 'door.open never fired');
  assert.ok(openedAt < enteredAt, `door.open (${openedAt}) must lead room.enter (${enteredAt}), or a grind starts too late`);
});

test('pin.clang fires on the frame metal refuses the Pin', () => {
  const room = roomFrom(`
##############
#............M
#............M
#............M
##############`);
  let s = stateIn(room, 3, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.events.some((e) => e.kind === 'pin.clang'), 'clang');
  const clang = s.events.find((e) => e.kind === 'pin.clang');
  assert.equal(clang?.material, 'metal');
  assert.equal(run(s, 0, 1, 'next frame').events.filter((e) => e.kind === 'pin.clang').length, 0,
    'the clang is one frame, not a state');
});
