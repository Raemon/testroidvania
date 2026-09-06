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
 */

import { spawn } from 'node:child_process';

/** Per-test ceiling. Anything legitimately slower than this is a bug. */
const TEST_TIMEOUT_MS = 15000;
/** Whole-suite ceiling, from AGENTS.md rule 6 ("if it takes more than 30, that is itself a bug"). */
const BUDGET_MS = 30000;
/** Explicit, so `test/harness/*.js` is not mistaken for a test file. */
const TEST_GLOB = 'test/**/*.test.js';

const started = process.hrtime.bigint();
const child = spawn(
  process.execPath,
  ['--test', `--test-timeout=${TEST_TIMEOUT_MS}`, ...process.argv.slice(2), TEST_GLOB],
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
