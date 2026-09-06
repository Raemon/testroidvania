/**
 * THE PIN. `Held -> Flying -> {Embedded | Pinned | Dropped} -> Returning -> Held`,
 * and nothing else is ever true of it (invariant PIN_STATE).
 *
 * The one rule the whole game hangs off: **Recall is unconditional**. There is no
 * branch in this file that can refuse a recall, no cooldown on it, and no terrain
 * that stops it — that is what makes "the player can never be stranded" a property
 * of the code rather than a promise in a document (06-revision-1 §G).
 *
 * The frame order inside a Pin step is fixed: recall press -> throw press ->
 * startup -> motion (substepped so a 13 px/f flight cannot tunnel a 16px tile) ->
 * pickup -> auto-recall bookkeeping.
 */

import {
  TILE, PIN_THROW_STARTUP, PIN_SPEED, PIN_RANGE, PIN_FALL_GRAVITY, PIN_RECALL_SPEED,
  PIN_CATCH_RADIUS, PIN_THROW_LOCK, PIN_HAND_OFFSET, PIN_CLANG_FLASH_FRAMES,
  PIN_AUTO_RECALL_FRAMES, PIN_PINNED_FRAMES, PIN_RECALL_DAMAGE,
  PIN_WATER_SINK, HITSTOP_HIT, HITSTOP_KILL, TERMINAL_VY,
} from './constants.js';
import { IN, justPressed, axisX, axisY } from './input.js';
import { glyphAt, solidAt, overlapsSolid, inWater } from './collision.js';
import { tileAt } from '../content/tiles.js';
import { overlaps, pointToSegment } from './geometry.js';
import { pinHitbox, contactAhead } from './pin-geometry.js';
import { damageEntity, entityBox } from './entities/index.js';
import { strikeEntity } from './pin-strike.js';
import { bitesMaterial, freezesMechanisms } from './abilities/deepPin.js';
import { canBounce, bounce } from './abilities/ricochet.js';
import { startReel } from './abilities/reel.js';
import { breakTile } from './rooms.js';
import { emit } from './events.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Pin} Pin */
/** @typedef {import('./types.js').Entity} Entity */
/** @typedef {import('./types.js').Room} Room */
/** @typedef {import('./types.js').AbilityId} AbilityId */

/** Motion is resolved in slices no longer than this, so nothing tunnels a tile. */
const SUBSTEP = 4;

/** @returns {Pin} */
export function createPin() {
  return {
    state: 'held', x: 0, y: 0, vx: 0, vy: 0, travelled: 0, surface: null,
    dirX: 1, dirY: 0, hostId: null,
    startup: 0, aimX: 1, aimY: 0, nx: 0, ny: 0,
    inert: false, clang: 0, away: 0, lock: 0, hostTimer: 0,
    bounces: 0, propId: null,
  };
}

/**
 * A Pin embeds in wood from the start and in stone once Deep Pin is earned. Metal
 * never takes it — that is the whole gating vocabulary (00-BIBLE §5).
 * @param {Room} room
 * @param {number} tx
 * @param {number} ty
 * @param {readonly AbilityId[]} abilities
 * @returns {'embed'|'clang'|'crumble'|'reject'|'pass'}
 */
export function surfaceVerdict(room, tx, ty, abilities) {
  const def = tileAt(glyphAt(room, tx, ty));
  if (!def.solid) return 'pass';
  if (def.crumble) return 'crumble';
  if (def.material === 'metal') return 'clang';
  if (!def.pinnable) return 'reject';
  return bitesMaterial(def.material, abilities) ? 'embed' : 'reject';
}

/** Where the Pin sits while it is in the hand. @param {GameState} s @returns {{x:number,y:number}} */
export function handAt(s) {
  return { x: s.player.x + s.player.w / 2, y: s.player.y + PIN_HAND_OFFSET };
}

/**
 * The Pin stage. Returns a fresh state; never throws.
 * @param {GameState} s
 * @returns {GameState}
 */
