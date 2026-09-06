#!/usr/bin/env node
/**
 * The test entry point. It exists for two guarantees the bare runner does not give:
 *
 *  1. **No test may hang.** `--test-timeout` turns a spin into a named failing test.
 *     Overnight, with many agents, a hang is worse than a failure: a failure is
 *     information, a hang is silence.
 *  2. **The suite has a published wall-clock budget** (04-architecture §9 risk 5).
 *     Over `BUDGET_MS` the run fails even if every assertion passed, because a slow
 *     suite is the failure mode where agents quietly stop running it.
 *  3. **The gates cannot be bypassed.** Purity and typecheck run here rather than
 *     only in `pretest`, so `node tools/run-tests.mjs` and `npm test` are the same
 *     thing. They were a `pretest` hook, and running the runner directly skipped
 *     them — which is how type errors reached a commit.
 */

import { spawn, spawnSync } from 'node:child_process';

/**
 * Fail before spending time on tests; a broken boundary invalidates the run anyway.
 * @param {string} name
 * @param {string[]} argv
 */
function gate(name, argv) {
  const r = spawnSync(process.execPath, argv, { stdio: 'inherit' });
  if (r.status !== 0) {
    process.stderr.write(`\nrun-tests: ${name} failed — fix it before the suite means anything\n`);
    process.exit(r.status ?? 1);
  }
}

if (!process.env.PINLIGHT_SKIP_GATES) {
  gate('purity check', ['tools/check-purity.mjs']);
  gate('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', '.']);
}

/**
 * Per-test ceiling. It is a hang detector, not a speed limit — the suite's own
 * 30s budget is the speed limit, and it is the one that catches a slow suite.
 *
 * 20s rather than 15s because two of the tests here boot a real browser and one of
 * them renders eight bars of music inside it: on four cores, with the whole game's
 * playthrough running alongside, that legitimately costs 12-14s, and a ceiling that
 * close to the honest cost turns a busy machine into a red build. A hang is minutes,
 * not seconds, so nothing that this ceiling exists to catch escapes through the gap.
 */
const TEST_TIMEOUT_MS = 20000;
/** Whole-suite ceiling, from AGENTS.md rule 6 ("if it takes more than 30, that is itself a bug"). */
const BUDGET_MS = 30000;
/** Explicit, so `test/harness/*.js` is not mistaken for a test file. */
const TEST_GLOB = 'test/**/*.test.js';

const started = process.hrtime.bigint();
const child = spawn(
  process.execPath,
  [
    '--test',
    `--test-timeout=${TEST_TIMEOUT_MS}`,
    // Belt and braces: a leaked handle (a listening socket, a browser) must cost
    // zero seconds, not four minutes. --test-timeout only bounds a test *body*.
    '--test-force-exit',
    ...process.argv.slice(2),
    TEST_GLOB,
  ],
  { stdio: 'inherit' },
);

/** Belt and braces: if the runner itself wedges, kill it rather than hang the night. */
const killer = setTimeout(() => {
  process.stderr.write(`\nrun-tests: no result after ${BUDGET_MS * 2}ms — killing the runner\n`);
  child.kill('SIGKILL');
}, BUDGET_MS * 2);
killer.unref();

child.on('exit', (code, signal) => {
  clearTimeout(killer);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  process.stdout.write(`\nsuite wall clock: ${(ms / 1000).toFixed(1)}s (budget ${(BUDGET_MS / 1000).toFixed(0)}s)\n`);
  if (code !== 0 || signal) {
    process.exit(code ?? 1);
  }
  if (ms > BUDGET_MS) {
    process.stderr.write(`run-tests: suite took ${(ms / 1000).toFixed(1)}s, over the ${(BUDGET_MS / 1000).toFixed(0)}s budget — see AGENTS.md rule 6\n`);
    process.exit(1);
  }
  process.exit(0);
});
