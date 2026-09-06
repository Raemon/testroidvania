// Photograph the finale. The Core, the Ascent and the ending are the one stretch of
// the game whose whole job is to *look* like something, and a passing test says
// nothing about that — so this drives a real browser run to each of those moments
// and writes a PNG for a human to look at.
//
//   node tools/shots-core-ending.mjs

import { launchGame } from '../test/harness/browser.js';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '../artifacts/shots/core-ending');
const BATCH = 60;
const MAX_FRAMES = 200000;

/**
 * Each shot is "the first frame at which this is true". They are checked in order
 * and each is taken once, so one run photographs the whole finale.
 * @type {{name: string, when: (s: any) => boolean}[]}
 */
const SHOTS = [
  { name: '01-k1-seal', when: (s) => s.room === 'k1_seal' },
  { name: '02-k4-threshold', when: (s) => s.room === 'k4_threshold' },
  { name: '03-k5-anchor', when: (s) => s.room === 'k5_anchor' && s.tick % 1 === 0 },
  { name: '04-anchor-chase', when: (s) => s.room === 'k5_anchor' && s.player.hp < s.player.maxHp },
  { name: '05-ascent-s1', when: (s) => s.progress.flags.ascent && s.room === 's1_floor' },
  { name: '06-ascent-s2', when: (s) => s.progress.flags.ascent && s.room === 's2_awakening' },
  { name: '07-ascent-s3', when: (s) => s.progress.flags.ascent && s.room === 's3_throat' },
  { name: '08-ascent-s4', when: (s) => s.progress.flags.ascent && s.room === 's4_gallery' },
  { name: '09-crown', when: (s) => s.room === 's5_crown' && s.progress.flags.ascent },
  { name: '10-hull', when: (s) => s.room === 'e1_hull' },
  { name: '11-hull-lit', when: (s) => s.room === 'e1_hull' && s.player.x > 220 },
  { name: '12-hull-end', when: (s) => s.progress.flags.gameComplete },
];

const game = await launchGame({ query: 'seed=1&debug=1&lockstep=1&bot=1' });
let taken = 0;
let frames = 0;

try {
  while (frames < MAX_FRAMES && taken < SHOTS.length) {
    const st = await game.call('state');
    const shot = SHOTS[taken];
    if (shot && shot.when(st)) {
      const path = join(OUT, `${shot.name}.png`);
      await game.screenshot(path);
      console.log(`  ${String(st.tick).padStart(6)}  ${shot.name}  (${st.room})`);
      taken++;
      continue;
    }
    if (st.progress?.flags?.gameComplete) break;
    await game.pump(BATCH);
    frames += BATCH;
  }
  console.log(`\n${taken}/${SHOTS.length} shots written to artifacts/shots/core-ending`);
  if (taken < SHOTS.length) {
    console.error(`missed: ${SHOTS.slice(taken).map((s) => s.name).join(', ')}`);
    process.exit(1);
  }
} finally {
  await game.close();
}
