/**
 * Colours for the plain Phase 1 renderer.
 *
 * This is NOT the Lantern & Ink palette from 05-aesthetic.md — that look, with its
 * light holes, layered silhouettes and per-region hues, is owned by a later agent.
 * These values exist only so the geometry is legible while the foundation is being
 * tested, and are expected to be replaced wholesale.
 */

export const PALETTE = {
  background: '#12161c',
  backgroundFar: '#1a2029',
  stone: '#2b3440',
  stoneEdge: '#4e5a68',
  wood: '#3a2e22',
  woodEdge: '#7a5c3a',
  metal: '#2a3138',
  metalEdge: '#8fa3b8',
  platform: '#5a452e',
  platformEdge: '#a8834f',
  hazard: '#ff4d5a',
  hazardEdge: '#ffd3a0',
  door: '#5fe3d0',
  player: '#efe4c8',
  playerInk: '#1a1410',
  water: '#1e3a4e',
};

/** @type {Record<string, {fill:string, edge:string}>} */
export const MATERIAL_COLORS = {
  stone: { fill: PALETTE.stone, edge: PALETTE.stoneEdge },
  wood: { fill: PALETTE.wood, edge: PALETTE.woodEdge },
  metal: { fill: PALETTE.metal, edge: PALETTE.metalEdge },
};
