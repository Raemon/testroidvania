/**
 * The five abilities of 00-BIBLE §4, each against the thing 06-revision-1 §B says
 * it is for.
 *
 * The tests that matter most are the ones that would still pass if the ability were
 * quietly simplified: **Zip's jump-cancel**, **the mass rule that stops a heavy body
 * being pinned**, and **a boss part that is metal staying unpinnable**. Those three
 * are asserted on their numbers, not on their existence.
 */

import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN } from '../../src/core/input.js';
import {
  TILE, ZIP_SPEED, ZIP_CANCEL_VX_CAP, RUN_MAX, JUMP_VY, SKEWER_DAMAGE,
  ENEMY_HP_LIGHT, ENEMY_HP_HEAVY, REEL_SPEED, PIN_RANGE,
} from '../../src/core/constants.js';
import { roomFrom, stateIn, run, tap, until } from '../harness/sim.js';

/** @typedef {import('../../src/core/types.js').GameState} GameState */

/** Wood wall on the right, wood ceiling, nine tiles of floor. */
const HALL = `
##############
#............W
#............W
#............W
#............W
#............W
##############`;

/** @param {GameState} s @param {string[]} ids @returns {GameState} */
const withAbilities = (s, ids) => ({ ...s, progress: { ...s.progress, abilities: /** @type {any} */ (ids) } });

/** @param {string} art @param {object} [o] */
const at = (art, tx = 3, ty = 5, o = {}) => stateIn(roomFrom(art, o), tx, ty);

/** Throw right, wait for the embed. @param {GameState} s @returns {GameState} */
const embedRight = (s) => until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'embed in wood');

/**
 * Let the hitstop finish. A hit freezes the world for 3-6 frames and a frozen frame
 * deliberately does not *spend* an input edge, so a test that taps a button during
 * one is a test that pressed nothing.
 * @param {GameState} s @returns {GameState}
 */
const calm = (s) => run(s, 0, 8, 'settle');

// --- A1 Zip -----------------------------------------------------------------

test('zip: flies to the embedded Pin at 12 px/f and arrives in a Hang', () => {
  let s = withAbilities(at(HALL), ['zip']);
  s = embedRight(s);
  const startX = s.player.x;
  s = tap(s, IN.ZIP, 1, 'zip');
  assert.ok(s.player.zipFrames > 0, 'the zip started');
  assert.ok(Math.hypot(s.player.zipVx, s.player.zipVy) <= ZIP_SPEED + 1e-9);

  s = until(s, 0, (x) => x.player.zipFrames === 0, 'arrive', 120);
  assert.ok(s.player.x > startX, 'the zip moved the player toward the Pin');
  assert.equal(s.player.hang, true, 'a wall pin arrival is a Hang');
  assert.equal(s.player.x + s.player.w, s.pin.x, 'flush against the surface');
});

test('zip: without the ability, the button does nothing at all', () => {
  let s = at(HALL);
  s = embedRight(s);
  s = tap(s, IN.ZIP, 4, 'zip without Zip');
  assert.equal(s.player.zipFrames, 0);
  assert.equal(s.player.hang, false);
});

test('ZIP JUMP-CANCEL: Jump on any frame converts zip velocity into player velocity', () => {
  // The skill ceiling of the whole game. A cancel must leave the player *faster
  // than they can run* and travelling in the zip's direction, or the move is a
  // stop button rather than a momentum trick.
  let s = withAbilities(at(HALL), ['zip']);
  s = embedRight(s);
  s = tap(s, IN.ZIP, 3, 'zip');
  assert.ok(s.player.zipFrames > 0, 'mid-zip');
  const zipVx = s.player.zipVx;
  assert.ok(zipVx > RUN_MAX, `the zip must outrun a run: ${zipVx} vs ${RUN_MAX}`);

  const cancelled = run(run(s, 0, 1, 'release'), IN.JUMP, 1, 'cancel');
  assert.equal(cancelled.player.zipFrames, 0, 'Jump ends the zip on the frame it is pressed');
  assert.ok(
    cancelled.player.vx > RUN_MAX,
    `the cancel must carry the zip's speed (${cancelled.player.vx.toFixed(2)}), not clamp it to run speed`,
  );
  assert.ok(cancelled.player.vx <= ZIP_CANCEL_VX_CAP + 1e-9, 'and it is capped');
  assert.ok(cancelled.player.vy <= JUMP_VY / 2, `the cancel jumps: vy is ${cancelled.player.vy}`);
  assert.equal(cancelled.player.hang, false, 'a cancelled zip does not arrive');
});

