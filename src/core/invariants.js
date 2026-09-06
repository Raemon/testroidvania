/**
 * The oracle. `check(prev, next, input)` returns every rule the frame broke.
 *
 * Runs every frame when `state.debug` is on (i.e. in all tests), never in
 * production. Each rule is one entry in the CHECKS array, so a later agent adds a
 * rule by *appending* a function — never by editing an existing one. That is what
 * keeps this file merge-safe with eight agents on it.
 *
 * The rule numbers are 04-architecture §6.
 */

import { TILE, VMAX, MAX_ENTITIES, SOFTLOCK_WINDOW, PIN_AUTO_RECALL_FRAMES } from './constants.js';
import { overlapsSolid } from './collision.js';
import { hash, NonFiniteError } from './hash.js';
import { IN, justPressed } from './input.js';

/** @type {import('./types.js').PinState[]} */
const PIN_STATES = ['held', 'flying', 'embedded', 'pinned', 'dropped', 'returning'];

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Violation} Violation */
/** @typedef {import('./types.js').InputMask} InputMask */

/**
 * @typedef {object} CheckContext
 * @property {Readonly<GameState>} prev
 * @property {Readonly<GameState>} next
 * @property {InputMask} input
 * @property {(code: string, detail: string) => void} report
 */

/** @type {((ctx: CheckContext) => void)[]} */
const CHECKS = [];

/** @param {(ctx: CheckContext) => void} fn */
export function addCheck(fn) {
  CHECKS.push(fn);
}

// 1. No NaN or Infinity anywhere. hash() throws on the first one and names its path.
addCheck(({ next, report }) => {
  try {
    hash(next);
  } catch (e) {
    if (e instanceof NonFiniteError) report('NON_FINITE', e.message);
    else report('UNHASHABLE_STATE', e instanceof Error ? e.message : String(e));
  }
});

// 2. The clock advances by exactly one frame.
addCheck(({ prev, next, report }) => {
  if (next.tick !== prev.tick + 1) report('TICK_SKIP', `tick went ${prev.tick} -> ${next.tick}`);
});

// 3. Health stays inside its meter.
addCheck(({ next, report }) => {
  const p = next.player;
  if (p.maxHp <= 0) report('BAD_METER', `maxHp is ${p.maxHp}`);
  if (p.hp < 0 || p.hp > p.maxHp) report('HP_RANGE', `hp ${p.hp} outside [0, ${p.maxHp}]`);
});

// 4. Velocity stays bounded, so runaway integration is caught before it is Infinity.
addCheck(({ next, report }) => {
  const p = next.player;
  if (Math.abs(p.vx) > VMAX) report('VELOCITY', `vx ${p.vx} exceeds ${VMAX}`);
  if (Math.abs(p.vy) > VMAX) report('VELOCITY', `vy ${p.vy} exceeds ${VMAX}`);
});

// 5. Every timer is a non-negative integer.
addCheck(({ next, report }) => {
  const p = next.player;
  /** @type {[string, number][]} */
  const timers = [
    ['iframes', p.iframes], ['hurtFrames', p.hurtFrames], ['coyote', p.coyote],
    ['jumpBuffer', p.jumpBuffer], ['jumpFrames', p.jumpFrames], ['dropThrough', p.dropThrough],
    ['fallFrames', p.fallFrames],
  ];
  for (const [name, v] of timers) {
    if (!Number.isInteger(v) || v < 0) report('TIMER', `player.${name} is ${v}`);
  }
});

// 6. Entity budget and unique ids.
addCheck(({ next, report }) => {
  if (next.entities.length > MAX_ENTITIES) report('ENTITY_BUDGET', `${next.entities.length} entities`);
  const seen = new Set();
  for (const e of next.entities) {
    if (seen.has(e.id)) report('ENTITY_ID', `duplicate entity id ${e.id}`);
    seen.add(e.id);
  }
});

