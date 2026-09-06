/**
 * THE contract: `step(state, input) -> newState`. Pure, total, deterministic.
 *
 * The subsystem order is `STAGES`, below. It is an array rather than a paragraph of
 * comment plus a sequence of calls because the two had already drifted apart: the
 * comment said ten stages while the code ran fourteen. The list *is* the
 * documentation now, and each entry carries the reason it sits where it does.
 *
 * Every stage runs inside `runStage`, so a throw becomes a `SimError` in the
 * returned state rather than a dead loop (AGENTS.md rule 2). A failed stage leaves
 * its slice of the state untouched and the rest of the frame still runs.
 */

import { SOFTLOCK_WINDOW, DOOR_LEAD } from './constants.js';
import { emit } from './events.js';
import { stepPlayer, releaseBody } from './player.js';
import { snapPinToHand } from './pin.js';
import { pinPlatforms } from './pin-geometry.js';
import { stagePins } from './abilities/twinPin.js';
import { stageZip } from './abilities/zip.js';
import { stageReel } from './abilities/reel.js';
import { stageProps, spawnProps, propPlatforms } from './props/index.js';
import { stageGrip } from './grip.js';
import { stageEntities, stageCombat, spawnFor } from './combat.js';
import { stagePickups } from './pickups.js';
import { stageLanterns } from './lanterns.js';
import { stageFinale } from './ascent.js';
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
  // Newest kept, not oldest: a stage that throws every frame must stay visible.
  const errors = state.errors.slice(-63);
  // Rebuilt from scratch every frame: `events` is what happened *this* step, so it
  // stays a pure function of the frame and a replay hashes identically.
  /** @type {import('./types.js').SimEvent[]} */
  const events = [];

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
      events,
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
    events,
  };

  for (const [name, fn] of STAGES) s = runStage(s, name, fn, errors);
  return s;
}

/**
 * The frame, in order. "Which subsystem saw the frame first" is exactly the kind of
 * thing that silently changes a replay, so each entry says why it is here.
 * @type {[string, (s: GameState) => GameState][]}
 */
const STAGES = [
  // Physics, the jab clock and the collision sweep. Stands aside during a Zip.
  ['player', stagePlayer],
  // Throw, flight, embed, recall, for both Pins (06-revision-1 §G, §C).
  ['pin', stagePins],
  // After the Pin, so a recall pressed this frame has already released the anchor.
  ['zip', stageZip],
  // After Zip: a Pin that left drops whoever was perched on or hanging off it.
  ['grip', stageGrip],
  // Rails move once the Pins have decided which of them is frozen.
  ['props', stageProps],
  // Before entities, and load-bearing: a Charger must be able to acquire a Pin
  // thrown *this* frame, because "the Pin is a decoy" is a mechanic (§D2).
  ['light', stageLight],
  ['entities', stageEntities],
  // After entities, so a drag overrides whatever the body wanted to do itself.
  ['reel', stageReel],
  ['combat', stageCombat],
  ['pickups', stagePickups],
  // Last of the world stages: a transition rebuilds the room out from under it.
  ['rooms', stageRooms],
  ['lanterns', stageLanterns],
  // After the rooms stage, so the finale sees the tier the player is actually
  // standing in on the frame they arrive in it.
  ['finale', stageFinale],
  ['discovery', stageDiscovery],
  ['liveness', stageLiveness],
];

/**
 * The Zip stage owns the body outright while it is flying, so the ordinary physics
 * step stands aside rather than integrating gravity into a zip.
 * @param {GameState} s @returns {GameState}
 */
function stagePlayer(s) {
  if (s.player.zipFrames > 0) return s;
  return { ...s, player: stepPlayer(s.roomData, s.player, s.input, s.prevInput, s.pin, s.events, platformsFor(s)) };
}

/**
 * Every dynamic one-way surface this frame: both Pins' shelves and every rail.
 * @param {Readonly<GameState>} s @returns {import('./types.js').AABB[]}
 */
export function platformsFor(s) {
  return [...pinPlatforms(s.pin), ...pinPlatforms(s.pinB), ...propPlatforms(s.props)];
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
 *
 * `door.open` fires while the player is still walking *at* the door, not as they
 * cross it: a transition is instantaneous, so anything with a wind-up needs the
 * approach rather than the arrival. Nothing else in the frame writes `nearDoor`, so
 * the value still on the player here is last frame's.
 * @param {GameState} s @returns {GameState}
 */
function stageRooms(s) {
  const p = s.player;
  if (p.hp <= 0) return s;
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  const approaching = doorUnder(s.roomData, { ...box, x: box.x - DOOR_LEAD, w: box.w + DOOR_LEAD * 2 }, s.progress.abilities, s.progress.flags);
  const nearDoor = approaching?.id ?? '';
  if (nearDoor && nearDoor !== p.nearDoor) {
    emit(s.events, 'door.open', box.x + box.w / 2, box.y + box.h / 2);
  }
  s = { ...s, player: { ...p, nearDoor } };

  const door = doorUnder(s.roomData, box, s.progress.abilities, s.progress.flags);
  if (!door) return s;
  const partner = resolvePartner(door);
  if (!partner) {
    s.errors.push({ tick: s.tick, where: 'rooms', message: `door ${s.room}:${door.id} -> '${door.to}' does not resolve` });
    return s;
  }
  return enterRoom(s, partner.room, doorEntry(partner.room, partner.door, p.w, p.h));
}

/**
 * Put the player into a room at a point. Every way the world can change under the
 * player's feet — a door, and the Anchor's floor giving way into the Ascent — goes
 * through here, because §G's "the Pin snaps to Held, always" has to be true of all
 * of them and a second copy of this would eventually forget.
 *
 * @param {GameState} s
 * @param {import('./types.js').Room} room
 * @param {{x:number, y:number}} at
 * @returns {GameState}
 */
export function enterRoom(s, room, at) {
  const p = s.player;
  emit(s.events, 'room.enter', at.x, at.y);
  /** @type {GameState} */
  const arrived = {
    ...s,
    room: room.id,
    roomData: room,
    entities: spawnFor(room),
    nextEntityId: room.spawns.length + 1,
    props: spawnProps(room),
    brokenTiles: [],
    player: {
      ...releaseBody(p),
      x: at.x, y: at.y, vy: 0, grounded: false, coyote: 0, nearDoor: '',
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
    hashString(s.pinB.state),
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
