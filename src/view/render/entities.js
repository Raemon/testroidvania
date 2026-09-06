/**
 * Enemies: three rigs covering six archetypes (00-BIBLE §6), drawn under the three
 * readability guarantees of 05-aesthetic §2c.
 *
 * Those guarantees are the whole point of this file. A dark body on dark terrain
 * in a dark room is unreadable unless something structural fixes it, so every
 * entity gets, always and unconditionally:
 *   1. a self-lit accent eye, which punches its own hole in the darkness;
 *   2. a fog-coloured backlight halo that separates its value from the terrain's;
 *   3. a rim stroke along the side facing the player's light.
 * None of the three is a per-enemy decision, because a legibility rule with
 * exceptions is not a legibility rule.
 */

import { INK, rgba, shade } from './palette.js';
import { drawGlow, drawHalo } from './glow.js';
import { bone, clamp, ik2, makeChain, resetChain, stepChain } from './rig.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('../../core/types.js').Entity} Entity */
/** @typedef {import('./palette.js').Region} Region */

/** Per-entity secondary motion, which the sim does not (and must not) carry. */
const motion = new Map();

/**
 * @param {Entity} e
 * @returns {{walk:number, chain:import('./rig.js').VerletPoint[][], seen:number}}
 */
function motionFor(e) {
  let m = motion.get(e.id);
  if (!m) {
    m = { walk: 0, chain: [makeChain(6, e.x, e.y), makeChain(6, e.x, e.y), makeChain(6, e.x, e.y), makeChain(6, e.x, e.y)], seen: 0 };
    motion.set(e.id, m);
  }
  return m;
}

/** @param {string} kind @returns {'tick'|'jelly'|'knight'} */
function rigFor(kind) {
  if (kind === 'drifter' || kind === 'jelly') return 'jelly';
  if (kind === 'shell' || kind === 'knight' || kind === 'sentinel') return 'knight';
  return 'tick';
}

/**
 * @param {Readonly<GameState>} state
 * @param {number} dt
 */
export function updateEntities(state, dt) {
  const live = new Set();
  for (const e of state.entities ?? []) {
    live.add(e.id);
    const m = motionFor(e);
    m.walk += Math.abs(e.vx) * dt;
    if (rigFor(e.kind) === 'jelly') {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h * 0.75;
      for (let i = 0; i < m.chain.length; i++) {
        const c = m.chain[i];
        if (!c) continue;
        const ax = cx + (i - 1.5) * 3.4;
        if (m.seen === 0) resetChain(c, ax, cy);
        stepChain(c, ax, cy, 3.4, 0.15, -e.vx * 0.6, -e.vy * 0.3, 0.97);
      }
    }
    m.seen = 1;
  }
  for (const id of motion.keys()) if (!live.has(id)) motion.delete(id);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Region} region
 * @param {number} t seconds
 * @param {{x:number, y:number}} light  where the player's light is, for the rim
 */
export function drawEntities(ctx, state, region, t, light) {
  for (const e of state.entities ?? []) {
    if (e.roomId && e.roomId !== state.room) continue;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    const dir = light.x < cx ? -1 : 1;
    const hurt = (e.flash ?? 0) > 0;

    // Guarantee 2: the backlight halo, behind everything else the entity draws.
    drawHalo(ctx, cx, cy, Math.max(e.w, e.h) * 1.25, region.fog, 0.22);

    // 05 §2c requires an enemy body never darker than L 30%, which the region's
    // own `enemy` swatch sits just under; lifting it here keeps the rule rather
    // than the number.
    const body = hurt ? '#FFFFFF' : shade(region.enemy, e.pinned ? 0.3 : 0.18);
    const rig = rigFor(e.kind);
    if (rig === 'jelly') drawJelly(ctx, e, region, body, dir, t);
    else if (rig === 'knight') drawKnight(ctx, e, region, body, dir);
    else drawTick(ctx, e, region, body, dir, t);

    if (e.pinned) {
      // A pinned enemy is helpless and must look it: it hangs, struts splayed.
      ctx.strokeStyle = rgba('#C9BFA6', 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 5, e.y + e.h + 1);
      ctx.lineTo(cx + 5, e.y + e.h + 1);
      ctx.stroke();
    }
  }
}

/**
 * Guarantee 3: a rim stroke along the lit side. Drawing the silhouette offset
 * toward the light and stroking it, then covering it with the body, is a cheap
 * way to get a one-sided highlight out of a filled path.
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => void} path
 * @param {Region} region
 * @param {number} dir
 */
