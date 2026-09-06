/**
 * Rig services: the four primitives every character in the game animates with
 * (05-aesthetic §4). There are no keyframes and no animation data anywhere — a
 * pose is a pure function of (velocity, grounded, time, phase), which is why the
 * whole cast costs a few hundred bytes instead of a sprite sheet.
 *
 * All of this is view-side motion. It reads the sim and never writes to it.
 */

/** @typedef {{x:number, y:number, px:number, py:number}} VerletPoint */

/**
 * Critically-ish damped spring toward a target. Returns the new [value, velocity].
 * @param {number} value
 * @param {number} velocity
 * @param {number} target
 * @param {number} stiffness
 * @param {number} damping
 * @param {number} dt seconds
 * @returns {[number, number]}
 */
export function spring(value, velocity, target, stiffness, damping, dt) {
  const a = (target - value) * stiffness - velocity * damping;
  const v = velocity + a * dt;
  return [value + v * dt, v];
}

/**
 * @param {number} n
 * @param {number} x
 * @param {number} y
 * @returns {VerletPoint[]}
 */
export function makeChain(n, x, y) {
  /** @type {VerletPoint[]} */
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x, y, px: x, py: y });
  return pts;
}

/**
 * One Verlet integration + constraint pass for a chain anchored at its head.
 * Verlet rather than springs because a chain of springs needs a tiny timestep to
 * stay stable, and this is stable at 60 Hz with three relaxation passes.
 * @param {VerletPoint[]} pts
 * @param {number} ax anchor x
 * @param {number} ay anchor y
 * @param {number} segLen
 * @param {number} gravity
 * @param {number} windX
 * @param {number} windY
 * @param {number} damping
 */
export function stepChain(pts, ax, ay, segLen, gravity, windX, windY, damping) {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    if (i === 0) {
      p.px = p.x; p.py = p.y;
      p.x = ax; p.y = ay;
      continue;
    }
    const vx = (p.x - p.px) * damping + windX;
    const vy = (p.y - p.py) * damping + gravity;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-4;
      const k = (d - segLen) / d;
      const mx = dx * k;
      const my = dy * k;
      if (i > 1) { a.x += mx * 0.5; a.y += my * 0.5; b.x -= mx * 0.5; b.y -= my * 0.5; }
      else { b.x -= mx; b.y -= my; }
    }
  }
}

/**
 * If a chain's points are all identical (first frame, or after a teleport) the
 * constraint pass has no direction to work with and the chain never unfolds.
 * @param {VerletPoint[]} pts
 * @param {number} x
 * @param {number} y
 */
export function resetChain(pts, x, y) {
  for (const p of pts) { p.x = x; p.y = y; p.px = x; p.py = y; }
}

/**
 * Analytic two-bone IK. Returns the knee/elbow position that puts the end of the
 * chain on (tx, ty), or as close as the bones reach.
 * @param {number} hx
 * @param {number} hy
 * @param {number} tx
 * @param {number} ty
 * @param {number} upper
 * @param {number} lower
 * @param {number} bend  +1 or -1, which way the joint folds
 * @returns {{x:number, y:number}}
 */
export function ik2(hx, hy, tx, ty, upper, lower, bend) {
  const dx = tx - hx;
  const dy = ty - hy;
  const dist = Math.min(Math.hypot(dx, dy) || 1e-4, upper + lower - 0.001);
  const ux = dx / (Math.hypot(dx, dy) || 1e-4);
  const uy = dy / (Math.hypot(dx, dy) || 1e-4);
  const a = (dist * dist + upper * upper - lower * lower) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  return { x: hx + ux * a - uy * h * bend, y: hy + uy * a + ux * h * bend };
}

/**
 * A bone: a round-capped thick line. Everything living in this game is made of
 * these, which is what gives the cast one consistent, soft shape language.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} thickness
 * @param {string} color
 */
export function bone(ctx, x1, y1, x2, y2, thickness, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