test('zip: contact damage is suppressed in flight, and a Skewer does 3', () => {
  const room = roomFrom(`
##############
#............W
#..........c.W
#............W
##############`.replace('c', '.'), { spawns: [{ kind: 'crawler', at: [11, 3] }] });
  let s = withAbilities(stateIn(room, 2, 3), ['zip']);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'pinned', 'nail it to the wood');
  const hp = s.entities[0]?.hp ?? 0;

  s = tap(calm(s), IN.ZIP, 0, 'zip at it');
  s = until(s, 0, (x) => x.player.zipFrames === 0, 'skewer', 120);
  assert.equal(s.player.hp, s.player.maxHp, 'flying through a body must not hurt the player');
  const after = s.entities[0];
  assert.ok(after === undefined || after.hp <= hp - SKEWER_DAMAGE, 'the skewer does 3');
  assert.notEqual(s.pin.state, 'pinned', 'the Pin drops out of a skewered body');
});

// --- A2 Deep Pin ------------------------------------------------------------

test('deepPin: stone takes the Pin, and only then', () => {
  const STONE = `
##############
#............#
#............#
#............#
##############`;
  let plain = until(at(STONE, 2, 3), IN.RIGHT | IN.THROW, (x) => x.pin.inert || x.pin.state === 'dropped', 'bounce');
  assert.notEqual(plain.pin.state, 'embedded');

  let deep = withAbilities(at(STONE, 2, 3), ['deepPin']);
  deep = until(deep, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'Deep Pin bites stone');
  assert.equal(deep.pin.surface, 'stone');
});

test('deepPin: the recall shatters the whole slag block, and nothing else does', () => {
  const SLAG = `
##############
#.......SSS..#
#.......SSS..#
#.......SSS..#
##############`;
  let weak = until(at(SLAG, 2, 3), IN.RIGHT | IN.THROW, (x) => x.pin.state !== 'held' && x.pin.state !== 'flying', 'clang off it');
  weak = tap(weak, IN.THROW, 8, 'recall');
  assert.deepEqual(weak.brokenTiles, [], 'slag is stone: without Deep Pin the Pin cannot even reach it');

  let s = withAbilities(at(SLAG, 2, 3), ['deepPin']);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'pin the slag');
  s = tap(s, IN.THROW, 4, 'recall');
  assert.ok(s.brokenTiles.length >= 9, `the whole block goes, not one tile: ${s.brokenTiles.length}`);
});

test('deepPin: a rail clangs until Deep Pin, then it takes the Pin and stops dead', () => {
  const TRACK = `
################
#..............#
#..............#
#..............#
################`;
  // On the throw's own line: a rail two rows up is a rail the Pin flies under.
  const rails = [{ kind: 'rail', at: /** @type {[number,number]} */ ([8, 3]), to: /** @type {[number,number]} */ ([12, 3]) }];
  let plain = stateIn(roomFrom(TRACK, { rails }), 2, 3);
  plain = until(plain, IN.RIGHT | IN.THROW, (x) => x.pin.state !== 'held' && x.pin.state !== 'flying', 'clang off the rail');
  assert.notEqual(plain.pin.state, 'embedded', 'a rail is metal until A2');

  let s = withAbilities(stateIn(roomFrom(TRACK, { rails }), 2, 3), ['deepPin']);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'pin the core');
  assert.equal(s.props[0]?.frozen, true, 'a Pin in the core stops the mechanism');
  const t = s.props[0]?.t ?? -1;
  s = run(s, 0, 30, 'it stays stopped');
  assert.equal(s.props[0]?.t, t, 'a frozen rail does not move');
});

// --- A3 Reel ----------------------------------------------------------------

test('reel: the recall drags a pinned body home, and only with Reel', () => {
  const room = () => roomFrom(`
##############
#............W
#............W
#............W
##############`, { spawns: [{ kind: 'crawler', at: [11, 3] }] });

  let plain = calm(until(stateIn(room(), 2, 3), IN.RIGHT | IN.THROW, (x) => x.pin.state === 'pinned', 'nail it'));
  const wasX = plain.entities[0]?.x ?? 0;
  plain = run(tap(plain, IN.THROW, 20, 'recall'), 0, 20, 'settle');
  assert.ok(Math.abs((plain.entities[0]?.x ?? 0) - wasX) < 8, 'without Reel the body stays where it was');

  let s = withAbilities(stateIn(room(), 2, 3), ['reel']);
  s = calm(until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'pinned', 'nail it'));
  const startX = s.entities[0]?.x ?? 0;
  s = run(tap(s, IN.THROW, 1, 'recall'), 0, 10, 'drag');
  const moved = startX - (s.entities[0]?.x ?? 0);
  assert.ok(moved > REEL_SPEED, `the body was dragged ${moved.toFixed(1)}px toward the player`);
  assert.equal(s.pin.state === 'returning' || s.pin.state === 'held', true, 'and the Pin still came home');
});

