/**
 * A5 TWIN PIN — two Pins, chain-zip, two lights. **No wire**: the raycast, the
 * slope test, the walkable-vs-zipline decision and the tripwire were all cut
 * (06-revision-1 §C). Chain-zip crosses the Hazard gate and it is the same button
 * the player has been pressing since minute three.
 *
 * One ordering rule makes two Pins fit the one-button model, and everything else
 * here follows from it:
 *
 *   **`state.pin` is the Pin thrown most recently; `pinB` is the older one.**
 *
 * So Throw always throws the Pin in hand (there is always at most one), Recall only
 * happens when both are out and then returns both, Zip aims at `pin` — "the most
 * recently thrown" — and Perch and Hang only ever attach to `pin`. The invariant
 * that Recall is never refused survives untouched, because on the frame you throw
 * the second Pin, `pin` becomes that Pin, which spends its 4 startup frames Held.
 */

import { IN, justPressed } from '../input.js';
import { stagePin, createPin, handAt } from '../pin.js';

/** @typedef {import('../types.js').AbilityId} AbilityId */
/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').Pin} Pin */

export const id = /** @type {AbilityId} */ ('twinPin');
export const name = 'Twin Pin';
export const gate = 'hazard';

/** @param {readonly AbilityId[]} abilities @returns {boolean} */
export function owned(abilities) {
  return abilities.includes('twinPin');
}

/** @param {Readonly<GameState>} s @returns {Pin} the spare, sitting in the hand */
export function dormant(s) {
  const hand = handAt(s);
  return { ...createPin(), x: hand.x, y: hand.y };
}

/**
 * Step both Pins. Without A5 the second one never leaves the hand, and this is
 * exactly `stagePin` plus one line.
 * @param {GameState} s
 * @returns {GameState}
 */
export function stagePins(s) {
  if (!owned(s.progress.abilities)) {
    const only = stagePin(s);
    return { ...only, pinB: dormant(only) };
  }
  const press = justPressed(s.input, s.prevInput, IN.THROW);
  if (press && s.pin.state !== 'held' && s.pinB.state === 'held') return throwSecond(s);
  // A throw press must send out exactly one Pin, so the spare does not also answer
  // it. Recall is deliberately left unmasked: both Pins see it and both come home.
  const quiet = press && s.pin.state === 'held' ? s.input & ~IN.THROW : s.input;
  const a = stagePin(s);
  const b = stagePin({ ...a, pin: a.pinB, pinB: a.pin, input: quiet });
  return { ...b, input: s.input, pin: b.pinB, pinB: b.pin, flash: Math.max(a.flash, b.flash) };
}

/**
 * Throw the spare while the first Pin is still out there. The grip is released on
 * the same frame — you cannot both hold onto a Pin and be the Pin that just left.
 * @param {GameState} s
 * @returns {GameState}
 */
function throwSecond(s) {
  // Only `state.pin` may hold a body, so throwing the spare lets go of whatever the
  // first Pin was holding. You cannot pin an enemy with one hand and throw with it.
  if (s.pin.state === 'pinned') {
    const freed = s.entities.map((e) => (e.id === s.pin.hostId ? { ...e, pinned: false } : e));
    s = { ...s, entities: freed, pin: { ...s.pin, state: 'dropped', hostId: null, hostTimer: 0 } };
  }
  // The first Pin sees the press masked out so it does not answer a throw meant for
  // the other; the spare sees the real press and launches.
  const a = stagePin({ ...s, input: s.input & ~IN.THROW });
  const b = stagePin({ ...a, pin: a.pinB, pinB: a.pin, input: s.input });
  return {
    ...b,
    input: s.input,
    flash: Math.max(a.flash, b.flash),
    player: { ...b.player, hang: false, perch: false, hangBelow: false },
  };
}

/**
 * Room transition, death and respawn: both Pins are in your hand again (§G).
 * @param {GameState} s
 * @returns {GameState}
 */
export function snapBothToHand(s) {
  const hand = handAt(s);
  const fresh = { ...createPin(), x: hand.x, y: hand.y };
  return { ...s, pin: fresh, pinB: { ...fresh } };
}
