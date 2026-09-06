/**
 * The frame composition. `render` owns only the order of the layers and the
 * world->device transform; every layer's *look* lives in its own module.
 *
 * To restyle the game, replace the modules in LAYERS (or the array itself). The
 * camera (render/camera.js) and the loop (view/loop.js) do not go through here, so
 * a visual rewrite cannot change how the game feels or how many steps it runs.
 */

import { VIEW_W, VIEW_H } from '../../core/constants.js';
import { drawTiles } from './tiles.js';
import { drawHazards } from './hazards.js';
import { drawPlayer } from './player.js';
import { PALETTE } from './palette.js';

/** @typedef {import('../../core/types.js').GameState} GameState */
/** @typedef {import('./camera.js').Camera} Camera */

/**
 * @typedef {object} RenderTarget
 * @property {number} width   backing-store width in device pixels
 * @property {number} height  backing-store height in device pixels
 */

/** Ordered back to front. */
const LAYERS = [
  /** @param {CanvasRenderingContext2D} ctx @param {GameState} s @param {{x:number,y:number,w:number,h:number}} view */
  (ctx, s, view) => drawTiles(ctx, s.roomData, view),
  (/** @type {CanvasRenderingContext2D} */ ctx, /** @type {GameState} */ s) => drawHazards(ctx, s.roomData),
  (/** @type {CanvasRenderingContext2D} */ ctx, /** @type {GameState} */ s) => drawPlayer(ctx, s.player),
];

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Readonly<GameState>} state
 * @param {Camera} cam
 * @param {RenderTarget} target
 */
export function render(ctx, state, cam, target) {
  const scale = Math.min(target.width / VIEW_W, target.height / VIEW_H);
  const offsetX = (target.width - VIEW_W * scale) / 2;
  const offsetY = (target.height - VIEW_H * scale) / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, target.width, target.height);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  ctx.fillStyle = PALETTE.backgroundFar;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Camera offsets are rounded so 1.5px strokes stay on the same subpixel every
  // frame; without it the whole scene shimmers as the camera eases.
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  const view = { x: Math.round(cam.x), y: Math.round(cam.y), w: VIEW_W, h: VIEW_H };

  for (const layer of LAYERS) {
    layer(ctx, /** @type {GameState} */ (state), view);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