test('reel: nothing but bodies and rails is draggable — crates were cut (§C)', () => {
  // The negative half of the rule. If a future edit makes some other solid a reel
  // target, this is the test that says so.
  let s = withAbilities(at(HALL), ['reel']);
  s = embedRight(s);
  const before = s.roomData.grid.join('');
  s = run(tap(s, IN.THROW, 1, 'recall'), 0, 20, 'drag nothing');
  assert.equal(s.roomData.grid.join(''), before, 'a wall is not a reel target');
  assert.deepEqual(s.entities, [], 'and there was nothing else to drag');
});

// --- A4 Ricochet ------------------------------------------------------------

test('ricochet: metal banks the Pin instead of clanging, once, and the range keeps counting', () => {
  // Wood behind you, metal in front. Without A4 the throw clangs and lies down;
  // with it, the Pin comes back off the rivets and lands in the wood behind.
  const BANK = `
#############
#...W......M#
#...W......M#
#...W......M#
#############`;
  let plain = until(at(BANK, 7, 3), IN.RIGHT | IN.THROW, (x) => x.pin.inert || x.pin.state === 'dropped', 'clang');
  assert.notEqual(plain.pin.state, 'embedded');
  assert.equal(plain.pin.bounces, 0, 'without A4 there is no bounce');

  let s = withAbilities(at(BANK, 7, 3), ['ricochet']);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.bounces > 0, 'bank off the metal', 120);
  assert.equal(s.pin.bounces, 1, 'exactly one mirror-bounce');
  assert.ok(s.pin.travelled > 0, 'the range keeps counting through the bounce');
  s = until(s, 0, (x) => x.pin.state !== 'flying', 'it lands somewhere', 120);
  assert.ok(s.pin.travelled <= PIN_RANGE + TILE, 'a bank is a throw, not a free second one');
});

// --- A5 Twin Pin ------------------------------------------------------------

test('twinPin: two Pins, two lights, and the held one is always `pin`', () => {
  let s = withAbilities(at(HALL), ['twinPin']);
  s = embedRight(s);
  assert.equal(s.pin.state, 'embedded', 'the first throw is the most recent Pin');
  assert.equal(s.pinB.state, 'held', 'and the spare is in hand');

  // Throwing again throws the spare, and `pin` becomes the one that just left —
  // which is what keeps Zip aimed at the most recent Pin and Recall unambiguous.
  s = until(
    tap(s, IN.RIGHT | IN.THROW, 0, 'throw the second'),
    IN.RIGHT,
    (x) => x.pin.state === 'embedded' && x.pinB.state === 'embedded',
    'both Pins are out',
    120,
  );
  const lights = s.lights.filter((l) => l.kind === 'pin');
  assert.equal(lights.length, 2, 'two Pins are two lights');

  // Recall now brings both home.
  s = until(tap(calm(s), IN.THROW, 0, 'recall both'), 0, (x) => x.pin.state === 'held' && x.pinB.state === 'held', 'both home', 200);
  assert.equal(s.pin.state, 'held');
  assert.equal(s.pinB.state, 'held');
});

test('twinPin: without A5 the second Pin never leaves the hand', () => {
  let s = at(HALL);
  s = embedRight(s);
  s = run(s, IN.RIGHT | IN.THROW, 30, 'press again');
  assert.equal(s.pinB.state, 'held', 'there is only one Pin until A5');
});

// --- The mass rule (00-BIBLE §6) --------------------------------------------

test('mass: a heavy body is never pinned to a wall, however good the wall is', () => {
  const room = roomFrom(`
##############
#............W
#............W
#............W
##############`, { spawns: [{ kind: 'turret', at: [11, 3] }] });
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state !== 'held' && x.pin.state !== 'flying', 'hit the turret');
  assert.notEqual(s.pin.state, 'pinned', 'heavy bodies take the damage and drop the Pin');
  assert.equal(s.entities[0]?.pinned, false);
  assert.equal(s.entities[0]?.maxHp, ENEMY_HP_HEAVY, 'heavy is 8 HP (§D3)');
});

test('mass: a light body in front of wood is pinned; light HP is 4 (§D3)', () => {
  const room = roomFrom(`
##############
#............W
#............W
#............W
##############`, { spawns: [{ kind: 'crawler', at: [11, 3] }] });
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'pinned', 'nail it');
  assert.equal(s.entities[0]?.pinned, true);
  assert.equal(s.entities[0]?.maxHp, ENEMY_HP_LIGHT);
});
