/**
 * Jab, damage, i-frames, knockback, hitstop, death — and the enemy HP numbers,
 * which are a *design* decision (06-revision-1 §D3) and therefore worth asserting
 * as one: throw + recall must never be a risk-free ranged kill.
 */

import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN } from '../../src/core/input.js';
import {
  JAB_STARTUP, JAB_ACTIVE, JAB_W, JAB_H, JAB_DAMAGE, JAB_CRIT_MULT,
  PIN_THROW_DAMAGE, PIN_RECALL_DAMAGE, ENEMY_HP_LIGHT, ENEMY_HP_HEAVY,
  PLAYER_IFRAMES, PLAYER_MAX_HP, KNOCKBACK_HAZARD_MULT, PLAYER_KNOCKBACK_VX,
  HITSTOP_HIT, DEATH_RESPAWN_FRAMES,
} from '../../src/core/constants.js';
import { jabBox, jabIsActive, JAB_TOTAL } from '../../src/core/jab.js';
import { damagePlayer } from '../../src/core/player.js';
import { roomFrom, stateIn, run, tap, until } from '../harness/sim.js';

const FLAT = `
######################
#....................#
#....................#
#....................#
######################`;

/** Short enough that the crawler is always within carry range of the wood. */
const WOOD_BACKED = `
############
#..........W
#..........W
#..........W
############`;

test('jab: 3 startup, 4 active, 9 recovery, and a 16x12 box in front', () => {
  let s = stateIn(roomFrom(FLAT), 3, 3);
  s = run(s, IN.ATTACK, 1, 'press');
  const active = [];
  for (let f = 1; f <= JAB_TOTAL + 2; f++) {
    active.push(jabIsActive(s.player));
    s = run(s, 0, 1, 'jab clock');
  }
  const firstActive = active.indexOf(true);
  const lastActive = active.lastIndexOf(true);
  assert.equal(firstActive, JAB_STARTUP, `the jab went active on frame ${firstActive}`);
  assert.equal(lastActive - firstActive + 1, JAB_ACTIVE, 'four active frames');
  assert.equal(s.player.jabFrames, 0, 'the jab is over and reusable');
});

test('jab: the box is in front of the player and flips with facing', () => {
  let s = stateIn(roomFrom(FLAT), 5, 3);
  s = run(s, IN.ATTACK, 1 + JAB_STARTUP, 'swing right');
  const right = jabBox(s.player);
  assert.ok(right, 'the box exists while active');
  assert.equal(right?.w, JAB_W);
  assert.equal(right?.h, JAB_H);
  assert.ok((right?.x ?? 0) >= s.player.x + s.player.w, 'facing right, the box is to the right');

  let back = run(stateIn(roomFrom(FLAT), 5, 3), IN.LEFT, 10, 'turn');
  back = run(back, IN.LEFT | IN.ATTACK, 1 + JAB_STARTUP, 'swing left');
  const left = jabBox(back.player);
  assert.ok((left?.x ?? 0) + JAB_W <= back.player.x, 'facing left, the box is to the left');
});

test('§D3: throw + recall leaves a light enemy alive, so every kill closes distance', () => {
  assert.equal(ENEMY_HP_LIGHT, 4);
  assert.equal(ENEMY_HP_HEAVY, 8);
  assert.ok(
    PIN_THROW_DAMAGE + PIN_RECALL_DAMAGE < ENEMY_HP_LIGHT,
    'throw+recall must not be a risk-free ranged kill on the lightest enemy',
  );
  assert.equal(
    PIN_THROW_DAMAGE + PIN_RECALL_DAMAGE, ENEMY_HP_LIGHT - 1,
    'and it must leave exactly 1, so the last point is always paid for up close',
  );
});

test('the taught kill works: pin it to the wood, one crit jab finishes it', () => {
  const room = roomFrom(WOOD_BACKED, { spawns: [{ kind: 'crawler', at: [9, 3] }] });
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'pinned', 'nail it');
  assert.equal(s.entities[0]?.hp, ENEMY_HP_LIGHT - PIN_THROW_DAMAGE);

  s = until(s, IN.RIGHT, (x) => x.player.x + x.player.w + JAB_W > (x.entities[0]?.x ?? 1e9), 'walk into range');
  assert.equal(s.player.hp, PLAYER_MAX_HP, 'a pinned enemy is helpless, so approaching it is free');

  s = tap(s, IN.ATTACK, JAB_TOTAL + 2, 'jab');
  assert.equal(s.entities.length, 0, `one crit jab (${JAB_DAMAGE * JAB_CRIT_MULT}) finishes the last ${ENEMY_HP_LIGHT - PIN_THROW_DAMAGE}`);
});

