/**
 * The frame composition: this file owns only the *order* of the layers and the
 * world->device transform. Every layer's look lives in its own module, so the
 * whole art direction can be re-cut by reordering `render` without touching a
 * single drawing routine.
 *
 * The frame is built in two groups, and which group a layer is in *is* the art
 * direction. The world group — terrain through player, plus the warm casts — is
 * everything a light can reach; the darkness is composited over it with
 * `source-atop`, so it lands on those pixels and nothing else. The distance is
 * then filled in behind with `destination-over` and takes a flat, hole-less dim.
 *
 * That split is the whole fix for 06 §D5's arithmetic problem: over L5 terrain a
 * 0.55 wash of an L6 colour subtracts nothing, so the only thing a full-screen
 * overlay was actually doing was crushing the parallax's L26/L20/L15 bands into
 * each other — flattening the one part of the frame that carries depth in order to
 * "darken" the one part it cannot darken at all.
 *
 * Draw order:
 *   terrain -> props -> fluids -> hazards -> particles -> entities -> Pin -> player
 *   the light layer: cold wash, holes, warm casts, remembered terrain, the grade,
 *     built at world resolution and landed in one pass (source-atop: world only)
 *   void gradient -> parallax skylines + fog + a flat dim   (destination-over)
 *   letterbox bars                                                        (device)
 *   hit flash and the low-health tint, when they are happening             (view)
 *   HUD                                                                    (view)
 *
 * The renderer holds mutable animation state (rigs, particles, cached canvases).
 * That state is *downstream only*: it is read from the sim every frame and never
 * written back, which is what keeps `render` a pure function of the simulation.
 */

import { TILE, VIEW_W, VIEW_H, DISCOVERED_ALPHA } from '../../core/constants.js';
import { regionFor, darknessFor, luminance, rgba, INK, PLAYER } from './palette.js';
import { drawParallax } from './parallax.js';
import { drawTerrain, drawFluids, updateMemoryMask } from './terrain.js';
import { drawHazards, drawHazardGlow } from './hazards.js';
import { drawLanterns, drawCrumble, drawPickups, drawRails, drawProps } from './props.js';
import { drawDarkness } from './darkness.js';
import { buildLights } from './lights.js';
import { createPlayerRig, updatePlayerRig, drawPlayer, handLight } from './player.js';
import { drawEntities, updateEntities } from './entities.js';
import { drawPins } from './pin.js';
import { Particles } from './particles.js';
import { drawGrade, gradeLayer } from './grade.js';
import { drawHudOverlay, drawRoomLabel } from './hud-overlay.js';
import { bloomAmount, drawPrompt, drawWorldMoments } from './moments.js';
import { codaDrift, drawCoda } from './coda.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./camera.js').Camera} Camera */

/**
 * @typedef {object} RenderTarget
 * @property {number} width   backing-store width in device pixels
 * @property {number} height  backing-store height in device pixels
 */

/** How strongly a light warms what it lands on. The cold half is `region.wash`. */
const WARM_ALPHA = 0.30;

const rig = createPlayerRig();
const particles = new Particles('pinlight');
let lastTick = -1;

/**
 * The world -> device transform. Exported because the harness projects the player
 * to a screen pixel with it; there must be exactly one copy of this arithmetic or
 * the "is the player visible" probe can disagree with what was actually drawn.
 * @param {RenderTarget} target
 * @returns {{scale:number, offsetX:number, offsetY:number}}
 */
