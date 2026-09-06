/**
 * Every Pin state transition, and every edge case in 06-revision-1 §G.
 *
 * The Pin is the game. If one of these goes red, nothing downstream of it is
 * worth reading until it is green again.
 */

import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN } from '../../src/core/input.js';
import {
  TILE, PIN_THROW_STARTUP, PIN_RANGE, PIN_PINNED_FRAMES, PIN_AUTO_RECALL_FRAMES,
  PIN_HAND_OFFSET, PIN_CLANG_FLASH_FRAMES, PLAYER_H, ENEMY_HP_LIGHT,
} from '../../src/core/constants.js';
import { pinPlatform } from '../../src/core/pin-geometry.js';
import { roomFrom, stateIn, run, tap, until } from '../harness/sim.js';

/** Wood wall on the right, stone floor, nine tiles of room to stand in. */
const WOOD_WALL = `
##############
#............W
#............W
#............W
#............W
#............W
##############`;

const METAL_WALL = `
##############
#............M
#............M
#............M
#............M
#............M
##############`;

const STONE_WALL = `
##############
#............#
#............#
#............#
#............#
#............#
##############`;

/** @param {string} art @param {object} [o] */
const at = (art, tx = 3, ty = 5, o = {}) => stateIn(roomFrom(art, o), tx, ty);

test('held: the Pin rides in the hand and follows the player', () => {
  let s = at(WOOD_WALL);
  assert.equal(s.pin.state, 'held');
  s = run(s, IN.RIGHT, 10, 'walk');
  assert.equal(s.pin.x, s.player.x + s.player.w / 2);
  assert.equal(s.pin.y, s.player.y + PIN_HAND_OFFSET);
});

test('throw: 4 frames of startup, aim locked at the press frame', () => {
  let s = at(WOOD_WALL);
  s = run(s, IN.RIGHT | IN.THROW, 1, 'press');
  assert.equal(s.pin.state, 'held', 'the Pin is still in hand during startup');
  assert.equal(s.pin.startup, PIN_THROW_STARTUP);
  assert.deepEqual([s.pin.aimX, s.pin.aimY], [1, 0]);

  // Aim is locked: pressing UP after the press frame must not curve the throw.
  s = run(s, IN.UP, PIN_THROW_STARTUP, 'startup');
  assert.equal(s.pin.state, 'flying');
  assert.equal(s.pin.vy, 0, 'a horizontal throw stays horizontal');
  assert.ok(s.pin.vx > 0);
});

test('throw: a neutral aim throws where the player is facing', () => {
  let s = at(WOOD_WALL);
  s = run(s, IN.LEFT, 8, 'turn');
  s = run(s, IN.THROW, 1 + PIN_THROW_STARTUP, 'throw');
  assert.ok(s.pin.vx < 0, `neutral throw went ${s.pin.vx}`);
});

test('throw freeze (§D1.3): horizontal velocity is frozen through the startup', () => {
  let s = at(WOOD_WALL);
  s = run(s, IN.RIGHT, 20, 'run up to speed');
  assert.ok(s.player.vx > 1, 'the player is moving before the throw');
  const x = s.player.x;
  s = run(s, IN.RIGHT | IN.THROW, 1, 'press');
  s = run(s, IN.RIGHT, PIN_THROW_STARTUP, 'startup');
  assert.equal(s.player.vx, 0, 'vx must be frozen for the whole startup');
  assert.ok(Math.abs(s.player.x - x) < 3, `the player drifted ${(s.player.x - x).toFixed(2)}px during the throw`);
});

test('embed: a horizontal throw at wood makes a platform exactly one tile above the feet', () => {
  let s = at(WOOD_WALL);
  const feet = s.player.y + PLAYER_H;
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'embed in wood');
  assert.equal(s.pin.surface, 'wood');
  assert.equal(s.pin.nx, -1, 'the normal points out of the wall, back at the player');
  const plat = pinPlatform(s.pin);
  assert.ok(plat, 'an embedded wall pin is a platform');
  assert.equal(feet - (plat?.y ?? 0), TILE, 'the hop is always the same one-tile step');
});

