/**
 * THE contract: `step(state, input) -> newState`. Pure, total, deterministic.
 *
 * Subsystem order is fixed and documented, because "which subsystem saw the frame
 * first" is exactly the kind of thing that silently changes a replay:
 *
 *   1. input      — roll `input` into `prevInput`, advance `tick`
 *   2. hitstop    — if the world is frozen for impact, only the clock moves
 *   3. player     — physics integration, jab timers and the collision sweep
 *   4. pin        — throw, flight, embed, recall (06-revision-1 §G)
 *   4b. grip      — a Pin that left drops whoever was perched on or hanging off it
 *   5. light      — the light list, which the next stage reads
 *   6. entities   — enemies; Chargers aim at the lights, not at the player (§D2)
 *   7. combat     — jab, hazards, contact damage, i-frames, death
 *   8. rooms      — door transitions
 *   9. progress   — save-lanterns and discovered-tile memory
 *  10. liveness   — the softlock fingerprint window
 *
 * Light before entities is load-bearing: a Charger must be able to acquire a Pin
 * thrown this frame, because "the Pin is a decoy" is a mechanic, not a coincidence.
 *
 * Every subsystem runs inside `runStage`, so a throw becomes a `SimError` in the
 * returned state rather than a dead loop (AGENTS.md rule 2). A failed stage leaves
 * its slice of the state untouched and the rest of the frame still runs.
 */

import { SOFTLOCK_WINDOW } from './constants.js';
import { stepPlayer } from './player.js';
import { stagePin, snapPinToHand } from './pin.js';
import { stageGrip } from './grip.js';
import { stageEntities, stageCombat, spawnFor } from './combat.js';
import { stageLanterns } from './lanterns.js';
import { computeLights, rememberSeen } from './light.js';
import { doorUnder, resolvePartner, doorEntry } from './rooms.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').InputMask} InputMask */
/** @typedef {import('./types.js').SimError} SimError */

/**
 * @param {GameState} state
 * @param {string} where
 * @param {(s: GameState) => GameState} fn
 * @param {SimError[]} errors appended to in place; `errors` is already a fresh array
 * @returns {GameState}
 */
function runStage(state, where, fn, errors) {
  try {
    return fn(state);
  } catch (e) {
    errors.push({ tick: state.tick, where, message: e instanceof Error ? e.message : String(e) });
    return state;
  }
}

/**
 * The ONLY way the world advances.
 * @param {Readonly<GameState>} state never mutated
 * @param {InputMask} input 16-bit mask for THIS frame
 * @returns {GameState} a fresh object graph
 */
export function step(state, input) {
  /** @type {SimError[]} */
  const errors = state.errors.slice(0, 64);

  // Hitstop freezes the world for 3-6 frames so a hit lands. Only the clock and the
  // flash timers move.
  //
  // The subtle part is input. A frozen frame must not *spend* an edge: it records
  // only which bits are still held (`prevInput & input`), so a button pressed
  // during the freeze is still an unpressed button when the world resumes, and
  // reads as a fresh press on the first live frame. Without this a Recall tapped
  // in the six frames after a kill would be silently eaten — and Recall is the one
  // input this game promises never to swallow.
  if (state.hitstop > 0) {
    const stillHeld = state.prevInput & input;
    /** @type {GameState} */
    const frozen = {
      ...state,
      tick: state.tick + 1,
      prevInput: stillHeld,
      input: stillHeld,
      hitstop: state.hitstop - 1,
      flash: Math.max(0, state.flash - 1),
      shake: Math.max(0, state.shake - 1),
      errors,
    };
    return runStage(frozen, 'liveness', stageLiveness, errors);
  }

  /** @type {GameState} */
  let s = {
    ...state,
    tick: state.tick + 1,
    prevInput: state.input,
    input,
    shake: Math.max(0, state.shake - 1),
    errors,
  };

  s = runStage(s, 'player', stagePlayer, errors);
  s = runStage(s, 'pin', stagePin, errors);
  s = runStage(s, 'grip', stageGrip, errors);
  s = runStage(s, 'light', stageLight, errors);
  s = runStage(s, 'entities', stageEntities, errors);
  s = runStage(s, 'combat', stageCombat, errors);
  s = runStage(s, 'rooms', stageRooms, errors);
  s = runStage(s, 'lanterns', stageLanterns, errors);
  s = runStage(s, 'discovery', stageDiscovery, errors);
  s = runStage(s, 'liveness', stageLiveness, errors);
  return s;
}