export function viewTransform(target) {
  const scale = Math.min(target.width / VIEW_W, target.height / VIEW_H);
  return {
    scale,
    offsetX: (target.width - VIEW_W * scale) / 2,
    offsetY: (target.height - VIEW_H * scale) / 2,
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Camera} cam
 * @param {RenderTarget} target
 */
export function render(ctx, state, cam, target) {
  const { scale, offsetX, offsetY } = viewTransform(target);
  const region = regionFor(state.room);
  const t = state.tick / 60;

  // Animation advances by however many sim frames passed since the last draw, so
  // a dropped frame does not slow the scarf down and the turbo test pump (one
  // step per draw) and free-running play produce the same motion.
  const dt = lastTick < 0 ? 1 : Math.max(0, Math.min(6, state.tick - lastTick));
  lastTick = state.tick;

  // Camera offsets are rounded so 1.5px strokes stay on the same subpixel every
  // frame; without it the whole scene shimmers as the camera eases.
  // The coda drifts the camera off the runner once the run is over. Added here
  // and in the harness's player projection through the same function, so there is
  // still exactly one answer to "where is the world".
  const drift = codaDrift();
  const camX = Math.round(cam.x + drift.x);
  const camY = Math.round(cam.y + drift.y);
  const view = { x: camX, y: camY, w: VIEW_W, h: VIEW_H };
  /** @type {import('./view.js').View} */
  const v = {
    scale,
    originX: Math.round(offsetX - camX * scale),
    originY: Math.round(offsetY - camY * scale),
    camX, camY, width: target.width, height: target.height,
  };

  updatePlayerRig(rig, state, dt, particles);
  updateEntities(state, dt);
  particles.breathe(region, view, dt);
  particles.update(dt);

  const hand = handLight(rig, state.player);
  const lights = buildLights(state, region, hand, t);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Cleared to *transparent*, because "has anything been drawn here" is what the
  // darkness composite reads as "can a light reach here". The distance and the
  // bars fill the untouched pixels back in at the end of the frame.
  ctx.clearRect(0, 0, target.width, target.height);

  ctx.setTransform(scale, 0, 0, scale, v.originX, v.originY);
  drawTerrain(ctx, state.roomData, region, v);
  drawRails(ctx, state.roomData, region);
  drawCrumble(ctx, state, region, view);
  drawFluids(ctx, state.roomData, region, view, t);
  drawHazards(ctx, state.roomData, view, t);
  drawLanterns(ctx, state, region, t);
  drawPickups(ctx, state, region, t);
  drawProps(ctx, state, region);
  particles.draw(ctx);
  drawEntities(ctx, state, region, t, hand);
  drawPins(ctx, state, region, t);
  drawPlayer(ctx, state, rig, region, t);
  drawWorldMoments(ctx, state, region, hand);
  drawHazardGlow(ctx, state.roomData, view);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  const screenLights = lights.map((l) => ({ ...l, x: l.x - camX, y: l.y - camY }));

  updateMemoryMask(state.roomData, state.discovered?.[state.room] ?? [], DISCOVERED_ALPHA, v);
  const low = state.player.maxHp > 0 && state.player.hp / state.player.maxHp < 0.25 && state.player.hp > 0;
  const grade = gradeLayer(region, state.tick);
  const gradeAlpha = low ? 0.85 + 0.15 * Math.sin(state.tick * 0.126) : 0.72;
  // Only what the light could have reached. See the header: a wash that also
  // covers the sky costs the parallax its value separation and buys nothing.
  // 05 §7.1: earning an ability opens the room up for a moment — "you see
  // architecture you could not see before" — and then it closes back down. It is
  // the one time the darkness is allowed to move, and it is the whole reason the
  // beat lands as a reward rather than as an inventory update.
  const bloom = bloomAmount();
  if (bloom > 0) {
    screenLights.push({
      x: hand.x - camX, y: hand.y - camY,
      r: 260 + 640 * bloom, color: PLAYER.flame, warmth: 1,
    });
  }
  ctx.globalCompositeOperation = 'source-atop';
  drawDarkness(ctx, region, screenLights, darknessFor(state.room, region) * (1 - bloom * 0.8), grade ? grade.canvas : null, gradeAlpha, WARM_ALPHA);

  // The distance, filled in behind everything above it. It carries the same grade
  // (so the vignette still closes the frame) and a flat, hole-less dim: the light
  // cannot reach out here, so it is neither lit nor hidden — only far.
  ctx.globalCompositeOperation = 'destination-over';
  drawParallax(ctx, region, camX, camY, state.roomData.h * TILE, grade ? grade.canvas : null, gradeAlpha);
  ctx.globalCompositeOperation = 'source-over';
  pushBackOutsideRoom(ctx, region, state.roomData.w * TILE, state.roomData.h * TILE, camX, camY);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = INK;
  if (offsetY > 0) {
    ctx.fillRect(0, 0, target.width, Math.ceil(offsetY));
    ctx.fillRect(0, target.height - Math.ceil(offsetY) - 1, target.width, Math.ceil(offsetY) + 1);
  }
  if (offsetX > 0) {
    ctx.fillRect(0, 0, Math.ceil(offsetX), target.height);
    ctx.fillRect(target.width - Math.ceil(offsetX) - 1, 0, Math.ceil(offsetX) + 1, target.height);
  }

  drawGrade(ctx, state, state.tick, { x: offsetX, y: offsetY, w: VIEW_W * scale, h: VIEW_H * scale });
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  drawHudOverlay(ctx, state, state.tick, dt);
  drawRoomLabel(ctx, state.room);
  drawPrompt(ctx, state.tick);
  drawCoda(ctx, state);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Push the distance back to the Void band past the room's own edges.
 *
 * A room smaller than the view is centred (camera.js §3.3 "Small rooms"), which
 * leaves the sky showing beyond its walls. In the dark regions that is free
 * atmosphere and worth keeping — the Plunge is a shaft with a city behind it. In
 * the Core the void gradient *inverts* and the same strip is a bright cream bar:
 * 23px above k1, 39px above k5, 71px above the Hull, all of them reading as a
 * lit wall where the room ends.
 *
 * So the strips are not blanked, they are dimmed to the band the Void is supposed
 * to occupy (05 §2, L10-12) — which costs a dark region almost nothing and costs
 * the Core exactly the bar.
 *
 * @param {CanvasRenderingContext2D} ctx  in view space
 * @param {import('./palette.js').Region} region
 * @param {number} roomW @param {number} roomH
 * @param {number} camX @param {number} camY
 */
function pushBackOutsideRoom(ctx, region, roomW, roomH, camX, camY) {
  const top = -camY;
  const bottom = roomH - camY;
  const left = -camX;
  const right = roomW - camX;
  if (top <= 0 && bottom >= VIEW_H && left <= 0 && right >= VIEW_W) return;
  const alpha = Math.min(0.88, Math.max(0, (luminance(region.voidTop) - 0.12) / 0.8));
  if (alpha <= 0.02) return;
  ctx.fillStyle = rgba(INK, alpha);
  if (top > 0) ctx.fillRect(0, 0, VIEW_W, top);
  if (bottom < VIEW_H) ctx.fillRect(0, bottom, VIEW_W, VIEW_H - bottom);
  if (left > 0) ctx.fillRect(0, 0, left, VIEW_H);
  if (right < VIEW_W) ctx.fillRect(right, 0, VIEW_W - right, VIEW_H);
}

/** Exposed for the perf probe: how much of the frame budget the scene is using. */
export const debugRenderState = { rig, particles, PLAYER };
