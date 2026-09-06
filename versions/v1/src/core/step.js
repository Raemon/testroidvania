/**
 * THE contract: `step(state, input) -> newState`. Pure, total, deterministic.
 *
 * Subsystem order is fixed and documented, because "which subsystem saw the frame
 * first" is exactly the kind of thing that silently changes a replay:
 *
 *   1. input      — roll `input` into `prevInput`, advance `tick`
 *   2. player     — physics integration and the collision sweep
 *   3. abilities  — (Phase 3)
 *   4. entities   — (Phase 3)
 *   5. bosses     — (Phase 3)
 *   6. combat     — hazard contact, i-frames, death
 *   7. rooms      — door transitions
 *   8. progress   — pickups and flags
 *   9. liveness   — the softlock fingerprint window
 *
 * Every subsystem runs inside `runStage`, so a throw becomes a `SimError` in the
 * returned state rather than a dead loop (AGENTS.md rule 2). A failed stage leaves
 * its slice of the state untouched and the rest of the frame still runs.
 */

import { SOFTLOCK_WINDOW } from './constants.js';
import { stepPlayer, damagePlayer } from './player.js';
import { doorUnder, resolvePartner, doorEntry, overlaps } from './rooms.js';

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

  /** @type {GameState} */
  let s = {
    ...state,
    tick: state.tick + 1,
    prevInput: state.input,
    input,
    errors,
  };

  s = runStage(s, 'player', stagePlayer, errors);
  s = runStage(s, 'combat', stageCombat, errors);
  s = runStage(s, 'rooms', stageRooms, errors);
  s = runStage(s, 'liveness', stageLiveness, errors);
  return s;
}

/** @param {GameState} s @returns {GameState} */
function stagePlayer(s) {
  return { ...s, player: stepPlayer(s.roomData, s.player, s.input, s.prevInput) };
}

/**
 * Hazard contact. A spike is a soft death: -1 HP and a respawn at the last safe
 * ground in the same room (03-game-feel §5), never a lost run.
 * @param {GameState} s @returns {GameState}
 */
function stageCombat(s) {
  const p = s.player;
  if (p.hp <= 0 || p.iframes > 0) return s;
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const hz of s.roomData.hazards) {
    if (!overlaps(box, hz)) continue;
    const hurt = damagePlayer(p, 1, hz.x + hz.w / 2);
    if (hurt.hp <= 0) return { ...s, player: hurt, progress: { ...s.progress, deaths: s.progress.deaths + 1 } };
    return { ...s, player: { ...hurt, x: p.safeGround.x, y: p.safeGround.y, vx: 0, vy: 0 } };
  }
  return s;
}

/** @param {GameState} s @returns {GameState} */
function stageRooms(s) {
  const p = s.player;
  const door = doorUnder(s.roomData, { x: p.x, y: p.y, w: p.w, h: p.h }, s.progress.abilities);
  if (!door) return s;
  const partner = resolvePartner(door);
  if (!partner) {
    s.errors.push({ tick: s.tick, where: 'rooms', message: `door ${s.room}:${door.id} -> '${door.to}' does not resolve` });
    return s;
  }
  const at = doorEntry(partner.room, partner.door, p.w, p.h);
  return {
    ...s,
    room: partner.room.id,
    roomData: partner.room,
    entities: [],
    player: { ...p, x: at.x, y: at.y, vy: 0, grounded: false, coyote: 0, iframes: Math.max(p.iframes, 20), safeGround: at },
  };
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
    s.progress.abilities.length,
    s.progress.bossesKilled.length,
    s.progress.pickupsTaken.length,
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