export function stagePin(s) {
  const pressed = justPressed(s.input, s.prevInput, IN.THROW);
  let pin = { ...s.pin, lock: Math.max(0, s.pin.lock - 1), clang: Math.max(0, s.pin.clang - 1) };
  let entities = s.entities;
  let flash = Math.max(0, s.flash - 1);
  let hitstop = 0;
  let roomData = s.roomData;
  let brokenTiles = s.brokenTiles;

  if (pin.state === 'held') {
    const hand = handAt(s);
    pin = { ...pin, x: hand.x, y: hand.y, vx: 0, vy: 0 };
    if (pressed && pin.lock === 0 && pin.startup === 0 && s.player.hp > 0) {
      const aimX = /** @type {-1|0|1} */ (axisX(s.input));
      const aimY = /** @type {-1|0|1} */ (axisY(s.input));
      const neutral = aimX === 0 && aimY === 0;
      pin = {
        ...pin,
        startup: PIN_THROW_STARTUP,
        aimX: neutral ? s.player.facing : aimX,
        aimY: neutral ? 0 : aimY,
      };
      // §D1.3: freeze horizontal velocity for the startup, so "stand three tiles
      // out and throw diagonal" lands in the same place every time.
      emit(s.events, 'pin.throw', hand.x, hand.y);
      return { ...s, pin, flash, player: { ...s.player, throwFreeze: PIN_THROW_STARTUP, vx: 0 } };
    }
    if (pin.startup > 0) {
      pin = { ...pin, startup: pin.startup - 1 };
      if (pin.startup === 0) pin = launch(pin, hand);
    }
    return { ...s, pin, flash };
  }

  // Recall: available from every other state, on every frame, with no condition.
  let props = s.props;
  if (pressed && pin.state !== 'returning') {
    emit(s.events, 'pin.recall', pin.x, pin.y);
    // A2: the recall is what shatters a slag block the Pin is buried in.
    const slag = slagUnder(s, pin, roomData);
    if (slag) {
      const broken = breakTile(roomData, brokenTiles, slag[0], slag[1]);
      roomData = broken.room;
      brokenTiles = broken.brokenTiles;
      emit(s.events, 'slag.shatter', (slag[0] + 0.5) * TILE, (slag[1] + 0.5) * TILE, { material: 'stone' });
    }
    // A3: whatever the Pin was in comes with it, for as far as it can get.
    const dragged = startReel(s, pin);
    entities = releaseHost(dragged.entities, pin);
    props = dragged.props;
    pin = { ...pin, state: 'returning', inert: false, away: 0, hostId: null, hostTimer: 0, propId: null, surface: null, nx: 0, ny: 0 };
  }

  if (pin.state === 'returning') {
    const result = stepReturning(s, pin, entities);
    if (result.pin.state === 'held') emit(s.events, 'pin.catch', result.pin.x, result.pin.y);
    return { ...s, pin: result.pin, entities: result.entities, props, roomData, brokenTiles, hitstop: Math.max(s.hitstop, result.hitstop), flash };
  }

  if (pin.state === 'flying') {
  const moved = stepFlying(s, pin, entities, roomData);
    pin = moved.pin;
    entities = moved.entities;
    hitstop = moved.hitstop;
    if (moved.clang) {
      flash = PIN_CLANG_FLASH_FRAMES;
      emit(s.events, 'pin.clang', pin.x, pin.y, { material: 'metal' });
    }
    if (moved.bounced) emit(s.events, 'pin.ricochet', pin.x, pin.y, { material: 'metal' });
    if (pin.state === 'embedded' && s.pin.state !== 'embedded') {
      emit(s.events, 'pin.embed', pin.x, pin.y, { material: pin.surface });
    }
    if (pin.state === 'pinned' && s.pin.state !== 'pinned') {
      emit(s.events, 'pin.enemy', pin.x, pin.y, { id: pin.hostId ?? undefined });
    }
    if (moved.broke) {
      const broken = breakTile(roomData, brokenTiles, moved.broke[0], moved.broke[1]);
      roomData = broken.room;
      brokenTiles = broken.brokenTiles;
      emit(s.events, 'crumble.break', (moved.broke[0] + 0.5) * TILE, (moved.broke[1] + 0.5) * TILE, { material: 'wood' });
    }
  } else if (pin.state === 'pinned') {
    const host = entities.find((e) => e.id === pin.hostId);
    if (!host || host.hp <= 0) {
      pin = { ...pin, state: 'dropped', hostId: null, hostTimer: 0, vx: 0, vy: 0 };
    } else if (pin.hostTimer <= 1) {
      // The 90 frames are up: it wriggles free and the Pin falls.
      entities = entities.map((e) => (e.id === host.id ? { ...e, pinned: false } : e));
      pin = { ...pin, state: 'dropped', hostId: null, hostTimer: 0, vx: 0, vy: 0 };
    } else {
      pin = { ...pin, hostTimer: pin.hostTimer - 1, x: host.x + host.w / 2, y: host.y + host.h / 2 };
    }
  } else if (pin.state === 'dropped') {
    const box = { x: s.player.x, y: s.player.y, w: s.player.w, h: s.player.h };
    if (s.player.hp > 0 && overlaps(box, { x: pin.x - 6, y: pin.y - 4, w: 12, h: 8 })) {
      pin = { ...createPin(), lock: PIN_THROW_LOCK };
      emit(s.events, 'pin.catch', pin.x, pin.y);
    }
  }

  pin = trackAutoRecall(s, pin, roomData);
  return { ...s, pin, entities, props, roomData, brokenTiles, flash, hitstop: Math.max(s.hitstop, hitstop) };
}

