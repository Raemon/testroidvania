/**
 * The seven voices (05-aesthetic §6a). Each one builds its own nodes, schedules its
 * own envelope, and schedules its own teardown; nothing outside has to remember it.
 *
 * Every voice ends in a lowpass capped at 8 kHz and every amplitude move is a ramp
 * from `SILENT`, never a `gain.value = 0` — those two rules are 90% of what keeps
 * synthesized web audio from sounding like a buzzer (05 §6d).
 */

import { SILENT, MAX_LOWPASS_HZ, MIN_ATTACK, MIN_RELEASE } from './graph.js';
import { createRng } from './rng.js';

/** @typedef {import('./graph.js').AudioGraph} AudioGraph */

/**
 * @typedef {object} VoiceOpts
 * @property {number} time      absolute context time to start at
 * @property {number} [freq]
 * @property {number} [gain]    velocity, 0..1
 * @property {number} [pan]     -1..1
 * @property {number} [reverb]  send amount 0..1
 * @property {number} [delay]   send amount 0..1
 * @property {AudioNode} [bus]  defaults to the sfx bus
 */

/**
 * @typedef {object} Voice
 * @property {number} endsAt     when the tail is silent
 * @property {(when: number) => void} stop  ramp out over 10 ms and tear down
 */

/** @param {number} midi @returns {number} */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * @param {AudioParam} p
 * @param {number} t0
 * @param {number} peak
 * @param {number} attack
 * @param {number} decay
 * @returns {number} the time the envelope has fully released
 */
export function ampEnv(p, t0, peak, attack, decay) {
  const a = Math.max(MIN_ATTACK, attack);
  const d = Math.max(MIN_RELEASE, decay);
  const top = Math.max(peak, SILENT * 2);
  p.setValueAtTime(SILENT, t0);
  p.linearRampToValueAtTime(top, t0 + a);
  // Exponential on the way down because loudness is logarithmic; a linear decay
  // sounds like it stops early and then lingers.
  p.exponentialRampToValueAtTime(SILENT, t0 + a + d);
  p.linearRampToValueAtTime(0, t0 + a + d + MIN_RELEASE);
  return t0 + a + d + MIN_RELEASE;
}

/**
 * The shared output section: lowpass -> pan -> level -> bus, with the two sends
 * tapped off the level so a send always tracks the voice's own volume.
 *
 * @param {AudioGraph} graph
 * @param {VoiceOpts} opts
 * @param {number} lowpassHz
 * @returns {{ input: BiquadFilterNode, level: GainNode, nodes: AudioNode[] }}
 */
export function outputChain(graph, opts, lowpassHz) {
  const ctx = graph.ctx;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(lowpassHz, MAX_LOWPASS_HZ);
  lp.Q.value = 0.7;

  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0));

  const level = ctx.createGain();
  level.gain.value = Math.max(SILENT, opts.gain ?? 1);

  lp.connect(pan);
  pan.connect(level);
  level.connect(opts.bus ?? graph.sfxBus);

  /** @type {AudioNode[]} */
  const nodes = [lp, pan, level];

  if (opts.reverb && opts.reverb > 0) {
    const send = ctx.createGain();
    send.gain.value = opts.reverb;
    level.connect(send);
    send.connect(graph.reverbBus);
    nodes.push(send);
  }
  if (opts.delay && opts.delay > 0) {
    const send = ctx.createGain();
    send.gain.value = opts.delay;
    level.connect(send);
    send.connect(graph.delayBus);
    nodes.push(send);
  }
  return { input: lp, level, nodes };
}

/**
 * Stop the sources at `endsAt` and disconnect everything once they have ended, so a
 * long session never accumulates dead nodes.
 *
 * @param {AudioNode[]} nodes
 * @param {AudioScheduledSourceNode[]} sources
 * @param {number} endsAt
 * @param {GainNode} level
 * @returns {Voice}
 */
function finish(nodes, sources, endsAt, level) {
  const all = nodes.concat(sources);
  let torn = false;
  const teardown = () => {
    if (torn) return;
    torn = true;
    for (const n of all) {
      try { n.disconnect(); } catch { /* already gone */ }
    }
  };
  const last = sources[sources.length - 1];
  for (const s of sources) {
    try { s.stop(endsAt); } catch { /* already stopped */ }
  }
  if (last) last.onended = teardown;

  return {
    endsAt,
    stop(when) {
      const t = Math.max(when, 0);
      const g = level.gain;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(Math.max(g.value, SILENT), t);
        g.linearRampToValueAtTime(0, t + 0.01);
      } catch { /* param already past */ }
      for (const s of sources) {
        try { s.stop(t + 0.012); } catch { /* already stopped */ }
      }
    },
  };
}

