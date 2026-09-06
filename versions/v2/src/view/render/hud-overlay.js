/**
 * The in-world HUD (05-aesthetic §5): health as a row of lantern flames, and the
 * abilities you have as lit glyph discs.
 *
 * Health is flames because the whole game is about carrying a light: losing a
 * point should look like losing light, not like a bar shrinking. A lost flame
 * *gutters* — it shrinks and smokes and leaves its empty iron behind, so the
 * player can still see how much they used to have.
 *
 * The debug readout with the `data-testid` fields is a separate thing entirely
 * (`src/view/hud.js`); the test harness asserts against that, not against this.
 * Wick, the stroke font, is deferred, so any text here is a system font.
 */

import { VIEW_W, VIEW_H } from '../../core/constants.js';
import { CREAM, PLAYER, rgba } from './palette.js';
import { drawGlow } from './glow.js';
import { hashNoise } from './rng.js';

/** @typedef {import('../../core/types.js').GameState} GameState */

const X0 = 12;
const Y0 = 12;
const CELL = 14;
const LANTERN_W = 10;
const LANTERN_H = 14;

/** Per-slot gutter timers, so a lost flame can animate out after the sim moved on. */
const gutter = /** @type {number[]} */ ([]);
let lastHp = -1;

/** Ability id -> a 5-point glyph on a unit box, drawn as a polyline. */
const GLYPHS = /** @type {Record<string, number[][]>} */ ({
  zip: [[-1, 0.6], [0.1, -0.1], [-0.3, -0.1], [1, -0.8]],
  deepPin: [[0, -1], [0, 0.7], [-0.5, 0.2], [0, 0.7], [0.5, 0.2]],
  reel: [[0.8, -0.8], [-0.4, -0.4], [0.4, 0.1], [-0.6, 0.6]],
  ricochet: [[-0.9, -0.7], [0.5, 0.2], [-0.3, 0.8]],
  twinPin: [[-0.5, -0.9], [-0.5, 0.7], [0.5, -0.9], [0.5, 0.7]],
});

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {number} frame
 * @param {number} dt
 */
export function drawHudOverlay(ctx, state, frame, dt) {
  const p = state.player;
  if (lastHp >= 0 && p.hp < lastHp) {
    for (let i = p.hp; i < lastHp; i++) gutter[i] = 18;
  }
  lastHp = p.hp;

  for (let i = 0; i < p.maxHp; i++) {
    const x = X0 + i * CELL;
    const lit = i < p.hp;
    const g = gutter[i] ?? 0;
    if (g > 0) gutter[i] = g - dt;
    drawLantern(ctx, x, Y0, lit, g / 18, i === p.hp - 1 && p.hp === 1, frame);
  }

  const abilities = state.progress?.abilities ?? [];
  for (let i = 0; i < abilities.length; i++) {
    const id = abilities[i];
    if (!id) continue;
    drawAbility(ctx, X0 + 3 + i * 26, VIEW_H - 26, id, frame);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y
 * @param {boolean} lit
 * @param {number} guttering 0..1, freshly lost
 * @param {boolean} last  the final point of health
 * @param {number} frame
 */
function drawLantern(ctx, x, y, lit, guttering, last, frame) {
  ctx.strokeStyle = rgba(CREAM, lit ? 0.7 : 0.32);
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, LANTERN_W, LANTERN_H, 2);
  ctx.stroke();
  // The hanging ring: the iron reads as a lantern rather than a rounded rect.
  ctx.beginPath();
  ctx.arc(x + LANTERN_W / 2 + 0.5, y - 1.5, 1.6, Math.PI, 0);
  ctx.stroke();

  const shrink = guttering > 0 ? guttering : lit ? 1 : 0;
  if (shrink <= 0) return;

  // At one point of health the last flame flickers hard: the fear is in the HUD.
  const wob = last ? 0.7 + hashNoise(Math.floor(frame / 7)) * 0.6 : 0.92 + hashNoise(Math.floor(frame / 11)) * 0.16;
  const h = 6 * shrink * wob;
  const w = h * 0.5;
  const cx = x + LANTERN_W / 2 + 0.5;
  const base = y + LANTERN_H - 3;

  drawGlow(ctx, cx, base - h * 0.4, 9 * shrink, PLAYER.flame, 0.5);
  ctx.fillStyle = PLAYER.flame;
  ctx.beginPath();
  ctx.moveTo(cx, base - h);
  ctx.quadraticCurveTo(cx + w, base - h * 0.35, cx, base);
  ctx.quadraticCurveTo(cx - w, base - h * 0.35, cx, base - h);
  ctx.fill();
  ctx.fillStyle = PLAYER.core;
  ctx.beginPath();
  ctx.ellipse(cx, base - h * 0.3, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy
 * @param {string} id
 * @param {number} frame
 */
function drawAbility(ctx, cx, cy, id, frame) {
  ctx.fillStyle = rgba('#0B0D12', 0.75);
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(CREAM, 0.55);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const glyph = GLYPHS[id];
  if (!glyph) return;
  ctx.strokeStyle = PLAYER.core;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < glyph.length; i++) {
    const pt = glyph[i];
    if (!pt) continue;
    const px = cx + (pt[0] ?? 0) * 5.5;
    const py = cy + (pt[1] ?? 0) * 5.5;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  drawGlow(ctx, cx, cy, 10, PLAYER.flame, 0.18 + 0.06 * Math.sin(frame * 0.05));
}

/**
 * The room name, bottom-right, at a whisper. A temporary stand-in for the map
 * screen; it exists so a screenshot always says which room it is.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} room
 */
export function drawRoomLabel(ctx, room) {
  ctx.font = '8px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = rgba(CREAM, 0.28);
  ctx.fillText(room.toUpperCase().replace(/_/g, ' '), VIEW_W - 10, VIEW_H - 8);
  ctx.textAlign = 'left';
}
