/**
 * Enemies and bosses: three body rigs covering six archetypes (00-BIBLE §6), plus
 * the boss part — drawn under the three readability guarantees of 05-aesthetic §2c.
 *
 * Those guarantees are the whole point of this file. A dark body on dark terrain
 * in a dark room is unreadable unless something structural fixes it, so every
 * entity gets, always and unconditionally:
 *   1. a self-lit accent eye, which punches its own hole in the darkness;
 *   2. a fog-coloured backlight halo that separates its value from the terrain's;
 *   3. a rim stroke along the side facing the player's light.
 * None of the three is a per-enemy decision, because a legibility rule with
 * exceptions is not a legibility rule.
 *
 * Two things here are gameplay information rather than decoration, and are drawn
 * to that standard:
 *
 *  - **Which rig a body uses is the body's own declaration.** Every entity module
 *    exports a `rig`, and this file reads it. Mapping kind names to rigs here
 *    meant every kind nobody remembered to list — which was all four bosses and
 *    the boss part — silently fell through to the ground crawler, so the Stoker
 *    was a large beetle and the Diver was the same beetle in blue.
 *  - **A part wears its material.** The design's strongest boss idea is "find the
 *    pinnable part while the rest is metal", and that is unplayable if the part
 *    looks like the armour. A pinnable part carries a bullseye and its material's
 *    hatch; an unpinnable one carries the metal rivets, in the same material
 *    language the terrain uses, because it is the same question being asked.
 */

import { ENTITY_KINDS } from '../../core/entities/index.js';
import { isBoss } from '../../core/bosses/index.js';
import { bitesMaterial } from '../../core/abilities/deepPin.js';
import { INK, HAZARD, WARN, STRIKE, materialLook, mix, rgba, shade } from './palette.js';
import { drawGlow, drawHalo } from './glow.js';
import { bone, clamp, ik2, makeChain, resetChain, stepChain } from './rig.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('../../core/types.js').Entity} Entity */
/** @typedef {import('./palette.js').Region} Region */

/** Modes that are a warning: the hitbox does not exist yet, but it is coming. */
const TELEGRAPH_MODES = new Set(['telegraph', 'windup', 'charging', 'alert']);
/** Modes in which the attack is live. 03 §2.8 paints these HAZARD, flat. */
const ACTIVE_MODES = new Set(['slam', 'geyser', 'dash', 'charge', 'chase']);

/** The Diver's submerge is 50 frames of immunity; this is how long the dive takes. */
const DIVE_FRAMES = 12;

/** Per-entity secondary motion, which the sim does not (and must not) carry. */
const motion = new Map();

/**
 * @typedef {object} Motion
 * @property {number} walk
 * @property {import('./rig.js').VerletPoint[][]} chain
 * @property {number} seen
 * @property {string} mode      the mode this entity was in last frame
 * @property {number} modeMax   frames that mode started with, for the telegraph ramp
 */

/**
 * @param {Entity} e
 * @returns {Motion}
 */
function motionFor(e) {
  let m = motion.get(e.id);
  if (!m) {
    m = {
      walk: 0,
      chain: [makeChain(6, e.x, e.y), makeChain(6, e.x, e.y), makeChain(6, e.x, e.y), makeChain(6, e.x, e.y)],
      seen: 0,
      mode: e.mode,
      modeMax: Math.max(1, e.timers.mode ?? 0),
    };
    motion.set(e.id, m);
  }
  return m;
}

/**
 * The rig this body declares. Falling back to the crawler is the *last* resort,
 * not the default: an unrecognised kind is a bug, and it should at least be an
 * insect-shaped one rather than an invisible one.
 * @param {string} kind
 * @returns {'tick'|'jelly'|'knight'}
 */
