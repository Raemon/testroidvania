/**
 * The shared half of every boss policy.
 *
 * A boss policy is a **reactive function** — `(observation) -> input bits` — and
 * deliberately not an input tape. A tape is written against one exact sequence of
 * boss frames, so the first time a phase machine changes its mind the tape walks
 * into a wall and the test says "the bot got stuck" instead of "the boss changed".
 * A policy tests the boss: it has to dodge the telegraphs and hit the openings, and
 * it fails loudly when either stops working.
 *
 * The loop it implements is the design's boss idea, in three lines:
 * find the pinnable part, nail it, and hit the thing while its plates are down.
 */

import { IN } from '../../core/input.js';

/** @typedef {import('../api.js').Observation} Observation */

/** Frames between presses of an edge-triggered button. */
const PRESS_PERIOD = 8;
/** Where to stand to jab the root: outside its box, inside the jab's 16px reach. */
const JAB_STANDOFF = 20;
/** The band the flat throw is taken from: outside contact, well inside the range. */
const THROW_MIN = 40;
const THROW_MAX = 120;
/** How close a bolt has to be before it is worth reacting to. */
const BOLT_ALARM = 72;

/**
 * Edge-triggered inputs need a rising edge, and a stateless policy that simply
 * holds the button presses it exactly once. Pulsing keeps Throw and Recall live.
 * @param {Observation} obs
 * @returns {boolean}
 */
export function pressNow(obs) {
  return obs.tick % PRESS_PERIOD === 0;
}

/**
 * The nearest bolt, wave or geyser actually heading at the player.
 * @param {Observation} obs
 * @returns {Observation['enemies'][number]|null}
 */
export function incoming(obs) {
  const p = obs.player;
  let best = null;
  let bestDist = BOLT_ALARM;
  for (const e of obs.enemies) {
    if (e.kind !== 'bolt') continue;
    const d = Math.hypot(e.x + e.w / 2 - p.cx, e.y + e.h / 2 - p.cy);
    if (d >= bestDist) continue;
    // Only things closing on us: something already past is not a threat.
    if ((e.x - p.cx) * e.vx > 0 && (e.y - p.cy) * e.vy >= 0) continue;
    best = e;
    bestDist = d;
  }
  return best;
}

/**
 * @param {Observation} obs
 * @param {number} targetX
 * @param {number} slack
 * @returns {number} input bits that walk toward `targetX`, 0 once there
 */
export function walkTo(obs, targetX, slack = 5) {
  const dx = targetX - obs.player.cx;
  if (Math.abs(dx) <= slack) return 0;
  return dx > 0 ? IN.RIGHT : IN.LEFT;
}

/**
 * The boss fight, minus whatever the individual boss makes you do differently.
 * @param {Observation} obs
 * @returns {number} input bits for this frame
 */
