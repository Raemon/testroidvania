/**
 * The entity registry: kind -> behaviour. Adding an enemy is one new file plus one
 * alphabetically-sorted line here (AGENTS.md rule 4). Content validation reads it,
 * so a room cannot spawn a kind nothing implements.
 *
 * Bosses live in `src/core/bosses/` but register here as ordinary kinds, because a
 * boss is a body: it takes damage, it touches you, the Pin bites its parts, and its
 * eyes are lights. None of that is worth writing twice.
 */

import * as anchor from '../bosses/anchor.js';
import * as bolt from './bolt.js';
import * as charger from './charger.js';
import * as crawler from './crawler.js';
import * as diver from '../bosses/diver.js';
import * as drifter from './drifter.js';
import * as hopper from './hopper.js';
import * as part from './part.js';
import * as sentinel from '../bosses/sentinel.js';
import * as shell from './shell.js';
import * as stoker from '../bosses/stoker.js';
import * as turret from './turret.js';

export { entityBox, entityEye, damageEntity, createEntity, moveEntity, blockedAhead, armoured } from './base.js';

/**
 * @typedef {object} EntityKind
 * @property {string} kind
 * @property {(id: number, roomId: string, tx: number, ty: number) => import('../types.js').Entity} spawn
 * @property {(e: import('../types.js').Entity, s: Readonly<import('../types.js').GameState>) => import('../types.js').Entity} update
 * @property {(e: Readonly<import('../types.js').Entity>, s: Readonly<import('../types.js').GameState>, nextId: number) => import('../types.js').Entity[]} [hatch]
 *   bodies this one makes this frame: a Turret's bolt, a boss's limbs, a lava wave
 */

/** @type {Record<string, EntityKind>} */
export const ENTITY_KINDS = {
  anchor,
  bolt,
  charger,
  crawler,
  diver,
  drifter,
  hopper,
  part,
  sentinel,
  shell,
  stoker,
  turret,
};

/** @param {string} kind @returns {boolean} */
export function isEntityKind(kind) {
  return Object.hasOwn(ENTITY_KINDS, kind);
}