// 7. The player is never inside a solid tile after resolution. The single most
//    valuable rule: it catches every tunnelling and resolution-order bug.
addCheck(({ next, report }) => {
  const p = next.player;
  if (overlapsSolid(next.roomData, { x: p.x, y: p.y, w: p.w, h: p.h })) {
    report('INSIDE_SOLID', `player at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) overlaps a solid tile`);
  }
});

// 8. The player stays within the room plus a two-tile margin.
addCheck(({ next, report }) => {
  const p = next.player;
  const m = 2 * TILE;
  const w = next.roomData.w * TILE;
  const h = next.roomData.h * TILE;
  if (p.x < -m || p.y < -m || p.x + p.w > w + m || p.y + p.h > h + m) {
    report('OUT_OF_BOUNDS', `player at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) is outside ${next.roomData.id} (${w}x${h})`);
  }
});

// 9. No entity is orphaned across a room transition.
addCheck(({ next, report }) => {
  for (const e of next.entities) {
    if (e.roomId !== next.room) report('ORPHAN_ENTITY', `entity ${e.id} (${e.kind}) belongs to ${e.roomId}, room is ${next.room}`);
  }
});

// 11. The loaded room and its compiled data agree.
addCheck(({ next, report }) => {
  if (next.roomData.id !== next.room) report('ROOM_MISMATCH', `room '${next.room}' but roomData '${next.roomData.id}'`);
});

// 12. Abilities are monotonically non-decreasing.
addCheck(({ prev, next, report }) => {
  for (const a of prev.progress.abilities) {
    if (!next.progress.abilities.includes(a)) report('ABILITY_LOST', `ability '${a}' disappeared`);
  }
});

// 13. A killed boss never revives; a taken pickup never untakes.
addCheck(({ prev, next, report }) => {
  for (const b of prev.progress.bossesKilled) {
    if (!next.progress.bossesKilled.includes(b)) report('BOSS_REVIVED', `boss '${b}' is alive again`);
  }
  for (const id of prev.progress.pickupsTaken) {
    if (!next.progress.pickupsTaken.includes(id)) report('PICKUP_UNTAKEN', `pickup '${id}' untaken`);
  }
});

// step() reports failures instead of throwing, so a new error is still a failure.
addCheck(({ prev, next, report }) => {
  if (next.errors.length > prev.errors.length) {
    const e = next.errors[next.errors.length - 1];
    report('SIM_ERROR', `${e?.where}: ${e?.message}`);
  }
});

// 17. Softlock: the progress fingerprint has not moved for a whole 600-frame
//     window even though the player was pressing something the entire time.
addCheck(({ next, report }) => {
  const { sameFor, inputFramesInWindow } = next.liveness;
  if (sameFor >= SOFTLOCK_WINDOW && inputFramesInWindow >= SOFTLOCK_WINDOW) {
    report('SOFTLOCK', `no progress for ${sameFor} frames in ${next.room} while input was held`);
  }
});

/**
 * @param {Readonly<GameState>} prev
 * @param {Readonly<GameState>} next
 * @param {InputMask} input
 * @returns {Violation[]}
 */
export function check(prev, next, input) {
  /** @type {Violation[]} */
  const violations = [];
  /** @type {(code: string, detail: string) => void} */
  const report = (code, detail) => { violations.push({ code, tick: next.tick, room: next.room, detail }); };
  const ctx = { prev, next, input, report };
  for (const fn of CHECKS) {
    try {
      fn(ctx);
    } catch (e) {
      report('CHECK_THREW', e instanceof Error ? e.message : String(e));
    }
  }
  return violations;
}

/**
 * @param {Violation} v
 * @returns {string}
 */
export function formatViolation(v) {
  return `${v.code} at tick ${v.tick} in ${v.room}: ${v.detail}`;
}

// --- Phase 2: the Pin ------------------------------------------------------

