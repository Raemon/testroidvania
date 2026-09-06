/**
 * Spine — the hub. Drone and pad, and one bell voice per ability the player owns.
 *
 * 05 §7.1 step 6 promises that every ability adds a permanent note to the arp.
 * The Spine is where that promise is audible, because the hub is the one place the
 * player returns to over and over: the first visit is a drone and an open chord,
 * and by the last it is five voices ringing. Nothing else in the region moves, so
 * the growth is the material rather than a detail inside it.
 *
 * The voicings are fourths and fifths with the third left out. The hub should feel
 * like the space between regions, not like a region.
 */

import { bell, pluck, breath, pad, midiToFreq } from '../voices.js';
import { chordDegree, degreeLead, noteRng } from './material.js';

/** @typedef {import('../sequencer.js').StepContext} StepContext */
/** @typedef {import('../sequencer.js').ChordContext} ChordContext */
/** @typedef {import('../sequencer.js').Region} Region */

/** @type {import('../sequencer.js').Chord[]} */
const CHORDS = [
  { name: 'Dm(add9)', bass: 38, pad: [62, 69, 76, 81], tones: [62, 64, 69, 74, 76], drone: 26 },
  { name: 'Am11', bass: 45, pad: [64, 69, 74, 81], tones: [64, 69, 72, 76, 81], drone: 26 },
  { name: 'Dm(add9)', bass: 38, pad: [62, 69, 76, 81], tones: [62, 64, 69, 74, 76], drone: 26 },
  { name: 'Gm9', bass: 43, pad: [65, 69, 74, 79], tones: [62, 65, 69, 74, 77], drone: 31 },
];

/**
 * The five slots, in the order the player earns them: which 16th of a 64-step
 * loop the voice strikes on, which scale degree it takes, and how far above the
 * voicing it rings. Slot `i` sounds only once the player owns `i + 1` abilities.
 * @type {{step: number, degree: number, octave: number}[]}
 */
const VOICES = [
  { step: 0, degree: 0, octave: 1 },
  { step: 22, degree: 2, octave: 1 },
  { step: 40, degree: 4, octave: 1 },
  { step: 12, degree: 3, octave: 2 },
  { step: 54, degree: 1, octave: 2 },
];

/** The hub's own boss phrase — the Spine has rooms with things in them too. */
const LEAD = [
  0, 2, 3, null,
  4, 3, 2, null,
  1, 2, 4, null,
  3, null, 0, null,
];

/** @type {Region} */
export const SPINE = {
  id: 'spine',
  name: 'Spine',
  tempo: 66,
  bossTempo: 72,
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
          gain: 0.27,
          bus: cx.bus,
          reverb: 0.7,
          release: 3.5,
        });
        if (cx.calm) {
          const fifth = cx.chord.pad[0];
          if (fifth !== undefined) {
            pad(cx.graph, { time: cx.time, freqs: [midiToFreq(fifth + 7)], gain: 0.14, bus: cx.bus, reverb: 0.8, release: 3.5 })
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
      loopSteps: 64,
      /** @param {StepContext} cx */
      step(cx) {
        for (let i = 0; i < VOICES.length; i++) {
          if (i >= cx.abilities) break;
          const voice = VOICES[i];
          if (!voice || voice.step !== cx.stepInLoop) continue;
          const note = chordDegree(cx.chord, voice.degree);
          if (note === undefined) continue;
          bell(cx.graph, {
            time: cx.time,
            freq: midiToFreq(note + 12 * voice.octave),
            // Each new voice comes in under the ones already there, so growing
            // never makes the hub louder — only wider.
            gain: 0.26 * (1 - i * 0.07) * (0.85 + noteRng(0x5b1e, cx.loop, voice.step)() * 0.3),
            bus: cx.bus,
            reverb: 0.65,
            delay: 0.35,
            pan: ((i % 3) - 1) * 0.28,
          });
        }
      },
    },
    {
      id: 'bass',
      minIntensity: 0.45,
      gain: 1,
      loopSteps: 32,
      /** @param {StepContext} cx */
      step(cx) {
        if (cx.stepInLoop !== 0 && cx.stepInLoop !== 18) return;
        pluck(cx.graph, { time: cx.time, freq: midiToFreq(cx.chord.bass + 12), gain: 0.3, bus: cx.bus, reverb: 0.3, delay: 0.15 });
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
        if (s % 4 === 2) {
          breath(cx.graph, { time: cx.time, freq: 4800, q: 1.1, attack: 0.003, decay: 0.05, gain: 0.12, bus: cx.bus, reverb: 0.35 });
        }
        if (s === 0) {
          breath(cx.graph, { time: cx.time, freq: 1400, q: 2.2, attack: 0.003, decay: 0.09, gain: 0.2, bus: cx.bus, reverb: 0.5 });
        }
      },
    },
    degreeLead({ phrase: LEAD, gain: 0.44, reverb: 0.45, delay: 0.5 }),
  ],
};
