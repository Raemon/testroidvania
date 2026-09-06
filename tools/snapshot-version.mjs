// Freeze the current working game into versions/vN/ so it stays playable
// forever while development continues on the copy at the repo root.
//
//   node tools/snapshot-version.mjs "Title of this pass" "note" "note" ...

import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readManifest, writeManifest, VERSIONS_DIR, GAME_PAYLOAD } from './version-store.mjs';

// --from <ref> freezes a known-good commit instead of the working tree. Agents
// run continuously here, so the tree is rarely quiescent enough to snapshot.
const argv = process.argv.slice(2);
let ref = 'HEAD';
const fromAt = argv.indexOf('--from');
if (fromAt !== -1) {
  ref = argv[fromAt + 1] ?? 'HEAD';
  argv.splice(fromAt, 2);
}
const [title, ...notes] = argv;
if (!title) {
  console.error('usage: node tools/snapshot-version.mjs [--from <ref>] "<title>" [note ...]');
  process.exit(1);
}

const manifest = readManifest();
const id = `v${manifest.versions.length + 1}`;
const dest = join(VERSIONS_DIR, id);

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

if (ref === 'HEAD' && fromAt === -1) {
  for (const entry of GAME_PAYLOAD) {
    if (!existsSync(entry)) {
      console.error(`missing ${entry} — run from the repo root`);
      process.exit(1);
    }
    cpSync(entry, join(dest, entry), { recursive: true });
  }
} else {
  // git archive reads straight from the object store, so a working tree that
  // other agents are actively editing cannot leak into the frozen copy.
  execFileSync('sh', ['-c',
    `git archive ${ref} ${GAME_PAYLOAD.join(' ')} | tar -x -C ${dest}`], { stdio: 'inherit' });
}

const commit = execFileSync('git', ['rev-parse', '--short', ref], { encoding: 'utf8' }).trim();

manifest.versions.push({
  id,
  title,
  notes,
  commit,
  date: new Date().toISOString().slice(0, 10),
});
writeManifest(manifest);

console.log(`froze ${id} (${title}) at ${commit} -> ${dest}`);
