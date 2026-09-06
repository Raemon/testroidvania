// Play the ENTIRE game in a real browser, start to credits.
//
// `npm test` runs a browser playthrough of a slice, because the renderer costs
// ~5ms/frame under this container's software rasteriser and the whole game does
// not fit a per-test ceiling. That keeps the suite fast, but the project's
// actual promise is that a full run works in a browser — so this exists, with no
// time budget, to be run at checkpoints.
//
//   node tools/playthrough-full.mjs

import { launchGame } from '../test/harness/browser.js';

const BATCH = 600;
const MAX_FRAMES = 200000;

/** Read the completion flag off the real state rather than a test-only hook. */
const complete = async () => {
  const st = await game.call('state');
  return Boolean(st.progress?.flags?.gameComplete);
};

const started = Date.now();
const game = await launchGame({ query: 'seed=1&debug=1&lockstep=1&bot=1' });

let frames = 0;
let lastRoom = '';
/** @type {{room: string, tick: number}[]} */
const visited = [];

try {
  while (frames < MAX_FRAMES) {
    if (await complete()) break;
    await game.pump(BATCH);
    frames += BATCH;

    const room = await game.call('room');
    if (room !== lastRoom) {
      const tick = await game.call('tick');
      visited.push({ room, tick });
      console.log(`  ${String(tick).padStart(6)}  ${room}`);
      lastRoom = room;
    }
  }

  const finished = await complete();
  const tick = await game.call('tick');
  const st = await game.call('state');
  const hp = st.player.hp;
  const seconds = (tick / 60).toFixed(1);

  console.log(`\nrooms visited: ${visited.length}`);
  console.log(`ticks: ${tick}  (${seconds}s of game time)`);
  console.log(`wall clock: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`player hp at the end: ${hp}`);
  console.log(`browser errors: ${game.errors.length}`);

  if (!finished) {
    console.error(`\nFAILED: the bot did not finish. Last room: ${lastRoom} at tick ${tick}.`);
    process.exit(1);
  }
  console.log('\nCOMPLETE — the bot played the whole game in a real browser.');
} finally {
  await game.close();
}
