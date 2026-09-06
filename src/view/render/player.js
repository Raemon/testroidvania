/**
 * The player rig (05-aesthetic §4).
 *
 * A capsule skeleton with two-bone IK legs, a procedural gait driven by distance
 * travelled, squash/stretch anchored at the feet, a Verlet scarf and a pendulum
 * that carries the Pin's flame. The player is on screen 100% of the time, so this
 * is where hand-animation would have been most missed and where procedural motion
 * pays back most.
 *
 * The rig reads the hitbox and never the reverse: `p.x, p.y, p.w, p.h` place the
 * feet, and squash/stretch scales only what is drawn. A visual that fed back into
 * the hitbox would make the game feel different at different frame rates.
 */

import { PLAYER, rgba } from './palette.js';
import { drawGlow } from './glow.js';
import { bone, clamp, ik2, makeChain, resetChain, spring, stepChain } from './rig.js';
import { hashNoise } from './rng.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('../../core/types.js').Player} Player */

/**
 * 05 §4 specifies a 36px rig. Against a 20px hitbox that overhangs by 80% and the
 * head visibly enters ceilings the body cannot reach, so the whole rig is scaled:
 * proportions are the doc's, the height is 27px.
 */
const S = 0.75;

const HIP_Y = -14 * S;
const SHOULDER_Y = -26 * S;
const HEAD_Y = -31 * S;
const HEAD_R = 6 * S;
const STRIDE = 28 * S;
const LEG_UPPER = 9 * S;
const LEG_LOWER = 9 * S;
const SCARF_SEG = 5 * S;
const SCARF_N = 8;

/**
 * @typedef {object} PlayerRig
 * @property {number} sx
 * @property {number} sy
 * @property {number} sxv
 * @property {number} syv
 * @property {number} lean
 * @property {number} dist       distance travelled, drives the gait phase
 * @property {number} bob
 * @property {number} pend       pendulum angle of the hand light
 * @property {number} pendV
 * @property {number} arm        weapon-arm angle
 * @property {number} armV
 * @property {import('./rig.js').VerletPoint[]} scarf
 * @property {boolean} wasGrounded
 * @property {number} landHold
 * @property {number} lastTick
 * @property {{x:number, y:number}} hand   world position of the flame
 */

/** @returns {PlayerRig} */
export function createPlayerRig() {
  return {
    sx: 1, sy: 1, sxv: 0, syv: 0, lean: 0, dist: 0, bob: 0,
    pend: 0, pendV: 0, arm: 0, armV: 0,
    scarf: makeChain(SCARF_N, 0, 0),
    wasGrounded: true, landHold: 0, lastTick: -1,
    hand: { x: 0, y: 0 },
  };
}

/**
 * Advance the rig's secondary motion. Called once per rendered frame; `dt` is in
 * frames so the numbers here match the 60 Hz sim's units.
 * @param {PlayerRig} rig
 * @param {Readonly<GameState>} state
 * @param {number} dt
 * @param {import('./particles.js').Particles|null} fx
 */
