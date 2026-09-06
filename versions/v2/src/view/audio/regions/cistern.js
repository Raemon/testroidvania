/**
 * The Cistern's material, written out exactly as 05-aesthetic §6b specifies it:
 * D Dorian, 72 BPM, 4/4, Dm9 -> Fmaj7 -> Am7 -> Cmaj7 two bars each.
 *
 * This is the one region done properly; the others are the same shape with their
 * own numbers. A layer is a function of one 16th-note step, so the sequencer can
 * schedule it from a lookahead clock at play time or straight into an
 * OfflineAudioContext for measurement, with no difference in what it produces.
 */

import { bell, pluck, sub, breath, pad, midiToFreq } from '../voices.js';

/** @typedef {import('../sequencer.js').StepContext} StepContext */
/** @typedef {import('../sequencer.js').ChordContext} ChordContext */
/** @typedef {import('../sequencer.js').Region} Region */

/**
 * `tones` are the chord's {1,3,5,7,9} in MIDI, voiced in octave 4-5; the bell arp
 * transposes them up an octave into 5-6. `pad` is the closed voicing above C4.
 * @type {import('../sequencer.js').Chord[]}
 */
const CHORDS = [
  { name: 'Dm9', bass: 38, pad: [62, 65, 69, 76], tones: [62, 65, 69, 72, 76], drone: 26 },
  { name: 'Fmaj7', bass: 41, pad: [65, 69, 72, 76], tones: [65, 69, 72, 76, 79], drone: 26 },
  { name: 'Am7', bass: 45, pad: [69, 72, 76, 79], tones: [69, 72, 76, 79, 83], drone: 33 },
  { name: 'Cmaj7', bass: 48, pad: [72, 76, 79, 83], tones: [72, 76, 79, 83, 86], drone: 26 },
];

/**
 * `1 . . 5 . . 9 . . . 3 . . . 7 . | . . 5 . . . 1 . . 9 . . . . 3 .`
 * as step -> index into the chord's {1,3,5,7,9}.
 * @type {Record<number, number>}
 */
const ARP = {
  0: 0, 3: 2, 6: 4, 10: 1, 14: 3,
  18: 2, 22: 0, 25: 4, 30: 1,
};
const ARP_STEPS = Object.keys(ARP).map(Number);

/**
 * `R . . . . . R . . . R . . . b7 .` — root, root, root, flat seven.
 * @type {Record<number, number>}
 */
const BASS = { 0: 0, 6: 0, 10: 0, 14: 10 };

/** Boss lead: a 4-bar phrase on the quarter notes. `null` is a rest. */
const LEAD = [
  74, 77, 81, 79,
  77, 76, 74, null,
  72, 74, 77, 76,
  74, null, 69, null,
];

/** @type {Region} */
export const CISTERN = {
  id: 'cistern',
  name: 'Cistern',
  tempo: 72,
  bossTempo: 80,
  stepsPerBar: 16,
  barsPerChord: 2,
  chords: CHORDS,
  drone: { gain: 0.26 },
  layers: [
    {
      id: 'pad',
      minIntensity: 0,
      gain: 1,
      /** Retriggered every 2 bars, on the chord. @param {ChordContext} cx */
      chord(cx) {
        const voice = pad(cx.graph, {
          time: cx.time,
          freqs: cx.chord.pad.map(midiToFreq),
          gain: 0.12,
          bus: cx.bus,
          reverb: 0.7,
          release: 3.5,
        });
        // Save-lantern rooms add the fifth above (05 §6b); one extra saw stack, so
        // the "you are safe here" chord is the same chord, only wider.
        if (cx.calm) {
          const fifth = cx.chord.pad[0];
          if (fifth !== undefined) {
            pad(cx.graph, { time: cx.time, freqs: [midiToFreq(fifth + 7)], gain: 0.06, bus: cx.bus, reverb: 0.8, release: 3.5 })
              .release(cx.time + cx.barDur * 2 - 0.4);
          }
        }
        voice.release(cx.time + cx.barDur * 2 - 0.4);
      },
    },
    {
      id: 'bells',
      minIntensity: 0,
      gain: 1,
      loopSteps: 32,
      /** @param {StepContext} cx */
      step(cx) {
        const degree = ARP[cx.stepInLoop];
        if (degree === undefined) return;
        // "Every 8th playthrough a seeded RNG drops 2 random notes" — so the arp
        // never quite reads as a loop even after twenty minutes in one region.
        if (cx.loop % 8 === 7) {
          const a = ARP_STEPS[Math.floor(cx.rng() * ARP_STEPS.length)];
          const b = ARP_STEPS[Math.floor(cx.rng() * ARP_STEPS.length)];
          if (cx.stepInLoop === a || cx.stepInLoop === b) return;
        }
        const note = cx.chord.tones[degree];
        if (note === undefined) return;
        bell(cx.graph, {
          time: cx.time,
          freq: midiToFreq(note + 12),
          gain: 0.26,
          bus: cx.bus,
          reverb: 0.55,
          delay: 0.3,
          pan: ((degree % 3) - 1) * 0.18,
        });
      },
    },
    {
      id: 'bass',
      minIntensity: 0.45,
      gain: 1,
      loopSteps: 16,
      /** @param {StepContext} cx */
      step(cx) {
        const offset = BASS[cx.stepInLoop];
        if (offset === undefined) return;
        pluck(cx.graph, {
          time: cx.time,
          freq: midiToFreq(cx.chord.bass + offset + 12),
          gain: 0.35,
          bus: cx.bus,
          reverb: 0.3,
          delay: 0.15,
        });
      },
    },
    {
      id: 'perc',
      minIntensity: 0.75,
      gain: 1,
      loopSteps: 16,
      /** @param {StepContext} cx */
      step(cx) {
        const s = cx.stepInLoop;
        // "Stone" kick: a sub with a 110 -> 55 Hz pitch env, on 1 and 3.
        if (s === 0 || s === 8) {
          sub(cx.graph, { time: cx.time, freq: 110, to: 55, sweep: 0.04, attack: 0.002, decay: 0.22, gain: 0.45, bus: cx.bus });
        }
        // "Drip": the room, not the drummer.
        if (s === 3 || s === 6 || s === 11) {
          breath(cx.graph, { time: cx.time, freq: 2400, q: 6, attack: 0.001, decay: 0.05, gain: 0.25, bus: cx.bus, reverb: 0.6, pan: (s % 2 ? 0.3 : -0.3) });
        }
        // "Hiss" on every off-beat 8th, quiet enough to be felt, not heard.
        if (s % 4 === 2) {
          breath(cx.graph, { time: cx.time, freq: 6000, q: 1.2, attack: 0.002, decay: 0.06, gain: 0.12, bus: cx.bus, reverb: 0.3 });
        }
      },
    },
    {
      id: 'lead',
      minIntensity: 1,
      gain: 1,
      loopSteps: 64,
      /** @param {StepContext} cx */
      step(cx) {
        if (cx.stepInLoop % 4 !== 0) return;
        const note = LEAD[cx.stepInLoop / 4];
        if (note === null || note === undefined) return;
        pluck(cx.graph, { time: cx.time, freq: midiToFreq(note), gain: 0.5, bus: cx.bus, reverb: 0.4, delay: 0.5 });
      },
    },
  ],
};
