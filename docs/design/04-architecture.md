# Testability & Code Architecture

## 0. The load-bearing result

Environment verified with working probes:

| Probe | Result |
|---|---|
| Node / npm | v22.22.2 / 10.9.7, registry reachable, `npm i playwright@1.56.1` succeeds in 2s |
| Playwright | 1.56.1 already global; `chromium.launch()` works, no `playwright install` needed |
| **216,000 frames (60 min @60fps) of real prod loop + canvas render + HUD DOM in headless Chromium** | **2.34 s** |
| 216,000 sim-only steps in bare Node | 15-33 ms (~7-14M steps/s) |
| Chromium launch (warm) / screenshot | 184 ms / 188 ms |
| WebAudio headless | `AudioContext.state === "running"`, oscillators work |
| `tsc --checkJs` on JSDoc'd plain `.js` | catches `s.player.hpp`, `s.playr` — full type safety, zero build |
| Node native TS strip | works for `.ts` in Node, but **browsers can't load `.ts`** — decisive |
| Purity checker prototype | caught `Math.random`, `Date.now`, cross-boundary import in <100 ms |
| Negative test (injected `drawImage(null)` + bad DOM id at frame 500) | **threw out of `page.evaluate` into Node with `render_buggy.js:3:20`** |

That last row is the thesis: a browser-layer render bug became a Node test failure with exact file:line, in under 3 seconds.

A full 60-minute playthrough, rendered by the real production game loop in real Chromium, costs **~2.3 seconds**. There is therefore no reason to ever ship a "logic-only" playthrough test. **Every playthrough test runs in the browser, with pixels.**

---

## 1. Module layout

```
testroidvania/
|- package.json                 # type:module, scripts, devDeps: playwright only
|- tsconfig.json                # checkJs+strict, noEmit — type checking, never a build
|- index.html                   # the game; loads /src/view/main.js as type=module. No bundler.
|- AGENTS.md                    # ownership map + the rules (see section 9)
|
|- src/core/                    # == PURE == no DOM, no canvas, no Date.now, no Math.random
|  |- types.js                  # JSDoc @typedef for GameState + every entity shape.
|  |- state.js                  # createInitialState(seed, world) -> GameState
|  |- step.js                   # THE contract: step(state, input) -> newState.
|  |- input.js                  # InputBits enum, encode/decode, edge detection
|  |- rng.js                    # mulberry32; pure (seed)->[float,newSeed]. Seed lives in state.
|  |- physics.js                # gravity, accel, friction, terminal velocity
|  |- collision.js              # AABB vs tilemap sweep; the one place "solid" is decided
|  |- player.js                 # player state machine
|  |- abilities/                # one file per ability — agents never collide here
|  |  |- index.js               # ABILITIES registry (one line per ability)
|  |- entities/
|  |  |- index.js               # ENTITY_KINDS registry; kind -> {spawn, update, onHit}
|  |- bosses/
|  |  |- index.js               # BOSSES registry
|  |- combat.js                 # damage, i-frames, knockback, death/respawn
|  |- rooms.js                  # room load/unload, door transition resolution
|  |- progress.js               # abilities owned, bosses killed, pickups taken, save flags
|  |- save.js                   # serialize/deserialize GameState <-> plain JSON
|  |- hash.js                   # FNV-1a canonical walk of state -> hex. Throws on NaN/Infinity.
|  |- invariants.js             # checkInvariants(prev, state, input) -> Violation[]
|
|- src/content/                 # == DATA == pure data + tiny pure helpers
|  |- tiles.js                  # tile id -> {solid, damage, glyph, color, oneWay}
|  |- rooms/
|  |  |- index.js               # ROOMS registry: id -> module (one line per room)
|  |  |- s1_floor.js  r1_gate.js ...
|  |- world.js                  # world graph: door pairings, ability gates per edge, start room
|  |- routes.js                 # the canonical playthrough plan: ordered list of high-level Intents
|
|- src/view/                    # == BROWSER ONLY == may import core; core may NEVER import this
|  |- main.js                   # bootstrap: build state, wire loop, expose window.__HARNESS__
|  |- loop.js                   # rAF driver + fixed-timestep accumulator + lockstep mode
|  |- input-source.js           # keyboard/gamepad -> input bitmask; swappable for bot/replay
|  |- render/
|  |  |- index.js               # render(ctx, state, viewState)
|  |  |- camera.js  tiles.js  entities.js  player.js  effects.js  bossOverlay.js
|  |  |- palette.js             # procedural color/shape generation (no image assets)
|  |- hud.js                    # DOM HUD: hp, abilities, map, boss bar. data-testid on every field.
|  |- audio.js                  # WebAudio synth. Fully no-op'able via ?mute=1.
|  |- debug/
|     |- ctxGuard.js            # Proxy over CanvasRenderingContext2D: rejects NaN args, counts calls
|     |- overlay.js             # hitbox/invariant overlay, toggled by ?debug=1
|
|- src/bot/                     # == PURE == imports core+content only. Runs in Node AND in the browser.
|  |- api.js                    # BotAPI: observe(state) + intent execution
|  |- servo.js                  # the cheap autopilot: reactive controller -> input bits
|  |- solver.js                 # beam search over inputs; generates macros when servo fails
|  |- macros.js                 # RLE input tapes, loaded from content/rooms/*.js
|  |- script.js                 # runs content/routes.js to completion; emits a frame-by-frame trace
|
|- test/
|  |- harness/
|  |  |- server.js              # zero-dep static http server (ESM won't load over file://)
|  |  |- browser.js             # launch chromium, install turbo rAF, error sinks, pixel/HUD probes
|  |  |- expect.js              # tiny assert helpers with room/frame context
|  |- purity.test.js
|  |- determinism.test.js
|  |- content.test.js
|  |- unit/
|  |- rooms.test.js             # per-room traversal in isolation (the bisector)
|  |- bosses.test.js
|  |- playthrough.test.js       # * THE CENTREPIECE — full game, in Chromium, with pixels
|  |- smoke.test.js
|
|- tools/
   |- check-purity.mjs          # static boundary + banned-global enforcement
   |- record-macro.mjs          # runs solver.js for a room, writes the tape into the room file
   |- reachability.mjs          # world-graph solver: is the game completable?
   |- goldens.mjs               # regenerate determinism hashes
   |- shots.mjs                 # capture the key-beat screenshot contact sheet
```