export function updatePlayerRig(rig, state, dt, fx) {
  const p = state.player;
  const fx0 = p.x + p.w / 2;
  const fy0 = p.y + p.h;

  rig.dist += Math.abs(p.vx) * dt;

  // Squash/stretch (03 §3.1). Set on the event, sprung back, anchored at the feet.
  if (p.grounded && !rig.wasGrounded) {
    const hard = clamp(Math.abs(p.vy) / 6, 0, 1);
    rig.sy = 0.72 - hard * 0.12;
    rig.sx = 1.30 + hard * 0.15;
    rig.landHold = 4;
    if (fx) fx.landing(fx0, fy0, hard);
  } else if (!p.grounded && rig.wasGrounded && p.vy < 0) {
    rig.sy = 1.22;
    rig.sx = 0.80;
    if (fx) fx.jump(fx0, fy0);
  }
  rig.wasGrounded = p.grounded;

  if (rig.landHold > 0) rig.landHold -= dt;
  else {
    [rig.sy, rig.syv] = spring(rig.sy, rig.syv, airScaleY(p), 180, 13, dt / 60);
    [rig.sx, rig.sxv] = spring(rig.sx, rig.sxv, 2 - airScaleY(p), 180, 13, dt / 60);
  }
  rig.sy = clamp(rig.sy, 0.5, 1.45);
  rig.sx = clamp(rig.sx, 0.6, 1.5);

  rig.lean += (clamp(p.vx * 0.06, -0.22, 0.22) - rig.lean) * Math.min(1, 0.18 * dt);
  rig.bob = p.grounded && Math.abs(p.vx) < 0.2 ? Math.sin(state.tick * 0.094) * 0.6 : 0;

  // The hand light is a pendulum: it swings against acceleration and settles. This
  // is the single most "alive" thing on screen because it lags every input.
  const target = clamp(-p.vx * 0.14, -0.7, 0.7) + (p.grounded ? 0 : clamp(p.vy * 0.03, -0.3, 0.3));
  [rig.pend, rig.pendV] = spring(rig.pend, rig.pendV, target, 60, 6, dt / 60);

  const jab = p.jabFrames ?? 0;
  const armTarget = jab === 0 ? 0 : jab <= 3 ? -0.9 : jab <= 7 ? 2.1 : 0;
  [rig.arm, rig.armV] = spring(rig.arm, rig.armV, armTarget, jab > 0 ? 420 : 120, 16, dt / 60);

  const pts = anchors(p, rig);
  if (rig.lastTick < 0 || Math.abs(state.tick - rig.lastTick) > 30) resetChain(rig.scarf, pts.neck.x, pts.neck.y);
  rig.lastTick = state.tick;

  const wind = -p.vx * 0.5 - (p.grounded ? 0 : 0);
  for (let i = 0; i < Math.max(1, Math.round(dt)); i++) {
    stepChain(rig.scarf, pts.neck.x, pts.neck.y, SCARF_SEG, 0.35, wind, p.vy * -0.08, 0.94);
  }
  rig.hand = pts.flame;
  if (fx && p.grounded && Math.abs(p.vx) > 2.1 && state.tick % 8 === 0) fx.runDust(fx0, fy0, p.facing);
}

/** @param {Player} p @returns {number} the resting scaleY for the current motion */
function airScaleY(p) {
  if (p.grounded) return 1;
  if (p.vy < -1) return 1.06;
  if (p.vy > 4) return 1.10;
  return 1;
}

/**
 * World-space positions of the rig's joints, with squash/stretch and lean baked
 * in. Exported through `updatePlayerRig` so the darkness overlay can put the light
 * exactly where the flame is drawn rather than at the player's centre.
 * @param {Player} p
 * @param {PlayerRig} rig
 */
function anchors(p, rig) {
  const fx = p.x + p.w / 2;
  const fy = p.y + p.h;
  const cos = Math.cos(rig.lean);
  const sin = Math.sin(rig.lean);
  /** @param {number} lx @param {number} ly */
  const world = (lx, ly) => ({ x: fx + lx * rig.sx, y: fy + (ly + rig.bob) * rig.sy });
  /** Points above the hip rotate with the lean; the legs stay under the body. */
  const upper = (/** @type {number} */ lx, /** @type {number} */ ly) => {
    const dx = lx;
    const dy = ly - HIP_Y;
    return world(dx * cos - dy * sin, HIP_Y + dx * sin + dy * cos);
  };
  const hip = world(0, HIP_Y);
  const neck = upper(0, SHOULDER_Y);
  const head = upper(0, HEAD_Y);
  const handLocalX = p.facing * 9 * S;
  const handLocalY = -22 * S;
  const armCos = Math.cos(rig.arm);
  const armSin = Math.sin(rig.arm);
  const ax = handLocalX * armCos - (handLocalY - SHOULDER_Y) * armSin;
  const ay = SHOULDER_Y + handLocalX * armSin + (handLocalY - SHOULDER_Y) * armCos;
  const hand = upper(ax, ay);
  const flame = { x: hand.x + Math.sin(rig.pend) * 5, y: hand.y + Math.cos(rig.pend) * 5 };
  return { fx, fy, hip, neck, head, hand, flame };
}