test('embed: the platform holds the player up, and Perch centres them on it', () => {
  let s = at(WOOD_WALL);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'embed');
  const plat = pinPlatform(s.pin);
  assert.ok(plat);
  s = run(s, IN.RIGHT | IN.JUMP, 12, 'hop up');
  s = until(s, IN.RIGHT, (x) => x.player.perch, 'land on the pin');
  assert.equal(s.player.y + s.player.h, plat?.y, 'the feet rest on the platform');
  assert.equal(s.player.x, (plat?.x ?? 0) + ((plat?.w ?? 0) - s.player.w) / 2, 'Perch centres the player');
});

test('perch: horizontal input is ignored until Jump or Down', () => {
  let s = at(WOOD_WALL);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'embed');
  s = run(s, IN.RIGHT | IN.JUMP, 12, 'hop up');
  s = until(s, IN.RIGHT, (x) => x.player.perch, 'perch');
  const x = s.player.x;

  s = run(s, IN.LEFT, 20, 'shove');
  assert.equal(s.player.x, x, 'a perched player does not slide off');
  assert.equal(s.player.vx, 0);

  s = run(s, IN.LEFT | IN.DOWN, 1, 'ask to leave');
  assert.equal(s.player.perch, false, 'Down releases the perch');
});

test('hang (§D1.2): falling past a wall pin snaps to it, and Jump is a wall-kick', () => {
  let s = at(WOOD_WALL);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'embed');
  // Jump up past the pin and come back down beside it.
  s = run(s, IN.RIGHT | IN.JUMP, 10, 'up');
  s = until(s, IN.RIGHT, (x) => x.player.hang || x.player.perch, 'grab or land');
  if (!s.player.hang) {
    // Landed on it instead; step off the side and fall past it.
    s = run(s, IN.JUMP, 6, 'hop off');
    s = until(s, IN.RIGHT, (x) => x.player.hang, 'grab on the way down');
  }
  assert.equal(s.player.hang, true);
  assert.equal(s.player.vy, 0, 'a hang holds you still');
  assert.equal(s.player.x + s.player.w, s.pin.x, 'the body is flush with the surface');

  const kicked = run(s, IN.JUMP, 2, 'wall kick');
  assert.ok(kicked.player.vx < 0, 'the kick pushes away from the wall');
  assert.ok(kicked.player.vy < 0, 'the kick goes up');
  assert.equal(kicked.player.hang, false);
});

test('hang: Down lets go, and recall drops you — a hang can never strand you', () => {
  let s = at(WOOD_WALL);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'embed');
  s = run(s, IN.RIGHT | IN.JUMP, 10, 'up');
  s = until(s, IN.RIGHT, (x) => x.player.hang, 'grab', 240);

  const dropped = run(s, IN.DOWN, 2, 'let go');
  assert.equal(dropped.player.hang, false);

  const recalled = run(s, IN.THROW, 2, 'recall while hanging');
  assert.equal(recalled.player.hang, false, 'recall must drop the player, never hold them');
  assert.notEqual(recalled.pin.state, 'embedded');
});

test('clang: metal is never pinnable — white flash, and straight down', () => {
  let s = at(METAL_WALL);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.inert, 'clang');
  assert.notEqual(s.pin.state, 'embedded', 'metal must never take the Pin');
  assert.equal(s.flash, PIN_CLANG_FLASH_FRAMES, 'the clang raises the screen-edge flash');
  assert.equal(s.pin.clang, PIN_CLANG_FLASH_FRAMES);
  assert.equal(s.pin.vx, 0, 'a clanged Pin drops straight down');
  s = until(s, 0, (x) => x.pin.state === 'dropped', 'falls to the floor');
  assert.ok(s.pin.y > s.player.y, 'it ended up on the floor');
});

test('stone is not pinnable until Deep Pin, and then it is', () => {
  let s = at(STONE_WALL);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.inert || x.pin.state === 'dropped', 'bounce off stone');
  assert.notEqual(s.pin.state, 'embedded');
  assert.equal(s.flash, 0, 'only metal clangs');

  let deep = at(STONE_WALL);
  deep = { ...deep, progress: { ...deep.progress, abilities: ['deepPin'] } };
  deep = until(deep, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'Deep Pin embeds in stone');
  assert.equal(deep.pin.surface, 'stone');
});

test('one-way platforms are not pinnable: the Pin passes straight through (§G)', () => {
  const room = roomFrom(`
##############
#............#
#............#
#...=========#
#............#
#............#
##############`);
  let s = stateIn(room, 3, 5);
  s = until(s, IN.UP | IN.THROW, (x) => x.pin.state !== 'held' && x.pin.state !== 'flying', 'the Pin comes back down', 300);
  assert.notEqual(s.pin.state, 'embedded', 'a one-way platform must not hold the Pin');
});

