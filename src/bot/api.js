/**
 * The bot's view of the world: a *projection* of state, not state itself
 * (04-architecture §4b). The bot may only read what is here, so refactors inside
 * `src/core` cannot break the autopilot, and the autopilot cannot come to depend
 * on an internal the sim is free to change.
 */

import { TILE } from '../core/constants.js';
import { solidAt, oneWayAt } from '../core/collision.js';

/** @typedef {import('../core/types.js').GameState} GameState */
/** @typedef {import('../core/types.js').AbilityId} AbilityId */

/**
 * @typedef {object} Observation
 * @property {number} tick
 * @property {string} room
 * @property {{w:number, h:number, tw:number, th:number}} roomBounds world units and tiles
 * @property {{x:number,y:number,cx:number,cy:number,footY:number,vx:number,vy:number,grounded:boolean,facing:-1|1,hp:number,maxHp:number,iframes:number,state:string}} player
 * @property {{state:string, x:number, y:number}} pin
 * @property {AbilityId[]} abilities
 * @property {{id:string, x:number, y:number, to:string, requires:AbilityId|null}[]} doors
 * @property {{id:string, kind:string, x:number, y:number, taken:boolean}[]} pickups
 * @property {{id:number, kind:string, x:number, y:number, hp:number}[]} enemies
 * @property {null} boss
 * @property {{x:number,y:number,w:number,h:number,kind:string}[]} hazards
 * @property {[number,number][]} route waypoints in tile coords; y is the foot tile
 * @property {(tx:number, ty:number) => boolean} solidAt
 * @property {(tx:number, ty:number) => boolean} oneWayAt
 * @property {{bossesKilled:string[], flags:Record<string, boolean>}} progress
 */

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
    },
    pin: { state: state.pin.state, x: state.pin.x, y: state.pin.y },
    abilities: state.progress.abilities.slice(),
    doors: room.doors.map((d) => ({
      id: d.id, x: d.at[0] * TILE + TILE / 2, y: d.at[1] * TILE + TILE, to: d.to, requires: d.requires,
    })),
    pickups: room.pickups.map((pk) => ({
      id: pk.id, kind: pk.kind, x: pk.at[0] * TILE + TILE / 2, y: pk.at[1] * TILE + TILE,
      taken: state.progress.pickupsTaken.includes(pk.id),
    })),
    enemies: state.entities.map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, hp: e.hp })),
    boss: null,
    hazards: room.hazards.map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h, kind: h.kind })),
    route: room.route,
    solidAt: (tx, ty) => solidAt(room, tx, ty),
    oneWayAt: (tx, ty) => oneWayAt(room, tx, ty),
    progress: { bossesKilled: state.progress.bossesKilled.slice(), flags: { ...state.progress.flags } },
  };
}