/**
 * @param {PlayerRig} rig
 * @param {Player} p
 * @returns {{x:number, y:number}} where the held flame is, in world units
 */
export function handLight(rig, p) {
  return anchors(p, rig).flame;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {PlayerRig} rig
 * @param {import('./palette.js').Region} region
 * @param {number} t seconds
 */
export function drawPlayer(ctx, state, rig, region, t) {
  const p = state.player;
  const a = anchors(p, rig);
  const dead = p.state === 'dead';

  // i-frames blink in 4-on/4-off blocks, matching 03 §2.4 exactly.
  if (p.iframes > 0 && Math.floor(p.iframes / 4) % 2 === 1) ctx.globalAlpha = 0.4;
  const body = dead ? '#7A2A2E' : p.iframes > 55 ? '#FF4D5A' : PLAYER.body;

  drawScarf(ctx, rig, dead);
  drawLegs(ctx, p, rig, a, body);

  // Torso and head: one capsule and one circle. The silhouette does the work, so
  // there is no interior detail at all beyond the face crescent.
  bone(ctx, a.hip.x, a.hip.y, a.neck.x, a.neck.y, 9 * S * rig.sx, body);
  ctx.strokeStyle = PLAYER.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(a.hip.x, a.hip.y);
  ctx.lineTo(a.neck.x, a.neck.y);
  ctx.stroke();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(a.head.x, a.head.y, HEAD_R * rig.sx, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PLAYER.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Hood: a teardrop trailing back from the head, which is what stops the head
  // reading as a lollipop and gives the silhouette a direction at any size.
  ctx.fillStyle = PLAYER.ink;
  ctx.globalAlpha *= 0.85;
  ctx.beginPath();
  ctx.moveTo(a.head.x - p.facing * HEAD_R * 0.2, a.head.y - HEAD_R * 0.9);
  ctx.quadraticCurveTo(a.head.x - p.facing * HEAD_R * 2.4, a.head.y - HEAD_R * 1.1, a.head.x - p.facing * HEAD_R * 1.9, a.head.y + HEAD_R * 0.8);
  ctx.quadraticCurveTo(a.head.x - p.facing * HEAD_R * 0.8, a.head.y + HEAD_R * 0.4, a.head.x - p.facing * HEAD_R * 0.2, a.head.y - HEAD_R * 0.9);
  ctx.fill();
  ctx.globalAlpha = p.iframes > 0 && Math.floor(p.iframes / 4) % 2 === 1 ? 0.4 : 1;

  ctx.fillStyle = PLAYER.ink;
  ctx.beginPath();
  ctx.arc(a.head.x + p.facing * HEAD_R * 0.45, a.head.y + HEAD_R * 0.05, HEAD_R * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Arm to the hand, then whatever the hand is holding.
  bone(ctx, a.neck.x, a.neck.y, a.hand.x, a.hand.y, 4 * S, body);
  if (!dead) drawHandFlame(ctx, state, rig, a, region, t);

  ctx.globalAlpha = 1;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Player} p
 * @param {PlayerRig} rig
 * @param {ReturnType<typeof anchors>} a
 * @param {string} body
 */
function drawLegs(ctx, p, rig, a, body) {
  const moving = p.grounded && Math.abs(p.vx) > 0.25;
  const phase = rig.dist / STRIDE;
  for (let i = 0; i < 2; i++) {
    const hx = a.hip.x + (i === 0 ? -1.5 : 1.5) * rig.sx;
    const hy = a.hip.y;
    let tx;
    let ty;
    if (!p.grounded) {
      // Airborne: the trailing leg tucks, the leading one reaches. Reads as intent.
      const tuck = clamp(-p.vy * 0.6, -4, 5);
      tx = hx + p.facing * (i === 0 ? 1 : 4);
      ty = a.fy - (i === 0 ? 4 + tuck : 1);
    } else if (moving) {
      const ph = (phase + i * 0.5) * Math.PI * 2;
      tx = hx + Math.cos(ph) * 8.25 * p.facing;
      ty = a.fy - Math.max(0, Math.sin(ph)) * 4.5;
    } else {
      tx = hx + (i === 0 ? -3.75 : 3.75);
      ty = a.fy;
    }
    const knee = ik2(hx, hy, tx, ty, LEG_UPPER, LEG_LOWER, p.facing);
    bone(ctx, hx, hy, knee.x, knee.y, 5 * S, body);
    bone(ctx, knee.x, knee.y, tx, ty, 4.2 * S, body);
  }
}

/**
 * The scarf: the only saturated red on the player and the "hero flag" that makes
 * a small cream figure legible against a busy silhouette.
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlayerRig} rig
 * @param {boolean} dead
 */
function drawScarf(ctx, rig, dead) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < rig.scarf.length; i++) {
    const a = rig.scarf[i - 1];
    const b = rig.scarf[i];
    if (!a || !b) continue;
    ctx.strokeStyle = dead ? rgba(PLAYER.scarf, 0.5) : PLAYER.scarf;
    ctx.lineWidth = 4 * S * (1 - (i - 1) / rig.scarf.length * 0.7);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

/**
 * What hangs from the hand: the Pin's flame when it is held, and an ember when it
 * is thrown. 06 §D5 is explicit that the hand is never empty — the 90px aura has
 * to have something visible making it.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {PlayerRig} rig
 * @param {ReturnType<typeof anchors>} a
 * @param {import('./palette.js').Region} region
 * @param {number} t
 */
function drawHandFlame(ctx, state, rig, a, region, t) {
  const held = (state.pin?.state ?? 'held') === 'held';
  const wobble = 0.9 + hashNoise(Math.floor(t * 11)) * 0.2;
  const h = (held ? 7 : 3.4) * wobble * (1 + Math.abs(rig.pendV) * 0.04);
  const w = h * 0.55;

  if (held) {
    // The Pin itself: a short iron stake, ink-dark so the flame reads against it.
    ctx.strokeStyle = '#2A2620';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.hand.x, a.hand.y);
    ctx.lineTo(a.flame.x + Math.sin(rig.pend) * 3, a.flame.y + Math.cos(rig.pend) * 3);
    ctx.stroke();
  }

  drawGlow(ctx, a.flame.x, a.flame.y, held ? 26 : 14, PLAYER.flame, 0.55);
  drawGlow(ctx, a.flame.x, a.flame.y, held ? 9 : 5, PLAYER.core, 0.9);

  ctx.fillStyle = PLAYER.flame;
  ctx.beginPath();
  ctx.moveTo(a.flame.x, a.flame.y - h);
  ctx.quadraticCurveTo(a.flame.x + w, a.flame.y - h * 0.3, a.flame.x, a.flame.y + w * 0.6);
  ctx.quadraticCurveTo(a.flame.x - w, a.flame.y - h * 0.3, a.flame.x, a.flame.y - h);
  ctx.fill();
  ctx.fillStyle = PLAYER.core;
  ctx.beginPath();
  ctx.ellipse(a.flame.x, a.flame.y - h * 0.25, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // A breath of the region accent in the flame's halo ties the player's light to
  // the room it is standing in without changing the flame's own colour.
  drawGlow(ctx, a.flame.x, a.flame.y - h * 0.4, 5, region.accent, 0.25);
}
