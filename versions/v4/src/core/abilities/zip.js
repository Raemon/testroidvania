/**
 * A1 ZIP — fly to your embedded Pin at 12 px/f, gravity off, contact damage
 * suppressed.
 *
 * **The jump-cancel is the skill ceiling of the whole game.** Jump on any frame of a
 * zip ends it and hands the zip's velocity to the player, capped but well above run
 * speed, so a diagonal zip cancelled at the right frame carries momentum out of a
 * room. `accelerate()` only caps the direction being pushed, which is what lets that
 * carry survive until friction eats it. Nothing in this file may simplify that away.
 *
 * Arrival is decided by the surface the Pin is in, not by the zip: wall pin -> Hang,
 * floor pin -> stand on the cap, ceiling pin -> hang below, Pinned enemy -> Skewer.
 */

import {
  ZIP_SPEED, ZIP_ARRIVE_DIST, ZIP_MAX_FRAMES, ZIP_CANCEL_VX_CAP, ZIP_CANCEL_VY_CAP,
  ZIP_PASS_DAMAGE, SKEWER_DAMAGE, SKEWER_STUN, JUMP_VY, PIN_HAND_OFFSET, PIN_POLE_H,
  HITSTOP_HIT, HITSTOP_KILL, HANG_COOLDOWN,
} from '../constants.js';
import { IN, justPressed } from '../input.js';
import { overlapsSolid } from '../collision.js';
import { overlaps } from '../geometry.js';
import { pinPlatform } from '../pin-geometry.js';
import { damageEntity, entityBox } from '../entities/index.js';
import { hangAnchor } from '../grip.js';
import { stepJab } from '../jab.js';
import { releaseBody } from '../player.js';
import { emit } from '../events.js';

/** @typedef {import('../types.js').AbilityId} AbilityId */
/** @typedef {import('../types.js').GameState} GameState */
/** @typedef {import('../types.js').Player} Player */
/** @typedef {import('../types.js').Pin} Pin */
/** @typedef {import('../types.js').Entity} Entity */
/** @typedef {import('../types.js').AABB} AABB */

export const id = /** @type {AbilityId} */ ('zip');
export const name = 'Zip';
export const gate = 'height';

/** Motion slices, so a 12 px/f flight cannot cross a 16px tile unnoticed. */
const SUBSTEP = 4;

/** @param {readonly AbilityId[]} abilities @returns {boolean} */
export function owned(abilities) {
  return abilities.includes('zip');
}

/** @param {Readonly<Pin>} pin @returns {boolean} */
export function isAnchor(pin) {
  return pin.state === 'embedded' || pin.state === 'pinned';
}

/**
 * Where a zip would end up. The Pin's own anchor for an embed; the body it is
 * through for a Pinned enemy, because that is what you are aiming at.
 * @param {Readonly<GameState>} s
 * @param {Readonly<Pin>} pin
 * @returns {{x:number, y:number}}
 */
export function anchorOf(s, pin) {
  if (pin.state === 'pinned') {
    const host = s.entities.find((e) => e.id === pin.hostId);
    if (host) return { x: host.x + host.w / 2, y: host.y + host.h / 2 };
  }
  return { x: pin.x, y: pin.y };
}

/**
 * The zip stage. Runs after the Pin so a recall pressed this frame has already
 * released the anchor, and before grip so a cancel is seen by nothing else.
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageZip(s) {
  if (s.player.zipFrames > 0) return flyOn(s);
  return maybeStart(s);
}

/** @param {GameState} s @returns {GameState} */
function maybeStart(s) {
  const p = s.player;
  if (!owned(s.progress.abilities) || p.hp <= 0 || p.hurtFrames > 0) return s;
  if (!justPressed(s.input, s.prevInput, IN.ZIP)) return s;
  if (!isAnchor(s.pin)) return s;
  const to = anchorOf(s, s.pin);
  const from = { x: p.x + p.w / 2, y: p.y + PIN_HAND_OFFSET };
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist <= ZIP_ARRIVE_DIST) return s;
  emit(s.events, 'zip.start', from.x, from.y, { material: s.pin.surface });
  return {
    ...s,
    player: {
      ...releaseBody(p),
      zipFrames: 1,
      zipVx: ((to.x - from.x) / dist) * ZIP_SPEED,
      zipVy: ((to.y - from.y) / dist) * ZIP_SPEED,
      vx: 0,
      vy: 0,
      grounded: false,
      jumpFrames: 0,
      jumpBuffer: 0,
      coyote: 0,
    },
  };
}

