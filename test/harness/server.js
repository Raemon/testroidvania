/**
 * A zero-dependency static server on an ephemeral port. ES modules will not load
 * over `file://`, and a bundler is banned, so this is the whole build system.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

/** @type {Record<string, string>} */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

/** @returns {Promise<{ origin: string, close: () => Promise<void> }>} */
export async function startServer() {
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const rel = normalize(decodeURIComponent(path === '/' ? '/index.html' : path)).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, rel);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    readFile(file).then(
      (body) => res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body),
      () => res.writeHead(404).end('not found'),
    );
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', () => done(undefined)));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((done) => server.close(() => done(undefined))),
  };
}