export function rigFor(kind) {
  const declared = /** @type {{rig?: string}|undefined} */ (ENTITY_KINDS[kind])?.rig;
  return declared === 'jelly' || declared === 'knight' ? declared : 'tick';
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
    // The telegraph ramp needs to know how long the wind-up *was*, and only the
    // frame it began on knows that. Sampled here rather than hard-coded, so a
    // boss whose telegraph budget changes does not need this file edited.
    if (e.mode !== m.mode) {
      m.mode = e.mode;
      m.modeMax = Math.max(1, e.timers.mode ?? 0);
    }
    if (e.kind !== 'part' && rigFor(e.kind) === 'jelly') {
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
 * Where this body is on the 03 §2.8 ramp, or null if it is not attacking.
 *
 * The ramp is the same four colours for every enemy in the game — base, orange,
 * white on the last frame of warning, coral while the hitbox is live — because a
 * player who has to learn a second warning colour has not been warned.
 *
 * @param {Entity} e
 * @param {Motion} m
 * @param {string} base  the colour the ramp starts from
 * @returns {{color: string, k: number, active: boolean}|null}
 */
function telegraph(e, m, base) {
  if (ACTIVE_MODES.has(e.mode)) return { color: HAZARD, k: 1, active: true };
  if (!TELEGRAPH_MODES.has(e.mode)) return null;
  const timer = e.timers.mode ?? 0;
  const k = clamp(1 - timer / m.modeMax, 0, 1);
  // The single frame before the hitbox exists is white, and is the frame the
  // player is actually reacting to.
  const color = timer <= 1 ? STRIKE : mix(base, WARN, 0.25 + k * 0.75);
  return { color, k, active: false };
}

/**
 * The Diver's dive, 0 (surfaced) to 1 (gone under). `submerge` is fifty frames of
 * "you cannot touch me and I cannot touch you", and drawn like `surface` it was
 * fifty frames of the fight appearing to have hung.
 * @param {Entity} e
 * @param {Motion} m
 * @returns {number}
 */
function diveDepth(e, m) {
  if (e.mode !== 'submerge') return 0;
  const timer = e.timers.mode ?? 0;
  const elapsed = m.modeMax - timer;
  const going = clamp(elapsed / DIVE_FRAMES, 0, 1);
  const coming = clamp(timer / DIVE_FRAMES, 0, 1);
  return Math.min(going, coming);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Region} region
 * @param {number} t seconds
 * @param {{x:number, y:number}} light  where the player's light is, for the rim
 */
export function drawEntities(ctx, state, region, t, light) {
  const abilities = state.progress?.abilities ?? [];
  for (const e of state.entities ?? []) {
    if (e.roomId && e.roomId !== state.room) continue;
    if (e.kind === 'part') {
      drawPart(ctx, e, state, region, abilities, t);
      continue;
    }

    const m = motionFor(e);
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    const dir = light.x < cx ? -1 : 1;
    const hurt = (e.flash ?? 0) > 0;
    const boss = isBoss(e.kind);
    const dive = diveDepth(e, m);

    // 05 §2c puts the enemy band at L30-36, and that is a measurement of the
    // *pixel*, not of the swatch. The halo, the rim, the eye glow and the warm
    // cast all land on top of this fill, and measured together they were putting
    // enemies at L49 — a light-valued moving thing, which the player is supposed
    // to be the only one of. The fill is set low so the sum comes out in band.
    const base = hurt ? '#FFFFFF' : shade(region.enemy, e.pinned ? 0.12 : -0.05);
    const warn = hurt ? null : telegraph(e, m, base);
    // A guarded boss is *immune*, and looking identical to an open one is the
    // single most confusing thing a boss can do. Open brightens the whole body.
    const open = boss && (e.timers.guard ?? 0) === 0;
    const body = warn?.active ? mix(base, HAZARD, 0.55) : open ? shade(base, 0.16) : base;
    const rimColor = warn ? warn.color : open ? region.accent : region.edge;

    ctx.save();
    if (dive > 0) {
      surfaceRipple(ctx, e, region, t, dive);
      ctx.translate(0, dive * (e.h + 4));
      ctx.globalAlpha = 1 - dive * 0.65;
    } else {
      // Guarantee 2: the backlight halo, behind everything else the entity draws.
      drawHalo(ctx, cx, cy, Math.max(e.w, e.h) * 1.25, region.fog, 0.12);
    }

    if (boss && warn && !warn.active) incomingRing(ctx, e, warn);

    const rig = rigFor(e.kind);
    if (rig === 'jelly') drawJelly(ctx, e, region, body, rimColor, dir, t);
    else if (rig === 'knight') drawKnight(ctx, e, region, body, rimColor, dir);
    else drawTick(ctx, e, region, body, rimColor, dir, t, Boolean(warn));
    if (boss) drawCrest(ctx, e, region, body, rimColor, t);
    ctx.restore();

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
 * The wind-up read at a distance: a ring that closes onto the body over the
 * telegraph. 03 §2.8 asks heavy and boss attacks for an attack-zone preview at
 * alpha 0.3 filling to 0.8; this is the shape-agnostic version of it, so a boss
 * cannot ship a new attack that forgets to warn about itself.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e
 * @param {{color:string, k:number}} warn
 */
function incomingRing(ctx, e, warn) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const r = Math.max(e.w, e.h) * (1.5 - 0.55 * warn.k);
  ctx.strokeStyle = rgba(warn.color, 0.3 + 0.5 * warn.k);
  ctx.lineWidth = 1 + warn.k * 1.6;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * The water closing over a diving body. Drawn at the surfaced silhouette's
 * shoulder line, which is where the water was when it went under.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e @param {Region} region @param {number} t @param {number} dive
 */
function surfaceRipple(ctx, e, region, t, dive) {
  const cx = e.x + e.w / 2;
  const y = e.y + e.h * 0.35;
  ctx.strokeStyle = rgba(region.accent, 0.5 * (1 - dive * 0.4));
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const spread = (dive * 0.7 + i * 0.28 + (t * 0.4 % 1)) % 1;
    ctx.globalAlpha = (1 - spread) * 0.8;
    ctx.beginPath();
    ctx.ellipse(cx, y, e.w * (0.5 + spread * 0.9), 2.4 + spread * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * A boss's limb, and the one place in the game where the material vocabulary is
 * asked about a *creature*.
 *
 * The plate itself is the material's own colour and hatch, exactly as a terrain
 * cell of that material would be — that is the whole point: the player already
 * learned "warm edge and grain means the Pin bites" off a wall, and this spends
 * that knowledge rather than teaching a second thing. On top of it goes the
 * answer to the only question that matters mid-fight: a bullseye if the Pin will
 * take it, rivets if it will clang off.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e
 * @param {Readonly<GameState>} state
 * @param {Region} region
 * @param {readonly import('../../core/types.js').AbilityId[]} abilities
 * @param {number} t seconds
 */
function drawPart(ctx, e, state, region, abilities, t) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const r = Math.min(e.w, e.h) / 2;
  const material = e.pinMaterial ?? 'metal';
  const look = materialLook(material);
  const takeable = bitesMaterial(e.pinMaterial, abilities);
  const held = e.pinned;

  drawHalo(ctx, cx, cy, Math.max(e.w, e.h) * 1.4, region.fog, 0.16);

  const plate = () => ctx.roundRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2, 3);
  ctx.beginPath();
  plate();
  ctx.fillStyle = shade(look.hatch, held ? 0.22 : -0.32);
  ctx.fill();
  ctx.strokeStyle = look.edge;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  plate();
  ctx.clip();
  partHatch(ctx, e, look);
  ctx.restore();

  if (!takeable) {
    // Armour. No ring, no invitation: the four rivets and the cold bright edge
    // are the same "the Pin will bounce off this" the metal terrain says.
    ctx.strokeStyle = rgba(look.edge, 0.85);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.x + 3, e.y + 3);
    ctx.lineTo(e.x + e.w - 3, e.y + e.h - 3);
    ctx.moveTo(e.x + e.w - 3, e.y + 3);
    ctx.lineTo(e.x + 3, e.y + e.h - 3);
    ctx.stroke();
    return;
  }

  // The bullseye: two rings and a pip, breathing at 0.6 Hz. It is the only ring
  // in the game, so it can only mean one thing.
  const pulse = held ? 1 : 0.86 + 0.14 * Math.sin(t * Math.PI * 2 * 0.6);
  const ring = held ? '#FFFFFF' : look.edge;
  drawGlow(ctx, cx, cy, 14 * pulse, ring, held ? 0.55 : 0.3);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.44 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The material face pattern, at entity scale. Deliberately the same three
 * patterns `terrain.js` draws on a tile — grain, cracks, rivets — because they
 * answer the same question and a second vocabulary would be a second thing to
 * learn.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e
 * @param {import('./palette.js').MaterialLook} look
 */
function partHatch(ctx, e, look) {
  ctx.strokeStyle = look.hatch;
  ctx.fillStyle = look.hatch;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.8;
  if (look.pattern === 'grain') {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const o = e.x + 2 + i * (e.w / 3);
      ctx.moveTo(o, e.y + e.h);
      ctx.lineTo(o + e.w * 0.4, e.y);
    }
    ctx.stroke();
  } else if (look.pattern === 'crack') {
    ctx.beginPath();
    ctx.moveTo(e.x + e.w * 0.2, e.y + e.h * 0.25);
    ctx.lineTo(e.x + e.w * 0.45, e.y + e.h * 0.5);
    ctx.lineTo(e.x + e.w * 0.3, e.y + e.h * 0.8);
    ctx.moveTo(e.x + e.w * 0.6, e.y + e.h * 0.2);
    ctx.lineTo(e.x + e.w * 0.78, e.y + e.h * 0.55);
    ctx.stroke();
  } else {
    for (const [fx, fy] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) {
      ctx.beginPath();
      ctx.arc(e.x + e.w * (fx ?? 0), e.y + e.h * (fy ?? 0), 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * One silhouette mark per boss, so the three that share the knight rig are three
 * creatures rather than one creature at three sizes. Small, and on the outline —
 * a mark inside the body is invisible at the value the body is drawn at.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e @param {Region} region
 * @param {string} body @param {string} rimColor @param {number} t
 */
function drawCrest(ctx, e, region, body, rimColor, t) {
  const cx = e.x + e.w / 2;
  const top = e.y;
  ctx.strokeStyle = rimColor;
  ctx.fillStyle = shade(body, -0.25);
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';

  if (e.kind === 'stoker') {
    // A pair of flues, breathing embers: this is the thing that makes the waves.
    for (const side of [-1, 1]) {
      const x = cx + side * e.w * 0.24;
      ctx.beginPath();
      ctx.rect(x - 2.5, top - 7, 5, 8);
      ctx.fill();
      ctx.stroke();
      drawGlow(ctx, x, top - 7, 7 + 2 * Math.sin(t * 5 + side), region.accent, 0.5);
    }
  } else if (e.kind === 'anchor') {
    // The fluke: a hanging hook, the heaviest shape in the game.
    ctx.beginPath();
    ctx.moveTo(cx, top - 8);
    ctx.lineTo(cx, top + 2);
    ctx.moveTo(cx - 7, top - 3);
    ctx.quadraticCurveTo(cx, top + 4, cx + 7, top - 3);
    ctx.moveTo(cx - 5, top - 6);
    ctx.lineTo(cx + 5, top - 6);
    ctx.stroke();
  } else if (e.kind === 'sentinel') {
    // Horns. The Apex miniboss is a Shell grown too large, and it wears it.
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(cx + side * e.w * 0.3, top + 3);
      ctx.quadraticCurveTo(cx + side * e.w * 0.5, top - 6, cx + side * e.w * 0.18, top - 9);
    }
    ctx.stroke();
  } else if (e.kind === 'diver') {
    // A crown of spines around the bell, which no ordinary jelly has.
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * e.w * 0.2;
      ctx.moveTo(x, e.y + e.h * 0.42);
      ctx.lineTo(x + i * 1.5, e.y - 5 - Math.abs(i) * -1.5);
    }
    ctx.stroke();
  }
}

/**
 * Guarantee 3: a rim stroke along the lit side. Drawing the silhouette offset
 * toward the light and stroking it, then covering it with the body, is a cheap
 * way to get a one-sided highlight out of a filled path.
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => void} path
 * @param {string} color
 * @param {number} dir
 */
function rim(ctx, path, color, dir) {
  ctx.save();
  ctx.translate(dir * 2, -1.2);
  ctx.beginPath();
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/**
 * Guarantee 1: the eye. Accent coloured, self-lit, on the facing side.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} r
 * @param {string} color @param {number} intensity
 */
function eye(ctx, x, y, r, color, intensity) {
  drawGlow(ctx, x, y, 6 * intensity, color, 0.5);
  ctx.fillStyle = color;
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
 * @param {string} rimColor @param {number} dir @param {number} t @param {boolean} alert
 */
function drawTick(ctx, e, region, body, rimColor, dir, t, alert) {
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
  rim(ctx, path, rimColor, dir);
  ctx.beginPath();
  path();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  eye(ctx, cx + e.facing * rx * 0.55, cy + bob - ry * 0.25, 1.8, alert ? rimColor : region.accent,
    alert ? 1.8 : 1 + 0.12 * Math.sin(t * 4));
}

/**
 * "Drift Jelly" — the only semi-translucent thing in the game. The bell pumps and
 * the tendrils are Verlet chains, so its motion is entirely a consequence of where
 * it has been rather than a cycle.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e @param {Region} region @param {string} body
 * @param {string} rimColor @param {number} dir @param {number} t
 */
function drawJelly(ctx, e, region, body, rimColor, dir, t) {
  const m = motionFor(e);
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h * 0.45;
  const rx = e.w * 0.6;
  const ry = e.h * 0.5 * (1 + 0.18 * Math.sin(t * Math.PI * 2 * 0.8));

  for (const c of m.chain) {
    ctx.strokeStyle = rgba(rimColor, 0.55);
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
    if (tip) drawGlow(ctx, tip.x, tip.y, 6, rimColor, 0.4);
  }

  const path = () => ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
  rim(ctx, path, rimColor, dir);
  ctx.globalAlpha *= 0.85;
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha /= 0.85;

  ctx.save();
  ctx.globalAlpha *= 0.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.2, rx * 0.55, ry * 0.5, 0, Math.PI, 0);
  ctx.fillStyle = region.fog;
  ctx.fill();
  ctx.restore();

  eye(ctx, cx, cy - ry * 0.35, 2, region.accent, 1.2);
}

/**
 * "Reliquary Knight" — the heavy. Its whole face is the eye: a horizontal slit in
 * a visor, which is a completely different silhouette from the round crawler and
 * the soft jelly, so mass is legible before anything else about it is.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Entity} e @param {Region} region @param {string} body
 * @param {string} rimColor @param {number} dir
 */
function drawKnight(ctx, e, region, body, rimColor, dir) {
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
  ctx.strokeStyle = rimColor;
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
  drawGlow(ctx, vx + visorW / 2, vy + visorH * 0.5, 10, region.accent, 0.55);
  ctx.fillStyle = region.accent;
  ctx.fillRect(vx + (visorW - slitW) / 2, vy + visorH * 0.42, slitW, clamp(visorH * 0.22, 1, 3));
}