/** @param {GameState} s @returns {GameState} */
function flyOn(s) {
  const ticked = stepJab({
    ...s.player,
    iframes: Math.max(0, s.player.iframes - 1),
    hurtFrames: Math.max(0, s.player.hurtFrames - 1),
    hangCooldown: Math.max(0, s.player.hangCooldown - 1),
  }, 0, 0);

  if (ticked.hp <= 0) return { ...s, player: end(ticked, 0, 0) };
  // The anchor left: recalled, shattered, or the host died. Let go with the carry.
  if (!isAnchor(s.pin)) return { ...s, player: cancel(ticked, false), events: s.events };
  if (justPressed(s.input, s.prevInput, IN.JUMP)) {
    emit(s.events, 'zip.cancel', ticked.x + ticked.w / 2, ticked.y + ticked.h / 2);
    return { ...s, player: cancel(ticked, true) };
  }
  if (ticked.zipFrames >= ZIP_MAX_FRAMES) return { ...s, player: cancel(ticked, false) };

  const to = anchorOf(s, s.pin);
  const moved = sweep(s, ticked, to);
  if (!moved.arrived) {
    return { ...s, player: { ...moved.player, zipFrames: ticked.zipFrames + 1 }, entities: moved.entities, hitstop: Math.max(s.hitstop, moved.hitstop) };
  }
  return arrive({ ...s, entities: moved.entities, hitstop: Math.max(s.hitstop, moved.hitstop) }, moved.player);
}

/**
 * One frame of zip motion, in slices, cutting anything it passes for 1.
 * @param {GameState} s
 * @param {Player} p
 * @param {{x:number,y:number}} to
 * @returns {{player: Player, entities: Entity[], hitstop: number, arrived: boolean}}
 */
function sweep(s, p, to) {
  let box = { x: p.x, y: p.y, w: p.w, h: p.h };
  let entities = /** @type {Entity[]} */ (s.entities.slice());
  let hitstop = 0;
  let arrived = false;
  const slices = Math.max(1, Math.ceil(ZIP_SPEED / SUBSTEP));

  for (let i = 0; i < slices; i++) {
    const hand = { x: box.x + box.w / 2, y: box.y + PIN_HAND_OFFSET };
    const dx = to.x - hand.x;
    const dy = to.y - hand.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= ZIP_ARRIVE_DIST) { arrived = true; break; }
    const stepLen = Math.min(ZIP_SPEED / slices, dist);
    const next = { ...box, x: box.x + (dx / dist) * stepLen, y: box.y + (dy / dist) * stepLen };
    // Running into terrain short of the anchor ends the zip where it stopped; it
    // never pushes the body into a solid, which invariant 7 re-checks anyway.
    if (overlapsSolid(s.roomData, next)) { arrived = true; break; }
    box = next;

    entities = entities.map((e) => {
      if (e.hp <= 0 || e.id === s.pin.hostId || e.hitLockout > 0) return e;
      if (!overlaps(box, entityBox(e))) return e;
      const hurt = damageEntity(e, ZIP_PASS_DAMAGE, box.x + box.w / 2);
      hitstop = Math.max(hitstop, hurt.hp <= 0 ? HITSTOP_KILL : HITSTOP_HIT);
      emit(s.events, hurt.hp <= 0 ? 'enemy.death' : 'hit', e.x + e.w / 2, e.y + e.h / 2, { id: e.id });
      return hurt;
    });
  }
  return { player: { ...p, x: box.x, y: box.y }, entities, hitstop, arrived };
}

/**
 * Arrival. Which of the four landings you get is decided by the Pin's surface
 * normal, so the throw already told the player where they would end up.
 * @param {GameState} s
 * @param {Player} p
 * @returns {GameState}
 */
