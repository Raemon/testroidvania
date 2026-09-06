/**
 * The four things terrain does that are not "you cannot walk through me": it
 * drowns you, it gives way under you, it pushes you sideways, and — as a room
 * property rather than a tile — it blows.
 *
 * 02-world-structure §2 gives every region exactly one hazard and these are the
 * ones the sim did not have. Each is tested against the *reason* it exists: a
 * current has to be survivable upstream or it is a wall, a crumble tile has to hold
 * long enough to be crossed on purpose, and water has to be crossable without
 * costing a heart or it is a toll rather than a decision.
 */

import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN } from '../../src/core/input.js';
import { compileRoom } from '../../src/content/room-format.js';
import {
  WATER_DROWN_FRAMES, CRUMBLE_FRAMES, CURRENT_PUSH, WIND_ACCEL, RUN_MAX,
} from '../../src/core/constants.js';
import { roomFrom, stateIn, run } from '../harness/sim.js';
import { step } from '../../src/core/step.js';

const DEEP = `
##############
#~~~~~~~~~~~~#
#~~~~~~~~~~~~#
#~~~~~~~~~~~~#
##############`;

test('water drowns a body held under, and only a body held under', () => {
  let s = stateIn(roomFrom(DEEP), 3, 3);
  s = run(s, 0, WATER_DROWN_FRAMES - 2, 'hold your breath');
  assert.equal(s.player.hp, s.player.maxHp, 'the timer must not bite early');
  assert.ok(s.player.submerged > 0, 'and it must be counting');

  s = run(s, 0, 4, 'and then it does');
  assert.equal(s.player.hp, s.player.maxHp - 1, 'six seconds under costs a heart');
  assert.ok(s.player.submerged < 10, 'and the breath starts again rather than draining the bar');
});

test('water above the head is what counts, not water around the knees', () => {
  // Feet in the water, head in the air: wading, not drowning.
  const shallow = roomFrom(`
##############
#............#
#............#
#~~~~~~~~~~~~#
##############`);
  const s = run(stateIn(shallow, 3, 3), 0, WATER_DROWN_FRAMES + 30, 'wade');
  assert.equal(s.player.hp, s.player.maxHp, 'a wading body is not a drowning one');
  assert.equal(s.player.submerged, 0);
});

test('a current pushes a standing body, and is slower than a run so you can swim it', () => {
  const room = roomFrom(`
##############
#>>>>>>>>>>>>#
#>>>>>>>>>>>>#
##############`);
  const drift = run(stateIn(room, 3, 2), 0, 60, 'let it carry you');
  assert.ok(drift.player.x > 3 * 16, `the current must carry a body downstream, not ${drift.player.x}`);

  const upstream = run(stateIn(room, 8, 2), IN.LEFT, 60, 'swim against it');
  assert.ok(upstream.player.x < 8 * 16, 'swimming upstream must make ground, or the current is a wall');
  assert.ok(CURRENT_PUSH < RUN_MAX, 'a current that outruns a run is terrain, not weather');
});

test('wind is a room property, and it only pushes what is off the ground', () => {
  const art = `
##############
#............#
#............#
#............#
##############`;
  /** @param {number} wind */
  const roomWithWind = (wind) => compileRoom({
    id: 'windy', tiles: art, doors: [], spawns: [], rails: [], pickups: [],
    hints: { route: [] }, wind, macro: null,
  });

  const still = run(stateIn(roomWithWind(0), 6, 3), 0, 90, 'no wind');
  const blown = run(stateIn(roomWithWind(4), 6, 3), 0, 90, 'wind, standing');
  assert.equal(blown.player.x, still.player.x, 'a body on its feet is not blown along the floor');

  const jumped = run(stateIn(roomWithWind(4), 6, 3), IN.JUMP, 30, 'wind, airborne');
  const jumpedStill = run(stateIn(roomWithWind(0), 6, 3), IN.JUMP, 30, 'no wind, airborne');
  assert.ok(jumped.player.x > jumpedStill.player.x, 'wind must move an airborne body');
  assert.ok(WIND_ACCEL > 0);
});

test('a crumble tile holds for a moment, then drops whoever is standing on it', () => {
  const room = roomFrom(`
##############
#............#
#............#
#....cccc....#
#............#
##############`);
  let s = stateIn(room, 6, 2);
  s = run(s, 0, CRUMBLE_FRAMES - 8, 'land on it');
  assert.equal(s.player.grounded, true, 'the tile holds at first');
  const feet = s.player.y + s.player.h;

  s = run(s, 0, CRUMBLE_FRAMES + 4, 'and then it does not');
  assert.ok(s.player.y + s.player.h > feet, 'the body must fall once the tile gives way');
  assert.ok(s.brokenTiles.length > 0, 'and the tile must actually be gone from the room');
});

test('a crumble tile nobody is standing on stays where it is', () => {
  // The timer is per-body-on-tile, not per-tile: a ledge across the room does not
  // quietly dissolve while the player is somewhere else.
  const room = roomFrom(`
##############
#............#
#....cccc....#
#............#
##############`);
  let s = stateIn(room, 6, 3);
  const events = [];
  for (let i = 0; i < CRUMBLE_FRAMES * 3; i++) {
    s = step(s, 0);
    for (const e of s.events) events.push(e.kind);
  }
  assert.equal(events.includes('crumble.break'), false, 'nothing under the feet, nothing crumbles');
});
