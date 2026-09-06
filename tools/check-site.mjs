// Boot every page in _site/ in a real browser and fail on any console or page
// error. The site is what people actually load, so "it built" is not enough —
// a broken working copy must never replace a working deploy.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = '_site';
/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const [urlPath = '/'] = (req.url || '/').split('?');
    let p = normalize(decodeURI(urlPath)).replace(/^(\.\.[/\\])+/, '');
    if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, () => resolve(undefined)));
const { port } = /** @type {{port:number}} */ (server.address());

const entries = await readdir(ROOT, { withFileTypes: true });
const games = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
const pages = ['/', ...games.map((g) => `/${g}/`)];

const browser = await chromium.launch();
/** @type {string[]} */
const failures = [];

try {
  for (const path of pages) {
    const page = await browser.newPage();
    /** @type {string[]} */
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    try {
      await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'load', timeout: 20000 });
      // The chooser is static; a game page must reach a live harness.
      if (path !== '/') {
        await page.waitForFunction(() => !!(/** @type {any} */ (window).__HARNESS__), { timeout: 15000 })
          .catch(() => errors.push('__HARNESS__ never appeared — the game did not boot'));
      }
    } catch (e) {
      errors.push(`navigation: ${/** @type {Error} */ (e).message}`);
    }
    await page.close();
    if (errors.length) failures.push(`${path}\n    ${errors.join('\n    ')}`);
    console.log(`${errors.length ? 'FAIL' : 'ok  '}  ${path}`);
  }
} finally {
  await browser.close();
  server.closeAllConnections?.();
  server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} page(s) failed to boot:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log(`\nall ${pages.length} pages booted cleanly`);
