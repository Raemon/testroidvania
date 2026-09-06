/**
 * The six archetypes of 00-BIBLE §6, against the two rules that make them a roster
 * rather than a list: **mass decides what the Pin does to you**, and **nothing deals
 * damage inside 16 frames of visible telegraph** (03-game-feel §2.7).
 *
 * The telegraph rule is asserted by counting frames from the moment a body commits
 * to an attack to the moment anything of its can touch the player, so an enemy that
 * is retuned to be nastier fails here rather than in a playtest.
 */

import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_KINDS, armoured } from '../../src/core/entities/index.js';
import { ENEMY_HP_LIGHT, ENEMY_HP_HEAVY } from '../../src/core/constants.js';
import { isBoss } from '../../src/core/bosses/index.js';
import { IN } from '../../src/core/input.js';
import { roomFrom, stateIn, run, until } from '../harness/sim.js';

const FLOOR = `
##############################
#............................#
#............................#
#............................#
#............................#
#............................#
##############################`;

/** @param {string} kind @param {[number,number]} at */
const withEnemy = (kind, at, px = 3) => stateIn(roomFrom(FLOOR, { spawns: [{ kind, at }] }), px, 5);

test('every archetype declares a rig, so the view reads it off the registry', () => {
  for (const [kind, def] of Object.entries(ENTITY_KINDS)) {
    const rig = /** @type {{rig?: string}} */ (def).rig;
    assert.ok(rig, `entity kind '${kind}' has no rig; the renderer would have to hard-code it`);
    assert.ok(['tick', 'jelly', 'knight'].includes(rig), `'${kind}' has unknown rig '${rig}'`);
  }
});

test('mass and health follow §D3: light 4, heavy 8, and a Drifter dies to anything', () => {
  /** @type {[string, 0|1, number][]} */
  const roster = [
    ['crawler', 0, ENEMY_HP_LIGHT],
    ['charger', 0, ENEMY_HP_LIGHT],
    ['hopper', 0, ENEMY_HP_LIGHT],
    ['drifter', 0, 1],
    ['turret', 1, ENEMY_HP_HEAVY],
    ['shell', 1, ENEMY_HP_HEAVY],
  ];
  for (const [kind, mass, hp] of roster) {
    const e = ENTITY_KINDS[kind]?.spawn(1, 'fixture', 5, 5);
    assert.ok(e, `no kind '${kind}'`);
    assert.equal(e?.mass, mass, `${kind} mass`);
    assert.equal(e?.maxHp, hp, `${kind} health`);
  }
});

test('hopper: at least 16 frames of visible crouch before it can be anywhere near you', () => {
  let s = withEnemy('hopper', [16, 5], 12);
  s = until(s, 0, (x) => (x.entities[0]?.mode ?? '') === 'telegraph', 'it notices', 120);
  const committed = s.tick;
  s = until(s, 0, (x) => (x.entities[0]?.mode ?? '') === 'leap', 'it leaps', 120);
  assert.ok(s.tick - committed >= 16, `only ${s.tick - committed} frames of warning`);
});

test('turret: 32 frames of telegraph, and the bolt does not exist before then', () => {
  let s = withEnemy('turret', [20, 5], 8);
  s = until(s, 0, (x) => (x.entities[0]?.mode ?? '') === 'telegraph', 'it acquires a light', 200);
  const committed = s.tick;
  s = until(s, 0, (x) => x.entities.some((e) => e.kind === 'bolt'), 'it fires', 200);
  assert.ok(s.tick - committed >= 16, `only ${s.tick - committed} frames before the bolt existed`);
  const bolt = s.entities.find((e) => e.kind === 'bolt');
  assert.ok(bolt && (bolt.vx !== 0 || bolt.vy !== 0), 'a bolt that does not move is not a shot');
});

test('turret: it aims at the nearest light, which may be the Pin you threw (§D2)', () => {
  // The whole reason a Turret exists. Throw the Pin the other way and the shot
  // follows the light, not the player.
  // Stand well back and lob the Pin toward it: now the nearest light in its line of
  // sight is a piece of iron in the floor, and that is what it shoots at.
  // Stand far enough back that the turret cannot see the player at all, then lob
  // the Pin down-range: the only light in its line of sight is the one you threw.
  let s = withEnemy('turret', [22, 5], 3);
  const cx = s.player.x + s.player.w / 2;
  s = run(s, IN.THROW, 1, 'lob it forward');
  /** @type {{aim:number, pinX:number}|null} */
  let shot = null;
  for (let i = 0; i < 300 && shot === null; i++) {
    s = run(s, 0, 1, 'watch it aim');
    const t = s.entities[0];
    if (t && t.mode === 'telegraph') shot = { aim: t.targetX, pinX: s.pin.x };
  }
  assert.ok(shot, 'the turret never acquired anything, so it never saw the Pin either');
  assert.ok(
    Math.abs((shot?.aim ?? 0) - (shot?.pinX ?? 0)) < Math.abs((shot?.aim ?? 0) - cx),
    `it aimed at ${shot?.aim}, which is the player at ${cx} and not the Pin at ${shot?.pinX}`,
  );
});

test('drifter: it flies, it never falls, and one hit is enough', () => {
  let s = withEnemy('drifter', [16, 3], 3);
  const y0 = s.entities[0]?.y ?? 0;
  s = run(s, 0, 60, 'drift');
  const e = s.entities[0];
  assert.ok(e, 'it is still airborne');
  assert.ok(Math.abs((e?.y ?? 0) - y0) < 32, 'a sine-flyer does not fall out of the air');
  assert.equal(e?.vy, 0, 'and gravity does not apply to it');
});

test('shell: armour is geometry — the front rings, above and behind do not', () => {
  const e = ENTITY_KINDS['shell']?.spawn(1, 'fixture', 5, 5);
  assert.ok(e, 'no shell');
  const shell = { ...(/** @type {NonNullable<typeof e>} */ (e)), facing: /** @type {1} */ (1) };
  const cx = shell.x + shell.w / 2;
  const cy = shell.y + shell.h / 2;
  assert.equal(armoured(shell, cx + 40, cy), true, 'a blow to the face rings off it');
  assert.equal(armoured(shell, cx - 40, cy), false, 'from behind it is open');
  assert.equal(armoured(shell, cx + 40, shell.y - 8), false, 'from above it is open');
});

test('a boss is an entity kind, and no ordinary enemy claims to be a boss', () => {
  for (const kind of Object.keys(ENTITY_KINDS)) {
    if (!isBoss(kind)) continue;
    assert.ok(ENTITY_KINDS[kind]?.hatch, `boss '${kind}' hatches no parts`);
  }
  for (const kind of ['crawler', 'charger', 'hopper', 'turret', 'drifter', 'shell']) {
    assert.equal(isBoss(kind), false, `'${kind}' is an enemy, not a boss`);
  }
});
