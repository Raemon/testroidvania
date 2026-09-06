/**
 * Spine — the hub has no material of its own in 05. It gets the Cistern's mode a
 * shade slower and a shade emptier: the hub should feel like the space between
 * regions, not like a region.
 *
 * TODO: replace with hub-specific material once the Spine rooms exist.
 */

import { CISTERN } from './cistern.js';

/** @type {import('../sequencer.js').Region} */
export const SPINE = {
  id: 'spine',
  name: 'Spine',
  tempo: 66,
  bossTempo: 66,
  stepsPerBar: 16,
  barsPerChord: 2,
  chords: CISTERN.chords,
  drone: { gain: 0.35 },
  layers: CISTERN.layers,
};
