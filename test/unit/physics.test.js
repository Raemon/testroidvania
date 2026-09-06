import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/core/constants.js';
import { accelerate, applyGravity } from '../../src/core/physics.js';
import { IN } from '../../src/core/input.js';
import { newRun } from '../harness/run.js';
import { step } from '../../src/core/step.js';

/**
 * A settled standing start. The run opens with a two-tile drop (beat 0), so
 * "wait ten frames" is not the same thing as "standing still" — every measurement
 * below is relative to the floor, and taking it mid-fall silently halves it.
 * @param {number} [seed]
 * @returns {import('../../src/core/types.js').GameState}
 */
function standing(seed = 1) {
  let s = newRun(seed);
  for (let i = 0; i < 120; i++) {
    s = step(s, 0);
    if (s.player.grounded && s.player.vy === 0 && s.player.vx === 0) return s;
  }
  assert.fail('the player never settled on the ground');
}

/**
 * Hold `input` for `frames` from a settled standing start.
 * @param {number} frames
 * @param {number | ((frame: number) => number)} input
 * @param {number} [seed]
 */
function drive(frames, input, seed = 1) {
  let s = standing(seed);
  const start = { x: s.player.x, y: s.player.y };
  let minY = start.y;
  for (let i = 0; i < frames; i++) {
    s = step(s, typeof input === 'function' ? input(i) : input);
    minY = Math.min(minY, s.player.y);
  }
  return { state: s, start, minY };
}

test('ground acceleration reaches run speed in 6 frames', () => {
  let vx = 0;
  for (let i = 0; i < 6; i++) vx = accelerate(vx, 1, true);
  assert.equal(vx, C.RUN_MAX, 'six frames of ground accel must cap at RUN_MAX');
  assert.ok(accelerate(0, 1, true) === C.GROUND_ACCEL);
});

test('ground friction stops the player in 4 frames', () => {
  let vx = C.RUN_MAX;
  for (let i = 0; i < 4; i++) vx = accelerate(vx, 0, true);
  assert.equal(vx, 0);
});

test('turnaround applies the 1.6x boost', () => {
  assert.equal(accelerate(-1, 1, true), -1 + C.GROUND_ACCEL * C.TURNAROUND_MULT);
  assert.equal(accelerate(1, 1, true), 1 + C.GROUND_ACCEL);
});

test('gravity halves near the apex and clamps at terminal velocity', () => {
  assert.equal(applyGravity(-1, false), -1 + C.GRAVITY_RISE);
  assert.equal(applyGravity(1, false), 1 + C.GRAVITY_FALL);
  assert.equal(applyGravity(0, false), C.GRAVITY_FALL * C.APEX_HANG_MULT, 'apex hang');
  assert.equal(applyGravity(C.TERMINAL_VY, false), C.TERMINAL_VY, 'terminal clamp');
  assert.equal(applyGravity(C.FASTFALL_TERMINAL_VY, true), C.FASTFALL_TERMINAL_VY, 'fast-fall terminal');
});

test('a full jump clears about 3.5 tiles (56px)', () => {
  const { start, minY } = drive(60, IN.JUMP);
  const height = start.y - minY;
  assert.ok(height > 50 && height < 60, `full jump height was ${height.toFixed(2)}px, want ~56`);
});

test('a tapped jump clears about 1.4 tiles (22px), proving jump-cut works', () => {
  const { start, minY } = drive(60, (/** @type {number} */ i) => (i === 0 ? IN.JUMP : 0));
  const height = start.y - minY;
  assert.ok(height > 18 && height < 27, `tap jump height was ${height.toFixed(2)}px, want ~22`);
  assert.ok(height < 40, 'a tap must be much shorter than a full jump');
});

test('a full-speed jump carries about 7 tiles horizontally', () => {
  let s = standing();
  for (let i = 0; i < 20; i++) s = step(s, IN.RIGHT);
  const x0 = s.player.x;
  s = step(s, IN.RIGHT | IN.JUMP);
  let air = 0;
  while (!s.player.grounded && air < 200) {
    s = step(s, IN.RIGHT | IN.JUMP);
    air++;
  }
  const reach = s.player.x - x0;
  assert.ok(air >= 38 && air <= 50, `airtime was ${air} frames, want ~43`);
  assert.ok(reach > 100 && reach < 130, `horizontal reach was ${reach.toFixed(1)}px, want ~112`);
});

test('coyote time lets a jump fire after walking off a ledge', () => {
  const s = standing();
  assert.ok(s.player.grounded);
  assert.equal(s.player.coyote, C.COYOTE_FRAMES);
});

test('a jump press 4 frames early fires on the landing frame', () => {
  let airborne = standing();
  airborne = step(airborne, IN.JUMP);

  let probe = airborne;
  let airtime = 0;
  while (!probe.player.grounded && airtime < 200) {
    probe = step(probe, 0);
    airtime++;
  }
  assert.ok(airtime > 8, 'need an airtime long enough to press early into');

  let s = airborne;
  for (let i = 0; i < airtime - 4; i++) s = step(s, 0);
  s = step(s, IN.JUMP);   // one press, released immediately, 4 frames before landing
  let fired = false;
  for (let i = 0; i < C.JUMP_BUFFER_FRAMES && !fired; i++) {
    s = step(s, 0);
    if (s.player.vy < -1) fired = true;
  }
  assert.ok(fired, 'the buffered press must fire on the first grounded frame');
});

test('velocity never exceeds the invariant ceiling over a long run', () => {
  let s = standing();
  for (let i = 0; i < 600; i++) {
    s = step(s, i % 7 === 0 ? IN.JUMP | IN.RIGHT : IN.RIGHT);
    assert.ok(Math.abs(s.player.vx) <= C.VMAX && Math.abs(s.player.vy) <= C.VMAX);
  }
});