/** @param {Pin} pin @param {{x:number,y:number}} from @returns {Pin} */
function launch(pin, from) {
  const diagonal = pin.aimX !== 0 && pin.aimY !== 0;
  const comp = diagonal ? PIN_SPEED / Math.SQRT2 : PIN_SPEED;
  return {
    ...pin,
    state: 'flying',
    x: from.x,
    y: from.y,
    vx: pin.aimX * comp,
    vy: pin.aimY * comp,
    dirX: /** @type {-1|1} */ (pin.aimX === 0 ? pin.dirX : pin.aimX),
    dirY: pin.aimY,
    travelled: 0,
    inert: false,
    surface: null,
    nx: 0,
    ny: 0,
  };
}

/**
 * @param {readonly Entity[]} entities
 * @param {Readonly<Pin>} pin
 * @returns {Entity[]}
 */
function releaseHost(entities, pin) {
  if (pin.hostId === null) return /** @type {Entity[]} */ (entities.slice());
  return entities.map((e) => (e.id === pin.hostId ? { ...e, pinned: false } : e));
}

/**
 * Recall flight: straight at the player, through everything, 1 damage on the line.
 * @param {GameState} s
 * @param {Pin} pin
 * @param {readonly Entity[]} entities
 * @returns {{pin: Pin, entities: Entity[], hitstop: number}}
 */
function stepReturning(s, pin, entities) {
  const target = handAt(s);
  const dx = target.x - pin.x;
  const dy = target.y - pin.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= PIN_CATCH_RADIUS) {
    return { pin: { ...createPin(), lock: PIN_THROW_LOCK, x: target.x, y: target.y }, entities: /** @type {Entity[]} */ (entities.slice()), hitstop: 0 };
  }
  const step = Math.min(PIN_RECALL_SPEED, dist);
  const nx = pin.x + (dx / dist) * step;
  const ny = pin.y + (dy / dist) * step;

  let hitstop = 0;
  const next = entities.map((e) => {
    if (e.hp <= 0) return e;
    const b = entityBox(e);
    const reach = Math.max(b.w, b.h) / 2 + 4;
    if (pointToSegment(b.x + b.w / 2, b.y + b.h / 2, pin.x, pin.y, nx, ny) > reach) return e;
    if (e.hitLockout > 0) return e;
    const hurt = damageEntity(e, PIN_RECALL_DAMAGE, pin.x);
    hitstop = Math.max(hitstop, hurt.hp <= 0 ? HITSTOP_KILL : HITSTOP_HIT);
    return hurt;
  });

  const caught = { ...pin, x: nx, y: ny, vx: (dx / dist) * PIN_RECALL_SPEED, vy: (dy / dist) * PIN_RECALL_SPEED };
  return { pin: caught, entities: next, hitstop };
}

