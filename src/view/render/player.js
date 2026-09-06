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

import { PLAYER, rgba, shade } from './palette.js';
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

const HIP_Y = -13 * S;
const SHOULDER_Y = -27 * S;
const HEAD_Y = -32.5 * S;
const HEAD_R = 5.2 * S;
const STRIDE = 28 * S;
const LEG_UPPER = 9 * S;
const LEG_LOWER = 9 * S;
const SCARF_SEG = 3.4 * S;
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
  // Anchored a little behind the neck, and pushed back a little every frame: a
  // scarf hanging from the centre of the chest reads as a tail.
  const anchorX = pts.neck.x - p.facing * 1.8;
  const anchorY = pts.neck.y + 0.5;
  if (rig.lastTick < 0 || Math.abs(state.tick - rig.lastTick) > 30) resetChain(rig.scarf, anchorX, anchorY);
  rig.lastTick = state.tick;

  // Wind is deliberately weak against gravity: a scarf that streams straight out
  // at running speed reads as a rigid stick, not cloth. It should lag and sag.
  const wind = -p.vx * 0.16 - p.facing * 0.12;
  for (let i = 0; i < Math.max(1, Math.round(dt)); i++) {
    stepChain(rig.scarf, anchorX, anchorY, SCARF_SEG, 0.45, wind, p.vy * -0.05, 0.9, 0.85);
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

  drawHead(ctx, a.head.x, a.head.y, HEAD_R * (0.7 + 0.3 * rig.sx), p.facing, body);

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
    const hx = a.hip.x + (i === 0 ? -2.6 : 2.6) * rig.sx;
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
      tx = hx + (i === 0 ? -2.2 : 2.2);
      ty = a.fy;
    }
    const knee = ik2(hx, hy, tx, ty, LEG_UPPER, LEG_LOWER, p.facing);
    bone(ctx, hx, hy, knee.x, knee.y, 4.4 * S, i === 0 ? shade(body, -0.16) : body);
    bone(ctx, knee.x, knee.y, tx, ty, 3.6 * S, i === 0 ? shade(body, -0.16) : body);
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
  const pts = rig.scarf;
  if (pts.length < 2) return;
  // Built as a tapered ribbon rather than a stroked polyline: a chain of
  // round-capped segments reads as a rope, and a polygon whose width falls to a
  // point reads as cloth. Same data, completely different material.
  const n = pts.length;
  /** @type {number[][]} */
  const left = [];
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n - 1, i + 1)] ?? p;
    const r = pts[Math.max(0, i - 1)] ?? p;
    if (!p || !q || !r) continue;
    const dx = q.x - r.x;
    const dy = q.y - r.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = 3.6 * S * Math.pow(1 - i / (n - 1), 0.7) + 0.25;
    left.push([p.x - (dy / d) * w, p.y + (dx / d) * w]);
    right.push([p.x + (dy / d) * w, p.y - (dx / d) * w]);
  }
  ctx.fillStyle = dead ? rgba(PLAYER.scarf, 0.5) : PLAYER.scarf;
  ctx.beginPath();
  for (let i = 0; i < left.length; i++) {
    const q = left[i];
    if (!q) continue;
    if (i === 0) ctx.moveTo(q[0] ?? 0, q[1] ?? 0);
    else ctx.lineTo(q[0] ?? 0, q[1] ?? 0);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    const q = right[i];
    if (!q) continue;
    ctx.lineTo(q[0] ?? 0, q[1] ?? 0);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * The head: a cream face inside a dark hood. The hood is the dark shape and the
 * face is the light one, which is the read that survives at 12px and at any
 * distance — a light head with a dark feature on it just looks like a smudge.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} r
 * @param {number} facing @param {string} body
 */
function drawHead(ctx, x, y, r, facing, body) {
  // The hood's tail, trailing back outside the skull.
  ctx.fillStyle = PLAYER.ink;
  ctx.beginPath();
  ctx.moveTo(x - facing * r * 0.2, y - r * 1.05);
  ctx.quadraticCurveTo(x - facing * r * 2.3, y - r * 1.0, x - facing * r * 1.9, y + r * 0.75);
  ctx.quadraticCurveTo(x - facing * r * 0.9, y + r * 0.35, x - facing * r * 0.2, y - r * 1.05);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // The hood proper: a disc offset backward, clipped to the skull, leaving a
  // crescent of face on the side the player is looking.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + 0.4, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = PLAYER.ink;
  ctx.beginPath();
  ctx.arc(x - facing * r * 0.78, y - r * 0.12, r * 1.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = PLAYER.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
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
  const h = (held ? 5.4 : 3) * wobble * (1 + Math.abs(rig.pendV) * 0.04);
  const w = h * 0.5;

  if (held) {
    // The Pin itself: a short iron stake, ink-dark so the flame reads against it.
    ctx.strokeStyle = '#2A2620';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    // Stops short of the flame: a shaft drawn *through* the flame puts a dark
    // bar across it and the whole thing reads as a ring rather than a fire.
    ctx.beginPath();
    ctx.moveTo(a.hand.x, a.hand.y);
    ctx.lineTo(a.hand.x + Math.sin(rig.pend) * 3.4, a.hand.y + Math.cos(rig.pend) * 3.4);
    ctx.stroke();
  }

  // Kept below the flame's own brightness: an additive core hotter than the
  // teardrop turns the flame into a dark ring inside a bright disc.
  drawGlow(ctx, a.flame.x, a.flame.y, held ? 30 : 16, PLAYER.flame, 0.42);
  drawGlow(ctx, a.flame.x, a.flame.y, held ? 12 : 6, PLAYER.core, 0.30);

  teardrop(ctx, a.flame.x, a.flame.y, h, w, PLAYER.flame);
  teardrop(ctx, a.flame.x, a.flame.y - h * 0.1, h * 0.55, w * 0.45, PLAYER.core);
  // A breath of the region accent in the flame's halo ties the player's light to
  // the room it is standing in without changing the flame's own colour.
  drawGlow(ctx, a.flame.x, a.flame.y - h * 0.4, 5, region.accent, 0.25);
}

/**
 * A flame: pointed at the top, round at the bottom. The obvious symmetric lens
 * shape reads as a leaf, and every flame in the game is drawn from here so they
 * all agree.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y
 * @param {number} h @param {number} w @param {string} color
 */
export function teardrop(ctx, x, y, h, w, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + w * 0.75, y - h * 0.45, x + w, y + h * 0.05, x, y + w * 0.85);
  ctx.bezierCurveTo(x - w, y + h * 0.05, x - w * 0.75, y - h * 0.45, x, y - h);
  ctx.fill();
}
