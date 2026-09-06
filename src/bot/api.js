/**
 * The bot's view of the world: a *projection* of state, not state itself
 * (04-architecture §4b). The bot may only read what is here, so refactors inside
 * `src/core` cannot break the autopilot, and the autopilot cannot come to depend
 * on an internal the sim is free to change.
 */

import { TILE } from '../core/constants.js';
import { solidAt, oneWayAt } from '../core/collision.js';
import { pinPlatform } from '../core/pin-geometry.js';
import { isBoss, BOSSES } from '../core/bosses/index.js';

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('../core/types.js').AbilityId} AbilityId */

/**
 * @typedef {object} Observation
 * @property {number} tick
 * @property {string} room
 * @property {{w:number, h:number, tw:number, th:number}} roomBounds world units and tiles
 * @property {{x:number,y:number,cx:number,cy:number,footY:number,vx:number,vy:number,grounded:boolean,facing:-1|1,hp:number,maxHp:number,iframes:number,state:string,jabFrames:number,perch:boolean,hang:boolean,hangBelow:boolean,zipFrames:number}} player
 * @property {{state:string, x:number, y:number, nx:number, ny:number, platform:import('../core/types.js').AABB|null}} pin
 * @property {{state:string, x:number, y:number}} pinB
 * @property {{x:number,y:number,w:number,h:number,frozen:boolean}[]} props
 * @property {import('../core/types.js').Light[]} lights
 * @property {AbilityId[]} abilities
 * @property {{id:string, x:number, y:number, to:string, requires:AbilityId|null}[]} doors
 * @property {{id:string, kind:string, x:number, y:number, taken:boolean}[]} pickups
 * @property {{id:number, kind:string, x:number, y:number, hp:number, pinned:boolean, mode:string}[]} enemies
 * @property {{id:string, entityId:number, x:number, y:number, w:number, h:number, hp:number, maxHp:number, mode:string, guarded:boolean, parts:{id:number,x:number,y:number,w:number,h:number,pinned:boolean,material:string|null}[]}|null} boss
 * @property {{x:number,y:number,w:number,h:number,kind:string}[]} hazards
 * @property {import('../core/types.js').Waypoint[]} route waypoints in tile coords; y is the foot tile
 * @property {(tx:number, ty:number) => boolean} solidAt
 * @property {(tx:number, ty:number) => boolean} oneWayAt
 * @property {{bossesKilled:string[], flags:Record<string, boolean>}} progress
 */

/**
 * The boss in the room, with its parts, because "which part is pinnable and is one
 * of them held right now" is the entire input to a boss policy.
 * @param {Readonly<GameState>} state
 * @returns {Observation['boss']}
 */
function bossIn(state) {
  const root = state.entities.find((e) => isBoss(e.kind) && e.hp > 0);
  if (!root) return null;
  return {
    id: BOSSES[root.kind]?.id ?? root.kind,
    entityId: root.id,
    x: root.x, y: root.y, w: root.w, h: root.h,
    hp: root.hp, maxHp: root.maxHp, mode: root.mode,
    guarded: (root.timers.guard ?? 0) > 0,
    parts: state.entities
      .filter((e) => e.timers.owner === root.id && e.hp > 0)
      .map((e) => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h, pinned: e.pinned, material: e.pinMaterial })),
  };
}

/**
 * @param {Readonly<GameState>} state
 * @returns {Observation}
 */
export function observe(state) {
  const p = state.player;
  const room = state.roomData;
  return {
    tick: state.tick,
    room: state.room,
    roomBounds: { w: room.w * TILE, h: room.h * TILE, tw: room.w, th: room.h },
    player: {
      x: p.x, y: p.y,
      cx: p.x + p.w / 2, cy: p.y + p.h / 2, footY: p.y + p.h,
      vx: p.vx, vy: p.vy, grounded: p.grounded, facing: p.facing,
      hp: p.hp, maxHp: p.maxHp, iframes: p.iframes, state: p.state,
      jabFrames: p.jabFrames, perch: p.perch, hang: p.hang,
      hangBelow: p.hangBelow, zipFrames: p.zipFrames,
    },
    pin: {
      state: state.pin.state, x: state.pin.x, y: state.pin.y,
      nx: state.pin.nx, ny: state.pin.ny, platform: pinPlatform(state.pin),
    },
    pinB: { state: state.pinB.state, x: state.pinB.x, y: state.pinB.y },
    props: state.props.map((pr) => ({ x: pr.x, y: pr.y, w: pr.w, h: pr.h, frozen: pr.frozen })),
    lights: state.lights.map((l) => ({ ...l })),
    abilities: state.progress.abilities.slice(),
    doors: room.doors.map((d) => ({
      id: d.id, x: d.at[0] * TILE + TILE / 2, y: d.at[1] * TILE + TILE, to: d.to, requires: d.requires,
    })),
    pickups: room.pickups.map((pk) => ({
      id: pk.id, kind: pk.kind, x: pk.at[0] * TILE + TILE / 2, y: pk.at[1] * TILE + TILE,
      taken: state.progress.pickupsTaken.includes(pk.id),
    })),
    enemies: state.entities.map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, hp: e.hp, pinned: e.pinned, mode: e.mode })),
    boss: bossIn(state),
    hazards: room.hazards.map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h, kind: h.kind })),
    route: room.route,
    solidAt: (tx, ty) => solidAt(room, tx, ty),
    oneWayAt: (tx, ty) => oneWayAt(room, tx, ty),
    progress: { bossesKilled: state.progress.bossesKilled.slice(), flags: { ...state.progress.flags } },
  };
}
