/**
 * The ending — D major, 72 BPM. The one piece of material in the game that
 * resolves.
 *
 * Without it the run ends in the Hull, which wears the Ossuary's palette, so the
 * last thing the player heard after the final strike was F# Phrygian's bII: the
 * region's "unease" chord, held forever under the credits. 05 §7.5 asks for the
 * opposite — the drone changes to D major and the lanterns relight one at a time
 * on an ascending bell figure.
 *
 * So this is the Cistern's home key with its third raised: the same D the game
 * opened on, finally major. The sequencer glides the drone into it over four
 * seconds rather than restarting, so the resolution is a change of colour in a
 * sound that has been running the whole game.
 */

import { bell, pluck, pad, midiToFreq } from '../voices.js';
import { chordDegree, noteRng } from './material.js';

/** @typedef {import('../sequencer.js').StepContext} StepContext */
/** @typedef {import('../sequencer.js').ChordContext} ChordContext */
/** @typedef {import('../sequencer.js').Region} Region */

/**
 * Dmaj9 -> Gmaj7 -> A6/9 -> Dmaj9: out and home. The drone note never leaves the
 * D/G/A of the cadence, so the floor of the room walks the resolution too.
 * @type {import('../sequencer.js').Chord[]}
 */
const CHORDS = [
  { name: 'Dmaj9', bass: 38, pad: [62, 66, 69, 73], tones: [62, 66, 69, 73, 76], drone: 26 },
  { name: 'Gmaj7', bass: 43, pad: [67, 71, 74, 78], tones: [67, 71, 74, 78, 81], drone: 31 },
  { name: 'A6/9', bass: 45, pad: [69, 73, 76, 83], tones: [69, 73, 76, 78, 83], drone: 33 },
  { name: 'Dmaj9', bass: 38, pad: [62, 66, 69, 73], tones: [62, 66, 69, 73, 76], drone: 26 },
];

/**
 * The lanterns relighting: eleven strikes climbing two octaves across a 64-step
 * loop, accelerating as they go (05 §7.5 step 4 — "every 700 ms, accelerating to
 * every 150 ms"). The gaps shrink; the pitch rises; nothing comes back down.
 * @type {{step: number, degree: number}[]}
 */
const ASCENT = [
  { step: 0, degree: 0 },
  { step: 12, degree: 2 },
  { step: 22, degree: 4 },
  { step: 30, degree: 5 },
  { step: 36, degree: 7 },
  { step: 41, degree: 6 },
  { step: 45, degree: 8 },
  { step: 48, degree: 9 },
  { step: 51, degree: 10 },
  { step: 54, degree: 11 },
  { step: 56, degree: 12 },
];

/** @type {Region} */
export const ENDING = {
  id: 'ending',
  name: 'Ending',
  tempo: 72,
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
        // Wider and wetter than any region's pad, and it never gets a fifth added
        // for calm: the whole thing is already the calm.
        const voice = pad(cx.graph, {
          time: cx.time,
          freqs: cx.chord.pad.map(midiToFreq),
          gain: 0.3,
          bus: cx.bus,
          reverb: 0.85,
          release: 4.5,
        });
        const upper = pad(cx.graph, {
          time: cx.time,
          freqs: [midiToFreq((cx.chord.pad[1] ?? 66) + 12), midiToFreq((cx.chord.pad[3] ?? 73) + 12)],
          gain: 0.12,
          bus: cx.bus,
          reverb: 0.9,
          release: 4.5,
        });
        upper.release(cx.time + cx.barDur * 2 - 0.5);
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
        for (const lantern of ASCENT) {
          if (lantern.step !== cx.stepInLoop) continue;
          const note = chordDegree(cx.chord, lantern.degree);
          if (note === undefined) continue;
          bell(cx.graph, {
            time: cx.time,
            freq: midiToFreq(note + 12),
            gain: 0.28 * (0.88 + noteRng(0xe4d, cx.loop, lantern.step)() * 0.24),
            bus: cx.bus,
            reverb: 0.9,
            delay: 0.6,
            pan: ((lantern.degree % 5) - 2) * 0.16,
          });
        }
      },
    },
    {
      id: 'root',
      minIntensity: 0,
      gain: 1,
      loopSteps: 32,
      /** @param {StepContext} cx */
      step(cx) {
        if (cx.stepInLoop !== 0) return;
        pluck(cx.graph, { time: cx.time, freq: midiToFreq(cx.chord.bass + 12), gain: 0.26, bus: cx.bus, reverb: 0.5, delay: 0.3 });
      },
    },
  ],
};
