/**
 * Building a sim out of a scrap of ASCII, for unit tests that want one wall and
 * nothing else. Real rooms make bad unit-test fixtures: a Pin test that fails
 * should name the Pin, not a room's floor plan.
 */

import assert from 'node:assert/strict';
import { compileRoom } from '../../src/content/room-format.js';
import { createInitialState } from '../../src/core/state.js';
import { createPlayer } from '../../src/core/player.js';
import { createPin } from '../../src/core/pin.js';
import { spawnFor } from '../../src/core/combat.js';
import { spawnProps } from '../../src/core/props/index.js';
import { computeLights } from '../../src/core/light.js';
import { standOn } from '../../src/core/rooms.js';
import { step } from '../../src/core/step.js';
import { check, formatViolation } from '../../src/core/invariants.js';
import { PLAYER_W, PLAYER_H, PIN_HAND_OFFSET } from '../../src/core/constants.js';

/** @typedef {import('../../src/core/types.js').GameState} GameState */
/** @typedef {import('../../src/core/types.js').Room} Room */

/**
 * @param {string} art rows of glyphs, one per line; blank lines are ignored
 * @param {object} [options]
 * @param {string} [options.id]
 * @param {{kind:string, at:[number,number]}[]} [options.spawns]
 * @param {{kind:string, at:[number,number], to:[number,number]}[]} [options.rails]
 * @param {{id:string, kind:string, at:[number,number], ability?:import('../../src/core/types.js').AbilityId, afterBoss?:string}[]} [options.pickups]
 * @returns {Room}
 */
export function roomFrom(art, options = {}) {
  return compileRoom({
    id: options.id ?? 'fixture',
    tiles: art,
    doors: [],
    spawns: options.spawns ?? [],
    rails: options.rails ?? [],
    pickups: options.pickups ?? [],
    hints: { route: [] },
    macro: null,
  });
}

/**
 * @param {Room} room
 * @param {number} tx tile the player's feet rest on
 * @param {number} ty
 * @returns {GameState}
 */
export function stateIn(room, tx, ty) {
  const base = createInitialState(1);
  const pos = standOn(tx, ty, PLAYER_W, PLAYER_H);
  /** @type {GameState} */
  const s = {
    ...base,
    debug: true,
    room: room.id,
    roomData: room,
    player: { ...createPlayer(pos.x, pos.y), grounded: true },
    entities: spawnFor(room),
    nextEntityId: room.spawns.length + 1,
    props: spawnProps(room),
    pin: { ...createPin(), x: pos.x + PLAYER_W / 2, y: pos.y + PIN_HAND_OFFSET },
    pinB: { ...createPin(), x: pos.x + PLAYER_W / 2, y: pos.y + PIN_HAND_OFFSET },
    respawn: { room: room.id, x: pos.x, y: pos.y },
    discovered: {},
    brokenTiles: [],
  };
  return { ...s, lights: computeLights(s) };
}

/**
 * Advance `frames` frames on one input, checking every invariant on every frame.
 * @param {GameState} state
 * @param {number} input
 * @param {number} frames
 * @param {string} [label]
 * @returns {GameState}
 */
export function run(state, input, frames, label = 'run') {
  let s = state;
  for (let i = 0; i < frames; i++) {
    const prev = s;
    s = step(s, input);
    const violations = check(prev, s, input);
    assert.equal(
      violations.length, 0,
      `${label}: frame ${i} broke ${violations.map(formatViolation).join('; ')}`,
    );
  }
  return s;
}

/**
 * Press a button for one frame, then hold nothing for `after` frames. Edge-
 * triggered inputs are the only ones the Pin cares about, so this is the shape
 * every Pin test wants.
 * @param {GameState} state
 * @param {number} bits
 * @param {number} [after]
 * @param {string} [label]
 * @returns {GameState}
 */
export function tap(state, bits, after = 0, label = 'tap') {
  // Release first: these are edge-triggered inputs, and a "press" that was already
  // held is not a press. Getting this wrong makes a test that proves nothing.
  const released = run(state, 0, 1, label);
  return run(run(released, bits, 1, label), 0, after, label);
}

/**
 * Advance until `predicate` holds, failing by name if it never does.
 * @param {GameState} state
 * @param {number} input
 * @param {(s: GameState) => boolean} predicate
 * @param {string} label
 * @param {number} [budget]
 * @returns {GameState}
 */
export function until(state, input, predicate, label, budget = 240) {
  let s = state;
  for (let i = 0; i < budget; i++) {
    if (predicate(s)) return s;
    s = run(s, input, 1, label);
  }
  assert.fail(`${label}: never became true in ${budget} frames (pin is ${s.pin.state} at ${s.pin.x.toFixed(1)},${s.pin.y.toFixed(1)})`);
}
