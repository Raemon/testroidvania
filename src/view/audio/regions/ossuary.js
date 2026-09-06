/**
 * Ossuary (Apex, Core, Hull) — F# Phrygian, 60 BPM, F#m -> Gmaj7 -> F#m -> Bm.
 * The bII is the unease; that one chord is the whole region's character.
 *
 * 05-aesthetic §6b asks for the Cistern's bells to be *replaced* by a detuned pad
 * and a slow pluck, and for the percussion to be bone-dry Ticks with no reverb.
 * That is what is here: there is no bell voice anywhere in this region, which is
 * the loudest single difference between it and everything else in the game.
 *
 * This is also where the boss lead matters most. Played as the Cistern's literal
 * D-Dorian phrase it scored sixteen non-chord tones and fourteen semitone clashes
 * across the progression — the final fight of the game had the most dissonant
 * music in it, by accident. The lead below is scale degrees, so it lands inside
 * F# Phrygian instead of on top of it.
 */

import { pluck, tick, pad, midiToFreq } from '../voices.js';
import { chordDegree, degreeLead, noteRng } from './material.js';

/** @typedef {import('../sequencer.js').StepContext} StepContext */
/** @typedef {import('../sequencer.js').ChordContext} ChordContext */
/** @typedef {import('../sequencer.js').Region} Region */

/** @type {import('../sequencer.js').Chord[]} */
const CHORDS = [
  { name: 'F#m', bass: 42, pad: [66, 69, 73, 78], tones: [66, 69, 73, 76, 80], drone: 30 },
  { name: 'Gmaj7', bass: 43, pad: [67, 71, 74, 78], tones: [67, 71, 74, 78, 81], drone: 31 },
  { name: 'F#m', bass: 42, pad: [66, 69, 73, 78], tones: [66, 69, 73, 76, 80], drone: 30 },
  { name: 'Bm', bass: 47, pad: [71, 74, 78, 81], tones: [71, 74, 78, 81, 85], drone: 35 },
];

/**
 * The slow pluck: one note every eight 16ths, and nothing in between.
 * @type {Record<number, number>}
 */
const SLOW = { 0: 4, 8: 2 };

/**
 * Bone-dry ticks. Steps, and the pitch each one lands on.
 * @type {Record<number, number>}
 */
const TICKS = { 2: 2400, 7: 1700, 10: 3100, 13: 1200 };

/**
 * The boss phrase for the Sentinel and the Anchor, in scale degrees. Long notes
 * and long rests: at 60 BPM a quarter is a full second, and a busy lead over a
 * Phrygian pad is a different genre.
 */
const LEAD = [
  0, null, 2, 1,
  null, 3, 2, null,
  4, 3, null, 2,
  1, null, 0, null,
];

/** @type {Region} */
export const OSSUARY = {
  id: 'ossuary',
  name: 'Ossuary',
  tempo: 60,
  bossTempo: 68,
  stepsPerBar: 16,
  barsPerChord: 2,
  chords: CHORDS,
  drone: { gain: 0.12 },
  layers: [
    {
      id: 'pad',
      minIntensity: 0,
      gain: 1,
      /** @param {ChordContext} cx */
      chord(cx) {
        const voice = pad(cx.graph, {
          time: cx.time,
          freqs: cx.chord.pad.map(midiToFreq),
          gain: 0.26,
          bus: cx.bus,
          reverb: 0.75,
          release: 4,
        });
        // The bells' replacement: the same voicing an octave up and 14 cents
        // sharp. Two pads a fraction apart beat against each other at about one
        // hertz, which is the sound of a room that is not quite still, and it puts
        // the region's brightness in a sustained voice instead of a struck one.
        const shimmer = pad(cx.graph, {
          time: cx.time,
          freqs: cx.chord.pad.map((m) => midiToFreq(m + 12) * 1.0081),
          gain: 0.11,
          bus: cx.bus,
          reverb: 0.85,
          release: 4,
        });
        if (cx.calm) {
          const fifth = cx.chord.pad[0];
          if (fifth !== undefined) {
            pad(cx.graph, { time: cx.time, freqs: [midiToFreq(fifth + 7)], gain: 0.13, bus: cx.bus, reverb: 0.85, release: 4 })
              .release(cx.time + cx.barDur * 2 - 0.4);
          }
        }
        shimmer.release(cx.time + cx.barDur * 2 - 0.5);
        voice.release(cx.time + cx.barDur * 2 - 0.4);
      },
    },
    {
      id: 'slow',
      minIntensity: 0,
      gain: 1,
      loopSteps: 16,
      /** @param {StepContext} cx */
      step(cx) {
        const degree = SLOW[cx.stepInLoop];
        if (degree === undefined) return;
        const note = chordDegree(cx.chord, degree + (cx.loop % 2));
        if (note === undefined) return;
        pluck(cx.graph, {
          time: cx.time,
          freq: midiToFreq(note),
          gain: 0.3 * (0.85 + noteRng(0x055, cx.loop, cx.stepInLoop)() * 0.3),
          bus: cx.bus,
          reverb: 0.55,
          delay: 0.25,
          pan: cx.stepInLoop === 0 ? -0.2 : 0.2,
        });
      },
    },
    {
      id: 'bass',
      minIntensity: 0.45,
      gain: 1,
      loopSteps: 32,
      /** @param {StepContext} cx */
      step(cx) {
        const s = cx.stepInLoop;
        if (s !== 0 && s !== 20) return;
        pluck(cx.graph, {
          time: cx.time,
          freq: midiToFreq(cx.chord.bass + (s === 20 ? 7 : 0) + 12),
          gain: 0.32,
          bus: cx.bus,
          reverb: 0.25,
          delay: 0.1,
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
        const freq = TICKS[cx.stepInLoop];
        if (freq === undefined) return;
        // Bone-dry: reverb 0, delay 0. In a room with a 3.6 s tail, the one sound
        // with no tail at all is the one that sounds like it is in the room with
        // you rather than down the hall.
        tick(cx.graph, {
          time: cx.time,
          freq,
          to: freq * 0.5,
          sweep: 0.025,
          decay: 0.035,
          gain: 0.22,
          bus: cx.bus,
          reverb: 0,
          pan: cx.stepInLoop % 2 ? 0.3 : -0.3,
        });
      },
    },
    degreeLead({ phrase: LEAD, gain: 0.44, reverb: 0.5, delay: 0.55 }),
  ],
};
