/**
 * Damage in both directions, plus the two things that make a hit *read*: hitstop
 * and i-frames.
 *
 * The rule worth stating out loud is the knockback one, which lives in
 * `damagePlayer`: a hit must never be the thing that throws you into the spikes.
 * Everything else here is bookkeeping.
 */

import {
  ENEMY_CONTACT_DAMAGE, JAB_DAMAGE, JAB_CRIT_MULT, JAB_KNOCKBACK,
  HITSTOP_HIT, HITSTOP_KILL, DEATH_RESPAWN_FRAMES, PLAYER_MAX_HP,
} from './constants.js';
import { damagePlayer } from './player.js';
import { jabBox, jabIsActive } from './jab.js';
import { overlaps } from './geometry.js';
import { damageEntity, entityBox, ENTITY_KINDS } from './entities/index.js';
import { getRoom } from './rooms.js';
import { createPin, handAt } from './pin.js';
import { createPlayer } from './player.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Entity} Entity */

/**
 * Advance every entity, then reap the dead. Runs after the light stage so a
 * light-tracking enemy sees this frame's lights, including a Pin thrown as a decoy.
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageEntities(s) {
  if (s.entities.length === 0) return s;
  const stepped = s.entities.map((e) => {
    const ticked = {
      ...e,
      hitLockout: Math.max(0, e.hitLockout - 1),
      flash: Math.max(0, e.flash - 1),
      stun: e.pinned ? e.stun : Math.max(0, e.stun - 1),
    };
    if (ticked.hp <= 0) return ticked;
    const kind = ENTITY_KINDS[ticked.kind];
    return kind ? kind.update(ticked, s) : ticked;
  });
  return { ...s, entities: stepped.filter((e) => e.hp > 0) };
}

/**
 * Hazards, enemy contact, the Jab, and death.
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageCombat(s) {
  let next = applyJab(s);
  next = applyHazards(next);
  next = applyContact(next);
  next = applyDeath(next);
  // Reap here as well as in the entity stage: a kill that happens *after* the
  // entity stage must not leave a 0-HP body in the state for a frame.
  return next.entities.some((e) => e.hp <= 0)
    ? { ...next, entities: next.entities.filter((e) => e.hp > 0) }
    : next;
}

/** @param {GameState} s @returns {GameState} */
function applyJab(s) {
  const p = s.player;
  if (!jabIsActive(p) || p.hp <= 0) return s;
  const box = jabBox(p);
  if (!box) return s;
  let hits = 0;
  let hitstop = 0;
  const entities = s.entities.map((e) => {
    if (e.hp <= 0 || e.hitLockout > 0 || !overlaps(box, entityBox(e))) return e;
    // A pinned enemy is helpless, so the jab that frees it counts double.
    const damage = JAB_DAMAGE * (e.pinned ? JAB_CRIT_MULT : 1);
    const hurt = damageEntity(e, damage, p.x + p.w / 2);
    hits++;
    hitstop = Math.max(hitstop, hurt.hp <= 0 ? HITSTOP_KILL : HITSTOP_HIT);
    return { ...hurt, vx: hurt.pinned ? 0 : Math.sign(hurt.vx || p.facing) * JAB_KNOCKBACK };
  });
  if (hits === 0) return s;
  return {
    ...s,
    entities,
    player: { ...p, jabHits: p.jabHits + hits },
    hitstop: Math.max(s.hitstop, hitstop),
  };
}

/**
 * A spike is a soft death: -1 HP and a respawn at the last safe ground in the same
 * room (03-game-feel §5), never a lost run.
 * @param {GameState} s @returns {GameState}
 */
function applyHazards(s) {
  const p = s.player;
  if (p.hp <= 0 || p.iframes > 0) return s;
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const hz of s.roomData.hazards) {
    if (!overlaps(box, hz)) continue;
    const hurt = damagePlayer(p, 1, hz.x + hz.w / 2, s.roomData.hazards);
    if (hurt.hp <= 0) return { ...s, player: hurt, hitstop: Math.max(s.hitstop, HITSTOP_KILL) };
    return {
      ...s,
      player: { ...hurt, x: p.safeGround.x, y: p.safeGround.y, vx: 0, vy: 0 },
      hitstop: Math.max(s.hitstop, HITSTOP_HIT),
    };
  }
  return s;
}

/** @param {GameState} s @returns {GameState} */
function applyContact(s) {
  const p = s.player;
  if (p.hp <= 0 || p.iframes > 0) return s;
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const e of s.entities) {
    // Pinned is helpless: it cannot hurt you, which is what makes "nail it to the
    // wall, then walk up and jab it" a safe thing for the game to teach.
    if (e.hp <= 0 || e.pinned || !overlaps(box, entityBox(e))) continue;
    const hurt = damagePlayer(p, ENEMY_CONTACT_DAMAGE, e.x + e.w / 2, s.roomData.hazards);
    return { ...s, player: hurt, hitstop: Math.max(s.hitstop, hurt.hp <= 0 ? HITSTOP_KILL : HITSTOP_HIT) };
  }
  return s;
}

/**
 * Death and respawn. The Pin comes back to the hand, always (§G).
 * @param {GameState} s @returns {GameState}
 */
function applyDeath(s) {
  const p = s.player;
  if (p.hp > 0) return s;
  if (p.deadFrames < DEATH_RESPAWN_FRAMES) return s;
  const room = getRoom(s.respawn.room) ?? s.roomData;
  const fresh = createPlayer(s.respawn.x, s.respawn.y);
  const revived = { ...s, room: room.id, roomData: room, entities: spawnFor(room), player: { ...fresh, hp: PLAYER_MAX_HP } };
  return {
    ...revived,
    pin: { ...createPin(), ...handAt(revived) },
    brokenTiles: [],
    progress: { ...s.progress, deaths: s.progress.deaths + 1 },
  };
}

/**
 * @param {import('./types.js').Room} room
 * @returns {Entity[]} the room's spawns, freshly instantiated
 */
export function spawnFor(room) {
  /** @type {Entity[]} */
  const out = [];
  room.spawns.forEach((spawn, i) => {
    const kind = ENTITY_KINDS[spawn.kind];
    if (kind) out.push(kind.spawn(i + 1, room.id, spawn.at[0], spawn.at[1]));
  });
  return out;
}
