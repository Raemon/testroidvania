#!/usr/bin/env node
/**
 * Regenerates `test/goldens/route.json` after an *intentional* behaviour change.
 *
 * A golden failure is not a bug report — it is a diff. Run this, then read the
 * change in the file: it is the reviewable record of what your physics or content
 * edit did to the run (04-architecture §9 risk 2).
 */

import { writeFileSync } from 'node:fs';
import { hash } from '../src/core/hash.js';
import { IN } from '../src/core/input.js';
import { newRun, runBot, replayWithCheckpoints } from '../test/harness/run.js';

const SEED = 1;
const EVERY = 25;

/** Kept in sync with `scriptedTape` in determinism.test.js. */
function scriptedTape(length = 600) {
  /** @type {number[]} */
  const tape = [];
  for (let i = 0; i < length; i++) {
    let bits = 0;
    if (i % 120 < 70) bits |= IN.RIGHT;
    else if (i % 120 < 95) bits |= IN.LEFT;
    if (i % 37 < 6) bits |= IN.JUMP;
    if (i % 53 === 0) bits |= IN.DOWN;
    tape.push(bits);
  }
  return tape;
}

const scripted = replayWithCheckpoints(newRun(SEED), scriptedTape(), EVERY);
// Generous: the unaided route grows with every region, and a cap that bites
// silently refuses to write goldens rather than failing loudly.
const BOT_ROUTE_MAX_FRAMES = 20000;
const bot = runBot(newRun(SEED), { maxFrames: BOT_ROUTE_MAX_FRAMES });
if (!bot.done) {
  process.stderr.write(`goldens: the bot did not finish the route — ${bot.violation ?? bot.why}\n`);
  process.exit(1);
}

const out = {
  seed: SEED,
  every: EVERY,
  scripted,
  bot: { final: hash(bot.state), frames: bot.frames, room: bot.state.room },
};
const path = new URL('../test/goldens/route.json', import.meta.url);
writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
process.stdout.write(`goldens: wrote ${path.pathname}\n  scripted ${scripted.final}\n  bot ${out.bot.final} (${bot.frames} frames, ends in ${out.bot.room})\n`);