test('contact damage costs 1 and buys 60 frames of invulnerability', () => {
  const room = roomFrom(FLAT, { spawns: [{ kind: 'crawler', at: [10, 3] }] });
  let s = stateIn(room, 3, 3);
  s = until(s, IN.RIGHT, (x) => x.player.hp < PLAYER_MAX_HP, 'walk into it', 300);
  assert.equal(s.player.hp, PLAYER_MAX_HP - 1);
  assert.equal(s.player.iframes, PLAYER_IFRAMES);
  assert.ok(s.hitstop >= HITSTOP_HIT, 'a hit stops the world for a moment');

  const hp = s.player.hp;
  s = run(s, IN.RIGHT, PLAYER_IFRAMES - 2, 'keep walking into it');
  assert.equal(s.player.hp, hp, 'i-frames mean one touch is one hit');
});

test('knockback is halved rather than throwing the player into a hazard', () => {
  const clear = stateIn(roomFrom(FLAT), 5, 3);
  const free = damagePlayer(clear.player, 1, clear.player.x + 40, []);
  assert.equal(Math.abs(free.vx), PLAYER_KNOCKBACK_VX, 'with nothing around, the full impulse');

  const spiked = stateIn(roomFrom(`
######################
#....................#
#....................#
#^^^^................#
######################`), 5, 3);
  const saved = damagePlayer(spiked.player, 1, spiked.player.x + 40, spiked.roomData.hazards);
  assert.equal(Math.abs(saved.vx), PLAYER_KNOCKBACK_VX * KNOCKBACK_HAZARD_MULT,
    'knocked toward spikes, the impulse is halved');
  assert.ok(saved.vx !== 0, 'halved, never cancelled: a hit you cannot feel does not read as a hit');
});

test('death respawns at the last save-lantern, at full health, with the Pin in hand', () => {
  const room = roomFrom(`
######################
#....................#
#..........L.........#
#....^^^^^^..........#
######################`);
  let s = stateIn(room, 11, 3);
  s = run(s, 0, 4, 'stand on the lantern');
  assert.equal(s.progress.lanternsLit.length, 1, 'walking through lights it, with no prompt');
  const respawn = { ...s.respawn };

  s = { ...s, player: { ...s.player, hp: 1 } };
  s = until(s, IN.LEFT, (x) => x.player.hp === 0, 'walk into the spikes', 400);
  s = until(s, 0, (x) => x.player.hp > 0, 'respawn', DEATH_RESPAWN_FRAMES + 10);
  assert.equal(s.player.hp, PLAYER_MAX_HP);
  assert.equal(s.pin.state, 'held');
  assert.deepEqual({ ...s.respawn }, respawn, 'the lantern is still the respawn point');
});

test('hitstop freezes the world without eating the recall press', () => {
  const room = roomFrom(WOOD_BACKED, { spawns: [{ kind: 'crawler', at: [9, 3] }] });
  let s = until(stateIn(room, 2, 3), IN.RIGHT | IN.THROW, (x) => x.hitstop > 0, 'land a throw');
  const frozen = { x: s.player.x, y: s.player.y, hp: s.entities[0]?.hp };
  const during = run(s, 0, 1, 'frozen');
  assert.equal(during.player.x, frozen.x, 'nothing moves during hitstop');
  assert.equal(during.player.y, frozen.y);

  // Press Recall *inside* the freeze; it must still be a press when time resumes.
  let held = run(s, 0, 1, 'release');
  for (let i = 0; i < s.hitstop + 2; i++) held = run(held, IN.RECALL, 1, 'recall through the freeze');
  assert.ok(held.pin.state === 'returning' || held.pin.state === 'held',
    `recall pressed during hitstop was swallowed; the Pin is ${held.pin.state}`);
});