// 18. The Pin is in exactly one valid state, and its fields agree with it. Every
//     other Pin rule is only meaningful if this one holds.
addCheck(({ next, report }) => {
  const pin = next.pin;
  if (!PIN_STATES.includes(pin.state)) {
    report('PIN_STATE', `pin.state is '${pin.state}'`);
    return;
  }
  if (pin.state === 'pinned' && pin.hostId === null) report('PIN_STATE', 'a pinned Pin has no host');
  if (pin.state !== 'pinned' && pin.hostId !== null) report('PIN_STATE', `a ${pin.state} Pin still names host ${pin.hostId}`);
  if (pin.state === 'embedded' && pin.nx === 0 && pin.ny === 0) report('PIN_STATE', 'an embedded Pin has no surface normal');
  if (pin.state === 'embedded' && pin.surface === null) report('PIN_STATE', 'an embedded Pin is embedded in nothing');
  if (pin.state !== 'embedded' && pin.surface !== null) report('PIN_STATE', `a ${pin.state} Pin still names surface '${pin.surface}'`);
  if (pin.state === 'held' && (pin.vx !== 0 || pin.vy !== 0)) report('PIN_STATE', 'a held Pin is moving');
  for (const [name, v] of [['startup', pin.startup], ['clang', pin.clang], ['away', pin.away], ['lock', pin.lock], ['hostTimer', pin.hostTimer]]) {
    if (!Number.isInteger(v) || v < 0) report('TIMER', `pin.${name} is ${v}`);
  }
});

// 19. RECALL IS NEVER DISABLED. A Throw/Recall press on a frame the world is
//     actually running, with the Pin anywhere but the hand, must start it home.
//     This is the invariant the whole "you can never be stranded" promise rests on,
//     so it is checked on every frame rather than trusted to a unit test.
addCheck(({ prev, next, report }) => {
  if (prev.hitstop > 0) return;
  if (!justPressed(next.input, next.prevInput, IN.THROW)) return;
  if (prev.pin.state === 'held') return;
  if (next.pin.state === 'returning' || next.pin.state === 'held') return;
  report('RECALL_REFUSED', `Recall pressed with the Pin ${prev.pin.state} and it stayed ${next.pin.state}`);
});

// 20. The player is never stranded: a Pin that has left the room or landed in
//     something that kills is counting down to its own auto-recall.
addCheck(({ next, report }) => {
  const pin = next.pin;
  if (pin.state === 'held' || pin.state === 'returning') return;
  const room = next.roomData;
  const outside = pin.x < 0 || pin.y < 0 || pin.x > room.w * TILE || pin.y > room.h * TILE;
  if (!outside) return;
  if (pin.away <= 0 || pin.away > PIN_AUTO_RECALL_FRAMES) {
    report('PIN_ABANDONED', `Pin is ${pin.state} outside ${room.id} at (${pin.x.toFixed(1)}, ${pin.y.toFixed(1)}) with away=${pin.away}`);
  }
});

// 21. Perch and Hang only exist while there is a wall pin to perch on or hang
//     from — otherwise the player is standing on, or dangling from, nothing.
addCheck(({ next, report }) => {
  const p = next.player;
  const wallPin = next.pin.state === 'embedded' && next.pin.nx !== 0;
  if (p.perch && !wallPin) report('GRIP', 'the player is perched with no wall pin');
  if (p.hang && !wallPin) report('GRIP', 'the player is hanging with no wall pin');
  if (p.perch && p.hang) report('GRIP', 'the player is perched and hanging at once');
});

// 22. Enemy bookkeeping: health in range, and only light bodies get pinned.
addCheck(({ next, report }) => {
  for (const e of next.entities) {
    if (e.hp <= 0 || e.hp > e.maxHp) report('ENEMY_HP', `${e.kind} ${e.id} has hp ${e.hp} of ${e.maxHp}`);
    if (e.pinned && e.mass !== 0) report('ENEMY_PINNED', `heavy ${e.kind} ${e.id} is pinned to a wall`);
    if (e.pinned && next.pin.hostId !== e.id) report('ENEMY_PINNED', `${e.kind} ${e.id} thinks it is pinned but the Pin is ${next.pin.state}`);
  }
});
