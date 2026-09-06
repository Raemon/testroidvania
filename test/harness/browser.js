/**
 * The browser harness: a static server, a Chromium page with rAF replaced by a
 * synchronous pump, and every browser-layer failure wired to fail the Node test.
 *
 * The load-bearing idea (04-architecture §5) is that the harness *is* the clock.
 * Nothing waits on real time, so there is no race between the test and the page,
 * and 216,000 frames of the real loop cost a couple of seconds.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { startServer } from './server.js';

const ARTIFACTS = join(import.meta.dirname, '../../artifacts/failure');

/** Boot must succeed inside this, or the failure is reported rather than waited on. */
const BOOT_TIMEOUT_MS = 8000;

/**
 * Replaces rAF before any page script runs. Errors thrown inside a frame callback
 * are annotated with the frame number and room, then re-thrown so they surface in
 * Node with the page's own stack trace.
 */
function installPump() {
  /** @type {((t: number) => void)[]} */
  let callbacks = [];
  let virtualTime = 0;
  let frame = 0;

  // @ts-ignore - deliberately replacing the platform's rAF
  globalThis.requestAnimationFrame = (/** @type {(t:number)=>void} */ cb) => callbacks.push(cb);
  // @ts-ignore
  globalThis.cancelAnimationFrame = () => {};
  Object.assign(globalThis, {
    __FRAME__: () => frame,
    __PUMP__: (/** @type {number} */ n) => {
      for (let i = 0; i < n; i++) {
        virtualTime += 1000 / 60;
        frame++;
        const due = callbacks;
        callbacks = [];
        for (const cb of due) {
          try {
            cb(virtualTime);
          } catch (e) {
            const room = /** @type {any} */ (globalThis).__HARNESS__?.room() ?? '?';
            if (e instanceof Error) e.message = `[frame ${frame}, room ${room}] ${e.message}`;
            throw e;
          }
        }
      }
      return frame;
    },
  });

  globalThis.addEventListener('unhandledrejection', (ev) => {
    const reason = /** @type {PromiseRejectionEvent} */ (ev).reason;
    const detail = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
    console.error(`unhandledrejection: ${detail}`);
  });
}

/**
 * @typedef {object} Harness
 * @property {import('playwright').Page} page
 * @property {string[]} errors      console errors + page errors, in order
 * @property {(n: number) => Promise<number>} pump
 * @property {(predicate: string, options?: {batch?: number, maxFrames?: number, label?: string}) => Promise<number>} pumpUntil
 * @property {() => void} assertClean
 * @property {(method: string, ...args: unknown[]) => Promise<any>} call  invoke a `__HARNESS__` method
 * @property {() => Promise<PixelProbe>} probe
 * @property {() => Promise<void>} assertHudMatchesState
 * @property {(name: string) => Promise<void>} dumpFailure
 * @property {(path: string) => Promise<void>} screenshot
 * @property {() => Promise<void>} close
 */

/**
 * @typedef {object} PixelProbe
 * @property {number} nonBackground   fraction of sampled pixels that are not the modal colour
 * @property {number} distinctColors
 * @property {number} gridHash        hash of a 32x18 luminance grid
 * @property {boolean} playerVisible  the pixel at the player's projected centre is not background
 */

/**
 * @param {object} [options]
 * @param {string} [options.query] query string appended to the page URL
 * @returns {Promise<Harness>}
 */
