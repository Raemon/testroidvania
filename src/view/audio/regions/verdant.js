/**
 * Verdant (Roots) — G Lydian, 84 BPM, Gmaj7 -> Amaj7 -> Gmaj7 -> Bm7. The #4 lift
 * lives in the Amaj7; this is the brightest material in the game (05 §6b).
 *
 * Two things make it that. The bells are voiced an octave above the Cistern's,
 * into octave 6, with delay send 0.7 — a wash of high strikes where the Cistern
 * has a close arp. And they are answered: bells call for a bar, a Pluck answers in
 * the next, so the phrase is a conversation across two bars rather than a loop
 * repeating under the harmony.
 */

import { bell, pluck, breath, tick, pad, midiToFreq } from '../voices.js';
import { chordDegree, degreeLead, noteRng } from './material.js';

/** @typedef {import('../sequencer.js').StepContext} StepContext */
/** @typedef {import('../sequencer.js').ChordContext} ChordContext */
/** @typedef {import('../sequencer.js').Region} Region */

/** @type {import('../sequencer.js').Chord[]} */
const CHORDS = [
  { name: 'Gmaj7', bass: 43, pad: [67, 71, 74, 78], tones: [67, 71, 74, 78, 81], drone: 31 },
  { name: 'Amaj7', bass: 45, pad: [69, 73, 76, 80], tones: [69, 73, 76, 80, 83], drone: 33 },
  { name: 'Gmaj7', bass: 43, pad: [67, 71, 74, 78], tones: [67, 71, 74, 78, 81], drone: 31 },
  { name: 'Bm7', bass: 47, pad: [71, 74, 78, 81], tones: [71, 74, 78, 81, 85], drone: 35 },
];

/**
 * The call: bar one of every two, as step -> scale degree. Denser and higher than
 * the Cistern's arp, and it leaves the whole of bar two empty for the answer.
 * @type {Record<number, number>}
 */
const CALL = { 0: 0, 2: 2, 3: 4, 6: 3, 8: 5, 9: 2, 12: 6, 14: 4 };

/** The response: bar two, an octave and a half lower, in the gaps the call left. */
const ANSWER = { 17: 3, 20: 1, 23: 2, 26: 0, 30: 4 };

/** The boss phrase, in scale degrees — up into the #4 and back down. */
const LEAD = [
  2, 3, 4, 5,
  4, null, 3, 2,
  1, 2, 3, null,
  4, 3, 1, null,
];

/** @type {Region} */
export const VERDANT = {
  id: 'verdant',
  name: 'Verdant',
  tempo: 84,
  bossTempo: 92,
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
          gain: 0.24,
          bus: cx.bus,
          reverb: 0.6,
          release: 3,
        });
        if (cx.calm) {
          const fifth = cx.chord.pad[0];
          if (fifth !== undefined) {
            pad(cx.graph, { time: cx.time, freqs: [midiToFreq(fifth + 7)], gain: 0.13, bus: cx.bus, reverb: 0.7, release: 3 })
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
        // Slide the call against the harmony by five steps a chord, so the same
        // eight strikes land somewhere new for four chords running.
        const at = (cx.stepInLoop - cx.chordIndex * 5 + 32) % 32;
        const degree = CALL[at];
        if (degree === undefined || at >= 16) return;
        const note = chordDegree(cx.chord, degree);
        if (note === undefined) return;
        // +24, not the Cistern's +12: octave 6, where a bell stops being a note
        // and starts being light.
        bell(cx.graph, {
          time: cx.time,
          freq: midiToFreq(note + 24),
          gain: 0.2 * (0.8 + noteRng(0x5eed, cx.loop, at)() * 0.4),
          bus: cx.bus,
          reverb: 0.5,
          delay: 0.7,
          pan: ((degree % 3) - 1) * 0.3,
        });
      },
    },
    {
      id: 'answer',
      minIntensity: 0,
      gain: 1,
      loopSteps: 32,
      /** @param {StepContext} cx */
      step(cx) {
        const degree = ANSWER[cx.stepInLoop];
        if (degree === undefined) return;
        const note = chordDegree(cx.chord, degree);
        if (note === undefined) return;
        pluck(cx.graph, {
          time: cx.time,
          freq: midiToFreq(note + 12),
          gain: 0.3 * (0.85 + noteRng(0xa115, cx.loop, cx.stepInLoop)() * 0.3),
          bus: cx.bus,
          reverb: 0.4,
          delay: 0.45,
          pan: 0.18,
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
        const s = cx.stepInLoop;
        const offset = s === 0 ? 0 : s === 7 ? 7 : s === 11 ? 0 : undefined;
        if (offset === undefined) return;
        pluck(cx.graph, { time: cx.time, freq: midiToFreq(cx.chord.bass + offset + 12), gain: 0.32, bus: cx.bus, reverb: 0.25, delay: 0.2 });
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
        // Wood, not stone: a high dry tick on the beat instead of a Sub kick. The
        // brightest region in the game does not get a 55 Hz thump under it.
        if (s === 0 || s === 8) {
          tick(cx.graph, { time: cx.time, freq: 900, to: 420, sweep: 0.03, decay: 0.05, gain: 0.28, bus: cx.bus, reverb: 0.25 });
        }
        if (s === 4 || s === 12) {
          breath(cx.graph, { time: cx.time, freq: 3800, q: 1.6, attack: 0.002, decay: 0.06, gain: 0.16, bus: cx.bus, reverb: 0.4, pan: s === 4 ? -0.3 : 0.3 });
        }
        // Leaves.
        if (s % 4 === 3) {
          breath(cx.graph, { time: cx.time, freq: 6400, q: 0.9, attack: 0.003, decay: 0.05, gain: 0.1, bus: cx.bus, reverb: 0.35 });
        }
      },
    },
    degreeLead({ phrase: LEAD, gain: 0.42, reverb: 0.35, delay: 0.6, transpose: 12 }),
  ],
};
