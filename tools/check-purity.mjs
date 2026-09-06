#!/usr/bin/env node
// Enforces R1/R2 from docs/design/04-architecture.md §1: src/core and src/content
// are pure. Static scan only — see test/harness/trap.js for the runtime layer.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Roots that are checked, and that are also the only roots they may import from. */
const PURE_ROOTS = ['src/core', 'src/content'];

/** identifier pattern -> the sanctioned replacement named in the error. */
const BANNED = [
  ['Math.random', 'state.rng via nextFloat()'],
  ['Date.now', 'state.tick'],
  ['new Date', 'state.tick'],
  ['Date.parse', 'state.tick'],
  ['performance.now', 'state.tick'],
  ['performance', 'state.tick'],
  ['document', 'nothing — core is DOM-free'],
  ['window', 'nothing — core is DOM-free'],
  ['globalThis', 'nothing — core is DOM-free'],
  ['navigator', 'nothing — core is DOM-free'],
  ['localStorage', 'save.js'],
  ['sessionStorage', 'save.js'],
  ['requestAnimationFrame', 'view/loop.js'],
  ['cancelAnimationFrame', 'view/loop.js'],
  ['setTimeout', 'state.tick'],
  ['setInterval', 'state.tick'],
  ['queueMicrotask', 'nothing — core is synchronous'],
  ['fetch', 'a static import'],
  ['XMLHttpRequest', 'a static import'],
  ['AudioContext', 'view/audio.js'],
  ['console', 'state.errors'],
  ['process', 'nothing — core runs in the browser too'],
  ['require', 'a static ESM import'],
];

const BANNED_RE = BANNED.map(([name = '', fix = '']) => ({
  name,
  fix,
  // Not preceded by `.` or an identifier char, so `state.window` and `myconsole` are fine.
  re: new RegExp(`(?<![\\w$.])${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?![\\w$])`),
}));

/**
 * Blank out comments and string/template/regex literals so their contents never
 * trip the scanner, while preserving line structure for accurate line numbers.
 * @param {string} src
 * @returns {string}
 */
export function stripCommentsAndStrings(src) {
  const out = src.split('');
  const n = src.length;
  let i = 0;
  /** @param {number} from @param {number} to */
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  /** Rough JS lexer state: after these, a `/` starts a regex, not a division. */
  let prevSignificant = '';
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && c2 === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      blank(i + 1, j);
      i = Math.min(j + 1, n);
      prevSignificant = 'x';
      continue;
    }
    if (c === '/' && !/[\w$)\]]/.test(prevSignificant)) {
      // Regex literal.
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
        j++;
      }
      if (j < n && src[j] === '/') {
        blank(i + 1, j);
        i = j + 1;
        prevSignificant = 'x';
        continue;
      }
    }
    if (!/\s/.test(/** @type {string} */ (c))) prevSignificant = /** @type {string} */ (c);
    i++;
  }
  return out.join('');
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const found = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return found; }
  for (const name of entries.sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...walk(p));
    else if (name.endsWith('.js')) found.push(p);
  }
  return found;
}

/** @returns {string[]} human-readable violations */
export function checkPurity() {
  /** @type {string[]} */
  const violations = [];
  for (const root of PURE_ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      const rel = relative(ROOT, file).replaceAll('\\', '/');
      const lines = stripCommentsAndStrings(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, idx) => {
        for (const { name, fix, re } of BANNED_RE) {
          if (re.test(line)) violations.push(`${rel}:${idx + 1}  banned: ${name} (use ${fix})`);
        }
      });

      // Imports: comments/strings are blanked above, so re-read the raw source
      // for specifiers but use the stripped copy to locate real import statements.
      const raw = readFileSync(file, 'utf8').split('\n');
      lines.forEach((stripped, idx) => {
        if (!/\b(?:import|export)\b/.test(stripped) || !/\bfrom\b|^\s*import\s*['"]/.test(stripped)) return;
        const m = /from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/.exec(raw[idx] ?? '');
        const spec = m?.[1] ?? m?.[2];
        if (!spec) return;
        const where = `${rel}:${idx + 1}`;
        if (!spec.startsWith('.')) {
          violations.push(`${where}  banned: import '${spec}' (use a relative import inside ${PURE_ROOTS.join(' or ')})`);
          return;
        }
        const target = relative(ROOT, resolve(dirname(file), spec)).replaceAll('\\', '/');
        if (!PURE_ROOTS.some((r) => target === r || target.startsWith(r + '/'))) {
          violations.push(`${where}  banned: import '${spec}' escapes to '${target}' (use ${PURE_ROOTS.join(' or ')})`);
        }
      });
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = checkPurity();
  for (const v of violations) process.stderr.write(v + '\n');
  if (violations.length) {
    process.stderr.write(`\ncheck-purity: ${violations.length} violation(s) — see AGENTS.md rule 1\n`);
    process.exit(1);
  }
  process.stdout.write('check-purity: clean\n');
}
