/**
 * The runtime half of the purity boundary (04-architecture §1, layer 2). Imported
 * *before* core in every Node test, it replaces the nondeterministic globals with
 * throwing stubs, catching the indirect reaches the static scanner cannot see —
 * an aliased `const r = Math.random`, a helper called through a registry, a
 * dependency of a dependency.
 *
 * Import for the side effect: `import './harness/trap.js';`
 */

/** @param {string} name @param {string} fix @returns {string} */
const message = (name, fix) => `${name} is banned in the sim (use ${fix}) — see AGENTS.md rule 1`;

Math.random = () => {
  throw new Error(message('Math.random()', 'state.rng via nextFloat()'));
};

const RealDate = Date;
Date.now = () => {
  throw new Error(message('Date.now()', 'state.tick'));
};

globalThis.Date = /** @type {DateConstructor} */ (/** @type {unknown} */ (new Proxy(RealDate, {
  construct(target, args) {
    if (args.length === 0) throw new Error(message('new Date()', 'state.tick'));
    return Reflect.construct(target, args);
  },
})));

if (typeof globalThis.performance === 'object' && globalThis.performance) {
  globalThis.performance.now = () => {
    throw new Error(message('performance.now()', 'state.tick'));
  };
}

/** Restores the real globals, for the few places a test legitimately needs a clock. */
export function untrap() {
  globalThis.Date = RealDate;
}

/** A monotonic timer the tests may use; the trap does not touch it. */
export const now = () => Number(process.hrtime.bigint() / 1000000n);
