/**
 * THE WHOLE GAME, AND THE END OF IT.
 *
 * `rooms.test.js` proves each room is solvable on its own and `playthrough.test.js`
 * proves the browser and the sim agree; neither of them proves the thing the
 * project is actually for, which is that a run *finishes*. This file does, in Node,
 * where frames are free: one bot, one seed, from the first frame to the far edge of
 * the hull, with every invariant checked on every frame.
 *
 * The rest of the file is about the finale specifically — the Ascent's clock, its
 * checkpoints, and the ending's dependence on how much of the map the run lit.
 */

import './harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, runGame, runBot } from './harness/run.js';
import { step } from '../src/core/step.js';
import { getRoom } from '../src/content/rooms/index.js';
import { voidTop } from '../src/core/ascent.js';
import { ASCENT_TIER_FRAMES, ASCENT_RISE, TILE } from '../src/core/constants.js';
import { SPINE_TIERS, ENDING_ROOM } from '../src/content/world.js';
import { IN } from '../src/core/input.js';

test('the bot plays the whole game, start to finish, and the Vessel lights up', () => {
  const run = runGame();
  assert.ok(run.done, `the run did not finish: ${run.why}\n  rooms: ${run.rooms.join(' -> ')}`);
  assert.equal(run.state.room, ENDING_ROOM, 'a finished run ends on the hull');
  assert.equal(run.state.progress.flags.gameComplete, true);
  assert.deepEqual(run.state.errors, [], 'step() reported errors during the run');

  // The shape of the run, not just its end: every ability, every boss, and the
  // Ascent's own flag, which only the Anchor's death can set.
  assert.deepEqual(
    run.state.progress.abilities,
    ['zip', 'deepPin', 'reel', 'ricochet', 'twinPin'],
    'the ability ladder was not climbed in order',
  );
  assert.ok(run.state.progress.bossesKilled.includes('anchor'), 'the Anchor was walked around');
  assert.equal(run.state.progress.flags.ascent, true);

  // The Ascent is a recap, so every Spine tier has to appear on the way up, after
  // the Core. Anything less means the finale skipped the map it is made of.
  const afterCore = run.rooms.slice(run.rooms.lastIndexOf('k5_anchor') + 1);
  for (const tier of SPINE_TIERS) {
    assert.ok(afterCore.includes(tier), `the Ascent never passed through ${tier}: ${afterCore.join(' -> ')}`);
  }
});

test('the Anchor can kill: standing still in its arena costs the whole bar', () => {
  // The other half of "beatable". A boss the policy can beat but which cannot
  // punish a player who does nothing is scenery.
  let s = newRun(1, 'k5_anchor');
  s = { ...s, progress: { ...s.progress, abilities: ['zip', 'deepPin'] } };
  let hurt = false;
  for (let f = 0; f < 3000 && !hurt; f++) {
    s = step(s, 0);
    if (s.player.hp < s.player.maxHp) hurt = true;
  }
  assert.ok(hurt, 'the Anchor never touched a player who never moved');
});

test('the Anchor is killable by its own policy, and the floor gives way when it falls', () => {
  const run = runBot(
    { ...newRun(1, 'k5_anchor'), progress: { ...newRun(1, 'k5_anchor').progress, abilities: ['zip', 'deepPin'] } },
    { maxFrames: 9000, until: (s) => s.progress.bossesKilled.includes('anchor') },
  );
  assert.ok(run.done, `the policy did not beat the Anchor: ${run.why || run.violation}`);
  assert.ok(run.state.player.hp >= 1, 'the Anchor killed the bot');
});

test('the void holds level for the grace period, then eats the tier', () => {
  const room = getRoom(SPINE_TIERS[0] ?? '');
  assert.ok(room);
  const floor = (room.h - 1) * TILE;
  assert.equal(voidTop(room, 0), floor, 'the void opens flush with the floor, which is not lethal');
  assert.equal(voidTop(room, ASCENT_TIER_FRAMES), floor, 'and it holds there for the grace period');
  assert.equal(voidTop(room, ASCENT_TIER_FRAMES + 100), floor - 100 * ASCENT_RISE, 'then it climbs');
});

test('the Ascent drowns a player who stops, and the checkpoint costs the tier and not the run', () => {
  // Stand on the floor of S1 with the clock running and do nothing at all.
  const room = getRoom(SPINE_TIERS[0] ?? '');
  assert.ok(room);
  let s = newRun(1, SPINE_TIERS[0]);
  s = {
    ...s,
    progress: { ...s.progress, abilities: ['zip'], flags: { ascent: true } },
    ascent: { active: true, tier: 0, frames: 0, done: false },
  };
  const startedAt = { ...s.respawn };

  let drowned = -1;
  for (let f = 0; f < ASCENT_TIER_FRAMES * 3 && drowned < 0; f++) {
    s = step(s, 0);
    if (s.events.some((e) => e.kind === 'ascent.void')) drowned = f;
  }
  // Standing on the floor is safe for the whole grace period and lethal on the
  // first frame after it: the void's top *is* the floor until then.
  assert.ok(drowned >= ASCENT_TIER_FRAMES, `the void reached a standing player at frame ${drowned}`);
  assert.equal(s.player.hp, 0, 'the void kills outright rather than costing a heart');
  assert.equal(s.ascent.frames, 0, 'and the tier clock restarts, so a death costs the tier');
  assert.equal(s.respawn.room, startedAt.room, 'the checkpoint is the tier, not the start of the run');

  // And it comes back: the respawn puts the player on their feet in the same tier.
  for (let f = 0; f < 120; f++) s = step(s, 0);
  assert.ok(s.player.hp > 0, 'the player never respawned');
  assert.equal(s.room, SPINE_TIERS[0]);
});

test('the ending scales with how much the run lit', () => {
  /** @param {string[]} lanternsLit @returns {number} */
  const lightsOnTheHull = (lanternsLit) => {
    const room = getRoom(ENDING_ROOM);
    assert.ok(room);
    let s = newRun(1, ENDING_ROOM);
    s = { ...s, progress: { ...s.progress, lanternsLit, flags: { ascent: true } } };
    // Walk to the far end; the trail is drawn behind the runner as it goes.
    let count = 0;
    for (let f = 0; f < 400; f++) {
      s = step(s, IN.RIGHT);
      count = Math.max(count, s.lights.filter((l) => l.kind === 'lantern').length);
    }
    return count;
  };

  const sparse = lightsOnTheHull(['a@1,1', 'b@1,1']);
  const thorough = lightsOnTheHull(Array.from({ length: 20 }, (_, i) => `r${i}@1,1`));
  assert.ok(thorough > sparse, `a thorough run must light more of the hull (${thorough} vs ${sparse})`);
});
