/**
 * The two things terrain does to a body over time, rather than on contact:
 * **drowning** and **crumbling**.
 *
 * Both belong here rather than in `physics.js` because both change the *world* or
 * the run, not the motion — a crumble tile leaves the room a tile shorter, and a
 * drowning costs a heart. Physics stays a pure function of one frame's forces.
 *
 * 02-world-structure §2 gives each region one hazard, and these are two of the four
 * that had nothing behind them: water was implemented for the Pin and not for the
 * player, and a crumble tile only ever gave way when the Pin hit it, which made the
 * Apex's crumbling ledges ordinary floor.
 */

import { TILE, WATER_DROWN_FRAMES, CRUMBLE_FRAMES } from './constants.js';
import { glyphAt } from './collision.js';
import { tileAt } from '../content/tiles.js';
import { damagePlayer } from './player.js';
import { breakTile } from './rooms.js';
import { emit } from './events.js';

/** @typedef {import('./types.js').GameState} GameState */

/**
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageTerrain(s) {
  return stageCrumble(stageDrown(s));
}

/**
 * Held under for three seconds and it costs a heart. The head, not the body: a
 * player wading chest-deep is in water and is not drowning, and the difference is
 * the whole reason water is a medium rather than a hazard.
 * @param {GameState} s
 * @returns {GameState}
 */
function stageDrown(s) {
  const p = s.player;
  if (p.hp <= 0) return s;
  const head = tileAt(glyphAt(s.roomData, Math.floor((p.x + p.w / 2) / TILE), Math.floor((p.y + 3) / TILE)));
  if (!head.water) return p.submerged === 0 ? s : { ...s, player: { ...p, submerged: 0 } };

  const submerged = p.submerged + 1;
  if (submerged < WATER_DROWN_FRAMES) return { ...s, player: { ...p, submerged } };
  const hurt = damagePlayer({ ...p, submerged: 0, iframes: 0 }, 1, p.x + p.w / 2, s.roomData.hazards);
  emit(s.events, hurt.hp <= 0 ? 'player.death' : 'player.hurt', p.x + p.w / 2, p.y + p.h / 2);
  return { ...s, player: hurt };
}

/**
 * A crumble tile holds for `CRUMBLE_FRAMES` and then it is gone. The whole run of
 * tiles under the feet goes at once, because a body 12 wide standing across a seam
 * would otherwise drop through half a tile and stand on the other half.
 * @param {GameState} s
 * @returns {GameState}
 */
function stageCrumble(s) {
  const p = s.player;
  if (!p.grounded || p.hp <= 0) return p.crumbleFrames === 0 ? s : { ...s, player: { ...p, crumbleFrames: 0 } };

  const ty = Math.floor((p.y + p.h + 1) / TILE);
  /** @type {number[]} */
  const under = [];
  for (let tx = Math.floor(p.x / TILE); tx <= Math.floor((p.x + p.w - 1) / TILE); tx++) {
    if (tileAt(glyphAt(s.roomData, tx, ty)).crumble) under.push(tx);
  }
  if (under.length === 0) return p.crumbleFrames === 0 ? s : { ...s, player: { ...p, crumbleFrames: 0 } };

  const crumbleFrames = p.crumbleFrames + 1;
  if (crumbleFrames < CRUMBLE_FRAMES) return { ...s, player: { ...p, crumbleFrames } };

  let roomData = s.roomData;
  let brokenTiles = s.brokenTiles;
  for (const tx of under) {
    const broken = breakTile(roomData, brokenTiles, tx, ty);
    roomData = broken.room;
    brokenTiles = broken.brokenTiles;
    emit(s.events, 'crumble.break', (tx + 0.5) * TILE, (ty + 0.5) * TILE, { material: 'wood' });
  }
  return { ...s, roomData, brokenTiles, player: { ...p, crumbleFrames: 0 } };
}
