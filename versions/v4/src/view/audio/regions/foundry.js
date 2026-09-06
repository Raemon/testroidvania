/**
 * Foundry — A minor pentatonic with a b5 blue note, 96 BPM (05-aesthetic §6b).
 *
 * The design gives this region one chord and asks the *ostinato* to carry it:
 * `A . A . C . A . G . A . Eb . A .` in Pluck, Sub kicks on all four beats, and
 * "the melody is a rising pad every 8 bars". So the four chord slots below are one
 * Am voiced four rungs higher each time — eight bars that climb an octave and drop
 * back, which is the only harmonic motion this region wants.
 *
 * The ostinato and the kicks sit at minIntensity 0, not 0.45. This is the one
 * region whose pulse belongs at rest: a foundry with nothing hammering in it is a
 * cave. Putting them behind the combat gate meant the industrial pulse that names
 * the region only existed while something was trying to kill you.
 */

import { bell, pluck, sub, breath, tick, pad, midiToFreq } from '../voices.js';
import { chordDegree, degreeLead, noteRng } from './material.js';

/** @typedef {import('../sequencer.js').StepContext} StepContext */
/** @typedef {import('../sequencer.js').ChordContext} ChordContext */
/** @typedef {import('../sequencer.js').Region} Region */

/**
 * One Am, four rungs. `tones` is the A minor pentatonic (A C D E G) rather than a
 * stacked seventh, so every degree the plucks and the lead reach for is inside the
 * scale the region is written in; the third rung swaps D for the Eb blue note.
 * @type {import('../sequencer.js').Chord[]}
 */
const CHORDS = [
  { name: 'Am', bass: 45, pad: [69, 72, 76, 79], tones: [69, 72, 74, 76, 79], drone: 33 },
  { name: 'Am/C', bass: 45, pad: [72, 76, 79, 84], tones: [72, 74, 76, 79, 81], drone: 33 },
  { name: 'Am(b5)', bass: 45, pad: [75, 79, 81, 84], tones: [74, 75, 76, 79, 81], drone: 33 },
  { name: 'Am(add11)', bass: 45, pad: [76, 79, 84, 88], tones: [76, 79, 81, 84, 88], drone: 33 },
];

/**
 * `A . A . C . A . G . A . Eb . A .`, as step -> semitones above the bass root.
 * G is the b7 above rather than the second below, so the ostinato walks up and
 * falls back inside one octave instead of straddling the drone.
 * @type {Record<number, number>}
 */
const OSTINATO = { 0: 0, 2: 0, 4: 3, 6: 0, 8: 10, 10: 0, 12: 6, 14: 0 };

/** Sub kicks on all four beats — the hammer. */
const KICKS = [0, 4, 8, 12];

/** The boss phrase, in scale degrees of whichever rung is sounding. */
const LEAD = [
  0, 2, 4, 3,
  null, 2, 1, 0,
  5, 4, 2, null,
  3, 2, 0, null,
];

/** @type {Region} */
export const FOUNDRY = {
  id: 'foundry',
  name: 'Foundry',
  tempo: 96,
  bossTempo: 104,
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
        // Short reverb (1.6 s here against the Cistern's 2.8) and a shorter release:
        // the Foundry is a machine room, not a cistern, and a long tail on a 96 BPM
        // ostinato is a smear.
        const voice = pad(cx.graph, {
          time: cx.time,
          freqs: cx.chord.pad.map(midiToFreq),
          gain: 0.26,
          bus: cx.bus,
          reverb: 0.45,
          release: 2.2,
        });
        if (cx.calm) {
          const fifth = cx.chord.pad[0];
          if (fifth !== undefined) {
            pad(cx.graph, { time: cx.time, freqs: [midiToFreq(fifth + 7)], gain: 0.13, bus: cx.bus, reverb: 0.5, release: 2.2 })
              .release(cx.time + cx.barDur * 2 - 0.4);
          }
        }
        voice.release(cx.time + cx.barDur * 2 - 0.4);
      },
    },
    {
      id: 'ostinato',
      minIntensity: 0,
      gain: 1,
      loopSteps: 16,
      /** @param {StepContext} cx */
      step(cx) {
        const offset = OSTINATO[cx.stepInLoop];
        if (offset === undefined) return;
        // The upbeat A's are lighter than the ones that move: a machine has a
        // stress pattern, and eight identical plucks a bar is a metronome.
        const accent = offset === 0 && cx.stepInLoop % 4 !== 0 ? 0.62 : 1;
        pluck(cx.graph, {
          time: cx.time,
          freq: midiToFreq(cx.chord.bass + offset + 12),
          gain: 0.34 * accent * (0.9 + noteRng(0xf0d, cx.loop, cx.stepInLoop)() * 0.2),
          bus: cx.bus,
          reverb: 0.18,
          delay: 0.1,
          pan: offset === 0 ? 0 : -0.12,
        });
      },
    },
    {
      id: 'pulse',
      minIntensity: 0,
      gain: 1,
      loopSteps: 16,
      /** @param {StepContext} cx */
      step(cx) {
        if (!KICKS.includes(cx.stepInLoop)) return;
        // 160 -> 80 Hz rather than the Cistern's 110 -> 55: four of these a bar is
        // four times the low-end duty cycle of the Cistern's two, and at 55 Hz the
        // region would be back to being a rumble with a tune on it.
        sub(cx.graph, { time: cx.time, freq: 160, to: 80, sweep: 0.035, attack: 0.002, decay: 0.13, gain: 0.42, bus: cx.bus });
        // The hammer face. Without it the kick is felt on a subwoofer and absent
        // on a laptop, which is where this game is played.
        tick(cx.graph, {
          time: cx.time,
          freq: cx.stepInLoop === 0 ? 780 : 620,
          to: 300,
          sweep: 0.02,
          decay: 0.05,
          gain: cx.stepInLoop === 0 ? 0.3 : 0.2,
          bus: cx.bus,
          reverb: 0.12,
        });
      },
    },
    {
      id: 'anvil',
      minIntensity: 0.45,
      gain: 1,
      loopSteps: 32,
      /** @param {StepContext} cx */
      step(cx) {
        const s = cx.stepInLoop;
        // Struck metal on the far side of the bar from the hammer.
        if (s === 6 || s === 22) {
          bell(cx.graph, {
            time: cx.time,
            freq: midiToFreq((chordDegree(cx.chord, s === 6 ? 2 : 4) ?? 76) + 12),
            gain: 0.2,
            bus: cx.bus,
            reverb: 0.35,
            delay: 0.2,
            pan: s === 6 ? 0.25 : -0.25,
          });
        }
        if (s === 11 || s === 27) {
          breath(cx.graph, { time: cx.time, freq: 1800, q: 5, attack: 0.002, decay: 0.09, gain: 0.2, bus: cx.bus, reverb: 0.3, pan: 0.2 });
        }
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
        // Steam: bright, dry-ish, on every off-beat 8th.
        if (s % 4 === 2) {
          breath(cx.graph, { time: cx.time, freq: 5200, q: 1.1, attack: 0.002, decay: 0.05, gain: 0.14, bus: cx.bus, reverb: 0.2, pan: s % 8 === 2 ? -0.25 : 0.25 });
        }
        if (s === 7 || s === 15) {
          tick(cx.graph, { time: cx.time, freq: 2600, to: 1400, sweep: 0.015, decay: 0.03, gain: 0.18, bus: cx.bus, reverb: 0.1 });
        }
      },
    },
    degreeLead({ phrase: LEAD, gain: 0.46, reverb: 0.3, delay: 0.4 }),
  ],
};
