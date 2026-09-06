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
/** Where to stand to throw: far enough that the flight is a clean straight line. */
const THROW_STANDOFF = 44;
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
    const aside = bolt.x + bolt.w / 2 < p.cx ? IN.RIGHT : IN.LEFT;
    return p.grounded ? aside | IN.JUMP : aside;
  }

  // 2. A part is held: the plates are down and the boss has stopped. Close and jab.
  const held = boss.parts.find((part) => part.pinned);
  if (held) {
    const fromLeft = p.cx < boss.x + boss.w / 2;
    const standX = fromLeft ? boss.x - JAB_STANDOFF : boss.x + boss.w + JAB_STANDOFF;
    const walk = walkTo(obs, standX);
    if (walk) return walk;
    const face = fromLeft ? IN.RIGHT : IN.LEFT;
    return face | (p.jabFrames === 0 ? IN.ATTACK : 0);
  }

  // 3. The Pin is out there and holding nothing useful: bring it home.
  if (obs.pin.state !== 'held') return pressNow(obs) ? IN.THROW : 0;

  // 4. Line up on the nearest part and throw flat at it. A part sits at hand height
  //    and stands proud of the body, so a level throw reaches it before the armour.
  const part = nearestPart(obs, boss);
  if (!part) return 0;
  const fromLeft = p.cx < part.x + part.w / 2;
  const standX = fromLeft ? boss.x - THROW_STANDOFF : boss.x + boss.w + THROW_STANDOFF;
  const walk = walkTo(obs, standX, 4);
  if (walk) return walk;
  if (Math.abs(p.vx) > 0.01 || !p.grounded) return 0;
  return (fromLeft ? IN.RIGHT : IN.LEFT) | (pressNow(obs) ? IN.THROW : 0);
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