/**
 * Flight: substepped motion against terrain and entities.
 * @param {GameState} s
 * @param {Pin} pin
 * @param {readonly Entity[]} entities
 * @param {Room} room
 * @returns {{pin: Pin, entities: Entity[], hitstop: number, clang: boolean, bounced: boolean, broke: [number,number]|null}}
 */
function stepFlying(s, pin, entities, room) {
  let next = { ...pin };
  let list = /** @type {Entity[]} */ (entities.slice());
  let hitstop = 0;
  let clang = false;
  let bounced = false;
  /** @type {[number,number]|null} */
  let broke = null;

  if (next.inert) {
    next.vy = Math.min(next.vy + PIN_FALL_GRAVITY, TERMINAL_VY);
  } else if (next.travelled >= PIN_RANGE) {
    // Past range it loses force and simply falls until something catches it.
    next = { ...next, inert: true, vx: 0 };
  }
  if (inWater(room, next.x, next.y)) {
    next = { ...next, inert: true, vx: 0, vy: PIN_WATER_SINK };
  }

  const speed = Math.hypot(next.vx, next.vy);
  const slices = Math.max(1, Math.ceil(speed / SUBSTEP));
  for (let i = 0; i < slices && next.state === 'flying'; i++) {
    const sx = next.vx / slices;
    const sy = next.vy / slices;
    const contact = contactAhead(room, s.props, next.x, next.y, sx, sy);
    if (contact) {
      const hit = resolveSurface(s, room, next, contact);
      next = hit.pin;
      clang = clang || hit.clang;
      bounced = bounced || hit.bounced;
      broke = hit.broke ?? broke;
      // A bounce is the one outcome that keeps flying, so it spends the slice and
      // carries on rather than ending the frame's motion.
      if (hit.bounced) continue;
      break;
    }
    // Range counts flight, not the fall afterwards, so `travelled` stays the
    // number the range cap is written in terms of.
    const flown = next.inert ? 0 : Math.hypot(sx, sy);
    next = { ...next, x: next.x + sx, y: next.y + sy, travelled: next.travelled + flown };

    const hitIdx = list.findIndex((e) => e.hp > 0 && !e.pinned && overlaps(pinHitbox(next), entityBox(e)));
    if (hitIdx >= 0 && !next.inert) {
      const target = /** @type {Entity} */ (list[hitIdx]);
      const result = strikeEntity(s, room, next, target);
      list = list.map((e, idx) => (idx === hitIdx ? result.entity : e));
      next = result.pin;
      hitstop = result.entity.hp <= 0 ? HITSTOP_KILL : HITSTOP_HIT;
      break;
    }
  }

  return { pin: next, entities: list, hitstop, clang, bounced, broke };
}


/**
 * The slag block a Pin is buried in, if any. Recall shatters it — the Barrier gate
 * is the one explicit lock in the game and this is the only thing that opens it.
 * @param {GameState} s @param {Readonly<Pin>} pin @param {Room} room
 * @returns {[number, number]|null}
 */
function slagUnder(s, pin, room) {
  if (pin.state !== 'embedded' || pin.propId !== null) return null;
  if (!freezesMechanisms(s.progress.abilities)) return null;
  const tx = Math.floor((pin.x - pin.nx) / TILE);
  const ty = Math.floor((pin.y - pin.ny) / TILE);
  return tileAt(glyphAt(room, tx, ty)).slag ? [tx, ty] : null;
}





