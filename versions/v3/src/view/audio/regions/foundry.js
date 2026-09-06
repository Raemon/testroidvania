/**
 * Foundry — A minor pentatonic with a b5 blue note, 96 BPM, one chord. 05 §6b asks
 * for the bass ostinato `A . A . C . A . G . A . Eb . A .` and Sub kicks on all
 * four beats; the four "chords" below are the same Am, which keeps the bass
 * ostinato as the only thing that moves.
 *
 * TODO: the ostinato and the every-8-bars rising pad; patterns are the Cistern's.
 */

import { CISTERN } from './cistern.js';

/** @type {import('../sequencer.js').Region} */
export const FOUNDRY = {
  id: 'foundry',
  name: 'Foundry',
  tempo: 96,
  bossTempo: 104,
  stepsPerBar: 16,
  barsPerChord: 2,
  chords: [
    { name: 'Am', bass: 45, pad: [69, 72, 76, 81], tones: [69, 72, 76, 79, 83], drone: 33 },
    { name: 'Am', bass: 45, pad: [69, 72, 76, 81], tones: [69, 72, 76, 79, 83], drone: 33 },
    { name: 'Am/b5', bass: 45, pad: [69, 72, 75, 81], tones: [69, 72, 75, 79, 83], drone: 33 },
    { name: 'Am', bass: 45, pad: [69, 72, 76, 81], tones: [69, 72, 76, 79, 83], drone: 33 },
  ],
  drone: { gain: 0.45 },
  layers: CISTERN.layers,
};
