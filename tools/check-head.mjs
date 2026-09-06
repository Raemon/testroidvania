// Run the suite against a clean export of a commit, ignoring the working tree.
//
// With several agents editing at once, "npm test is red" is ambiguous: it may be
// the commit that is broken or just the half-finished edits on disk. This answers
// the first question, so an agent can tell "HEAD is broken, not me" without
// stashing anyone's work.
//
//   node tools/check-head.mjs [ref]     (default: HEAD)

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ref = process.argv[2] ?? 'HEAD';
const repo = process.cwd();
const sha = execFileSync('git', ['rev-parse', '--short', ref], { encoding: 'utf8' }).trim();
const subject = execFileSync('git', ['log', '-1', '--format=%s', ref], { encoding: 'utf8' }).trim();

const dir = mkdtempSync(join(tmpdir(), 'pinlight-head-'));
try {
  execFileSync('sh', ['-c', `git archive ${ref} | tar -x -C ${dir}`], { cwd: repo });
  // Reuse the installed dependencies rather than paying for npm ci.
  const modules = join(repo, 'node_modules');
  if (existsSync(modules)) symlinkSync(modules, join(dir, 'node_modules'), 'dir');

  console.log(`checking ${sha} — ${subject}\n`);
  const r = spawnSync(process.execPath, [join(dir, 'tools', 'run-tests.mjs')], {
    cwd: dir,
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers' },
  });
  console.log(`\n${r.status === 0 ? 'GREEN' : 'RED'}  ${sha}  ${subject}`);
  process.exit(r.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
