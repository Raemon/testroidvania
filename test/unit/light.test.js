/**
 * The light model (§D5) and the rule it exists to serve (§D2): LOS enemies track
 * the light, not the player, so a thrown Pin is a decoy.
 *
 * The radii are asserted as *numbers*, deliberately. The failure mode the revision
 * warns about is someone "fixing" a 260px hole in a 480px viewport by shrinking it,
 * which produces the version of the game where you want the Pin thrown and held at
 * the same time. If a radius changes, this test should be the argument about it.
 */

import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN } from '../../src/core/input.js';
import {
  TILE, LIGHT_AURA_R, LIGHT_PIN_R, LIGHT_HAZARD_R, LIGHT_EYE_R,
  LIGHT_AURA_PER_ABILITY, DISCOVERED_ALPHA, DARKNESS_ALPHA_CAP, CHARGER_SIGHT,
} from '../../src/core/constants.js';
import { computeLights, auraRadius } from '../../src/core/light.js';
import { hasLineOfSight, nearestVisibleLight } from '../../src/core/los.js';
import { entityEye } from '../../src/core/entities/index.js';
import { roomFrom, stateIn, run, until } from '../harness/sim.js';

const FLAT = `
##############################
#............................#
#............................#
#............................#
#............................#
##############################`;

test('§D5: the calibrated radii are these numbers and shrinking them is a decision', () => {
  assert.equal(LIGHT_AURA_R, 90, 'the personal aura is never smaller than 90');
  assert.equal(LIGHT_PIN_R, 260, 'the Pin carries the big light');
  assert.equal(LIGHT_HAZARD_R, 40, 'hazards are self-lit: you can always see what kills you');
  assert.equal(LIGHT_EYE_R, 28, 'enemy eyes are self-lit: you can always see what is coming');
  assert.equal(LIGHT_AURA_PER_ABILITY, 40, 'every ability makes the world perceptibly brighter');
  assert.equal(DISCOVERED_ALPHA, 0.25, 'seen terrain is a memory, not a rumour');
  assert.equal(DARKNESS_ALPHA_CAP, 0.55);
});

test('the hand is never empty: the aura stays 90 with the Pin thrown across the room', () => {
  let s = stateIn(roomFrom(FLAT), 3, 4);
  const held = computeLights(s).find((l) => l.kind === 'aura');
  assert.equal(held?.r, LIGHT_AURA_R);

  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state !== 'held', 'throw it away');
  const thrown = s.lights.find((l) => l.kind === 'aura');
  assert.equal(thrown?.r, LIGHT_AURA_R, 'an ember in the palm carries the same aura');
  assert.equal(thrown?.x, s.player.x + s.player.w / 2, 'and it is on the player, not the Pin');
});

test("the Pin's light travels with the Pin, in every state", () => {
  let s = stateIn(roomFrom(FLAT), 3, 4);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'flying', 'in flight');
  for (let i = 0; i < 20; i++) {
    const lit = s.lights.find((l) => l.kind === 'pin');
    assert.equal(lit?.x, s.pin.x, `the light left the Pin while ${s.pin.state}`);
    assert.equal(lit?.y, s.pin.y);
    assert.equal(lit?.r, LIGHT_PIN_R);
    s = run(s, 0, 1, 'follow the Pin');
  }
});

test('every ability widens the aura, 90 -> 250 across the ladder', () => {
  const s = stateIn(roomFrom(FLAT), 3, 4);
  assert.equal(auraRadius(s), 90);
  /** @type {import('../../src/core/types.js').AbilityId[]} */
  const abilities = ['zip', 'deepPin', 'reel', 'ricochet'];
  const all = { ...s, progress: { ...s.progress, abilities } };
  assert.equal(auraRadius(all), 250);
});

