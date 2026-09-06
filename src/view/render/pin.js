/**
 * The Pin — your weapon, your platform and your light, all one object (00-BIBLE §1).
 *
 * The whole reason the darkness overlay is a system rather than a filter is that
 * the big light travels with this thing. So the drawing has one job above looking
 * good: wherever the flame is drawn is exactly where the light is punched, and the
 * light position comes from here rather than being recomputed elsewhere.
 *
 * Read defensively — the Pin's sim fields are landing while this is being written.
 */

import { PLAYER, rgba } from './palette.js';
import { drawGlow } from './glow.js';
import { hashNoise } from './rng.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('../../core/types.js').Pin} Pin */

const SHAFT = 11;

/** @param {Readonly<GameState>} state @returns {boolean} */
export function pinIsLoose(state) {
  const s = state.pin?.state ?? 'held';
  return s !== 'held';
}

/**
 * @param {Readonly<GameState>} state
 * @returns {{x:number, y:number}|null} world position of the Pin's flame, or null
 *   when the Pin is in hand (the player rig owns the light then)
 */
export function pinLight(state) {
  const pin = state.pin;
  if (!pin || pin.state === 'held') return null;
  return { x: pin.x, y: pin.y };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {import('./palette.js').Region} region
 * @param {number} t seconds
 */
export function drawPin(ctx, state, region, t) {
  const pin = state.pin;
  if (!pin || pin.state === 'held') return;

  // Orientation: embedded pins stand along their surface normal, flying ones
  // along their travel. Both fall back to the aim so a partial state still draws.
  let ax = pin.nx ?? 0;
  let ay = pin.ny ?? 0;
  if (pin.state === 'flying' || pin.state === 'returning' || pin.state === 'dropped') {
    const len = Math.hypot(pin.vx, pin.vy);
    if (len > 0.01) { ax = pin.vx / len; ay = pin.vy / len; }
    else { ax = pin.dirX ?? 1; ay = 0; }
  }
  if (Math.abs(ax) + Math.abs(ay) < 0.01) { ax = 1; ay = 0; }

  const tipX = pin.x + ax * -SHAFT * 0.35;
  const tipY = pin.y + ay * -SHAFT * 0.35;
  const headX = pin.x + ax * SHAFT * 0.65;
  const headY = pin.y + ay * SHAFT * 0.65;

  const clang = (pin.clang ?? 0) > 0;
  ctx.strokeStyle = clang ? '#FFFFFF' : '#2A2620';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(headX, headY);
  ctx.stroke();
  ctx.strokeStyle = rgba('#C9BFA6', 0.5);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // An embedded Pin is a ledge; drawing the platform lip is gameplay information,
  // not flourish, so it is always visible even inside the flame's own glare.
  if (pin.state === 'embedded' || pin.state === 'pinned') {
    ctx.strokeStyle = rgba('#C9BFA6', 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const px = -ay;
    const py = ax;
    ctx.moveTo(headX - px * 7, headY - py * 7);
    ctx.lineTo(headX + px * 7, headY + py * 7);
    ctx.stroke();
  }

  const wob = 0.85 + hashNoise(Math.floor(t * 11) ^ 0x51) * 0.3;
  drawGlow(ctx, headX, headY, 30 * wob, PLAYER.flame, 0.6);
  drawGlow(ctx, headX, headY, 11, PLAYER.core, 0.95);
  drawGlow(ctx, headX, headY, 7, region.accent, 0.2);

  const h = 7 * wob;
  ctx.fillStyle = PLAYER.flame;
  ctx.beginPath();
  ctx.moveTo(headX, headY - h);
  ctx.quadraticCurveTo(headX + h * 0.5, headY - h * 0.3, headX, headY + h * 0.35);
  ctx.quadraticCurveTo(headX - h * 0.5, headY - h * 0.3, headX, headY - h);
  ctx.fill();
  ctx.fillStyle = PLAYER.core;
  ctx.beginPath();
  ctx.arc(headX, headY - h * 0.25, h * 0.28, 0, Math.PI * 2);
  ctx.fill();
}