function arrive(s, p) {
  const pin = s.pin;
  emit(s.events, 'zip.arrive', pin.x, pin.y, { material: pin.surface });

  if (pin.state === 'pinned') return skewer(s, p);

  if (pin.nx !== 0) {
    const at = hangAnchor({ x: p.x, y: p.y, w: p.w, h: p.h }, pin);
    if (!overlapsSolid(s.roomData, { x: at.x, y: at.y, w: p.w, h: p.h })) {
      emit(s.events, 'hang', at.x + p.w / 2, at.y + p.h / 2, { material: pin.surface });
      return { ...s, player: { ...end(p, 0, 0), x: at.x, y: at.y, hang: true, facing: /** @type {-1|1} */ (pin.nx > 0 ? -1 : 1) } };
    }
    return { ...s, player: end(p, 0, 0) };
  }

  const plat = pinPlatform(pin);
  if (plat && pin.ny < 0) {
    // Floor pin: stand on the cap of the pole.
    const at = { x: plat.x + plat.w / 2 - p.w / 2, y: plat.y - p.h };
    if (!overlapsSolid(s.roomData, { x: at.x, y: at.y, w: p.w, h: p.h })) {
      return { ...s, player: { ...end(p, 0, 0), x: at.x, y: at.y, grounded: true, coyote: 0 } };
    }
  }
  if (plat && pin.ny > 0) {
    // Ceiling pin: hang below it. Jump or Down lets go.
    const at = { x: pin.x - p.w / 2, y: pin.y + PIN_POLE_H - PIN_HAND_OFFSET };
    if (!overlapsSolid(s.roomData, { x: at.x, y: at.y, w: p.w, h: p.h })) {
      return { ...s, player: { ...end(p, 0, 0), x: at.x, y: at.y, hangBelow: true } };
    }
  }
  return { ...s, player: end(p, 0, 0) };
}

/**
 * Skewer: 3 damage to a helpless body, and it is freed with a 20-frame stun. The
 * Pin drops out of it, which is what makes the follow-up a recall rather than a
 * second free hit.
 * @param {GameState} s @param {Player} p @returns {GameState}
 */
function skewer(s, p) {
  let hitstop = s.hitstop;
  const entities = s.entities.map((e) => {
    if (e.id !== s.pin.hostId) return e;
    const hurt = damageEntity({ ...e, hitLockout: 0 }, SKEWER_DAMAGE, p.x + p.w / 2);
    hitstop = Math.max(hitstop, hurt.hp <= 0 ? HITSTOP_KILL : HITSTOP_HIT);
    emit(s.events, hurt.hp <= 0 ? 'enemy.death' : 'hit', e.x + e.w / 2, e.y + e.h / 2, { id: e.id });
    return { ...hurt, pinned: false, stun: SKEWER_STUN };
  });
  return {
    ...s,
    entities,
    hitstop,
    player: end(p, 0, 0),
    pin: { ...s.pin, state: 'dropped', hostId: null, hostTimer: 0, surface: null, nx: 0, ny: 0, vx: 0, vy: 0 },
  };
}

/**
 * The jump-cancel. The zip's velocity becomes the player's, capped; a jump adds its
 * own impulse on top. This is the move the game is built around.
 * @param {Player} p
 * @param {boolean} jumped
 * @returns {Player}
 */
function cancel(p, jumped) {
  const vx = clampTo(p.zipVx, ZIP_CANCEL_VX_CAP);
  const carried = clampTo(p.zipVy, ZIP_CANCEL_VY_CAP);
  const vy = jumped ? Math.max(carried + JUMP_VY, -ZIP_CANCEL_VY_CAP) : carried;
  return {
    ...end(p, vx, vy),
    facing: /** @type {-1|1} */ (vx === 0 ? p.facing : (vx > 0 ? 1 : -1)),
    jumpFrames: jumped ? 1 : 0,
    jumpCut: false,
    hangCooldown: HANG_COOLDOWN,
  };
}

/** @param {Player} p @param {number} vx @param {number} vy @returns {Player} */
function end(p, vx, vy) {
  return { ...p, zipFrames: 0, zipVx: 0, zipVy: 0, vx, vy };
}

/** @param {number} v @param {number} cap @returns {number} */
function clampTo(v, cap) {
  return v < -cap ? -cap : v > cap ? cap : v;
}
