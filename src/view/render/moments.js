/**
 * The three moments the game was not showing.
 *
 * Everything here is driven by `state.events` rather than by diffing state, and
 * it is observed from `onStep` rather than from the draw, because an event lives
 * for exactly one frame: a free-running loop that takes two sim steps between
 * draws would silently lose half of them, and the half it lost would be the ones
 * that mattered.
 *
 * What it draws, and why each earns its frames:
 *
 *  1. **The ability prompt.** Abilities are picked up by walking into them, with
 *     no prompt at all. Zip is the largest verb in the game and it is bound to a
 *     key nothing else uses, so a player who does not go looking for V simply
 *     never zips — and the measured critique put this at the single highest-value
 *     change in the game. Three seconds, centred, glyph + key + one line.
 *  2. **The pickup ceremony** (05-aesthetic §7.1). The ember flies to the
 *     player's light and the room briefly brightens. The full §7.1 beat is a
 *     hit-stop and a permanent aura increase, both of which are the sim's to own;
 *     what is left for the view is the flight and the bloom, which is the part
 *     you can actually see.
 *  3. **The bank line.** Ricochet's whole payoff is a bounce, and nothing ever
 *     drew one. Shown once when the Pin actually banks, and once when it clangs
 *     while Ricochet is owned — the second is the teaching case: this is where
 *     the throw you just made *would* have gone.
 *
 * All three are once-only or short-lived by construction. A hint that keeps
 * appearing is a hint the player learns to look past.
 */

import { PIN_RANGE, VIEW_W, VIEW_H } from '../../core/constants.js';
import { CREAM, CREAM_DIM, PLAYER, rgba } from './palette.js';
import { drawGlow } from './glow.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./palette.js').Region} Region */

/** 05 §7.1 gives the beat four seconds; the card holds for three of them. */
const PROMPT_FRAMES = 180;
const PROMPT_FADE = 24;
/** §7.1: the ember flies to the player's light over 400 ms. */
const EMBER_FRAMES = 24;
/** How long the room stays opened up after the ember lands. */
const BLOOM_FRAMES = 72;
const BANK_FRAMES = 20;

/**
 * What each ability is, in the fewest words that are still true. The key is the
 * one the player has to press, which for four of the five is the throw button
 * they already know — saying so is the point, because "you already have this"
 * is different information from "here is a new key".
 * @type {Record<string, {name:string, key:string, line:string}>}
 */
const ABILITY_PROMPTS = {
  zip: { name: 'ZIP', key: 'V', line: 'fly to your Pin' },
  deepPin: { name: 'DEEP PIN', key: 'C', line: 'the Pin now bites stone' },
  reel: { name: 'REEL', key: 'C', line: 'recall drags what the Pin holds' },
  ricochet: { name: 'RICOCHET', key: 'C', line: 'the Pin banks once off metal' },
  twinPin: { name: 'TWIN PIN', key: 'C', line: 'two Pins, two anchors' },
};

/** Ability id -> a glyph on a unit box, drawn as a polyline. Shared with the HUD. */
const GLYPHS = /** @type {Record<string, number[][]>} */ ({
  zip: [[-1, 0.6], [0.1, -0.1], [-0.3, -0.1], [1, -0.8]],
  deepPin: [[0, -1], [0, 0.7], [-0.5, 0.2], [0, 0.7], [0.5, 0.2]],
  reel: [[0.8, -0.8], [-0.4, -0.4], [0.4, 0.1], [-0.6, 0.6]],
  ricochet: [[-0.9, -0.7], [0.5, 0.2], [-0.3, 0.8]],
  twinPin: [[-0.5, -0.9], [-0.5, 0.7], [0.5, -0.9], [0.5, 0.7]],
});

/** @type {{id: string, frames: number}|null} */
let prompt = null;
/** @type {{x: number, y: number, frames: number}|null} */
let ember = null;
let bloom = 0;
/** @type {{x:number, y:number, dx:number, dy:number, frames:number}|null} */
let bank = null;
/** One showing each: the bounce that happened, and the bounce that could have. */
let bouncedShown = false;
let clangShown = false;

/** Reset every moment. Exported so a restored save does not inherit a stale card. */
export function clearMoments() {
  prompt = null;
  ember = null;
  bloom = 0;
  bank = null;
  bouncedShown = false;
  clangShown = false;
}

/**
 * Read one frame's events. Called from the step, never from the draw.
 * @param {Readonly<GameState>} prev
 * @param {Readonly<GameState>} next
 */
