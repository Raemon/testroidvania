/**
 * Save-lanterns. Walk through one and it lights: full heal, new respawn point, no
 * prompt and no button (06-revision-1 §E). The Pin's flame reaches out and does it
 * for you — the visual carries the metaphor, the player does nothing.
 *
 * Lighting one is also the game's collectible (§D4): the counter is what the
 * ending scales with, so an unlit lantern off the critical path is worth walking to.
 */

import { overlaps } from './geometry.js';
import { lanternId } from './light.js';
import { emit } from './events.js';

/** @typedef {import('./types.js').GameState} GameState */

/**
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageLanterns(s) {
  const p = s.player;
  if (p.hp <= 0 || s.roomData.lanterns.length === 0) return s;
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const lantern of s.roomData.lanterns) {
    const id = lanternId(s.roomData.id, lantern.at);
    if (s.progress.lanternsLit.includes(id)) continue;
    if (!overlaps(box, { x: lantern.x - 8, y: lantern.y - 8, w: 16, h: 16 })) continue;
    emit(s.events, 'lantern.light', lantern.x, lantern.y);
    return {
      ...s,
      player: { ...p, hp: p.maxHp },
      respawn: { room: s.room, x: p.safeGround.x, y: p.safeGround.y },
      progress: { ...s.progress, lanternsLit: [...s.progress.lanternsLit, id].sort() },
    };
  }
  return s;
}