/**
 * **Bell.** f plus an inharmonic partial at f*2.756 — the ratio is what makes it
 * read as struck metal rather than as a sine beep.
 * @param {AudioGraph} graph @param {VoiceOpts} opts @returns {Voice}
 */
export function bell(graph, opts) {
  const ctx = graph.ctx;
  const t = opts.time;
  const f = opts.freq ?? 880;
  const chain = outputChain(graph, { ...opts, gain: opts.gain ?? 0.35, reverb: opts.reverb ?? 0.55, delay: opts.delay ?? 0.3 }, 5000);

  const fundAmp = ctx.createGain();
  const fund = ctx.createOscillator();
  fund.type = 'sine';
  fund.frequency.value = f;
  fund.connect(fundAmp);
  fundAmp.connect(chain.input);
  const endFund = ampEnv(fundAmp.gain, t, 1, 0.004, 1.8);

  const partAmp = ctx.createGain();
  const part = ctx.createOscillator();
  part.type = 'sine';
  part.frequency.value = f * 2.756;
  part.connect(partAmp);
  partAmp.connect(chain.input);
  ampEnv(partAmp.gain, t, 0.35, 0.004, 0.5);

  fund.start(t);
  part.start(t);
  return finish([...chain.nodes, fundAmp, partAmp], [part, fund], endFund, chain.level);
}

/**
 * **Pad.** Three detuned saws into a slow-moving 380 Hz lowpass. It is the only
 * voice with a real release, so it returns a handle you must `release()`.
 * @param {AudioGraph} graph @param {VoiceOpts & {freqs?: number[], release?: number}} opts
 * @returns {Voice & { release: (when: number) => number }}
 */
