/**
 * The canonical playthrough, as high-level intents (04-architecture §4c). The
 * playthrough test executes exactly this list; growing the game means adding
 * intents here, never hand-authoring frames.
 *
 * Phase 1 owns only `go` and `expect`. Phase 2 adds `get`, `fight` and `use`.
 *
 * @typedef {{ go: string } | { expect: { room?: string, hpAtLeast?: number, abilities?: string[] } }} Intent
 */

/** @type {Intent[]} */
export const ROUTE = [
  { go: 't1_flat' },
  { expect: { room: 't1_flat' } },
  { go: 't2_gap' },
  { expect: { room: 't2_gap' } },
  { go: 't3_ceiling' },
  { expect: { room: 't3_ceiling', hpAtLeast: 5 } },
];

/** Frame budget for the whole route; the playthrough fails past 1.5x of it. */
export const ROUTE_EXPECTED_FRAMES = 700;