test('range: past 176px the Pin loses force and falls to Dropped', () => {
  const long = `
######################################
#....................................#
#....................................#
#....................................#
######################################`;
  let s = at(long, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'dropped', 'runs out of range', 300);
  assert.ok(s.pin.travelled >= PIN_RANGE - 9, `travelled ${s.pin.travelled.toFixed(1)} before dropping`);
  assert.ok(s.pin.travelled <= PIN_RANGE + 9);
});

test('dropped: walking over the Pin picks it up', () => {
  let s = at(METAL_WALL);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'dropped', 'clang and fall');
  s = until(s, IN.RIGHT, (x) => x.pin.state === 'held', 'walk over it');
  assert.equal(s.pin.state, 'held');
});

test('recall: 13 px/f straight home, phasing through terrain', () => {
  const throughWall = `
################
#......#.......W
#......#.......W
#......#.......W
################`;
  let s = at(throughWall, 2, 3);
  // Throw over the pillar so the Pin has to come home through it.
  s = until(s, IN.UP | IN.RIGHT | IN.THROW, (x) => x.pin.state !== 'held' && x.pin.state !== 'flying', 'lands somewhere', 300);
  const away = Math.hypot(s.pin.x - s.player.x, s.pin.y - s.player.y);
  assert.ok(away > TILE * 3, `the Pin only got ${away.toFixed(1)}px away`);
  s = until(s, IN.THROW, (x) => x.pin.state === 'held', 'phases home through the pillar');
  assert.equal(s.pin.state, 'held');
});

test('recall is never disabled: it works from every state the Pin can be in', () => {
  /** @type {[string, (s: import('../../src/core/types.js').GameState) => import('../../src/core/types.js').GameState][]} */
  const situations = [
    ['flying', (s) => run(s, IN.RIGHT | IN.THROW, 2, 'mid-flight')],
    ['embedded', (s) => until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'embed')],
    ['dropped', (s) => until(s, IN.UP | IN.THROW, (x) => x.pin.state === 'dropped', 'drop', 300)],
  ];
  for (const [name, reach] of situations) {
    const staged = reach(at(WOOD_WALL));
    assert.equal(staged.pin.state, name, `setup for '${name}'`);
    const back = until(staged, IN.THROW, (x) => x.pin.state === 'held', `recall from ${name}`);
    assert.equal(back.pin.state, 'held');
  }
});

test('recall cuts what it passes, for 1 damage', () => {
  const room = roomFrom(`
##############
#............W
#............W
#............W
##############`, { spawns: [{ kind: 'crawler', at: [8, 3] }] });
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'pinned' || x.pin.state === 'dropped', 'hit it');
  const hp = s.entities[0]?.hp ?? 0;
  assert.equal(hp, ENEMY_HP_LIGHT - 2, 'the throw does 2');
  s = until(s, IN.THROW, (x) => x.pin.state === 'held', 'recall through it');
  assert.equal(s.entities[0]?.hp, hp - 1, 'recall does 1 on its line');
});

test('pinned: a light enemy with wood behind it is nailed there, and freed after 90f', () => {
  const room = roomFrom(`
##############
#............W
#..........c.W
#............W
##############`.replace('c', '.'), { spawns: [{ kind: 'crawler', at: [11, 3] }] });
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'pinned', 'nail it to the wood');
  assert.equal(s.entities[0]?.pinned, true);
  assert.equal(s.pin.hostTimer, PIN_PINNED_FRAMES);

  const x = s.entities[0]?.x ?? 0;
  s = run(s, 0, 40, 'held helpless');
  assert.equal(s.entities[0]?.x, x, 'a pinned enemy cannot move');

  s = until(s, 0, (t) => t.pin.state === 'dropped', 'it wriggles free', PIN_PINNED_FRAMES + 20);
  assert.equal(s.entities[0]?.pinned, false);
});

test('pinned: a light enemy in front of metal cannot be pinned — the Pin just drops', () => {
  const room = roomFrom(`
##############
#............M
#............M
#............M
##############`, { spawns: [{ kind: 'crawler', at: [11, 3] }] });
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state !== 'held' && x.pin.state !== 'flying', 'hit it');
  assert.notEqual(s.pin.state, 'pinned', 'material decides combat exactly as it decides traversal');
  assert.equal(s.entities[0]?.hp, ENEMY_HP_LIGHT - 2, 'it still takes the 2 damage');
});

