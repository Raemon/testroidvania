/**
 * Per-frame events: the things that *happened* this step, as opposed to the state
 * that resulted.
 *
 * The view can diff two GameStates for most of what it needs, but some of the
 * game's loudest moments are invisible in a diff — a Zip arrival and a fast fall
 * look identical, a room transition is instantaneous so a door has already gone
 * past by the time anything could grind, and "which material is under the foot"
 * would mean re-deriving collision outside the sim. Those belong here.
 *
 * Rules that keep this from becoming a side channel:
 *  - the list is rebuilt from scratch every `step()`, so it is a pure function of
 *    the frame and a replay hashes identically;
 *  - every event has the same five fields, so hashing it is cheap and total;
 *  - consumers are strictly read-only.
 */

/** @typedef {import('./types.js').SimEvent} SimEvent */
/** @typedef {import('./types.js').Material} Material */

/**
 * Every kind the sim may emit. Phase 3 systems add their own line here rather than
 * inventing a string at the call site, so the view can enumerate what exists.
 */
export const EVENT_KINDS = [
  // Pin
  'pin.throw', 'pin.embed', 'pin.clang', 'pin.enemy', 'pin.recall', 'pin.catch', 'pin.drop',
  // Grip
  'perch', 'hang', 'wallkick',
  // Movement
  'jump', 'land', 'footstep', 'water.enter', 'water.exit',
  // Combat
  'jab', 'hit', 'enemy.death', 'player.hurt', 'player.death', 'respawn',
  // World
  'crumble.break', 'lantern.light', 'door.open', 'room.enter',
  // Phase 3, declared so the vocabulary is fixed before the code arrives
  'zip.start', 'zip.arrive', 'boss.roar', 'boss.stomp', 'boss.phase', 'menu.move',
];

/**
 * Append one event. `events` is always an array this frame created, so pushing to
 * it is not a mutation of anything `step()` was handed.
 *
 * @param {SimEvent[]} events
 * @param {string} kind      one of EVENT_KINDS
 * @param {number} x         where it happened, world units
 * @param {number} y
 * @param {object} [extra]
 * @param {Material|null} [extra.material] the surface involved, for footsteps and impacts
 * @param {number} [extra.id] the entity involved, when there is one
 * @returns {void}
 */
export function emit(events, kind, x, y, extra = {}) {
  events.push({
    kind,
    x,
    y,
    material: extra.material ?? null,
    id: extra.id ?? null,
  });
}
