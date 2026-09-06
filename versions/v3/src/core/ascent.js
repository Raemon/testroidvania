/**
 * THE FINALE. Two beats, one stage, no new subsystems.
 *
 * **The Ascent** (02-world-structure §6 beat 2). The Anchor falls, the floor of the
 * Core goes with it, and the player is standing at the bottom of the Spine with the
 * void coming up behind them. They climb S1 to S5 using each ability in the order
 * they earned it. Per 06-revision-1 §A3 every one of those gates has already been
 * climbed once, with its own key, within a minute of picking it up — which is the
 * only reason a five-tier climb on a clock is a recap and not five new rooms.
 *
 * **The Hull** (§6 denouement). A flat run to the right while the regions light up
 * behind you. Every save-lantern the run lit comes back on, in the order they were
 * lit, so the ending is longer and brighter for a player who explored — which is
 * what §D4 promised when it made unlit lanterns the collectible.
 *
 * Two things here are deliberate and worth defending:
 *
 *  - **The void is a hazard rect in a derived room, not a new drawing primitive.**
 *    Hazards are already globally coral, self-lit and hatched (00-BIBLE §1
 *    guardrail 4), which is exactly what a rising lethal substance should look
 *    like, and it costs the renderer nothing.
 *  - **The void kills outright.** Ordinary hazard contact costs a heart and puts
 *    you back on safe ground; during the Ascent safe ground is the tile the void
 *    just ate, so that rule would loop. Death here costs the tier, and the tier
 *    is a checkpoint — 20 seconds, not the sequence.
 */

import { TILE, ASCENT_TIER_FRAMES, ASCENT_RISE, SHAKE_HURT, HITSTOP_KILL } from './constants.js';
import { getRoom, standOn } from './rooms.js';
import { emit } from './events.js';
import { enterRoom } from './step.js';
import { SPINE_TIERS, ENDING_ROOM, ASCENT_FLAG, COMPLETE_FLAG, spineTier } from '../content/world.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Room} Room */
/** @typedef {import('./types.js').Hazard} Hazard */

/** The boss whose death starts the clock. */
const ANCHOR = 'anchor';

/** How far along the hull counts as out the far edge. */
const HULL_END = 0.88;

/**
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageFinale(s) {
  if (s.room === ENDING_ROOM) return stageHull(s);
  if (!s.ascent.active) return s.progress.bossesKilled.includes(ANCHOR) && !s.ascent.done ? beginAscent(s) : s;
  return stageAscent(s);
}

/**
 * The floor of the Core gives way. The player is put at the bottom of the Spine
 * rather than walked back through the Seal: the Anchor is not dead-dead, it is
 * *under* you, and the way it reads is that the room you were fighting in is gone.
 * @param {GameState} s
 * @returns {GameState}
 */
function beginAscent(s) {
  const room = getRoom(SPINE_TIERS[0] ?? '');
  if (!room) return s;
  const at = room.route[0] ?? [1, room.h - 2];
  const pos = standOn(at[0], at[1], s.player.w, s.player.h);
  emit(s.events, 'ascent.start', pos.x, pos.y);
  const moved = enterRoom(s, room, pos);
  return {
    ...moved,
    ascent: { active: true, tier: 0, frames: 0, done: false },
    progress: { ...moved.progress, flags: { ...moved.progress.flags, [ASCENT_FLAG]: true } },
    respawn: { room: room.id, x: pos.x, y: pos.y },
    shake: Math.max(moved.shake, SHAKE_HURT),
  };
}

/**
 * One frame of the climb: bank the tier if the player has gained one, advance the
 * clock, hang the void off the bottom of the room, and drown anything standing in it.
 * @param {GameState} s
 * @returns {GameState}
 */
