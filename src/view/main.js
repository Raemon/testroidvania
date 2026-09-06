/**
 * Bootstrap. Builds the state, wires an input source into the loop, and publishes
 * `window.__HARNESS__` — the frame-level API from 04-architecture §4a.
 *
 * The harness drives the *same* loop, `step()` and renderer a human plays with.
 * There is no test-only code path in the game; `?bot=1` swaps the input source and
 * nothing else.
 *
 * URL parameters: `seed`, `debug=1`, `lockstep=1`, `bot=1`, `room=<id>`.
 */

import { createInitialState } from '../core/state.js';
import { step } from '../core/step.js';
import { hash } from '../core/hash.js';
import { snapshot, restore } from '../core/save.js';
import { check } from '../core/invariants.js';
import { observe } from '../bot/api.js';
import { createLoop } from './loop.js';
import { keyboardSource, botSource, replaySource, manualSource } from './input-source.js';
import { createHud, HUD_FIELDS } from './hud.js';
import { createCamera, updateCamera } from './render/camera.js';
import { render, viewTransform } from './render/index.js';
import { guardContext } from './debug/ctxGuard.js';

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('./input-source.js').InputSource} InputSource */

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 1) || 1;
const debug = params.get('debug') === '1';
const lockstep = params.get('lockstep') === '1';
const useBot = params.get('bot') === '1';
const startRoom = params.get('room') ?? undefined;

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('[data-testid="canvas"]'));
const raw = canvas.getContext('2d', { alpha: false });
if (!raw) throw new Error('main: 2d context unavailable');

const guard = debug ? guardContext(raw) : null;
const ctx = guard ? guard.ctx : raw;

let state = createInitialState(seed, startRoom);
state = { ...state, debug };
let camera = createCamera(state);
const updateHud = createHud(document);

const manual = manualSource();
const bot = botSource();
const keyboard = keyboardSource(window);
/** @type {InputSource} */
let source = useBot ? bot : keyboard;
/** @type {import('../core/types.js').Violation[]} */
let violations = [];
/** @type {number[]} */
let recorded = [];
let recording = false;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}
resize();
window.addEventListener('resize', resize);

function onStep() {
  const input = source.read(state);
  const prev = state;
  state = step(state, input);
  if (recording) recorded.push(input);
  if (state.debug) {
    const found = check(prev, state, input);
    if (found.length) violations = violations.concat(found).slice(0, 32);
  }
  camera = updateCamera(camera, state);
}

function onRender() {
  render(ctx, state, camera, { width: canvas.width, height: canvas.height });
  updateHud(state);
  if (guard) guard.endFrame();
}

const loop = createLoop({ onStep, onRender, lockstep });
onRender();
loop.start();

/**
 * Advance `n` frames. Under the test harness's turbo rAF pump this drives the real
 * rAF callback, so `frame()` and free-running play are the same code path; without
 * the pump (a human at a breakpoint) it falls back to stepping the loop directly.
 * @param {number} n
 */
function advance(n) {
  const pump = /** @type {{ __PUMP__?: (count: number) => void }} */ (globalThis).__PUMP__;
  if (pump) pump(n);
  else for (let i = 0; i < n; i++) loop.tickOnce();
}

/**
 * The frame-level harness API. Everything here is JSON-safe on the way out, so it
 * crosses `page.evaluate` unchanged.
 */
const harness = {
  /** @param {number} bits */
  setInput(bits) {
    source = manual;
    manual.set(bits);
  },
  useBot() { source = bot; },
  useKeyboard() { source = keyboard; },
  /** @param {ArrayLike<number>} tape */
  playTape(tape) {
    source = replaySource(tape);
    advance(tape.length);
    return state.tick;
  },
  /** @param {number} n */
  frame(n = 1) {
    advance(n);
    return state.tick;
  },
  /** @param {number} tick */
  recordFrom(tick) {
    recording = state.tick >= tick;
    recorded = [];
    return recording;
  },
  tape: () => recorded.slice(),
  hash: () => hash(state),
  snapshot: () => snapshot(state),
  /** @param {string} s */
  restore(s) {
    state = restore(s);
    camera = createCamera(state);
    return state.tick;
  },
  room: () => state.room,
  tick: () => state.tick,
  /** The full state, JSON-safe (room data is looked up, not serialized). */
  state: () => JSON.parse(snapshot(state)).state,
  observe: () => {
    const o = observe(state);
    const { solidAt, oneWayAt, ...plain } = o;
    return plain;
  },
  violations: () => violations.slice(),
  clearViolations() { violations = []; },
  errors: () => state.errors.slice(),
  botDone: () => bot.done(),
  botStuck: () => bot.stuck(),
  drawStats: () => (guard ? { ...guard.stats } : null),
  hudFieldIds: () => HUD_FIELDS.map(([id]) => id),
  /** @returns {Record<string, string>} what the DOM currently shows */
  hud() {
    /** @type {Record<string, string>} */
    const out = {};
    for (const [id] of HUD_FIELDS) {
      out[id] = document.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
    }
    return out;
  },
  /** @returns {Record<string, string>} what the HUD *should* show for this state */
  hudExpected() {
    /** @type {Record<string, string>} */
    const out = {};
    for (const [id, read] of HUD_FIELDS) out[id] = read(state);
    return out;
  },
  canvasSize: () => ({ width: canvas.width, height: canvas.height }),
  camera: () => ({ ...camera }),
  /** Device-pixel position of the player's centre, for the "is it on screen" probe. */
  projectPlayer() {
    const t = viewTransform({ width: canvas.width, height: canvas.height });
    return {
      x: Math.round(t.offsetX + (state.player.x + state.player.w / 2 - Math.round(camera.x)) * t.scale),
      y: Math.round(t.offsetY + (state.player.y + state.player.h / 2 - Math.round(camera.y)) * t.scale),
    };
  },
  stop: () => loop.stop(),
};

/** @type {Window & { __HARNESS__?: typeof harness }} */ (window).__HARNESS__ = harness;