function rim(ctx, path, region, dir) {
  ctx.save();
  ctx.translate(dir * 2, -1.2);
  ctx.beginPath();
  path();
  ctx.strokeStyle = region.edge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/**
 * Guarantee 1: the eye. Accent coloured, self-lit, on the facing side.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} r
 * @param {Region} region @param {number} intensity
 */
function eye(ctx, x, y, r, region, intensity) {
  drawGlow(ctx, x, y, 9 * intensity, region.accent, 0.7);
  ctx.fillStyle = region.accent;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * "Tick" — the ground crawler and everything built on its chassis. Six legs in a
 * tripod gait: legs L1/R2/L3 share a phase, the other three are half a cycle off,
 * which is how real hexapods stay statically stable and why it reads as an insect
 * rather than as a wobbling ellipse.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e @param {Region} region @param {string} body
 * @param {number} dir @param {number} t
 */
function drawTick(ctx, e, region, body, dir, t) {
  const m = motionFor(e);
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h * 0.45;
  // Sized from the hitbox, not scaled up from it: a body wider than the box it
  // occupies makes every gap look passable that is not.
  const rx = e.w * 0.55;
  const ry = e.h * 0.4;
  const phase = m.walk / 16;
  const legColor = shade(body, 0.14);

  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const slot = i % 3;
    const tripod = (i === 0 || i === 4 || i === 2) ? 0 : 0.5;
    const ph = (phase + tripod) * Math.PI * 2;
    const hx = cx + (slot - 1) * rx * 0.7;
    const hy = cy + ry * 0.35;
    const tx = hx + (slot - 1) * 2.2 + Math.cos(ph) * 5 * e.facing;
    const ty = e.y + e.h + 1.5 - Math.max(0, Math.sin(ph)) * 3;
    const knee = ik2(hx, hy, tx, ty, e.h * 0.5, e.h * 0.5, side);
    bone(ctx, hx, hy, knee.x, knee.y, 2.2, legColor);
    bone(ctx, knee.x, knee.y, tx, ty, 1.6, legColor);
  }

  const bob = Math.sin(phase * Math.PI * 2) * 0.7;
  const path = () => ctx.ellipse(cx, cy + bob, rx, ry, 0, 0, Math.PI * 2);
  rim(ctx, path, region, dir);
  ctx.beginPath();
  path();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const alert = e.mode === 'charging' || e.mode === 'windup' || e.mode === 'alert';
  eye(ctx, cx + e.facing * rx * 0.55, cy + bob - ry * 0.25, 1.8, region, alert ? 1.8 : 1 + 0.12 * Math.sin(t * 4));
}

/**
 * "Drift Jelly" — the only semi-translucent thing in the game. The bell pumps and
 * the tendrils are Verlet chains, so its motion is entirely a consequence of where
 * it has been rather than a cycle.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e @param {Region} region @param {string} body
 * @param {number} dir @param {number} t
 */
function drawJelly(ctx, e, region, body, dir, t) {
  const m = motionFor(e);
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h * 0.45;
  const rx = e.w * 0.6;
  const ry = e.h * 0.5 * (1 + 0.18 * Math.sin(t * Math.PI * 2 * 0.8));

  for (const c of m.chain) {
    ctx.strokeStyle = rgba(region.accent, 0.55);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < c.length; i++) {
      const p = c[i];
      if (!p) continue;
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    const tip = c[c.length - 1];
    if (tip) drawGlow(ctx, tip.x, tip.y, 6, region.accent, 0.4);
  }

  const path = () => ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
  rim(ctx, path, region, dir);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.2, rx * 0.55, ry * 0.5, 0, Math.PI, 0);
  ctx.fillStyle = region.fog;
  ctx.fill();
  ctx.globalAlpha = 1;

  eye(ctx, cx, cy - ry * 0.35, 2, region, 1.2);
}

/**
 * "Reliquary Knight" — the heavy. Its whole face is the eye: a horizontal slit in
 * a visor, which is a completely different silhouette from the round crawler and
 * the soft jelly, so mass is legible before anything else about it is.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e @param {Region} region @param {string} body
 * @param {number} dir
 */
function drawKnight(ctx, e, region, body, dir) {
  const m = motionFor(e);
  const cx = e.x + e.w / 2;
  const footY = e.y + e.h;
  const hipY = e.y + e.h * 0.55;
  const shoulderY = e.y + e.h * 0.22;
  const phase = m.walk / 40;

  for (let i = 0; i < 2; i++) {
    const ph = (phase + i * 0.5) * Math.PI * 2;
    const hx = cx + (i === 0 ? -2 : 2);
    const tx = hx + Math.cos(ph) * e.w * 0.4 * e.facing;
    const ty = footY - Math.max(0, Math.sin(ph)) * 3;
    const knee = ik2(hx, hipY, tx, ty, e.h * 0.24, e.h * 0.24, e.facing);
    bone(ctx, hx, hipY, knee.x, knee.y, 5, shade(body, -0.2));
    bone(ctx, knee.x, knee.y, tx, ty, 4, shade(body, -0.2));
  }

  const path = () => {
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx, shoulderY);
  };
  ctx.save();
  ctx.translate(dir * 1.5, -1);
  ctx.beginPath();
  path();
  ctx.strokeStyle = region.edge;
  ctx.lineWidth = e.w * 0.62;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  bone(ctx, cx, hipY, cx, shoulderY, e.w * 0.58, body);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx, shoulderY);
  ctx.stroke();

  const visorW = e.w * 0.5;
  const visorH = e.h * 0.16;
  const vx = cx - visorW / 2 + e.facing * 1;
  const vy = e.y + e.h * 0.06;
  ctx.fillStyle = shade(body, -0.35);
  ctx.beginPath();
  ctx.roundRect(vx, vy, visorW, visorH, 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const slitW = visorW * 0.7;
  drawGlow(ctx, vx + visorW / 2, vy + visorH * 0.5, 14, region.accent, 0.8);
  ctx.fillStyle = region.accent;
  ctx.fillRect(vx + (visorW - slitW) / 2, vy + visorH * 0.42, slitW, clamp(visorH * 0.22, 1, 3));
}