test('discovered-tile memory accumulates per room and never forgets', () => {
  const room = roomFrom(FLAT);
  let s = stateIn(room, 3, 4);
  s = run(s, 0, 2, 'stand still');
  const early = (s.discovered[room.id] ?? []).reduce((n, row) => n + bits(row), 0);
  assert.ok(early > 0, 'standing in a room reveals it');

  s = run(s, IN.RIGHT, 200, 'walk to the far end');
  const later = (s.discovered[room.id] ?? []).reduce((n, row) => n + bits(row), 0);
  assert.ok(later > early, `walking revealed nothing new (${early} -> ${later})`);

  const back = run(s, IN.LEFT, 200, 'walk back');
  const final = (back.discovered[room.id] ?? []).reduce((n, row) => n + bits(row), 0);
  assert.ok(final >= later, 'a room is never re-explored blind');
});

test('line of sight stops at solid terrain', () => {
  const room = roomFrom(`
################
#......#.......#
#......#.......#
#..............#
################`);
  assert.equal(hasLineOfSight(room, 2 * TILE, 1.5 * TILE, 12 * TILE, 1.5 * TILE), false, 'the pillar blocks');
  assert.equal(hasLineOfSight(room, 2 * TILE, 3.5 * TILE, 12 * TILE, 3.5 * TILE), true, 'under it is clear');
});

test('§D2: a Charger takes the nearest light it can see — and a thrown Pin is one', () => {
  const room = roomFrom(`
##############################
#............................#
#............................#
#............................#
#............................#
##############################`, { spawns: [{ kind: 'charger', at: [26, 4] }] });
  let s = stateIn(room, 20, 4);
  const charger = s.entities[0];
  assert.ok(charger);
  const eye = entityEye(charger);

  // With the Pin in hand, both lights sit on the player: the Charger comes for you.
  const onPlayer = nearestVisibleLight(room, eye.x, eye.y, s.lights.filter((l) => l.kind !== 'eye'), CHARGER_SIGHT);
  assert.ok(onPlayer, 'the player is visible from here');
  assert.ok(Math.abs(onPlayer.x - (s.player.x + s.player.w / 2)) < TILE, 'it is aiming at the player');

  // Throw the Pin the other way. Its light is now the nearest thing the Charger sees.
  s = until(s, IN.LEFT | IN.THROW, (x) => x.pin.state !== 'held' && x.pin.x < x.player.x - 3 * TILE, 'throw it away', 300);
  const decoyed = nearestVisibleLight(room, eye.x, eye.y, s.lights.filter((l) => l.kind !== 'eye'), CHARGER_SIGHT);
  assert.ok(decoyed, 'something is still visible');
  assert.equal(decoyed.kind, 'aura', 'the Pin is further away than the player now, so the player wins');

  // And when the Pin is the *nearer* light, the Pin wins — that is the decoy.
  const pinSide = { ...s, pin: { ...s.pin, x: eye.x - 3 * TILE, y: eye.y } };
  const lights = computeLights(pinSide).filter((l) => l.kind !== 'eye');
  const chosen = nearestVisibleLight(room, eye.x, eye.y, lights, CHARGER_SIGHT);
  assert.equal(chosen?.kind, 'pin', 'a Pin nearer than the player is what the Charger charges');
});

test('a Charger wakes, dashes at the light it saw, and stops at the ledge', () => {
  const room = roomFrom(`
##############################
#............................#
#............................#
#............................#
#...........................##
##############################`, { spawns: [{ kind: 'charger', at: [16, 4] }] });
  let s = stateIn(room, 4, 4);
  assert.equal(s.entities[0]?.mode, 'dormant');
  const startedAt = s.entities[0]?.x ?? 0;
  s = until(s, 0, (x) => x.entities[0]?.mode === 'dash', 'it acquires and winds up', 200);
  s = run(s, 0, 90, 'let it run');
  assert.ok((s.entities[0]?.x ?? 0) < startedAt, 'it charged toward the light');
  assert.ok((s.entities[0]?.x ?? 0) > 0, 'and it is still in the room');
});

/** @param {number} row @returns {number} */
function bits(row) {
  let n = 0;
  for (let i = 0; i < 32; i++) if (row & (1 << i)) n++;
  return n;
}