### The boundary rule, stated exactly

> **R1.** No file under `src/core/**` or `src/content/**` may (a) import anything outside `src/core/**` and `src/content/**`, (b) import any npm package, or (c) reference `Math.random`, `Date`, `Date.now`, `performance`, `document`, `window`, `navigator`, `localStorage`, `requestAnimationFrame`, `setTimeout`, `setInterval`, `fetch`, `AudioContext`, or `console` (except via the injected `state.debug.log` sink).
>
> **R2.** `src/view/**` may import `core` and `content` freely. `src/bot/**` may import `core` and `content` only.
>
> **R3.** `step()` must not mutate its arguments. The returned state must be a fresh object graph.

### How it is mechanically enforced

Three independent layers, because agents route around any single one:

1. **Static — `tools/check-purity.mjs`** (prototyped, works, <100 ms). Walks `src/core` and `src/content`, regex-scans non-comment code for banned identifiers, and resolves every relative import to assert it stays inside the allowed roots. Exits 1 with `file:line  banned: Math.random (use state.rng)`. Wired as `pretest` so it cannot be skipped.
2. **Runtime — the determinism trap.** `test/harness/trap.js` is imported *before* core in every Node test, replacing `Math.random`/`Date.now` with throwing stubs. Catches indirect reaches the regex misses.
3. **Behavioural — R3 is enforced by test.** `determinism.test.js` deep-freezes the input state before calling `step()`; any mutation throws in strict mode. This catches the aliasing bugs (`newState.player = oldState.player`) that are the largest source of "mysteriously nondeterministic".

---

## 2. Language & build — decision: plain ES modules + JSDoc types + `tsc --checkJs`. No build step. Ever.

**Why not TypeScript + Vite:**
- It puts a compiler between the file an agent edits and the code that runs. Overnight, unattended, with 8 agents, a broken build is a **total outage**. A syntax error in one agent's file takes down the other seven.
- It needs a dev server process alive during tests, or a build step before them. The static server is ~25 lines with zero dependencies and no build.
- Node 22.22 *does* strip types natively — but the **browser cannot load `.ts`**. So TS mandates a build for the thing we most need to test.
- Source maps mean stack traces from browser errors point at generated code, degrading our most valuable diagnostic.

