/**
 * One particle pool for the whole game (03-game-feel §3.2): 512 slots, oldest
 * evicted, plain arrays, one draw pass. A pool rather than allocation because the
 * only way a particle system costs anything at this scale is garbage collection.
 *
 * Every value comes from the cosmetic RNG stream, never `state.rng`: particles
 * must not be able to change what the simulation rolls next.
 */

import { cosmeticRng, seedFrom } from './rng.js';
import { rgba } from './palette.js';
import { drawGlow } from './glow.js';

const MAX = 512;

/**
 * @typedef {object} Particle
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life     frames remaining
 * @property {number} maxLife
 * @property {number} size
 * @property {string} color
 * @property {number} gravity
 * @property {number} drag
 * @property {0|1|2} shape     0 circle, 1 rect, 2 line
 * @property {number} glow     0..1, how much additive halo it carries
 */

export class Particles {
  /** @param {string} seed */
  constructor(seed) {
    /** @type {Particle[]} */
    this.pool = [];
    for (let i = 0; i < MAX; i++) {
      this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#ffffff', gravity: 0, drag: 1, shape: 0, glow: 0 });
    }
    this.next = 0;
    this.rnd = cosmeticRng(seedFrom(seed));
    this.ambient = 0;
  }

  /** @returns {Particle} the oldest slot, recycled */
  slot() {
    const p = this.pool[this.next] ?? /** @type {Particle} */ (this.pool[0]);
    this.next = (this.next + 1) % MAX;
    return p;
  }

  /**
   * @param {number} x @param {number} y @param {number} vx @param {number} vy
   * @param {number} life @param {number} size @param {string} color
   * @param {object} [opts]
   * @param {number} [opts.gravity]
   * @param {number} [opts.drag]
   * @param {0|1|2} [opts.shape]
   * @param {number} [opts.glow]
   */
  emit(x, y, vx, vy, life, size, color, opts = {}) {
    const p = this.slot();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size; p.color = color;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 1;
    p.shape = opts.shape ?? 0;
    p.glow = opts.glow ?? 0;
  }

  /** @param {number} n @returns {number} */
  rand(n) { return this.rnd() * n; }

  /** @param {number} x @param {number} y @param {number} hard 0..1 */
  landing(x, y, hard) {
    const n = 4 + Math.floor(hard * 6);
    for (let i = 0; i < n; i++) {
      const dir = this.rnd() < 0.5 ? -1 : 1;
      this.emit(x, y, dir * (0.4 + this.rand(1.0)), -this.rand(0.5), 14 + this.rand(6), 1.4 + this.rand(1.4), '#C9BFA6', { drag: 0.9 });
    }
  }

  /** @param {number} x @param {number} y */
  jump(x, y) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI + Math.PI;
      this.emit(x, y, Math.cos(a) * 1.1, Math.sin(a) * 0.6, 10 + this.rand(4), 1.2 + this.rand(1), '#C9BFA6', { drag: 0.92 });
    }
  }

  /** @param {number} x @param {number} y @param {number} facing */
  runDust(x, y, facing) {
    this.emit(x - facing * 3, y - 1, -facing * (0.3 + this.rand(0.4)), -this.rand(0.3), 12 + this.rand(6), 1 + this.rand(1), '#B5AB94', { drag: 0.92 });
  }

  /** @param {number} x @param {number} y @param {string} color */
  burst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = this.rand(Math.PI * 2);
      const sp = 0.8 + this.rand(2.4);
      this.emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 16 + this.rand(14), 1.2 + this.rand(1.8), color, { gravity: 0.12, drag: 0.94, glow: 0.6 });
    }
  }

  /** @param {number} x @param {number} y @param {number} dir @param {string} color */
  sparks(x, y, dir, color) {
    for (let i = 0; i < 8; i++) {
      const a = (this.rnd() - 0.5) * 1.4;
      const sp = 3 + this.rand(2);
      this.emit(x, y, Math.cos(a) * sp * dir, Math.sin(a) * sp, 8 + this.rand(4), 5, color, { shape: 2, drag: 0.88, glow: 1 });
    }
  }

  /**
   * The room's standing atmosphere. Kept topped up inside the view rect rather
   * than simulated across the whole room, so a 200-tile room costs the same as a
   * small one.
   * @param {import('./palette.js').Region} region
   * @param {{x:number, y:number, w:number, h:number}} view
   * @param {number} dt
   */
  breathe(region, view, dt) {
    this.ambient += dt;
    if (this.ambient < 7) return;
    this.ambient = 0;
    const x = view.x + this.rand(view.w);
    const y = view.y + this.rand(view.h);
    if (region.id === 'foundry') {
      this.emit(x, view.y + view.h - this.rand(24), (this.rnd() - 0.5) * 0.3, -(0.25 + this.rand(0.35)), 90 + this.rand(60), 1 + this.rand(0.8), region.accent, { glow: 0.8 });
    } else if (region.id === 'ossuary') {
      this.emit(x, view.y - 2 + this.rand(8), (this.rnd() - 0.5) * 0.2, 0.18 + this.rand(0.2), 150 + this.rand(80), 1 + this.rand(0.6), '#D8CFB8', { glow: 0.15 });
    } else if (region.id === 'verdant') {
      this.emit(x, y, (this.rnd() - 0.5) * 0.35, -(0.05 + this.rand(0.12)), 160 + this.rand(90), 1 + this.rand(0.9), region.accent, { glow: 0.5 });
    } else {
      this.emit(x, y, (this.rnd() - 0.5) * 0.16, -(0.12 + this.rand(0.16)), 120 + this.rand(80), 0.7 + this.rand(0.7), region.accent, { glow: 0.25 });
    }
  }

  /** @param {number} dt */
  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt);
      p.vy *= Math.pow(p.drag, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    ctx.lineCap = 'round';
    let glows = 0;
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      const k = p.life / p.maxLife;
      if (p.glow > 0.3 && glows < 28) {
        glows++;
        drawGlow(ctx, p.x, p.y, p.size * 4 + 2, p.color, p.glow * Math.min(1, k * 1.4) * 0.45);
      }
      const a = k > 0.8 ? (1 - k) * 5 : k;
      ctx.fillStyle = rgba(p.color, Math.min(1, a));
      if (p.shape === 2) {
        ctx.strokeStyle = rgba(p.color, Math.min(1, a));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6);
        ctx.stroke();
      } else if (p.shape === 1) {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        // A 1-2px mote is a rectangle either way once it is rasterised, and
        // `fillRect` skips the path machinery `arc` has to run per particle.
        const r = Math.max(0.3, p.size * (0.4 + k * 0.6));
        if (r <= 1.4) {
          ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}
