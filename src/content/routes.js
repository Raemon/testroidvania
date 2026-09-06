/**
 * The canonical playthrough, as high-level intents (04-architecture §4c). The
 * playthrough test executes exactly this list; growing the game means adding
 * intents here, never hand-authoring frames.
 *
 * This is the opening (03-game-feel §6 beats 0-5, then 06-revision-1 §F beats 6-8
 * — the Pin as a step, as a ladder, and as a weapon) and then the Roots, which
 * ends one room past the shrine, with Zip in hand.
 *
 * @typedef {{ go: string } | { expect: { room?: string, hpAtLeast?: number, abilities?: string[], lanternsAtLeast?: number } }} Intent
 */

/** @type {Intent[]} */
export const ROUTE = [
  { go: 'o1_arrival' },
  { expect: { room: 'o1_arrival', hpAtLeast: 5 } },
  { go: 'o2_gaps' },
  { expect: { room: 'o2_gaps', hpAtLeast: 5 } },
  { go: 'o3_drop' },
  { expect: { room: 'o3_drop', hpAtLeast: 5 } },
  { go: 'o4_step' },
  { expect: { room: 'o4_step', hpAtLeast: 5, lanternsAtLeast: 1 } },
  { go: 'o5_ladder' },
  { expect: { room: 'o5_ladder', hpAtLeast: 5 } },
  { go: 'o6_weapon' },
  { expect: { room: 'o6_weapon', hpAtLeast: 5 } },
  // The Roots: two rooms of base-kit climbing, the shrine, three of Zip.
  { go: 'r1_gate' },
  { expect: { room: 'r1_gate', hpAtLeast: 5 } },
  { go: 'o7_shrine' },
  { go: 'r3_canopy' },
  { expect: { room: 'r3_canopy', hpAtLeast: 5, abilities: ['zip'] } },
];

/**
 * The route stops one room after the shrine on purpose. The browser plays every
 * frame of it through the real renderer at ~5ms a frame, so the canonical route is
 * bounded by the suite's per-test ceiling and not by how much game there is; what
 * it has to prove is that the view and the sim agree over a long run that includes
 * a pickup. The rest of the unaided run — Roots to the Spine's slag gate — is
 * asserted frame-exactly in Node by `rooms.test.js`, where it costs a second.
 */

/** Frame budget for the whole route; the playthrough fails past 1.5x of it. */
export const ROUTE_EXPECTED_FRAMES = 2200;