**Why plain `.js` + JSDoc wins:**
- **Zero indirection.** The exact bytes an agent writes are the bytes Chromium parses and Node imports. A stack trace names the real file and line.
- **Type safety is not sacrificed.** `tsc --noEmit -p .` with `checkJs: true, strict: true, noUncheckedIndexedAccess: true` catches `s.player.hpp` and `s.playr.x` in JSDoc'd JS — the exact class of mistake agents make most. `noUncheckedIndexedAccess` forces `entities[i]` null-checks, killing a family of crash bugs.
- **Failure is local.** A syntax error in `boss3.js` fails the tests that import it, not the build for everyone.

**Setup:** `package.json` with `{"type":"module"}`, no `dependencies`, `devDependencies: {"playwright":"1.56.1"}`. All state shapes `@typedef`'d in `src/core/types.js`, owned by one agent. `tsc --noEmit` is a test, not a build.

---

## 3. The deterministic core

### The contract

```js
/**
 * The ONLY way the world advances. Pure. Total. Deterministic.
 * @param {Readonly<GameState>} state  - never mutated
 * @param {number} input               - 16-bit mask for THIS frame
 * @returns {GameState}                - fresh object graph
 */
export function step(state, input) { ... }
```

1. **Totality.** `step` never throws for any reachable `(state, input)`. Errors become state (`state.errors.push(...)`), so a bad frame produces a *diagnosable state*, not a dead loop. In debug mode the harness escalates `state.errors` to a failure.
2. **Fixed timestep.** No `dt` parameter. One `step` == exactly 1/60 s. Real-time smoothing is the accumulator's problem in `view/loop.js`. This decision is what makes replay possible.
3. **All randomness from `state.rng`.** `next(seed) -> [float, nextSeed]`. No module-level RNG instance.
4. **All time from `state.tick`.** Cooldowns, i-frames, boss phase timers are `tick`-denominated integers.
5. **No aliasing.** Any sub-object that changed must be a new object. Unchanged sub-objects may be shared.
6. **Ordered subsystems.** `step` calls subsystems in a fixed, documented order — input, player, abilities, entities, bosses, physics, collision, combat, rooms, progress. No registry iteration over an unordered `Object.keys`.

### Input as a bitmask

```js
export const IN = { LEFT:1, RIGHT:2, UP:4, DOWN:8, JUMP:16, ATTACK:32,
                    THROW:64, ZIP:128, PAUSE:256, MAP:512 };
```
One `number` per frame. A 60-minute playthrough is 216,000 entries = 432 KB raw, RLE-compressing to a few KB. Edge detection (`justPressed`) is derived inside `step` from `state.prevInput`.

### Snapshot / restore

`snapshot(state) -> string`, `restore(str) -> GameState`. Backed by `structuredClone` in memory (measured: 3.7 us each). Verified property: `hash(restore(snapshot(s))) === hash(s)`.

### Guaranteeing and testing determinism

`hash.js` does an FNV-1a walk with **sorted object keys** and **throws on any non-finite number** — so hashing doubles as the NaN detector, for free.

`determinism.test.js` runs five checks (~1 s total):
1. **Double replay.** Same seed, same input log, twice; final hash + 22 checkpoint hashes identical. *Measured 15-33 ms per run.*
2. **Golden hash.** Compare against `test/goldens/route.json`. Intentional physics changes fail this; `npm run goldens` regenerates, and the diff is a reviewable record of what changed.
3. **Snapshot equivalence.** Play 1,000 frames, snapshot, play 500 more; separately restore and play the same 500. Hashes must match. Catches hidden state outside `GameState`.
4. **Frozen input.** Deep-freeze state, `step()` it — must not throw.
5. **Cross-environment.** Browser final hash === Node final hash for the same input log. The strongest single assertion in the suite: if it passes, the view provably did not perturb the sim.

---

## 4. The bot interface

The unifying idea: **the bot is just an input source.** It emits the same `number` per frame the keyboard does. The bot drives the *real* game loop, through the *real* `step()`, with the *real* renderer running — there is no test-only code path in the game.

### (a) Frame level — precise replay

```js
harness.setInput(bits)                // set held input for subsequent frames
harness.frame(n = 1)                  // advance exactly n sim steps, rendering each
harness.playTape(int16array)          // feed a recorded log
harness.recordFrom(tick)              // start capturing input to a tape
harness.hash()                        // state hash right now
harness.snapshot() / harness.restore(s)
harness.seek(tick)                    // restore nearest snapshot + replay forward
```

Any failure anywhere reduces to a tape + a seed, committed as a regression test that reproduces in milliseconds.

