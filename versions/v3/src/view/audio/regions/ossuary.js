/**
 * Ossuary (Apex) — F# Phrygian, 60 BPM, F#m -> Gmaj7 -> F#m -> Bm. The bII is the
 * unease; that one chord is the whole region's character (05-aesthetic §6b).
 *
 * Mode, tempo, chords and reverb are final. The layer *patterns* are the Cistern's,
 * borrowed so the region is playable today — 05 asks for bells replaced by a
 * detuned pad and a slow pluck, and bone-dry Ticks for percussion. TODO: write them.
 */

import { CISTERN } from './cistern.js';

/** @type {import('../sequencer.js').Region} */
export const OSSUARY = {
  id: 'ossuary',
  name: 'Ossuary',
  tempo: 60,
  bossTempo: 68,
  stepsPerBar: 16,
  barsPerChord: 2,
  chords: [
    { name: 'F#m', bass: 42, pad: [66, 69, 73, 78], tones: [66, 69, 73, 76, 80], drone: 30 },
    { name: 'Gmaj7', bass: 43, pad: [67, 71, 74, 78], tones: [67, 71, 74, 78, 81], drone: 31 },
    { name: 'F#m', bass: 42, pad: [66, 69, 73, 78], tones: [66, 69, 73, 76, 80], drone: 30 },
    { name: 'Bm', bass: 47, pad: [71, 74, 78, 81], tones: [71, 74, 78, 81, 85], drone: 35 },
  ],
  drone: { gain: 0.4 },
  layers: CISTERN.layers,
};
