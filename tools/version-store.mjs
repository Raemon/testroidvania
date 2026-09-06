import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {object} Version
 * @property {string} id     directory name, e.g. "v3"
 * @property {string} title  what changed in this pass
 * @property {string[]} notes
 * @property {string} commit short sha it was frozen at
 * @property {string} date   ISO date
 *
 * @typedef {{ versions: Version[] }} Manifest
 */

export const VERSIONS_DIR = 'versions';
export const MANIFEST = join(VERSIONS_DIR, 'versions.json');

/** Files that make up a self-contained playable copy of the game. */
export const GAME_PAYLOAD = ['index.html', 'src'];

/** @returns {Manifest} */
export function readManifest() {
  if (!existsSync(MANIFEST)) return { versions: [] };
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

/** @param {Manifest} manifest */
export function writeManifest(manifest) {
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}
