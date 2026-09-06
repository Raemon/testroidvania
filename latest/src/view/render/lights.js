/**
 * Where the light is (06-revision-1 §D5).
 *
 * The sim owns the light list when it has one, because §D2 enemies aim at lights
 * and the two must never disagree. Until that lands, the same list is synthesised
 * here from the Pin and the player. Either way the numbers are §D5's and are not
 * to be shrunk: the darkness is a feel layer, no room is ever solved by it, and
 * the failure mode of a "tighter" light is a game you want to play with the Pin
 * held *and* thrown at once.
 */

import {
  LIGHT_AURA_R, LIGHT_AURA_PER_ABILITY, LIGHT_PIN_R,
  LIGHT_HAZARD_R, LIGHT_EYE_R, LIGHT_LANTERN_R, DEATH_RESPAWN_FRAMES,
} from '../../core/constants.js';
import { HAZARD, PLAYER } from './palette.js';
import { flicker } from './darkness.js';
import { loosePins } from './pin.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./darkness.js').Light} Light */

/**
 * The light the player carries goes out with them. Death is the one time a radius
 * shrinks — §D5's "never shrink the light" is about the calibration you play with,
 * and this is the sixty frames in which you are not playing.
 * @param {import('../../core/types.js').Player} p
 * @returns {number} multiplier on the aura's radius, 1 -> 40/90 over 60 frames
 */
function deathDim(p) {
  if (p.state !== 'dead' && p.hp > 0) return 1;
  const k = Math.max(0, Math.min(1, (p.deadFrames ?? 0) / DEATH_RESPAWN_FRAMES));
  return 1 - (1 - 40 / 90) * k;
}

/** @param {string} kind @returns {number} */
function radiusFor(kind) {
  if (kind === 'pin') return LIGHT_PIN_R;
  if (kind === 'hazard') return LIGHT_HAZARD_R;
  if (kind === 'eye') return LIGHT_EYE_R;
  if (kind === 'lantern') return LIGHT_LANTERN_R;
  return LIGHT_AURA_R;
}

/**
 * @param {Readonly<GameState>} state
 * @param {import('./palette.js').Region} region
 * @param {{x:number, y:number}} hand  where the rig actually drew the hand flame
 * @param {number} t seconds
 * @returns {Light[]} world-space lights
 */
export function buildLights(state, region, hand, t) {
  const f = flicker(t);
  const dying = deathDim(state.player);
  /** @type {Light[]} */
  const out = [];
  const sim = state.lights ?? [];

  if (sim.length > 0) {
    for (const l of sim) {
      const r = (l.r || radiusFor(l.kind)) * (l.kind === 'aura' || l.kind === 'pin' ? f : 1) * (l.kind === 'aura' ? dying : 1);
      // The aura is drawn from the hand, not the hitbox centre: the light has a
      // visible source and the two must be the same point.
      const fromHand = l.kind === 'aura';
      out.push({
        x: fromHand ? hand.x : l.x,
        y: fromHand ? hand.y : l.y,
        r,
        color: l.kind === 'hazard' ? HAZARD : l.kind === 'eye' ? region.accent : PLAYER.flame,
        warmth: l.kind === 'eye' ? 0 : 1,
      });
    }
    return out;
  }

  const abilities = state.progress?.abilities?.length ?? 0;
  const aura = LIGHT_AURA_R + abilities * LIGHT_AURA_PER_ABILITY;
  const loose = loosePins(state);

  out.push({ x: hand.x, y: hand.y, r: (loose.length ? aura : LIGHT_PIN_R) * f * dying, color: PLAYER.flame, warmth: 1 });
  for (const pin of loose) out.push({ x: pin.x, y: pin.y, r: LIGHT_PIN_R * f, color: PLAYER.flame, warmth: 1 });

  for (const hz of state.roomData?.hazards ?? []) {
    out.push({ x: hz.x + hz.w / 2, y: hz.y + hz.h / 2, r: LIGHT_HAZARD_R, color: HAZARD, warmth: 0 });
  }
  for (const l of state.roomData?.lanterns ?? []) {
    out.push({ x: l.x, y: l.y, r: LIGHT_LANTERN_R, color: PLAYER.flame, warmth: 1 });
  }
  for (const e of state.entities ?? []) {
    out.push({ x: e.x + e.w / 2, y: e.y + e.h * 0.4, r: LIGHT_EYE_R, color: region.accent, warmth: 0 });
  }
  return out;
}