/** @param {GameState} s @returns {GameState} */
function stagePlayer(s) {
  return { ...s, player: stepPlayer(s.roomData, s.player, s.input, s.prevInput, s.pin) };
}

/** @param {GameState} s @returns {GameState} */
function stageLight(s) {
  return { ...s, lights: computeLights(s) };
}

/** @param {GameState} s @returns {GameState} */
function stageDiscovery(s) {
  return { ...s, discovered: rememberSeen(s) };
}

/**
 * Door transitions. §G: crossing a room boundary snaps the Pin to Held, always,
 * with no exceptions — so a Pin can never be left behind in a room you have left.
 * @param {GameState} s @returns {GameState}
 */
function stageRooms(s) {
  const p = s.player;
  if (p.hp <= 0) return s;
  const door = doorUnder(s.roomData, { x: p.x, y: p.y, w: p.w, h: p.h }, s.progress.abilities);
  if (!door) return s;
  const partner = resolvePartner(door);
  if (!partner) {
    s.errors.push({ tick: s.tick, where: 'rooms', message: `door ${s.room}:${door.id} -> '${door.to}' does not resolve` });
    return s;
  }
  const at = doorEntry(partner.room, partner.door, p.w, p.h);
  /** @type {GameState} */
  const arrived = {
    ...s,
    room: partner.room.id,
    roomData: partner.room,
    entities: spawnFor(partner.room),
    brokenTiles: [],
    player: {
      ...p,
      x: at.x, y: at.y, vy: 0, grounded: false, coyote: 0,
      perch: false, hang: false, hangCooldown: 0, jabFrames: 0,
      iframes: Math.max(p.iframes, 20), safeGround: at,
    },
  };
  return snapPinToHand(arrived);
}

/**
 * Rolling softlock window (04-architecture §6 rule 17). The fingerprint is
 * quantized to whole tiles so ordinary jitter — an idle animation, a 0.1px slide
 * — does not read as progress and mask a genuine lock.
 * @param {GameState} s @returns {GameState}
 */
function stageLiveness(s) {
  const fp = progressFingerprint(s);
  const changed = fp !== s.liveness.fingerprint;
  const sameFor = changed ? 0 : Math.min(SOFTLOCK_WINDOW, s.liveness.sameFor + 1);
  const inputFramesInWindow = changed ? 0 : s.liveness.inputFramesInWindow + (s.input !== 0 ? 1 : 0);
  return { ...s, liveness: { fingerprint: fp, sameFor, inputFramesInWindow } };
}

/**
 * @param {GameState} s
 * @returns {number} a 32-bit fingerprint of everything that counts as progress
 */
export function progressFingerprint(s) {
  const parts = [
    Math.round(s.player.x / 8) | 0,
    Math.round(s.player.y / 8) | 0,
    s.player.hp | 0,
    s.room.length,
    hashString(s.room),
    hashString(s.pin.state),
    s.progress.abilities.length,
    s.progress.bossesKilled.length,
    s.progress.pickupsTaken.length,
    s.progress.lanternsLit.length,
    s.entities.length,
  ];
  let h = 0x811c9dc5;
  for (const v of parts) {
    h = Math.imul(h ^ (Number.isFinite(v) ? v | 0 : 0), 0x01000193);
  }
  return h >>> 0;
}

/** @param {string} str @returns {number} */
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
