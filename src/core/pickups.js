/**
 * Pickups: the ability pedestals and the health shards. Walk into one and it is
 * yours — the same no-prompt, no-button rule as the save-lanterns (06-revision-1 §E),
 * because a game whose only verbs are Throw and Jump should not grow an interact key.
 *
 * A pedestal in a boss arena carries `afterBoss`, so the ability is the *reward* for
 * the fight rather than something you can walk around it to collect.
 */

import { TILE, PLAYER_MAX_HP } from './constants.js';
import { overlaps } from './geometry.js';
import { isAbilityId } from './abilities/index.js';
import { emit } from './events.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').AbilityId} AbilityId */

/**
 * @param {GameState} s
 * @returns {GameState}
 */
export function stagePickups(s) {
  const p = s.player;
  if (p.hp <= 0 || s.roomData.pickups.length === 0) return s;
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };

  for (const pk of s.roomData.pickups) {
    if (s.progress.pickupsTaken.includes(pk.id)) continue;
    if (pk.afterBoss && !s.progress.bossesKilled.includes(pk.afterBoss)) continue;
    if (!overlaps(box, { x: pk.at[0] * TILE, y: pk.at[1] * TILE, w: TILE, h: TILE })) continue;

    emit(s.events, 'pickup.take', pk.at[0] * TILE + TILE / 2, pk.at[1] * TILE + TILE / 2);
    const progress = { ...s.progress, pickupsTaken: [...s.progress.pickupsTaken, pk.id].sort() };

    if (pk.kind === 'ability' && pk.ability && isAbilityId(pk.ability)) {
      if (progress.abilities.includes(pk.ability)) return { ...s, progress };
      emit(s.events, 'ability.gain', p.x + p.w / 2, p.y + p.h / 2);
      // Appended, not sorted: the order they were earned in is the ability ladder,
      // and every aura radius and every gate is read off its length.
      return { ...s, progress: { ...progress, abilities: [...progress.abilities, pk.ability] } };
    }
    if (pk.kind === 'shard') {
      const maxHp = Math.min(p.maxHp + 1, PLAYER_MAX_HP + 3);
      return { ...s, progress, player: { ...p, maxHp, hp: Math.min(maxHp, p.hp + 1) } };
    }
    return { ...s, progress };
  }
  return s;
}
