/**
 * Verdant (Roots) — G Lydian, 84 BPM, Gmaj7 -> Amaj7 -> Gmaj7 -> Bm7. The #4 lift
 * lives in the Amaj7; it is the brightest material in the game (05-aesthetic §6b).
 *
 * TODO: bells an octave higher with delay send 0.7, and the call-and-response
 * Pluck lead. Patterns are the Cistern's for now.
 */

import { CISTERN } from './cistern.js';

/** @type {import('../sequencer.js').Region} */
export const VERDANT = {
  id: 'verdant',
  name: 'Verdant',
  tempo: 84,
  bossTempo: 92,
  stepsPerBar: 16,
  barsPerChord: 2,
  chords: [
    { name: 'Gmaj7', bass: 43, pad: [67, 71, 74, 78], tones: [67, 71, 74, 78, 81], drone: 31 },
    { name: 'Amaj7', bass: 45, pad: [69, 73, 76, 80], tones: [69, 73, 76, 80, 83], drone: 33 },
    { name: 'Gmaj7', bass: 43, pad: [67, 71, 74, 78], tones: [67, 71, 74, 78, 81], drone: 31 },
    { name: 'Bm7', bass: 47, pad: [71, 74, 78, 81], tones: [71, 74, 78, 81, 85], drone: 35 },
  ],
  drone: { gain: 0.4 },
  layers: CISTERN.layers,
};