export async function launchGame(options = {}) {
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 480, height: 300 }, deviceScaleFactor: 1 });
  await context.addInitScript(installPump);
  const page = await context.newPage();

  /** @type {string[]} */
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));

  // Everything here is bounded. A page that fails to boot must produce a named
  // error in a second or two, never a test that hangs until someone notices.
  context.setDefaultTimeout(BOOT_TIMEOUT_MS);
  const shutdown = async () => {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  };

  const query = options.query ?? 'seed=1&debug=1&lockstep=1';
  try {
    await page.goto(`${server.origin}/?${query}`, { waitUntil: 'load' });
    await page.waitForFunction(
      () => Boolean(/** @type {{__HARNESS__?: unknown}} */ (globalThis).__HARNESS__),
      undefined,
      { timeout: BOOT_TIMEOUT_MS },
    );
  } catch (bootFailure) {
    // Give the console/pageerror sinks a moment to deliver what actually broke.
    await page.waitForTimeout(100).catch(() => {});
    const detail = errors.length ? errors.join('\n') : String(bootFailure);
    await shutdown();
    throw new Error(`the game never published window.__HARNESS__ — it threw while loading:\n${detail}`);
  }

  /** @type {Harness} */
  const harness = {
    page,
    errors,

    async pump(n) {
      const frame = await page.evaluate((count) => /** @type {any} */ (globalThis).__PUMP__(count), n);
      harness.assertClean();
      const violations = await page.evaluate(() => /** @type {any} */ (globalThis).__HARNESS__.violations());
      if (violations.length) {
        const v = violations[0];
        throw new Error(`invariant ${v.code} at tick ${v.tick} in ${v.room}: ${v.detail}`);
      }
      return frame;
    },

    /**
     * Pump in batches until a `__HARNESS__` predicate method returns true. The
     * frame budget is mandatory: a browser test that waits on a condition which
     * never arrives must fail by name, never spin.
     */
    async pumpUntil(predicate, opts = {}) {
      const batch = opts.batch ?? 30;
      const maxFrames = opts.maxFrames ?? 3000;
      let pumped = 0;
      while (pumped < maxFrames) {
        if (await harness.call(predicate)) return pumped;
        await harness.pump(batch);
        pumped += batch;
      }
      const room = await harness.call('room');
      const tick = await harness.call('tick');
      throw new Error(`${opts.label ?? predicate}: not satisfied after ${maxFrames} frames (room ${room}, tick ${tick})`);
    },

    assertClean() {
      if (errors.length) throw new Error(`browser reported ${errors.length} error(s):\n${errors.join('\n')}`);
    },

    call(method, ...args) {
      return page.evaluate(([name, params]) => {
        const h = /** @type {any} */ (globalThis).__HARNESS__;
        return h[/** @type {string} */ (name)](.../** @type {unknown[]} */ (params));
      }, /** @type {[string, unknown[]]} */ ([method, args]));
    },

    probe() {
      return page.evaluate(() => {
        const h = /** @type {any} */ (globalThis).__HARNESS__;
        const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('[data-testid="canvas"]'));
        const c2d = canvas.getContext('2d');
        if (!c2d) throw new Error('probe: no 2d context');
        const { width, height } = canvas;
        const data = c2d.getImageData(0, 0, width, height).data;

        /** @type {Map<number, number>} */
        const counts = new Map();
        let sampled = 0;
        for (let y = 0; y < height; y += 4) {
          for (let x = 0; x < width; x += 4) {
            const i = (y * width + x) * 4;
            const key = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
            counts.set(key, (counts.get(key) ?? 0) + 1);
            sampled++;
          }
        }
        let modalCount = 0;
        for (const v of counts.values()) if (v > modalCount) modalCount = v;

        let gridHash = 0x811c9dc5;
        for (let gy = 0; gy < 18; gy++) {
          for (let gx = 0; gx < 32; gx++) {
            const x = Math.floor(((gx + 0.5) / 32) * width);
            const y = Math.floor(((gy + 0.5) / 18) * height);
            const i = (y * width + x) * 4;
            const lum = ((data[i] ?? 0) * 3 + (data[i + 1] ?? 0) * 6 + (data[i + 2] ?? 0)) >> 3;
            gridHash = Math.imul(gridHash ^ lum, 0x01000193);
          }
        }

        const at = h.projectPlayer();
        const bg = c2d.getImageData(1, 1, 1, 1).data;
        const px = at.x >= 0 && at.y >= 0 && at.x < width && at.y < height
          ? c2d.getImageData(at.x, at.y, 1, 1).data
          : new Uint8ClampedArray([0, 0, 0, 0]);
        const playerVisible = Math.abs((px[0] ?? 0) - (bg[0] ?? 0)) + Math.abs((px[1] ?? 0) - (bg[1] ?? 0)) + Math.abs((px[2] ?? 0) - (bg[2] ?? 0)) > 24;

        return {
          nonBackground: 1 - modalCount / sampled,
          distinctColors: counts.size,
          gridHash: gridHash >>> 0,
          playerVisible,
        };
      });
    },

    async assertHudMatchesState() {
      const { actual, expected, tick } = await page.evaluate(() => {
        const h = /** @type {any} */ (globalThis).__HARNESS__;
        return { actual: h.hud(), expected: h.hudExpected(), tick: h.tick() };
      });
      for (const key of Object.keys(expected)) {
        if (actual[key] !== expected[key]) {
          throw new Error(`HUD desync at tick ${tick}: ${key} shows ${JSON.stringify(actual[key])}, state says ${JSON.stringify(expected[key])}`);
        }
      }
    },

    async dumpFailure(name) {
      await mkdir(ARTIFACTS, { recursive: true });
      try {
        await page.screenshot({ path: join(ARTIFACTS, `${name}.png`) });
        const dump = await page.evaluate(() => {
          const h = /** @type {any} */ (globalThis).__HARNESS__;
          return { snapshot: h.snapshot(), tape: h.tape().slice(-600), violations: h.violations(), errors: h.errors() };
        });
        await writeFile(join(ARTIFACTS, `${name}.json`), JSON.stringify(dump, null, 2));
      } catch {
        // A dump is a courtesy; never let it mask the real failure.
      }
    },

    /**
     * A picture of the canvas as it stands, for a human to look at. Separate from
     * `dumpFailure` because the interesting frames of a run are not only its
     * failures — the finale has to be *seen* to be reviewed.
     * @param {string} path
     */
    async screenshot(path) {
      await mkdir(dirname(path), { recursive: true });
      await page.screenshot({ path });
    },

    close: shutdown,
  };

  return harness;
}