/**
 * What one surface does to the Pin. Every material outcome the game has lives here,
 * once: embed, crumble, bank, clang, and the dead stop that stone gives you before
 * Deep Pin. `stepFlying` used to spell all five out three times over.
 *
 * @param {GameState} s
 * @param {Room} room
 * @param {Pin} pin
 * @param {import('./pin-geometry.js').PinContact} contact
 * @returns {{pin: Pin, clang: boolean, bounced: boolean, broke: [number,number]|null}}
 */
function resolveSurface(s, room, pin, contact) {
  const at = { ...pin, x: contact.x, y: contact.y };
  const onRail = contact.propId !== null;
  // A rail is metal, so it clangs — until Deep Pin, which embeds in its core and
  // stops it dead (§G). That is the same sentence as stone, in a different tile.
  const verdict = onRail
    ? (freezesMechanisms(s.progress.abilities) ? 'embed' : 'clang')
    : surfaceVerdict(room, contact.tx, contact.ty, s.progress.abilities);

  if (verdict === 'embed' && !pin.inert) {
    return {
      pin: {
        ...at, state: 'embedded', vx: 0, vy: 0, nx: contact.nx, ny: contact.ny, away: 0,
        propId: contact.propId,
        surface: onRail ? 'metal' : tileAt(glyphAt(room, contact.tx, contact.ty)).material,
      },
      clang: false, bounced: false, broke: null,
    };
  }
  if (verdict === 'crumble') {
    // The tile gives way rather than holding the Pin (§G).
    return { pin: { ...at, inert: true, vx: 0, vy: 0 }, clang: false, bounced: false, broke: [contact.tx, contact.ty] };
  }
  if (verdict === 'clang' && canBounce(pin, s.progress.abilities)) {
    // A4 turns the one thing the Pin could never do into a bank shot. Range keeps
    // counting through the bounce, so it is a throw and not a free second one.
    return { pin: bounce(at, contact.nx, contact.ny), clang: false, bounced: true, broke: null };
  }
  // Clang is the most important readability event in the game: white flash, then
  // straight down. Everything else non-pinnable just stops dead.
  const stopped = verdict === 'clang'
    ? { ...at, inert: true, vx: 0, clang: PIN_CLANG_FLASH_FRAMES }
    : { ...at, inert: true, vx: 0 };
  const landed = contact.ny < 0
    ? { ...stopped, state: /** @type {import('./types.js').PinState} */ ('dropped'), y: contact.y - 2, vy: 0 }
    : stopped;
  return { pin: landed, clang: verdict === 'clang' && !pin.inert, bounced: false, broke: null };
}

/**
 * A Pin outside the room, or sitting in something that kills, comes home by
 * itself after 30 frames. Along with unconditional recall this is why "where is
 * my Pin" can never become "my run is over".
 * @param {GameState} s @param {Pin} pin @param {Room} room
 * @returns {Pin}
 */
function trackAutoRecall(s, pin, room) {
  const outside = pin.x < 0 || pin.y < 0 || pin.x > room.w * TILE || pin.y > room.h * TILE;
  const inKillVolume = s.roomData.hazards.some((hz) => overlaps({ x: pin.x - 2, y: pin.y - 2, w: 4, h: 4 }, hz));
  if (!outside && !inKillVolume) return { ...pin, away: 0 };
  const away = pin.away + 1;
  if (away < PIN_AUTO_RECALL_FRAMES) return { ...pin, away };
  return { ...pin, state: 'returning', inert: false, away: 0, hostId: null, hostTimer: 0, surface: null, nx: 0, ny: 0 };
}

/**
 * Room transition, death and respawn all say the same thing: the Pin is in your
 * hand again. §G lists these separately; they are one line.
 * @param {GameState} s
 * @returns {GameState}
 */
export function snapPinToHand(s) {
  const hand = handAt(s);
  const fresh = { ...createPin(), x: hand.x, y: hand.y };
  return { ...s, pin: fresh, pinB: { ...fresh } };
}