### (b) Observation

A **projection of state, not state itself**, so the bot can't depend on internals agents will refactor:

```js
bot.observe() -> {
  tick, room: 'r1_gate', roomBounds: {w,h},
  player: { x, y, vx, vy, grounded, onWall, facing, hp, maxHp, iframes, state:'run' },
  pin:    { state:'embedded', x, y, surface:'wood', dir },
  abilities: ['zip','deepPin'],
  doors:    [{ id, x, y, to, requires:'zip', open:true }],
  pickups:  [{ id, kind, x, y, taken }],
  enemies:  [{ id, kind, x, y, hp, threat }],
  boss:     { id, hp, maxHp, phase, vulnerable } | null,
  hazards:  [{ x, y, w, h, kind }],
  solidAt(tx, ty) -> boolean,
  canReach(targetId) -> boolean,
  progress: { bossesKilled:[...], flags:{...} }
}
```

### (c) Intent level — "play the whole game" without 200,000 hand-authored frames

```js
await bot.run([
  { go: 'r1_gate' },
  { get: 'zip' },
  { fight: 'stoker' },
  { expect: { abilities: ['zip'] } },
  { go: 's5_crown' }, { fight: 'anchor' },
  { expect: { flag: 'gameComplete' } },
]);
```

`content/routes.js` *is* this list — roughly 60-100 intents for the whole game. That is the entire authored cost of the playthrough test.

### How the autopilot traverses rooms — the recommendation

A **layered fallback**, because no single technique is both cheap and robust.

**Layer 1 — the servo controller (`bot/servo.js`, ~150 lines). Handles ~80% of rooms.**
A reactive controller, not a planner. Given a target `(x,y)` in the current room:
- press toward target x;
- probe the tilemap 1-2 tiles ahead at foot and head height -> if blocked, `JUMP`; if a gap with no floor within jump range, `JUMP` at the edge;
- if a door needs an ability the player owns, use it when aligned;
- if an enemy is within threat radius and in front -> attack;
- stuck detector: if `|dx| < 0.5` over 30 frames, wiggle, then escalate to Layer 2.

**Layer 2 — the beam-search solver (`bot/solver.js`). Handles the rooms the servo can't.**
The sim runs at ~7-14M steps/s in Node. Even assuming a real game is 10x heavier, that's ~700k steps/s. A room traversal is ~300 frames. Beam search with width 50 over ~8 meaningful input combinations, depth 300, scored by *distance to exit + progress + alive*, costs ~90,000 steps ~ **0.13 s per room**. For 43 rooms that is ~6 s, run offline.

`npm run record-macro <room>` brute-forces a valid input tape and writes it into the room's own file as RLE. **We do not hand-author input macros. We generate them.**

**Layer 3 — hand-written macro.** Escape hatch for a room the solver can't crack.

**Boss fights** always use a hand-written *policy* (not a tape): a small per-boss function `(observe) -> inputBits` implementing "dodge when telegraphing, hit when vulnerable". ~30 lines per boss. Tapes are wrong for bosses because a fixed tape is brittle; a reactive policy is robust and is a much better *test* of the boss.

**The trade-off, stated plainly.** Recorded macros are brittle: change jump height and every tape breaks. Physics-aware A* over a jump graph is robust but is a multi-day project and a large new source of bugs — you end up debugging the pathfinder instead of the game. The layered design buys robustness where it's cheap and accepts brittleness only where regeneration is one automated command. **Brittleness is acceptable exactly when the fix is `npm run record-macro <room>` and takes 0.13 s.**

---

## 5. Browser-layer bug detection — the harness

**Serving.** ES modules will not load over `file://`. A ~25-line dependency-free `http.createServer` on an ephemeral port serves the repo root, starting and stopping inside the test.

**Turbo mode — replace rAF before any page script runs.** Via `page.addInitScript`:
```js
let cbs = [], vt = 0, frame = 0;
globalThis.requestAnimationFrame = cb => (cbs.push(cb), cbs.length);
globalThis.__PUMP__ = n => {
  for (let i = 0; i < n; i++) {
    vt += 1000/60; frame++;
    const due = cbs; cbs = [];
    for (const cb of due) {
      try { cb(vt); }
      catch (e) { throw annotate(e, frame, __HARNESS__.room()); }
    }
  }
};
```
Measured: **216,000 frames of the real loop, real canvas, real HUD DOM in 2.34 s.**