export function pad(graph, opts) {
  const ctx = graph.ctx;
  const t = opts.time;
  const freqs = opts.freqs ?? [opts.freq ?? 220];
  const chain = outputChain(graph, { ...opts, gain: opts.gain ?? 0.12, reverb: opts.reverb ?? 0.7 }, 4000);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  filter.Q.value = 0.9;
  filter.connect(chain.input);

  // A 0.08 Hz cutoff wobble. Without it three static saws sound like an organ;
  // with it the chord breathes and never quite repeats against the arp.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.08;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 180;
  lfo.connect(lfoDepth);
  lfoDepth.connect(filter.frequency);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.linearRampToValueAtTime(1, t + 1.8);
  amp.connect(filter);

  /** @type {AudioScheduledSourceNode[]} */
  const sources = [lfo];
  for (const base of freqs) {
    for (const cents of [-7, 0, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = base;
      osc.detune.value = cents;
      const v = ctx.createGain();
      v.gain.value = 1 / (freqs.length * 3);
      osc.connect(v);
      v.connect(amp);
      osc.start(t);
      sources.push(osc);
    }
  }
  lfo.start(t);

  const releaseS = opts.release ?? 3.5;
  let endsAt = t + 1.8 + releaseS + 30;
  const voice = finish([...chain.nodes, filter, lfoDepth, amp], sources, endsAt, chain.level);
  return {
    ...voice,
    release(when) {
      const g = amp.gain;
      g.cancelScheduledValues(when);
      g.setValueAtTime(Math.max(g.value, SILENT), when);
      g.exponentialRampToValueAtTime(SILENT, when + releaseS);
      g.linearRampToValueAtTime(0, when + releaseS + MIN_RELEASE);
      endsAt = when + releaseS + MIN_RELEASE;
      for (const s of sources) {
        try { s.stop(endsAt); } catch { /* already stopped */ }
      }
      return endsAt;
    },
  };
}

/**
 * **Drone.** Never stops; it glides. Highpassed at 30 Hz because everything below
 * that is speaker excursion, not sound.
 * @param {AudioGraph} graph @param {VoiceOpts} opts
 * @returns {{ setFreq: (f: number, when: number, glide?: number) => void,
 *            setCombat: (on: boolean, when: number) => void,
 *            release: (when: number) => void }}
 */
export function drone(graph, opts) {
  const ctx = graph.ctx;
  const t = opts.time;
  const f = opts.freq ?? 36.71;
  const chain = outputChain(graph, { ...opts, gain: opts.gain ?? 0.5, reverb: opts.reverb ?? 0.4 }, 2000);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 30;
  hp.connect(chain.input);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.linearRampToValueAtTime(1, t + 2);
  amp.connect(hp);

  const root = ctx.createOscillator();
  root.type = 'sine';
  root.frequency.value = f;
  const rootG = ctx.createGain();
  rootG.gain.value = 1;
  root.connect(rootG);
  rootG.connect(amp);

  const sub = ctx.createOscillator();
  sub.type = 'triangle';
  sub.frequency.value = f / 2;
  const subG = ctx.createGain();
  subG.gain.value = 0.5;
  sub.connect(subG);
  subG.connect(amp);

  const fifth = ctx.createOscillator();
  fifth.type = 'sine';
  fifth.frequency.value = f * 1.5;
  const fifthG = ctx.createGain();
  fifthG.gain.value = SILENT;
  fifth.connect(fifthG);
  fifthG.connect(amp);

  // 0.05 Hz, +/-15%: slow enough that you never hear it move, only that the room
  // is not dead.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.05;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.15;
  lfo.connect(lfoDepth);
  lfoDepth.connect(amp.gain);

  for (const s of [root, sub, fifth, lfo]) s.start(t);

  return {
    setFreq(next, when, glide = 4) {
      for (const [osc, mult] of /** @type {[OscillatorNode, number][]} */ ([[root, 1], [sub, 0.5], [fifth, 1.5]])) {
        const p = osc.frequency;
        p.cancelScheduledValues(when);
        p.setValueAtTime(p.value, when);
        p.linearRampToValueAtTime(next * mult, when + glide);
      }
    },
    setCombat(on, when) {
      const g = fifthG.gain;
      g.cancelScheduledValues(when);
      g.setValueAtTime(Math.max(g.value, SILENT), when);
      g.linearRampToValueAtTime(on ? 0.15 : SILENT, when + 2);
    },
    release(when) {
      amp.gain.cancelScheduledValues(when);
      amp.gain.setValueAtTime(Math.max(amp.gain.value, SILENT), when);
      amp.gain.linearRampToValueAtTime(0, when + 1.5);
      for (const s of [root, sub, fifth, lfo]) {
        try { s.stop(when + 1.6); } catch { /* already stopped */ }
      }
      lfo.onended = () => {
        for (const n of [...chain.nodes, hp, amp, rootG, subG, fifthG, lfoDepth, root, sub, fifth, lfo]) {
          try { n.disconnect(); } catch { /* already gone */ }
        }
      };
    },
  };
}

/** Reference notes for the Karplus-Strong tables: A1, A2, A3, A4, A5. */
const PLUCK_REFS = [33, 45, 57, 69, 81];

/**
 * A Karplus-Strong string, rendered into a buffer rather than built from a
 * DelayNode feedback loop.
 *
 * Why: Chromium clamps any delay inside a feedback cycle to one render quantum
 * (128 samples, ~2.9 ms), so a DelayNode string simply cannot play above ~344 Hz —
 * the D5 lead would come out as a wrong note. Rendering the identical difference
 * equation (1/f delay, 0.985 feedback, 3.5 kHz one-pole) into a table and pitching
 * it with `playbackRate` gives the specified sound at every pitch.
 *
 * @param {AudioGraph} graph
 * @param {number} refMidi
 * @returns {AudioBuffer}
 */
function pluckTable(graph, refMidi) {
  const cached = graph.plucks.get(refMidi);
  if (cached) return cached;

  const ctx = graph.ctx;
  const rate = ctx.sampleRate;
  const f = midiToFreq(refMidi);
  const period = Math.max(2, Math.round(rate / f));
  const len = Math.floor(rate * 1.6);
  const buf = ctx.createBuffer(1, len, rate);
  const out = buf.getChannelData(0);

  const rng = createRng(0x4b53 ^ refMidi);
  const burst = Math.floor(rate * 0.008);
  const line = new Float32Array(period);
  const a = 1 - Math.exp((-2 * Math.PI * 3500) / rate);
  let idx = 0;
  let z = 0;
  let peak = 0;
  for (let n = 0; n < len; n++) {
    const excite = n < burst ? rng() * 2 - 1 : 0;
    z += a * ((line[idx] ?? 0) * 0.985 - z);
    line[idx] = z + excite;
    idx = idx + 1 >= period ? 0 : idx + 1;
    out[n] = z;
    const abs = Math.abs(z);
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const norm = 0.95 / peak;
    for (let n = 0; n < len; n++) out[n] = (out[n] ?? 0) * norm;
  }
  graph.plucks.set(refMidi, buf);
  return buf;
}

/**
 * **Pluck.** @param {AudioGraph} graph @param {VoiceOpts & {midi?: number}} opts @returns {Voice}
 */
export function pluck(graph, opts) {
  const ctx = graph.ctx;
  const t = opts.time;
  const f = opts.freq ?? midiToFreq(opts.midi ?? 62);
  let ref = PLUCK_REFS[0] ?? 33;
  for (const candidate of PLUCK_REFS) {
    if (Math.abs(Math.log2(midiToFreq(candidate) / f)) < Math.abs(Math.log2(midiToFreq(ref) / f))) ref = candidate;
  }
  const chain = outputChain(graph, { ...opts, gain: opts.gain ?? 0.4, reverb: opts.reverb ?? 0.35 }, 6000);

  const src = ctx.createBufferSource();
  src.buffer = pluckTable(graph, ref);
  src.playbackRate.value = f / midiToFreq(ref);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.linearRampToValueAtTime(1, t + 0.002);
  src.connect(amp);
  amp.connect(chain.input);
  src.start(t);

  const dur = 1.6 / src.playbackRate.value;
  amp.gain.setValueAtTime(1, t + dur - 0.05);
  amp.gain.linearRampToValueAtTime(0, t + dur);
  return finish([...chain.nodes, amp], [src], t + dur, chain.level);
}

/**
 * **Sub.** The only voice allowed below 60 Hz, and the only one with no reverb —
 * a wet low end is mud.
 * @param {AudioGraph} graph @param {VoiceOpts & {to?: number, sweep?: number, attack?: number, decay?: number}} opts
 * @returns {Voice}
 */
export function sub(graph, opts) {
  const ctx = graph.ctx;
  const t = opts.time;
  const f = opts.freq ?? 55;
  const chain = outputChain(graph, { ...opts, gain: opts.gain ?? 0.5, reverb: opts.reverb ?? 0 }, 400);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (opts.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + (opts.sweep ?? 0.06));
  }
  const amp = ctx.createGain();
  osc.connect(amp);
  amp.connect(chain.input);
  const endsAt = ampEnv(amp.gain, t, 1, opts.attack ?? 0.025, opts.decay ?? 0.35);
  osc.start(t);
  return finish([...chain.nodes, amp], [osc], endsAt, chain.level);
}

