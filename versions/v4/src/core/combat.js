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
  HITSTOP_HIT, HITSTOP_HEAVY, HITSTOP_KILL, DEATH_RESPAWN_FRAMES, MAX_ENTITIES,
  SHAKE_HIT, SHAKE_KILL, SHAKE_HURT, SHAKE_BOSS,
} from './constants.js';
import { damagePlayer } from './player.js';
import { jabBox, jabIsActive } from './jab.js';
import { overlaps } from './geometry.js';
import { damageEntity, entityBox, armoured, ENTITY_KINDS } from './entities/index.js';
import { getRoom } from './rooms.js';
import { createPin, handAt } from './pin.js';
import { createPlayer } from './player.js';
import { spawnProps } from './props/index.js';
import { isBoss } from './bosses/index.js';
import { BOSS_CONTACT_DAMAGE } from './bosses/base.js';
import { emit } from './events.js';

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

  // Bodies that make bodies: a Turret's bolt, a boss's limbs, a lava wave. Ids come
  // from `nextEntityId` so they can never collide with a room's own spawns.
  /** @type {Entity[]} */
  const born = [];
  let nextEntityId = s.nextEntityId;
  for (const e of stepped) {
    const hatch = ENTITY_KINDS[e.kind]?.hatch;
    if (!hatch || e.hp <= 0) continue;
    if (stepped.length + born.length >= MAX_ENTITIES) break;
    for (const child of hatch(e, s, nextEntityId)) {
      born.push(child);
      nextEntityId++;
    }
  }
  const reaped = reap(s, [...stepped, ...born]);
  // A slam or a boss death shakes the screen. The sim owns how long, never how big.
  const loud = s.events.some((ev) => ev.kind === 'boss.stomp' || ev.kind === 'boss.death');
  return {
    ...s,
    entities: reaped.entities,
    progress: reaped.progress,
    nextEntityId,
    shake: loud ? Math.max(s.shake, SHAKE_BOSS) : s.shake,
  };
}

/**
 * Remove the dead, and record a boss's death as progress on the way past. Doing it
 * here rather than in a boss file means a boss killed by a recall on its way home
 * counts exactly as much as one killed by a jab.
 * @param {GameState} s
 * @param {Entity[]} entities
 * @returns {{entities: Entity[], progress: import('./types.js').Progress}}
 */
function reap(s, entities) {
  if (!entities.some((e) => e.hp <= 0)) return { entities, progress: s.progress };
  let progress = s.progress;
  for (const e of entities) {
    if (e.hp > 0 || !isBoss(e.kind) || progress.bossesKilled.includes(e.kind)) continue;
    emit(s.events, 'boss.death', e.x + e.w / 2, e.y + e.h / 2, { id: e.id });
    progress = { ...progress, bossesKilled: [...progress.bossesKilled, e.kind].sort() };
  }
  return { entities: entities.filter((e) => e.hp > 0), progress };
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
  const reaped = reap(next, next.entities);
  return { ...next, entities: reaped.entities, progress: reaped.progress };
}