One required cooperation from the game: `view/loop.js` supports **lockstep mode** (`?lockstep=1`), where each rAF callback performs exactly one `step()` instead of running the accumulator. Without this, `Math.min(ts-last, 250)` clamping makes frame count drift. Lockstep makes browser and Node frame-for-frame identical, enabling the cross-environment hash assertion.

**Fail on any console error or unhandled rejection.** Wired to `page.on('console')` (type `error`), `page.on('pageerror')`, and an in-page `unhandledrejection` listener. A throw inside `render` propagates synchronously out of `page.evaluate` into Node **with the real stack trace** — better than a console string.

**The canvas guard (`view/debug/ctxGuard.js`) — enabled by `?debug=1`.** A `Proxy` around `CanvasRenderingContext2D` that asserts every numeric argument is finite and every color string valid, and counts calls. This is the highest-value browser-layer check we have, because `ctx.fillRect(NaN, 0, 10, 10)` **draws nothing and throws nothing** — a silent invisible-player bug no logic test and no console listener will ever catch. Also caps draw calls per frame (5,000) to catch runaway render loops.

**Pixel sanity.**
- screen is not blank: fraction of non-background pixels within `[0.02, 0.98]`;
- the frame actually changed: hash of a downsampled 32x18 luminance grid differs across a 60-frame window while the player is moving (catches "renderer stopped but sim kept running");
- the player is on screen: a probe at the player's projected screen position is not background (catches camera/transform bugs).

**Sim/view desync oracle.** Every HUD field carries `data-testid`. The harness asserts `#hud-hp` text equals `state.player.hp`, ability pips equal `state.progress.abilities`, boss bar width ratio equals `boss.hp/boss.maxHp`, room name matches `state.room`. Checked at every intent boundary. Catches "HUD reads a stale copy of state".

**Audio.** WebAudio genuinely runs headless. Tests run **unmuted** so audio code paths execute and can throw, but with `AudioContext.destination` disconnected. A counter asserts `sfx.play()` calls > 0 by end of playthrough.

**Screenshots at key beats.** `tools/shots.mjs` captures a PNG at each intent boundary (~188 ms each) into `artifacts/shots/`, plus a contact sheet. This is the human-eyeball channel; it never fails the build. On playthrough failure the harness always dumps a screenshot + last 600 input frames + a state snapshot into `artifacts/failure/`.

---

## 6. Invariants + oracle

`core/invariants.js` exports `check(prev, next, input) -> Violation[]`. Runs **every frame** when `state.debug` is on (all tests), never in production. Cost: a few us/frame.

**Numeric / structural**
1. No `NaN`/`Infinity` anywhere — enforced for free by `hash.js` throwing on non-finite.
2. `tick === prev.tick + 1`, exactly.
3. `0 <= hp <= maxHp`, `maxHp > 0`; same for boss hp and every meter.
4. `|vx| <= VMAX`, `|vy| <= VMAX` (catches runaway integration before `Infinity`).
5. All timers/cooldowns/i-frames `>= 0` and non-increasing except on explicit reset.
6. Entity count `<= 256`; ids unique; no id reused within a room lifetime.

**Spatial**
7. Player AABB overlaps no solid tile after collision resolution (the most valuable invariant — catches every tunnelling and resolution-order bug).
8. Player within room bounds + 2-tile margin.
9. Every entity's `roomId === state.room` (no orphans leaking across transitions).
10. No entity at exactly `(0,0)` unless spawned there.

**Progression / world**
11. Room transitions only through a door whose `to` resolves to an existing room, whose partner door exists, and whose partner's spawn is where the player materialised.
12. `abilities` monotonically non-decreasing.
13. A boss marked dead never becomes alive; a taken pickup never untakes.
14. On transition, exactly one room is loaded.

**Consistency (every 1,000 frames)**
15. Save round-trip: `hash(restore(snapshot(s))) === hash(s)`.
16. Re-determinism spot check.

**Liveness — the softlock detector**
17. A rolling 600-frame window of a *progress fingerprint*: `hash(quantized player x/y, hp, room, abilities, boss hp, pickup flags, enemy count)`. If unchanged across the whole window **while non-zero input was supplied**, report `SOFTLOCK` with room and tick. This catches the failure the project owner actually fears.
18. Death loop detector: >5 deaths in the same room within 3,600 frames -> `DEATH_LOOP`.

