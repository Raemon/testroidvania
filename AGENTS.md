# Working rules for agents on PINLIGHT

Read `docs/design/00-BIBLE.md` first — it is authoritative and overrides the other
design docs where they conflict.

## The six rules

1. **The purity boundary is absolute.** Nothing under `src/core/**` or
   `src/content/**` may import outside those roots, import an npm package, or touch
   `Math.random`, `Date`, `performance`, `document`, `window`, `requestAnimationFrame`,
   `setTimeout`, `fetch`, `AudioContext`, or `console`.
   Need randomness? Use `state.rng`:
   ```js
   import { nextFloat } from './rng.js';
   const [roll, rng] = nextFloat(state.rng);
   return { ...state, rng, enemy: { ...enemy, jitter: roll } };
   ```
   Need the time? Use `state.tick` (integer frames since start).

2. **`step(state, input)` never mutates its arguments** and always returns a fresh
   object graph for anything that changed. Errors become `state.errors`, never throws.

3. **Never delete, skip, or weaken a test.** A golden-hash failure means "you changed
   behaviour — confirm it was intentional, then run `npm run goldens`". A playthrough
   failure means "the game is broken". These are different; treat them differently.

4. **One file per thing.** A new room, ability, entity, or boss is a new file plus one
   alphabetically-sorted line in the relevant `index.js`. Do not restructure shared
   files to add content.

5. **Every new room ships with its traversal test passing in the same commit.** A room
   without a passing `rooms.test.js` entry is not done.

6. **Run `npm test` before you say you are finished.** It takes ~20 seconds. If it
   takes more than 30, that is itself a bug.

## Commands

| Command | What it does |
|---|---|
| `npm test` | purity check, typecheck, unit, determinism, content, rooms, bosses, smoke, full playthrough. The one command that matters. |
| `npm run play` | static server + the game in a browser, for a human |
| `npm run shots` | screenshot contact sheet at every route beat, into `artifacts/shots/` |
| `npm run goldens` | regenerate determinism hashes after an *intentional* behaviour change |
| `npm run record-macro <room>` | brute-force a bot input tape for a room the servo can't solve |
| `npm run fuzz` | random-input soak test with all invariants on |

## Layout

- `src/core/**` — pure deterministic simulation. No DOM, no canvas, no clock.
- `src/content/**` — pure data: rooms, tiles, world graph, the canonical route.
- `src/view/**` — browser only: canvas render, DOM HUD, WebAudio, raw input.
- `src/bot/**` — pure: observes state, emits input bits. Imports core + content only.
- `test/**`, `tools/**` — the harness and the scripts above.

`src/core` may never import `src/view`. This is checked, not trusted.