/**
 * **Breath.** Filtered noise; the workhorse behind most of the SFX.
 * @param {AudioGraph} graph
 * @param {VoiceOpts & {to?: number, sweep?: number, q?: number, attack?: number, decay?: number, mode?: BiquadFilterType}} opts
 * @returns {Voice}
 */
export function breath(graph, opts) {
  const ctx = graph.ctx;
  const t = opts.time;
  const f = opts.freq ?? 900;
  const chain = outputChain(graph, { ...opts, gain: opts.gain ?? 0.3, reverb: opts.reverb ?? 0.2 }, 8000);

  const filter = ctx.createBiquadFilter();
  filter.type = opts.mode ?? 'bandpass';
  filter.Q.value = opts.q ?? 1.2;
  filter.frequency.setValueAtTime(f, t);
  if (opts.to !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + (opts.sweep ?? 0.08));
  }
  filter.connect(chain.input);

  const amp = ctx.createGain();
  amp.connect(filter);

  const src = ctx.createBufferSource();
  src.buffer = graph.noise;
  src.loop = true;
  // Start at a rotating offset so repeated breaths are not the same 60 ms of noise.
  src.loopStart = 0;
  src.connect(amp);

  const endsAt = ampEnv(amp.gain, t, 1, opts.attack ?? 0.005, opts.decay ?? 0.1);
  src.start(t, (t * 7.13) % 1.8);
  return finish([...chain.nodes, filter, amp], [src], endsAt, chain.level);
}

/**
 * **Tick.** A sine that drops an octave in 30 ms. Reads as a click without being
 * one — a true click is broadband and hurts.
 * @param {AudioGraph} graph @param {VoiceOpts & {to?: number, sweep?: number, decay?: number}} opts
 * @returns {Voice}
 */
export function tick(graph, opts) {
  const ctx = graph.ctx;
  const t = opts.time;
  const f = opts.freq ?? 1100;
  const chain = outputChain(graph, { ...opts, gain: opts.gain ?? 0.25, reverb: opts.reverb ?? 0.15 }, 8000);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to ?? f * 0.5), t + (opts.sweep ?? 0.03));

  const amp = ctx.createGain();
  osc.connect(amp);
  amp.connect(chain.input);
  const endsAt = ampEnv(amp.gain, t, 1, 0.001, opts.decay ?? 0.04);
  osc.start(t);
  return finish([...chain.nodes, amp], [osc], endsAt, chain.level);
}

/** Every voice by name, for the "can each voice be triggered" test. */
export const VOICES = { bell, pad, drone, pluck, sub, breath, tick };