**Browser-side (asserted by the harness)**
19. Zero console errors / pageerrors / unhandled rejections.
20. No non-finite argument to any canvas call (ctxGuard).
21. Draw calls per frame `<= 5,000`.
22. Screen not blank; content changes while the player moves; player visible.
23. HUD DOM matches sim state at every intent boundary.
24. Browser final hash === Node final hash.

Violations carry `{ code, tick, room, detail }`. The harness prints the **first** violation with 60 frames of surrounding input.

---

## 7. Test suite shape

```bash
npm test    # = node tools/check-purity.mjs && tsc --noEmit -p . && node --test test/
```

| Test | What it proves | Cost |
|---|---|---|
| `purity` (pretest) | The core/view boundary is intact; no banned globals | 0.1 s |
| `typecheck` (pretest) | No misspelled state fields, no bad signatures | 2-4 s |
| `unit/*` | physics, collision sweep, combat, each ability, save round-trip | 0.5 s |
| `determinism` | 2x replay, golden hashes, snapshot equivalence, frozen input | 1 s |
| `content` | every door paired, every ability obtainable, **game completable** | 0.3 s |
| `rooms` | each room traversable in isolation, entry->exit, sim-only | 2 s |
| `bosses` | each boss killable by its policy across 5 seeds; each can kill the player | 3 s |
| `smoke` (browser) | page loads, 300 frames, no console errors, screen not black, HUD populated | 2 s |
| **`playthrough` (browser)** | **the whole game, real loop, real canvas, real HUD, real audio, invariants every frame** | **~5 s** |
| **TOTAL** | | **~15-20 s** |

**The centrepiece, `playthrough.test.js`:**
1. Start static server, launch Chromium, install turbo rAF + error sinks.
2. `goto('/?seed=1&debug=1&lockstep=1&bot=1')`.
3. Run `content/routes.js` intent by intent through `bot.run()`, pumping frames in batches.
4. Every frame: `core/invariants.js` runs; any violation aborts.
5. Every intent boundary: assert postcondition, HUD/sim agreement, pixel sanity, record tick.
6. Global budget: fail if total ticks exceed 1.5x the expected route length (catches bot wandering — nearly always a real game bug).
7. At the end: assert `progress.flags.gameComplete`, all bosses dead, all abilities owned, and **browser final hash === Node-side hash**.
8. On failure: dump screenshot, snapshot, last 600 input frames, and the violation to `artifacts/failure/`, reporting **which intent, which room, which tick**.

**Failure localisation is the design goal.** `rooms.test.js` and `bosses.test.js` exist so that when the playthrough breaks, the smaller test that also broke names the culprit.

---

## 8. Content pipeline

**Rooms are ASCII in JS modules.** Not JSON — JS gives comments, named tile constants, and co-located metadata, and imports natively in both browser and Node with no loader.

```js
// src/content/rooms/r2_trunk.js
export const id = 'r2_trunk';
export const tiles = `
################################
#..............................#
#....o.........................#
#.......====...........^^^^....#
#..............................#
D..............................D
################################`;
//  # solid  . empty  = one-way  ^ spike  o pickup  D door  ~ water
export const doors = [
  { id:'d_w', at:[0,5],  to:'r1_gate:d_e',  requires:null },
  { id:'d_e', at:[31,5], to:'r3_thicket:d_w', requires:'zip' },
];
export const spawns = [{ kind:'crawler', at:[12,4] }];
export const pickups = [{ id:'p_zip', kind:'ability', ability:'zip', at:[5,3] }];
export const hints   = { route:[[0,5],[5,3],[31,5]] };  // waypoints for the servo
export const macro   = null;   // filled by tools/record-macro.mjs only if the servo fails
```

ASCII is right because it is the format an AI agent edits most reliably — it can see the room's shape in the diff, and a misplaced tile is visually obvious in review.

**Validation — `content.test.js` + `tools/reachability.mjs`, all static, ~0.3 s:**

*Structural:* every row the same length; only known glyphs; the room is enclosed (flood fill from empty space never escapes the border); every door's `to` resolves and **that partner points back**; door positions on the border, partners on compatible edges; no entity spawning inside a solid tile; every `spawns.kind` in `ENTITY_KINDS`; every `requires` in `ABILITIES`; every `id` unique.

*Semantic — the completability solver:* nodes = rooms, edges = doors labelled with `requires`. Fixpoint reachability over (room set x ability set):

```
owned = {}; reachable = {start}
repeat until stable:
  expand reachable through every door whose `requires` is a subset of owned
  owned |= abilities of every pickup in reachable rooms
  owned |= abilities granted by every boss in reachable rooms