export function observeMoments(prev, next) {
  if (prompt) prompt.frames--;
  if (prompt && prompt.frames <= 0) prompt = null;
  if (ember) ember.frames--;
  if (ember && ember.frames <= 0) ember = null;
  if (bloom > 0) bloom--;
  if (bank) bank.frames--;
  if (bank && bank.frames <= 0) bank = null;

  const owned = next.progress?.abilities ?? [];
  for (const e of next.events ?? []) {
    if (e.kind === 'ability.gain') {
      // The event does not name the ability, and it does not have to: the ladder
      // is append-only (invariant 12), so the one just earned is the last one.
      const id = owned[owned.length - 1];
      if (id) prompt = { id, frames: PROMPT_FRAMES };
      ember = { x: e.x, y: e.y, frames: EMBER_FRAMES };
      bloom = EMBER_FRAMES + BLOOM_FRAMES;
    }
    if (e.kind === 'pin.ricochet' && !bouncedShown) {
      bouncedShown = true;
      bank = { x: e.x, y: e.y, dx: next.pin.vx, dy: next.pin.vy, frames: BANK_FRAMES };
    }
    if (e.kind === 'pin.clang' && !clangShown && owned.includes('ricochet')) {
      clangShown = true;
      // The Pin has already gone inert by now, so the throw that just happened is
      // the one in the *previous* frame's Pin.
      const mirror = reflect(prev.pin.vx, prev.pin.vy);
      bank = { x: e.x, y: e.y, dx: mirror.x, dy: mirror.y, frames: BANK_FRAMES };
    }
  }
}

/**
 * Mirror a flight about the face it must have hit. The event carries the point of
 * impact but not the normal, and re-deriving the normal from the room grid would
 * be re-running collision in the view; the axis the Pin was travelling fastest
 * along is the axis it hit, which is right for every wall in the game.
 * @param {number} vx @param {number} vy
 * @returns {{x:number, y:number}}
 */
function reflect(vx, vy) {
  return Math.abs(vx) >= Math.abs(vy) ? { x: -vx, y: vy } : { x: vx, y: -vy };
}

/** How far open the room is, 0 to 1, for the §7.1 bloom. */
export function bloomAmount() {
  if (bloom <= 0) return 0;
  const k = bloom / (EMBER_FRAMES + BLOOM_FRAMES);
  return Math.min(1, k * 1.4);
}

/**
 * The world-space half: the ember's flight and the bank line. Drawn with the
 * world transform, before the darkness lands.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Region} region
 * @param {{x:number, y:number}} hand  where the player's light actually is
 */
export function drawWorldMoments(ctx, region, hand) {
  if (bank) {
    const k = bank.frames / BANK_FRAMES;
    const len = Math.hypot(bank.dx, bank.dy) || 1;
    const reach = PIN_RANGE * 0.6;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -(1 - k) * 24;
    ctx.strokeStyle = rgba(region.accent, 0.15 + 0.45 * k);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bank.x, bank.y);
    ctx.lineTo(bank.x + (bank.dx / len) * reach, bank.y + (bank.dy / len) * reach);
    ctx.stroke();
    ctx.restore();
    drawGlow(ctx, bank.x, bank.y, 14, region.accent, 0.3 * k);
  }

  if (ember) {
    // Ease-in, per §7.1: it leaves the alcove slowly and arrives fast.
    const k = 1 - ember.frames / EMBER_FRAMES;
    const e = k * k;
    const x = ember.x + (hand.x - ember.x) * e;
    const y = ember.y + (hand.y - ember.y) * e;
    drawGlow(ctx, x, y, 10 + 22 * (1 - e), PLAYER.core, 0.7);
    ctx.fillStyle = PLAYER.core;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 + 1.6 * (1 - e), 0, Math.PI * 2);
    ctx.fill();
    // Motes trailing behind it: twelve, as §7.1 asks, spent on the flight rather
    // than orbiting an alcove nobody is looking at any more.
    for (let i = 0; i < 12; i++) {
      const trail = Math.max(0, e - (i + 1) * 0.05);
      const tx = ember.x + (hand.x - ember.x) * trail;
      const ty = ember.y + (hand.y - ember.y) * trail;
      ctx.fillStyle = rgba(PLAYER.flame, 0.5 * (1 - i / 12) * (1 - e));
      ctx.beginPath();
      ctx.arc(tx, ty, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * The prompt card. Drawn in view space over everything, because the one thing it
 * must not do is get lost in the dark it is announcing.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} frame
 */
export function drawPrompt(ctx, frame) {
  if (!prompt) return;
  const copy = ABILITY_PROMPTS[prompt.id];
  if (!copy) return;
  const fade = Math.min(1, prompt.frames / PROMPT_FADE, (PROMPT_FRAMES - prompt.frames) / 10);
  const cx = VIEW_W / 2;
  const cy = VIEW_H * 0.38;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = rgba('#0B0D12', 0.72);
  ctx.beginPath();
  ctx.roundRect(cx - 96, cy - 34, 192, 68, 4);
  ctx.fill();
  ctx.strokeStyle = rgba(CREAM, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();

  drawGlow(ctx, cx, cy - 14, 26, PLAYER.flame, 0.3 + 0.08 * Math.sin(frame * 0.08));
  const glyph = GLYPHS[prompt.id];
  if (glyph) {
    ctx.strokeStyle = PLAYER.core;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < glyph.length; i++) {
      const pt = glyph[i];
      if (!pt) continue;
      const px = cx + (pt[0] ?? 0) * 9;
      const py = cy - 14 + (pt[1] ?? 0) * 9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px ui-monospace, Menlo, monospace';
  ctx.fillStyle = CREAM;
  ctx.fillText(`${copy.name}  —  ${copy.key}`, cx, cy + 8);
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.fillStyle = rgba(CREAM_DIM, 0.95);
  ctx.fillText(copy.line, cx, cy + 22);
  ctx.textAlign = 'left';
  ctx.restore();
}
