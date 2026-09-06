// Freeze the current working game into versions/vN/ so it stays playable
// forever while development continues on the copy at the repo root.
//
//   node tools/snapshot-version.mjs "Title of this pass" "note" "note" ...

import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readManifest, writeManifest, VERSIONS_DIR, GAME_PAYLOAD } from './version-store.mjs';

const [title, ...notes] = process.argv.slice(2);
if (!title) {
  console.error('usage: node tools/snapshot-version.mjs "<title>" [note ...]');
  process.exit(1);
}

const manifest = readManifest();
const id = `v${manifest.versions.length + 1}`;
const dest = join(VERSIONS_DIR, id);

for (const entry of GAME_PAYLOAD) {
  if (!existsSync(entry)) {
    console.error(`missing ${entry} — run from the repo root`);
    process.exit(1);
  }
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const entry of GAME_PAYLOAD) {
  cpSync(entry, join(dest, entry), { recursive: true });
}

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

manifest.versions.push({
  id,
  title,
  notes,
  commit,
  date: new Date().toISOString().slice(0, 10),
});
writeManifest(manifest);

console.log(`froze ${id} (${title}) at ${commit} -> ${dest}`);
