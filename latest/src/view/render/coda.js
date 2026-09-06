/**
 * The coda: what the player looks at once the run is over.
 *
 * Before this, `game.complete` set a flag and nothing else happened — frames
 * 13,955 to 14,273 of a full playthrough were pixel-identical. The last thing a
 * player saw was a still frame of a corridor, with no acknowledgement that they
 * had finished, no run time, and nothing to stop looking at.
 *
 * 05-aesthetic §7.5 and 02-world-structure §6 want the denouement to *end*, so
 * this is the smallest honest version of that: the camera drifts off the runner,
 * the world settles into ink, and the run is reported back — time, deaths, and
 * how much of the map the player actually claimed. The numbers come out of
 * `progress`, which has been counting them all along and had nowhere to say so.
 *
 * Nothing here writes to the simulation. The coda is a view-side clock started by
 * an event, exactly like the ability prompt, so a replay is unaffected by whether
 * anyone was watching the end of it.
 */

import { VIEW_W, VIEW_H } from '../../core/constants.js';
import { ABILITY_IDS } from '../../core/abilities/index.js';
import { CREAM, CREAM_DIM, INK, PLAYER, rgba } from './palette.js';
import { drawGlow } from './glow.js';
import { hashNoise } from './rng.js';

/** @typedef {import('../../core/types.js').GameState} GameState */

/** The runner keeps running for a beat before anything happens. */
const HOLD = 48;
/** Frames the world takes to settle into ink. */
const SETTLE = 120;
/** When the report starts fading in, and how long it takes. */
const REPORT_AT = HOLD + 70;
const REPORT_FADE = 60;
/** How far the camera drifts, and over how long. */
const DRIFT_X = 44;
const DRIFT_Y = -30;
const DRIFT_FRAMES = 300;
/** Embers rising through the ink. Cheap, and the alternative is a black rectangle. */
const EMBERS = 26;

let frames = -1;

/** @returns {void} */
export function clearCoda() {
  frames = -1;
}

/**
 * @param {Readonly<GameState>} next
 */
export function observeCoda(next) {
  if (frames >= 0) {
    frames++;
    return;
  }
  if ((next.events ?? []).some((e) => e.kind === 'game.complete')) frames = 0;
}

/** @param {number} v @returns {number} */
function ease(v) {
  const k = Math.max(0, Math.min(1, v));
  return k * k * (3 - 2 * k);
}

/**
 * How far the camera has drifted off the runner. Added to the camera by the
 * renderer *and* by the harness's player projection, so the two never disagree
 * about where the world is.
 * @returns {{x:number, y:number}}
 */
export function codaDrift() {
  if (frames < HOLD) return { x: 0, y: 0 };
  const k = ease((frames - HOLD) / DRIFT_FRAMES);
  return { x: DRIFT_X * k, y: DRIFT_Y * k };
}

/**
 * The full-screen half: ink, embers, and the report. Drawn in view space after
 * everything else, including the HUD, because the run is over and the HUD is not
 * information any more.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 */
export function drawCoda(ctx, state) {
  if (frames < 0) return;
  const veil = ease((frames - HOLD) / SETTLE) * 0.9;
  if (veil <= 0) return;

  ctx.save();
  ctx.fillStyle = rgba(INK, veil);
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // One ember per lantern the run lit, capped: the ending is literally as warm
  // as the run was thorough, which is the promise §D4 made of the collectible.
  const warmth = Math.min(EMBERS, (state.progress?.lanternsLit?.length ?? 0) + 4);
  for (let i = 0; i < warmth; i++) {
    const seed = hashNoise(i * 7 + 1);
    const speed = 0.25 + seed * 0.5;
    const y = VIEW_H - ((frames * speed + seed * VIEW_H * 2) % (VIEW_H + 40));
    const x = (seed * VIEW_W * 3.7) % VIEW_W + Math.sin(frames * 0.02 + i) * 6;
    const a = veil * 0.5 * (0.4 + 0.6 * hashNoise(i * 13 + 2));
    ctx.fillStyle = rgba(PLAYER.flame, a);
    ctx.beginPath();
    ctx.arc(x, y, 1 + seed, 0, Math.PI * 2);
    ctx.fill();
  }

  const fade = ease((frames - REPORT_AT) / REPORT_FADE);
  if (fade > 0) drawReport(ctx, state, fade, frames);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {number} fade
 * @param {number} frame
 */
function drawReport(ctx, state, fade, frame) {
  const p = state.progress;
  const cx = VIEW_W / 2;
  const cy = VIEW_H * 0.36;
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  drawGlow(ctx, cx, cy, 46, PLAYER.flame, 0.16 + 0.04 * Math.sin(frame * 0.03));
  ctx.font = 'bold 17px ui-monospace, Menlo, monospace';
  ctx.fillStyle = CREAM;
  ctx.fillText('PINLIGHT', cx, cy);

  ctx.strokeStyle = rgba(CREAM_DIM, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy + 14.5);
  ctx.lineTo(cx + 52, cy + 14.5);
  ctx.stroke();

  const rows = [
    ['TIME', clock(state.tick)],
    ['DEATHS', String(p?.deaths ?? 0)],
    ['LANTERNS', String(p?.lanternsLit?.length ?? 0)],
    ['ABILITIES', `${p?.abilities?.length ?? 0} / ${ABILITY_IDS.length}`],
  ];
  ctx.font = '9px ui-monospace, Menlo, monospace';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const y = cy + 30 + i * 13;
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(CREAM_DIM, 0.9);
    ctx.fillText(row[0] ?? '', cx - 6, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = CREAM;
    ctx.fillText(row[1] ?? '', cx + 6, y);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(CREAM_DIM, 0.55 + 0.15 * Math.sin(frame * 0.04));
  ctx.fillText('you carried it out', cx, cy + 30 + rows.length * 13 + 10);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

/** @param {number} tick @returns {string} m:ss at 60 Hz */
function clock(tick) {
  const total = Math.floor(tick / 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