function stageAscent(s) {
  const tier = spineTier(s.room);
  // Off the Spine — a side room, or a fall back through a door. The clock holds
  // where it is rather than resetting: leaving the ladder is not progress.
  if (tier < 0) return { ...s, roomData: withoutVoid(s.roomData) };

  let ascent = s.ascent;
  if (tier > ascent.tier) {
    emit(s.events, 'ascent.tier', s.player.x + s.player.w / 2, s.player.y + s.player.h);
    ascent = { ...ascent, tier, frames: 0 };
    s = { ...s, respawn: { room: s.room, x: s.player.x, y: s.player.y } };
  }
  // The Crown. The climb is over and the void stops where it is, so the last room
  // of the game is not a room you can drown in while reading it.
  if (tier >= SPINE_TIERS.length - 1) {
    return { ...s, ascent: { ...ascent, active: false, done: true }, roomData: withoutVoid(s.roomData) };
  }

  ascent = { ...ascent, frames: ascent.frames + 1 };
  const top = voidTop(s.roomData, ascent.frames);
  const roomData = withVoid(s.roomData, top);
  const drowned = s.player.hp > 0 && s.player.y + s.player.h > top;
  if (!drowned) return { ...s, ascent, roomData };

  emit(s.events, 'ascent.void', s.player.x + s.player.w / 2, s.player.y + s.player.h);
  emit(s.events, 'player.death', s.player.x + s.player.w / 2, s.player.y + s.player.h / 2);
  return {
    ...s,
    ascent: { ...ascent, frames: 0 },
    roomData,
    player: { ...s.player, hp: 0, vx: 0, vy: 0 },
    hitstop: Math.max(s.hitstop, HITSTOP_KILL),
    shake: Math.max(s.shake, SHAKE_HURT),
  };
}

/**
 * How high the void has climbed in this tier. It starts flush with the floor, which
 * is exactly not-lethal — a body standing on the floor has its feet *at* the top of
 * the void, not in it — and holds there for the grace period before it climbs.
 * @param {Room} room
 * @param {number} frames
 * @returns {number} world y of the top of the void
 */
export function voidTop(room, frames) {
  const floor = (room.h - 1) * TILE;
  return floor - Math.max(0, frames - ASCENT_TIER_FRAMES) * ASCENT_RISE;
}

/**
 * @param {Room} room
 * @param {number} top
 * @returns {Room} the same room with one void band across it
 */
function withVoid(room, top) {
  const base = withoutVoid(room);
  if (top >= room.h * TILE) return base;

  /** @type {Hazard} */
  const band = { x: 0, y: Math.max(0, top), w: room.w * TILE, h: room.h * TILE - Math.max(0, top), kind: 'void' };
  return { ...base, hazards: [...base.hazards, band] };
}

/** @param {Room} room @returns {Room} */
function withoutVoid(room) {
  if (!room.hazards.some((h) => h.kind === 'void')) return room;
  return { ...room, hazards: room.hazards.filter((h) => h.kind !== 'void') };
}

/**
 * The Hull. The player runs right; the regions light up behind them in order, and
 * so does every lantern the run lit. The lights are data — `state.lights` is what
 * the renderer punches its holes from — so the ending needs no new drawing code.
 * @param {GameState} s
 * @returns {GameState}
 */
function stageHull(s) {
  const width = s.roomData.w * TILE;
  const reached = Math.min(1, Math.max(0, (s.player.x + s.player.w / 2) / width));
  // The Hull's own beacons do not count as exploration: they are the regions
  // saluting, and folding them in would make every ending look equally thorough.
  const lit = s.progress.lanternsLit.filter((id) => !id.startsWith(`${ENDING_ROOM}@`));
  const shown = Math.floor(reached * lit.length);

  /** @type {import('./types.js').Light[]} */
  const trail = [];
  for (let i = 0; i < shown; i++) {
    // Spread along the hull behind the runner, in the order they were lit, so the
    // ending is literally as long and as bright as the run was thorough.
    const x = ((i + 0.5) / Math.max(1, lit.length)) * width;
    trail.push({ x, y: s.roomData.h * TILE - TILE * 3, r: 96, kind: 'lantern' });
  }

  const done = s.progress.flags[COMPLETE_FLAG] === true;
  if (done || reached < HULL_END) {
    return { ...s, lights: [...s.lights, ...trail] };
  }
  emit(s.events, 'game.complete', s.player.x + s.player.w / 2, s.player.y + s.player.h / 2);
  return {
    ...s,
    lights: [...s.lights, ...trail],
    progress: { ...s.progress, flags: { ...s.progress.flags, [COMPLETE_FLAG]: true } },
  };
}
