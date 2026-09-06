/**
 * A Proxy over CanvasRenderingContext2D that turns silent render bugs into loud
 * ones. Enabled by `?debug=1`, which the tests always pass.
 *
 * This is the highest-value browser-layer check in the project: `ctx.fillRect(NaN,
 * 0, 10, 10)` draws nothing and throws nothing, so an invisible player caused by a
 * NaN in the camera or the transform is invisible to logic tests, to the console
 * listener, and to a pixel probe that only asks "is the screen blank". Here it is
 * a thrown TypeError naming the method and the argument index, which the turbo
 * pump re-throws out of `page.evaluate` with a real stack trace.
 */

/** Draw-call budget per frame (04-architecture §6 rule 21). */
export const MAX_CALLS_PER_FRAME = 5000;

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)$/;

/** Properties whose value must be a usable colour or gradient. */
const COLOR_PROPS = new Set(['fillStyle', 'strokeStyle', 'shadowColor']);

/** Properties whose value must be a finite number. */
const NUMERIC_PROPS = new Set(['globalAlpha', 'lineWidth', 'lineDashOffset', 'miterLimit', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY']);

/**
 * @typedef {object} GuardStats
 * @property {number} calls        draw calls in the current frame
 * @property {number} peakCalls    the busiest frame so far
 * @property {number} frames
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @returns {{ ctx: CanvasRenderingContext2D, stats: GuardStats, endFrame: () => void }}
 */
export function guardContext(ctx) {
  /** @type {GuardStats} */
  const stats = { calls: 0, peakCalls: 0, frames: 0 };

  const proxy = new Proxy(ctx, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      const name = String(prop);
      return (/** @type {unknown[]} */ ...args) => {
        for (let i = 0; i < args.length; i++) {
          const a = args[i];
          if (typeof a === 'number' && !Number.isFinite(a)) {
            throw new TypeError(`ctxGuard: ${name}() argument ${i} is ${a} (args: ${describe(args)})`);
          }
        }
        stats.calls++;
        if (stats.calls > MAX_CALLS_PER_FRAME) {
          throw new RangeError(`ctxGuard: over ${MAX_CALLS_PER_FRAME} draw calls in one frame (at ${name}())`);
        }
        return Reflect.apply(/** @type {Function} */ (value), target, args);
      };
    },
    set(target, prop, value) {
      const name = String(prop);
      if (COLOR_PROPS.has(name) && typeof value === 'string' && !COLOR_RE.test(value.trim())) {
        throw new TypeError(`ctxGuard: ${name} set to invalid colour ${JSON.stringify(value)}`);
      }
      if (COLOR_PROPS.has(name) && typeof value === 'number') {
        throw new TypeError(`ctxGuard: ${name} set to a number (${value}), not a colour`);
      }
      if (NUMERIC_PROPS.has(name) && !Number.isFinite(Number(value))) {
        throw new TypeError(`ctxGuard: ${name} set to ${String(value)}`);
      }
      return Reflect.set(target, prop, value);
    },
  });

  return {
    ctx: /** @type {CanvasRenderingContext2D} */ (proxy),
    stats,
    endFrame() {
      stats.peakCalls = Math.max(stats.peakCalls, stats.calls);
      stats.frames++;
      stats.calls = 0;
    },
  };
}

/** @param {unknown[]} args @returns {string} */
function describe(args) {
  return args.map((a) => (typeof a === 'object' && a !== null ? '[obj]' : String(a))).join(', ');
}