assert 'e1_hull' in reachable and 'gameComplete' achievable
```

A ~40-line pure function answering the owner's actual question — *is the game completable?* — statically, in milliseconds. It also reports **unreachable content** and **ability ordering violations** ("`s3_throat` requires `reel`, but `reel` is only obtainable beyond `s3_throat`"), which is the softlock bug agents create most when adding rooms in parallel.

Two independent oracles now cover completability: the static solver (proves the *design* is sound) and the playthrough test (proves the *implementation* is sound).

---

## 9. Risks — many agents, parallel, overnight

**Risk 1 — Merge conflicts strangle throughput on hot files** (`step.js`, `types.js`, `world.js`, registry `index.js`).
*Mitigation:* one-file-per-thing everywhere, so adding content is **a new file plus one line** in a registry. Registry lines kept alphabetically sorted so conflicts are line-local. `AGENTS.md` publishes an ownership map: exactly one agent owns `types.js`, one owns `step.js`'s subsystem order, one owns `physics.js`.

**Risk 2 — A physics change silently invalidates every macro and golden hash, and the 3am agent "fixes" it by deleting the assertion.**
*Mitigation:* separate the two failure meanings. Golden-hash failure says "you changed behaviour — confirm it was intentional and run `npm run goldens`". Playthrough failure means "the game is broken". `AGENTS.md` rule: **never delete or skip a test; regenerate goldens or fix the game.** Tape staleness is cheap to repair (`npm run record-macro --all`, ~6 s), removing the incentive to cheat.

**Risk 3 — The purity boundary erodes.** An agent reaches for `Math.random()` for enemy jitter. Determinism dies quietly, the playthrough goes flaky, flaky tests get ignored.
*Mitigation:* three independent enforcement layers. Plus a *positive* affordance: `state.rng` is easy to use and documented at the top of `AGENTS.md` with a copy-pasteable example.

**Risk 4 — The full playthrough breaks and nobody can tell whose commit did it.**
*Mitigation:* localisation is a first-class feature. The failure report names **intent, room, tick, and invariant code**; per-room and per-boss isolation tests re-fail alongside and name the specific room; every failure dumps a reproducing tape. `npm test` runs cheap tests first and fails fast.

**Risk 5 — Tests get slow or flaky and agents stop running them.** The single most likely way the whole plan fails, because it is a soft failure nobody notices until morning.
*Mitigation:* a published, enforced **20-second budget**, with a test that fails the suite if the suite exceeds 30 s. No `setTimeout` in tests, no real-time waits, virtual clock everywhere, fixed seeds. The rAF pump means there is no race between harness and page — the harness *is* the clock. Screenshot capture lives in `npm run shots`, not `npm test`.

**Risk 6 — everyone builds content, nobody builds the bot, and the playthrough test doesn't exist until hour 10.**
*Mitigation:* build order is enforced: `core/step.js` + `hash.js` + the harness + a two-room walking playthrough test must be green **before any content or boss work begins**. A trivially-passing playthrough test on hour one that grows with the game is worth vastly more than a perfect one at hour ten. Every new room ships with its `rooms.test.js` entry in the same commit.

**Standing fuzz job:** `npm run fuzz` feeds random inputs from random snapshots along the route for 200k frames with all invariants on, across many seeds. It doesn't try to win — it tries to find NaN, out-of-bounds, softlocks, and render crashes in states the scripted route never visits. Every crash it finds is automatically saved as a reproducing tape.

---

## Summary of the decisions

1. **Zero build.** Plain ES modules + JSDoc, type-checked by `tsc --noEmit`.
2. **`step(state, input) -> state`**, fixed 1/60 timestep, seed and time inside state, pure, never mutating — enforced statically, at runtime, and behaviourally.
3. **The bot is an input source**, so tests drive the real loop and real renderer, never a test-only path.
4. **Servo -> beam-search solver -> hand macro**, with boss *policies* not tapes. Tapes are generated, never hand-written.
5. **Every playthrough test runs in Chromium with pixels**, because it costs 2.3 seconds and catches the bugs a logic suite cannot.
6. **`npm test` in ~20 s** tells an agent whether the game is beatable and the browser layer is sound, and names the room and frame when it isn't.