export function brawl(obs) {
  const boss = obs.boss;
  if (!boss) return 0;
  const p = obs.player;

  // 1. Get out of the way. Every boss's damage arrives as something that moves.
  const bolt = incoming(obs);
  if (bolt) {
    const aside = backAway(obs, bolt.x + bolt.w / 2 < p.cx ? IN.RIGHT : IN.LEFT);
    return p.grounded ? aside | IN.JUMP : aside;
  }

  // 2. A part is held: the plates are down and the boss has stopped. Close and jab.
  const held = boss.parts.find((part) => part.pinned);
  if (held) {
    const standX = standoff(obs, boss, JAB_STANDOFF);
    const walk = walkTo(obs, standX);
    if (walk) return walk;
    const face = standX < boss.x + boss.w / 2 ? IN.RIGHT : IN.LEFT;
    return face | (p.jabFrames === 0 ? IN.ATTACK : 0);
  }

  // 3. The Pin has landed on nothing useful: bring it home. Never while it is still
  //    flying — the pulse would recall a throw that has not arrived yet, which is
  //    how a policy spends an entire fight throwing the same Pin four tiles.
  if (obs.pin.state === 'flying') return 0;
  if (obs.pin.state !== 'held') return pressNow(obs) ? IN.RECALL : 0;

  // 4. Throw at the nearest part the moment it is in the lane and inside range.
  //    Not from a fixed mark: a boss walks, and a policy that insists on standing
  //    exactly 44px away spends the whole fight shuffling instead of throwing.
  const part = nearestPart(obs, boss);
  if (!part) return 0;
  const partX = part.x + part.w / 2;
  const reach = Math.abs(partX - p.cx);
  const toward = partX > p.cx ? IN.RIGHT : IN.LEFT;
  const away = partX > p.cx ? IN.LEFT : IN.RIGHT;
  if (reach > THROW_MAX) return toward;
  // Backing off is better than trading contact damage — unless there is nowhere
  // left to back off to, in which case take the shot from where you are standing.
  //    Backing through the door you came in by counts as cornered too: leaving the
  //    arena is not a dodge, and a policy that does it never fights the boss again.
  if (reach < THROW_MIN) {
    const back = backAway(obs, away);
    if (back) return back;
  }
  // A flat throw, so it is only worth spending while the part is in the hand's lane.
  const hand = p.y + 6;
  if (hand < part.y - 3 || hand > part.y + part.h + 3 || !p.grounded) return 0;
  return toward | (pressNow(obs) ? IN.THROW : 0);
}

/**
 * Which side to fight from. A boss that walks you into a corner would otherwise
 * leave the policy shuffling against a wall it can never back off from, which is
 * the single thing that stops a reactive policy dead.
 * @param {Observation} obs
 * @param {NonNullable<Observation['boss']>} boss
 * @param {number} dist
 * @returns {number}
 */
export function standoff(obs, boss, dist) {
  const left = boss.x - dist;
  const right = boss.x + boss.w + dist;
  const room = obs.roomBounds.w;
  const okLeft = left > 28;
  const okRight = right < room - 28;
  if (okLeft && okRight) {
    return Math.abs(left - obs.player.cx) <= Math.abs(right - obs.player.cx) ? left : right;
  }
  return okLeft ? left : right;
}

/**
 * Step away, unless away is off the edge of the arena or out through the door. Every
 * dodge in every policy goes through this, because a dodge that leaves the room is
 * not a dodge and a boss you walked away from is not a boss you tested.
 * @param {Observation} obs
 * @param {number} dir  IN.LEFT or IN.RIGHT
 * @returns {number} `dir`, the other way, or 0 when neither is safe
 */
export function backAway(obs, dir) {
  const other = dir === IN.LEFT ? IN.RIGHT : IN.LEFT;
  if (!blockedWay(obs, dir)) return dir;
  if (!blockedWay(obs, other)) return other;
  return 0;
}

/** @param {Observation} obs @param {number} dir @returns {boolean} */
function blockedWay(obs, dir) {
  const cx = obs.player.cx;
  if (dir === IN.LEFT && cx < 40) return true;
  if (dir === IN.RIGHT && cx > obs.roomBounds.w - 40) return true;
  return doorAhead(obs, dir);
}

/**
 * @param {Observation} obs
 * @param {number} dir  IN.LEFT or IN.RIGHT
 * @returns {boolean} true if stepping that way walks the bot out of the arena
 */
export function doorAhead(obs, dir) {
  const cx = obs.player.cx;
  return obs.doors.some((d) => (dir === IN.LEFT ? d.x < cx && cx - d.x < 56 : d.x > cx && d.x - cx < 56));
}

/**
 * @param {Observation} obs
 * @param {NonNullable<Observation['boss']>} boss
 * @returns {NonNullable<Observation['boss']>['parts'][number]|null}
 */
export function nearestPart(obs, boss) {
  let best = null;
  let bestDist = Infinity;
  for (const part of boss.parts) {
    const d = Math.abs(part.x + part.w / 2 - obs.player.cx);
    if (d < bestDist) { best = part; bestDist = d; }
  }
  return best;
}
