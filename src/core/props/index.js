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

/** @typedef {import('../types.js').Prop} Prop */
/** @typedef {import('../types.js').AABB} AABB */
/** @typedef {import('../types.js').GameState} GameState */

/**
 * @typedef {object} PropKind
 * @property {string} kind
 * @property {(id: number, at: [number,number], to: [number,number]) => Prop} spawn
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
    if (kindDef) out.push(kindDef.spawn(i + 1, spec.at, spec.to));
  });
  return out;
}

/** @param {GameState} s @returns {GameState} */
export function stageProps(s) {
  if (s.props.length === 0) return s;
  return { ...s, props: s.props.map((p) => PROP_KINDS[p.kind]?.update(p, s) ?? p) };
}
