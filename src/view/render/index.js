/**
 * The frame composition: this file owns only the *order* of the layers and the
 * world->device transform. Every layer's look lives in its own module, so the
 * whole art direction can be re-cut by reordering `render` without touching a
 * single drawing routine.
 *
 * Back to front:
 *   void gradient -> parallax skylines + fog planes  (view space, no camera)
 *   terrain -> props -> fluids -> hazards -> particles -> entities -> Pin -> player
 *   warm light casts                                                       (world, additive)
 *   darkness overlay + remembered terrain + the constant grade, in one blit
 *   hit flash and the low-health tint, when they are happening             (view)
 *   HUD                                                                    (view)
 *
 * The renderer holds mutable animation state (rigs, particles, cached canvases).
 * That state is *downstream only*: it is read from the sim every frame and never
 * written back, which is what keeps `render` a pure function of the simulation.
 */

import { VIEW_W, VIEW_H, DISCOVERED_ALPHA } from '../../core/constants.js';
import { regionFor, INK, PLAYER } from './palette.js';
import { drawParallax } from './parallax.js';
import { drawTerrain, drawFluids, updateMemoryMask } from './terrain.js';
import { drawHazards, drawHazardGlow } from './hazards.js';
import { drawLanterns, drawCrumble, drawPickups } from './props.js';
import { drawDarkness } from './darkness.js';
import { buildLights } from './lights.js';
import { createPlayerRig, updatePlayerRig, drawPlayer, handLight } from './player.js';
import { drawEntities, updateEntities } from './entities.js';
import { drawPin } from './pin.js';
import { Particles } from './particles.js';
import { drawGrade, gradeLayer } from './grade.js';
import { drawHudOverlay, drawRoomLabel } from './hud-overlay.js';
import { drawGlow } from './glow.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./camera.js').Camera} Camera */

/**
 * @typedef {object} RenderTarget
 * @property {number} width   backing-store width in device pixels
 * @property {number} height  backing-store height in device pixels
 */

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
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
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
  // Only the letterbox bars need clearing: the background layer paints every
  // pixel inside the view, so clearing the whole canvas would be a wasted pass.
  ctx.fillStyle = INK;
  if (offsetY > 0) {
    ctx.fillRect(0, 0, target.width, Math.ceil(offsetY));
    ctx.fillRect(0, target.height - Math.ceil(offsetY) - 1, target.width, Math.ceil(offsetY) + 1);
  }
  if (offsetX > 0) {
    ctx.fillRect(0, 0, Math.ceil(offsetX), target.height);
    ctx.fillRect(target.width - Math.ceil(offsetX) - 1, 0, Math.ceil(offsetX) + 1, target.height);
  }

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  drawParallax(ctx, region, camX, camY);

  ctx.setTransform(scale, 0, 0, scale, v.originX, v.originY);
  drawTerrain(ctx, state.roomData, region, v);
  drawCrumble(ctx, state, region, view);
  drawFluids(ctx, state.roomData, region, view, t);
  drawHazards(ctx, state.roomData, view, t);
  drawLanterns(ctx, state, region, t);
  drawPickups(ctx, state, region, t);
  particles.draw(ctx);
  drawEntities(ctx, state, region, t, hand);
  drawPin(ctx, state, region, t);
  drawPlayer(ctx, state, rig, region, t);
  drawHazardGlow(ctx, state.roomData, view);

  // The warm cast: what the light *adds* to the scene, as opposed to what the
  // darkness overlay subtracts everywhere else. Additive and low, so it colours
  // the surfaces near a light instead of washing them out.
  for (const l of lights) {
    if (!l.warmth) continue;
    drawGlow(ctx, l.x, l.y, Math.min(l.r * 0.5, 130), l.color, 0.20 * l.warmth, 3.2);
  }

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  updateMemoryMask(state.roomData, state.discovered?.[state.room] ?? [], DISCOVERED_ALPHA, v);
  const low = state.player.maxHp > 0 && state.player.hp / state.player.maxHp < 0.25 && state.player.hp > 0;
  const grade = gradeLayer(region, state.tick);
  drawDarkness(
    ctx, region,
    lights.map((l) => ({ ...l, x: l.x - camX, y: l.y - camY })),
    region.darkness,
    grade ? grade.canvas : null,
    low ? 0.85 + 0.15 * Math.sin(state.tick * 0.126) : 0.72,
  );


  drawGrade(ctx, state, state.tick, { x: offsetX, y: offsetY, w: VIEW_W * scale, h: VIEW_H * scale });
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  drawHudOverlay(ctx, state, state.tick, dt);
  drawRoomLabel(ctx, state.room);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Exposed for the perf probe: how much of the frame budget the scene is using. */
export const debugRenderState = { rig, particles, PLAYER };
