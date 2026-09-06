#!/usr/bin/env node
/**
 * The random-input soak (04-architecture §9, "standing fuzz job"). It does not try
 * to win: it tries to find NaN, out-of-bounds, softlocks and sim errors in states
 * the scripted route never visits.
 *
 * Phase 1 scope is deliberately small — random inputs from the start of each room,
 * with every invariant on. Phase 2 adds "resume from a snapshot along the route"
 * and writes each crash out as a reproducing tape.
 *
 * Usage: npm run fuzz -- [seeds] [framesPerSeed]
 */

import { createInitialState } from '../src/core/state.js';
import { step } from '../src/core/step.js';
import { check, formatViolation } from '../src/core/invariants.js';
import { nextInt } from '../src/core/rng.js';
import { IN_ALL } from '../src/core/input.js';
import { ROOM_IDS } from '../src/content/rooms/index.js';

const seeds = Number(process.argv[2] ?? 8);
const framesPerSeed = Number(process.argv[3] ?? 3000);

let failures = 0;
let frames = 0;

for (let seed = 1; seed <= seeds; seed++) {
  for (const roomId of ROOM_IDS) {
    let state = { ...createInitialState(seed, roomId), debug: true };
    // The fuzz stream is separate from the sim's, so fuzzing never perturbs sim RNG.
    let stream = (seed * 2654435761) >>> 0;
    let held = 0;
    for (let f = 0; f < framesPerSeed; f++) {
      const [roll, nextStream] = nextInt(stream, 12);
      stream = nextStream;
      // Change one bit at a time so inputs look like a person, not white noise.
      if (roll < 10) held ^= 1 << roll;
      const input = held & IN_ALL;
      const prev = state;
      state = step(state, input);
      frames++;
      const violations = check(prev, state, input);
      if (violations.length) {
        failures++;
        const v = violations[0];
        process.stderr.write(`fuzz: seed ${seed} room ${roomId} frame ${f}: ${v ? formatViolation(v) : '?'}\n`);
        process.stderr.write(`  tape seed=${seed} stream=${stream} frames=${f}\n`);
        break;
      }
    }
  }
}

process.stdout.write(`fuzz: ${frames} frames over ${seeds} seeds x ${ROOM_IDS.length} rooms, ${failures} failure(s)\n`);
process.exit(failures ? 1 : 0);