test('§G water: the Pin sinks slowly, stays recallable, and keeps its light', () => {
  const room = roomFrom(`
##############
#............#
#......~~~~~~#
#......~~~~~~#
##############`);
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.vy > 0 && x.pin.x > 7 * TILE, 'reaches the water', 300);
  assert.ok(s.pin.vy <= 0.5 + 1e-9, `sinking at ${s.pin.vy}, which is not slow`);
  const lit = s.lights.find((l) => l.kind === 'pin');
  assert.ok(lit && lit.x === s.pin.x, 'the light is still on the Pin, underwater');
  s = until(s, IN.THROW, (x) => x.pin.state === 'held', 'recall out of the water');
});

test('§G crumble: the tile gives way and the Pin drops', () => {
  const room = roomFrom(`
##############
#............c
#............c
#............c
##############`);
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.brokenTiles.length > 0, 'bite the crumble');
  assert.notEqual(s.pin.state, 'embedded', 'a crumble tile cannot hold the Pin');
  assert.equal(s.roomData.grid[3]?.[13], '.', 'the tile is gone from the room');
  s = until(s, 0, (x) => x.pin.state === 'dropped', 'and the Pin falls');
});

test('§G auto-recall: a Pin in a kill volume comes home by itself after 30 frames', () => {
  const room = roomFrom(`
##############
#............#
#............#
#......^^^^^^#
##############`);
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.away > 0, 'the Pin lands in the spikes', 300);
  const startedAt = s.tick;
  s = until(s, 0, (x) => x.pin.state === 'returning' || x.pin.state === 'held', 'auto-recall fires', 120);
  assert.ok(s.tick - startedAt <= PIN_AUTO_RECALL_FRAMES + 2, `waited ${s.tick - startedAt} frames`);
});

test('§G death: the Pin is back in the hand on respawn', () => {
  const room = roomFrom(`
##############
#............W
#............W
#..^^^^^^^^^^#
##############`);
  let s = stateIn(room, 2, 3);
  s = until(s, IN.RIGHT | IN.THROW, (x) => x.pin.state === 'embedded', 'throw it away first');
  s = until(s, IN.RIGHT, (x) => x.player.hp < 5, 'walk into the spikes', 300);
  s = until(s, 0, (x) => x.player.hp === 0, 'die', 900);
  s = until(s, 0, (x) => x.player.hp > 0, 'respawn', 200);
  assert.equal(s.pin.state, 'held', 'death always returns the Pin');
});

test('the state machine only ever visits legal states', () => {
  const legal = new Set(['held', 'flying', 'embedded', 'pinned', 'dropped', 'returning']);
  let s = at(WOOD_WALL);
  const seen = new Set();
  // A deterministic input churn: throw, recall, jab, move, in every combination.
  for (let i = 0; i < 600; i++) {
    let bits = 0;
    if (i % 7 === 0) bits |= IN.THROW;
    if (i % 11 < 4) bits |= IN.RIGHT;
    if (i % 13 < 3) bits |= IN.LEFT;
    if (i % 17 < 2) bits |= IN.UP;
    if (i % 19 === 0) bits |= IN.JUMP;
    if (i % 23 === 0) bits |= IN.ATTACK;
    s = run(s, bits, 1, 'churn');
    assert.ok(legal.has(s.pin.state), `the Pin reached '${s.pin.state}'`);
    seen.add(s.pin.state);
  }
  assert.ok(seen.size >= 3, `the churn only reached ${[...seen].join(', ')}`);
});

test('the player can never be stranded: from any state, holding recall returns the Pin', () => {
  let s = at(WOOD_WALL);
  for (let i = 0; i < 300; i++) {
    let bits = 0;
    if (i % 5 === 0) bits |= IN.THROW;
    if (i % 9 < 5) bits |= IN.RIGHT;
    if (i % 12 < 2) bits |= IN.UP;
    if (i % 15 === 0) bits |= IN.JUMP;
    s = run(s, bits, 1, 'wander');
    if (s.pin.state === 'held') continue;
    // From right here, tapping Recall must bring it home. Every time, no exceptions.
    const home = until(tap(s, IN.THROW, 0, 'recall'), 0, (x) => x.pin.state === 'held', `recall at tick ${s.tick}`, 120);
    assert.equal(home.pin.state, 'held');
  }
});
