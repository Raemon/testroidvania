// Assemble _site/ for GitHub Pages: the current game at /latest/, every frozen
// snapshot at /vN/, and a chooser page at the root.

import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readManifest, VERSIONS_DIR, GAME_PAYLOAD } from './version-store.mjs';

const OUT = '_site';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const manifest = readManifest();

mkdirSync(join(OUT, 'latest'), { recursive: true });
for (const entry of GAME_PAYLOAD) {
  if (existsSync(entry)) cpSync(entry, join(OUT, 'latest', entry), { recursive: true });
}

for (const v of manifest.versions) {
  const from = join(VERSIONS_DIR, v.id);
  if (existsSync(from)) cpSync(from, join(OUT, v.id), { recursive: true });
}

/** @type {Record<string, string>} */
const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** @param {unknown} s */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => HTML_ENTITIES[c] ?? c);

/**
 * @param {{href:string,label:string,title:string,meta:string,notes:string[],live:boolean}} v
 */
const card = ({ href, label, title, meta, notes, live }) => `
      <a class="card${live ? ' live' : ''}" href="${href}">
        <div class="tag">${esc(label)}</div>
        <h2>${esc(title)}</h2>
        <div class="meta">${esc(meta)}</div>
        ${notes.length ? `<ul>${notes.map((/** @type {string} */ n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
        <div class="go">Play &rarr;</div>
      </a>`;

const cards = [
  card({
    href: 'latest/index.html',
    label: 'in development',
    title: 'Latest',
    meta: 'The working copy — changes as the build continues',
    notes: [],
    live: true,
  }),
  ...[...manifest.versions].reverse().map((v) =>
    card({
      href: `${v.id}/index.html`,
      label: v.id,
      title: v.title,
      meta: `${v.date} · ${v.commit}`,
      notes: v.notes ?? [],
      live: false,
    }),
  ),
].join('\n');

writeFileSync(
  join(OUT, 'index.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PINLIGHT — versions</title>
<style>
  :root {
    --ink: #0B0D12; --ink2: #12161C; --line: #252D38;
    --cream: #F3E9D2; --dim: #9C8F78; --flame: #FFB347; --accent: #5FE3D0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 24px 80px;
    background:
      radial-gradient(900px 500px at 50% -10%, #1A2029 0%, transparent 70%),
      var(--ink);
    color: var(--cream);
    font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    min-height: 100vh;
  }
  header { max-width: 880px; margin: 0 auto 40px; }
  h1 {
    margin: 0 0 8px; font-size: 40px; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase;
  }
  .flame { color: var(--flame); }
  .sub { color: var(--dim); max-width: 60ch; margin: 0; }
  main {
    max-width: 880px; margin: 0 auto;
    display: grid; gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
  .card {
    display: block; padding: 20px; text-decoration: none; color: inherit;
    background: var(--ink2); border: 1px solid var(--line); border-radius: 10px;
    transition: border-color .15s, transform .15s, background .15s;
  }
  .card:hover { border-color: var(--flame); transform: translateY(-2px); background: #161B23; }
  .card.live { border-color: #3A4553; }
  .card.live:hover { border-color: var(--accent); }
  .tag {
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--dim); margin-bottom: 10px;
  }
  .card.live .tag { color: var(--accent); }
  h2 { margin: 0 0 4px; font-size: 19px; font-weight: 600; }
  .meta { color: var(--dim); font-size: 13px; }
  ul { margin: 12px 0 0; padding-left: 18px; color: var(--dim); font-size: 13px; }
  li { margin-bottom: 3px; }
  .go { margin-top: 16px; font-size: 13px; color: var(--flame); }
  .card.live .go { color: var(--accent); }
  footer {
    max-width: 880px; margin: 48px auto 0; padding-top: 20px;
    border-top: 1px solid var(--line); color: var(--dim); font-size: 13px;
  }
  a.plain { color: var(--accent); }
</style>
</head>
<body>
  <header>
    <h1>Pin<span class="flame">light</span></h1>
    <p class="sub">
      A metroidvania in the dark. Your only weapon is also your only light: an iron
      Pin you throw, which stays wherever it lands. Each card below is a frozen,
      still-playable version — newest first.
    </p>
  </header>
  <main>
${cards}
  </main>
  <footer>
    Arrow keys or WASD to move, Z to jump, X to jab, C to throw and recall the Pin.
    &nbsp;·&nbsp;
    <a class="plain" href="https://github.com/Raemon/testroidvania">Source</a>
  </footer>
</body>
</html>
`,
);

console.log(`built ${OUT}/ with latest + ${manifest.versions.length} frozen version(s)`);
