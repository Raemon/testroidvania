/**
 * The prop registry: kind -> behaviour, one file plus one alphabetically-sorted
 * line each (AGENTS.md rule 4).
 *
 * Props are the room's moving furniture. They are not entities: they have no
 * health, they never damage you, and the enemy invariants have nothing to say about
 * them. They exist because A2 needs something to freeze and A3 needs something to
 * drag that is not a physics body.
 */

import * as rail from './rail.js';
import { overlapsSolid } from '../collision.js';

/** @typedef {import('../types.js').Prop} Prop */
/** @typedef {import('../types.js').AABB} AABB */
/** @typedef {import('../types.js').GameState} GameState */

/**
 * @typedef {object} PropKind
 * @property {string} kind
 * @property {(id: number, at: [number,number], to: [number,number], running?: boolean) => Prop} spawn
 * @property {(p: Prop, s: Readonly<GameState>) => Prop} update
 */

/** @type {Record<string, PropKind>} */
export const PROP_KINDS = { rail };

/** @param {string} kind @returns {boolean} */
export function isPropKind(kind) {
  return Object.hasOwn(PROP_KINDS, kind);
}

/** @param {Readonly<Prop>} p @returns {AABB} */
export function propBox(p) {
  return { x: p.x, y: p.y, w: p.w, h: p.h };
}

/**
 * Rails are one-way surfaces rather than solids: you jump up through one and land
 * on top of it, exactly like a Pin's shelf. That keeps every moving thing in the
 * game on the same collision path and out of the swept-solid business.
 * @param {readonly Prop[]} props
 * @returns {AABB[]}
 */
export function propPlatforms(props) {
  return props.map(propBox);
}

/**
 * @param {import('../types.js').Room} room
 * @returns {Prop[]} the room's rails, freshly instantiated
 */
export function spawnProps(room) {
  /** @type {Prop[]} */
  const out = [];
  room.rails.forEach((spec, i) => {
    const kindDef = PROP_KINDS[spec.kind];
    if (kindDef) out.push(kindDef.spawn(i + 1, spec.at, spec.to, spec.running === true));
  });
  return out;
}

/**
 * `frozen` is derived from where the Pins are rather than stored, so a Pin that
 * left — recalled, shattered, knocked loose — can never leave a mechanism stopped
 * forever. Freezing is A2's traversal use, not a permanent edit to the room.
 * @param {GameState} s
 * @returns {GameState}
 */
export function stageProps(s) {
  if (s.props.length === 0) return s;
  let carry = { x: 0, y: 0 };
  const props = s.props.map((p) => {
    const held = p.id === s.pin.propId || p.id === s.pinB.propId;
    const kindDef = PROP_KINDS[p.kind];
    const moved = kindDef ? kindDef.update({ ...p, frozen: held }, s) : { ...p, frozen: held };
    if (riding(s, p)) carry = { x: carry.x + moved.x - p.x, y: carry.y + moved.y - p.y };
    return moved;
  });
  if (carry.x === 0 && carry.y === 0) return { ...s, props };
  // A rider goes with the rail. Without this the ferry slides out from under you,
  // which is the difference between a platform and a piece of scenery.
  const shifted = { ...s.player, x: s.player.x + carry.x, y: s.player.y + carry.y };
  const blocked = overlapsSolid(s.roomData, { x: shifted.x, y: shifted.y, w: shifted.w, h: shifted.h });
  return { ...s, props, player: blocked ? s.player : shifted };
}

/**
 * @param {Readonly<GameState>} s
 * @param {Readonly<Prop>} p
 * @returns {boolean} true if the player's feet are resting on this prop
 */
function riding(s, p) {
  const feet = s.player.y + s.player.h;
  if (Math.abs(feet - p.y) > 1) return false;
  return s.player.x < p.x + p.w && s.player.x + s.player.w > p.x;
}
