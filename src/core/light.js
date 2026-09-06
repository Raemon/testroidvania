/**
 * The light model (06-revision-1 §D5). Data only: this file says where the holes
 * in the dark are and which tiles have been seen; the renderer decides how any of
 * that looks.
 *
 * Two rules are load-bearing and must survive every future edit:
 *  - **The radii do not shrink.** The temptation, on seeing that a 260px hole lights
 *    most of a 480px viewport, is to shrink it — which produces the version where
 *    you want the Pin thrown *and* held. Darkness is a feel layer, not a puzzle.
 *  - **The hand is never empty.** With the Pin away, an ember carries the same 90px
 *    aura, so local platforming is always legible.
 */

import {
  TILE, LIGHT_AURA_R, LIGHT_AURA_PER_ABILITY, LIGHT_PIN_R, LIGHT_HAZARD_R,
  LIGHT_EYE_R, LIGHT_LANTERN_R,
} from './constants.js';
import { entityEye } from './entities/index.js';
import { owned as hasTwinPin } from './abilities/twinPin.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Light} Light */

/** @param {Readonly<GameState>} s @returns {number} the player's aura radius */
export function auraRadius(s) {
  return LIGHT_AURA_R + LIGHT_AURA_PER_ABILITY * s.progress.abilities.length;
}

/**
 * Every light hole this frame. The Pin's light travels with the Pin, whatever
 * state it is in, which is the entire point of the unification (00-BIBLE §1).
 * @param {Readonly<GameState>} s
 * @returns {Light[]}
 */
export function computeLights(s) {
  /** @type {Light[]} */
  const lights = [
    { x: s.player.x + s.player.w / 2, y: s.player.y + s.player.h / 2, r: auraRadius(s), kind: 'aura' },
    { x: s.pin.x, y: s.pin.y, r: LIGHT_PIN_R, kind: 'pin' },
  ];
  // A5's second light. Only when it is actually out there: two lights in one hand
  // is one light, and a §D2 enemy would see a decoy that is not a decoy.
  if (hasTwinPin(s.progress.abilities) && s.pinB.state !== 'held') {
    lights.push({ x: s.pinB.x, y: s.pinB.y, r: LIGHT_PIN_R, kind: 'pin' });
  }
  for (const hz of s.roomData.hazards) {
    lights.push({ x: hz.x + hz.w / 2, y: hz.y + hz.h / 2, r: LIGHT_HAZARD_R, kind: 'hazard' });
  }
  for (const lantern of s.roomData.lanterns) {
    if (s.progress.lanternsLit.includes(lanternId(s.roomData.id, lantern.at))) {
      lights.push({ x: lantern.x, y: lantern.y, r: LIGHT_LANTERN_R, kind: 'lantern' });
    }
  }
  for (const e of s.entities) {
    if (e.hp <= 0) continue;
    const eye = entityEye(e);
    lights.push({ x: eye.x, y: eye.y, r: LIGHT_EYE_R, kind: 'eye' });
  }
  return lights;
}

/** @param {string} roomId @param {readonly number[]} at @returns {string} */
export function lanternId(roomId, at) {
  return `${roomId}@${at[0]},${at[1]}`;
}

/**
 * Fold this frame's lights into the room's seen-tile memory. One number per tile
 * row, one bit per column — cheap to hash, cheap to draw, and it means a room is
 * never re-explored blind.
 * @param {Readonly<GameState>} s
 * @returns {Record<string, number[]>} a fresh map when anything was learned
 */
export function rememberSeen(s) {
  const room = s.roomData;
  const prev = s.discovered[room.id] ?? new Array(room.h).fill(0);
  const rows = prev.slice();
  let changed = false;
  for (const light of s.lights) {
    if (light.kind === 'eye') continue;
    const lo = Math.max(0, Math.floor((light.y - light.r) / TILE));
    const hi = Math.min(room.h - 1, Math.floor((light.y + light.r) / TILE));
    for (let ty = lo; ty <= hi; ty++) {
      const txLo = Math.max(0, Math.floor((light.x - light.r) / TILE));
      const txHi = Math.min(room.w - 1, Math.floor((light.x + light.r) / TILE));
      let row = rows[ty] ?? 0;
      for (let tx = txLo; tx <= txHi; tx++) {
        const bit = 1 << tx;
        if (row & bit) continue;
        const dx = (tx + 0.5) * TILE - light.x;
        const dy = (ty + 0.5) * TILE - light.y;
        if (dx * dx + dy * dy > light.r * light.r) continue;
        row |= bit;
        changed = true;
      }
      rows[ty] = row;
    }
  }
  if (!changed && s.discovered[room.id]) return s.discovered;
  return { ...s.discovered, [room.id]: rows };
}