/** @param {GameState} s @returns {GameState} */
function applyJab(s) {
  const p = s.player;
  if (!jabIsActive(p) || p.hp <= 0) return s;
  const box = jabBox(p);
  if (!box) return s;
  let hits = 0;
  let hitstop = 0;
  let shake = 0;
  const entities = s.entities.map((e) => {
    if (e.hp <= 0 || e.hitLockout > 0 || !overlaps(box, entityBox(e))) return e;
    // A pinned enemy is helpless, so the jab that frees it counts double.
    const damage = JAB_DAMAGE * (e.pinned ? JAB_CRIT_MULT : 1);
    const hurt = damageEntity(e, damage, p.x + p.w / 2, p.y + p.h / 2);
    // Rang off the armour: no hitstop, no death event, no reward for the swing.
    if (armoured(e, p.x + p.w / 2, p.y + p.h / 2)) return hurt;
    hits++;
    emit(s.events, hurt.hp <= 0 ? 'enemy.death' : 'hit', e.x + e.w / 2, e.y + e.h / 2, { id: e.id });
    hitstop = Math.max(hitstop, hurt.hp <= 0 ? HITSTOP_KILL : (e.mass === 1 ? HITSTOP_HEAVY : HITSTOP_HIT));
    shake = Math.max(shake, hurt.hp <= 0 ? SHAKE_KILL : SHAKE_HIT);
    return { ...hurt, vx: hurt.pinned ? 0 : Math.sign(hurt.vx || p.facing) * JAB_KNOCKBACK };
  });
  if (hits === 0) return s;
  return {
    ...s,
    entities,
    player: { ...p, jabHits: p.jabHits + hits },
    hitstop: Math.max(s.hitstop, hitstop),
    shake: Math.max(s.shake, shake),
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
    // The rising void is a hazard the finale stage owns outright: it kills rather
    // than costing a heart and bouncing you to safe ground, because "safe ground"
    // during the Ascent is the tile the void just ate.
    if (hz.kind === 'void') continue;
    if (!overlaps(box, hz)) continue;
    const hurt = damagePlayer(p, 1, hz.x + hz.w / 2, s.roomData.hazards);
    emit(s.events, hurt.hp <= 0 ? 'player.death' : 'player.hurt', p.x + p.w / 2, p.y + p.h / 2);
    if (hurt.hp <= 0) return { ...s, player: hurt, hitstop: Math.max(s.hitstop, HITSTOP_KILL), shake: Math.max(s.shake, SHAKE_HURT) };
    return {
      ...s,
      player: { ...hurt, x: p.safeGround.x, y: p.safeGround.y, vx: 0, vy: 0 },
      hitstop: Math.max(s.hitstop, HITSTOP_HIT),
      shake: Math.max(s.shake, SHAKE_HURT),
    };
  }
  return s;
}

/** @param {GameState} s @returns {GameState} */
function applyContact(s) {
  const p = s.player;
  if (p.hp <= 0 || p.iframes > 0) return s;
  // Zip suppresses contact damage (01 §4): skewering must not punish you for it.
  // Hazards still bite, so a zip into the spikes is still a zip into the spikes.
  if (p.zipFrames > 0) return s;
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const e of s.entities) {
    // Pinned is helpless: it cannot hurt you, which is what makes "nail it to the
    // wall, then walk up and jab it" a safe thing for the game to teach.
    if (e.hp <= 0 || e.pinned || !overlaps(box, entityBox(e))) continue;
    const damage = isBoss(e.kind) ? BOSS_CONTACT_DAMAGE : ENEMY_CONTACT_DAMAGE;
    const hurt = damagePlayer(p, damage, e.x + e.w / 2, s.roomData.hazards);
    emit(s.events, hurt.hp <= 0 ? 'player.death' : 'player.hurt', p.x + p.w / 2, p.y + p.h / 2, { id: e.id });
    return {
      ...s,
      player: hurt,
      hitstop: Math.max(s.hitstop, hurt.hp <= 0 ? HITSTOP_KILL : HITSTOP_HIT),
      shake: Math.max(s.shake, SHAKE_HURT),
    };
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
  emit(s.events, 'respawn', s.respawn.x, s.respawn.y);
  // Shards raise maxHp, so a respawn restores the *player's* meter, not the default
  // one. Rebuilding from createPlayer() here would silently eat every shard taken.
  const fresh = { ...createPlayer(s.respawn.x, s.respawn.y), maxHp: p.maxHp };
  const revived = {
    ...s, room: room.id, roomData: room,
    entities: spawnFor(room), nextEntityId: room.spawns.length + 1, props: spawnProps(room),
    player: { ...fresh, hp: fresh.maxHp },
  };
  const home = { ...createPin(), ...handAt(revived) };
  return {
    ...revived,
    pin: home,
    pinB: { ...home },
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
