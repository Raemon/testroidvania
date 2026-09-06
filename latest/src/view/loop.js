/**
 * The rAF driver.
 *
 * Two modes:
 *  - normal: a fixed-timestep accumulator. Real time is smoothed here and nowhere
 *    else, so `step()` never sees a `dt`.
 *  - lockstep (`?lockstep=1`): each rAF callback performs exactly one `step()`.
 *    This is what the test harness runs, and it is the reason the browser and Node
 *    produce identical hashes for the same input tape — with the accumulator, the
 *    `Math.min(ts - last, MAX_FRAME_MS)` clamp makes the step count drift.
 */

const STEP_MS = 1000 / 60;
/** A tab that was backgrounded must not try to catch up on minutes of frames. */
const MAX_FRAME_MS = 250;

/**
 * @typedef {object} LoopOptions
 * @property {() => void} onStep    advance the sim exactly one frame
 * @property {() => void} onRender  draw the current state
 * @property {boolean} lockstep
 */

/**
 * @param {LoopOptions} options
 * @returns {{ start: () => void, stop: () => void, steps: () => number, tickOnce: () => void }}
 */
export function createLoop(options) {
  let running = false;
  let handle = 0;
  let last = 0;
  let accumulator = 0;
  let steps = 0;

  /** @param {number} ts */
  function frame(ts) {
    if (!running) return;
    handle = requestAnimationFrame(frame);
    if (options.lockstep) {
      options.onStep();
      steps++;
    } else {
      const delta = last === 0 ? STEP_MS : Math.min(ts - last, MAX_FRAME_MS);
      last = ts;
      accumulator += delta;
      while (accumulator >= STEP_MS) {
        accumulator -= STEP_MS;
        options.onStep();
        steps++;
      }
    }
    options.onRender();
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      accumulator = 0;
      handle = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (handle) cancelAnimationFrame(handle);
      handle = 0;
    },
    steps: () => steps,
    /** Advance one frame outside the rAF driver, for `__HARNESS__.frame()`. */
    tickOnce() {
      options.onStep();
      steps++;
      options.onRender();
    },
  };
}
