/**
 * The three things every region's material needs and none of them owns.
 *
 * Everything else — the patterns, the voicings, the velocities — belongs in the
 * region file, because that is what makes a region a region. What lives here is
 * the *grammar*: how a scale degree becomes a MIDI note against whatever chord is
 * currently sounding, and how a struck note gets a velocity that is not identical
 * to the last one.
 */

import { createRng } from '../rng.js';
import { pluck, midiToFreq } from '../voices.js';

/** @typedef {import('../sequencer.js').Chord} Chord */
/** @typedef {import('../sequencer.js').Layer} Layer */
/** @typedef {import('../sequencer.js').StepContext} StepContext */

/**
 * A chord tone by degree, wrapping into higher octaves past the top of the
 * voicing: with `tones` = {1,3,5,7,9}, degree 5 is the root an octave up.
 *
 * This is what makes a phrase portable between regions. A phrase written as MIDI
 * notes is a phrase in one key against one chord set; the same phrase written as
 * degrees sits inside whatever harmony it is played against, which is why the
 * Cistern's boss lead — literal MIDI, transposed nowhere — was scoring fourteen
 * semitone clashes against the Ossuary's F# Phrygian in the final fight.
 *
 * @param {Chord} chord
 * @param {number} degree
 * @returns {number|undefined} MIDI note
 */
export function chordDegree(chord, degree) {
  const tones = chord.tones;
  const n = tones.length;
  if (n === 0) return undefined;
  const i = ((degree % n) + n) % n;
  const note = tones[i];
  return note === undefined ? undefined : note + 12 * Math.floor(degree / n);
}

/**
 * A per-note RNG stream.
 *
 * `cx.rng` is seeded per (layer, loop pass) and handed out fresh on every step, so
 * it is the right stream for a decision about the *pass* and the wrong one for a
 * decision about a note: every step in a pass would draw the same first value. A
 * struck instrument whose every stroke is the same weight is a sequencer, and you
 * hear it as one.
 *
 * @param {number} salt  distinguishes one layer's stream from another's
 * @param {number} loop
 * @param {number} step
 * @returns {() => number}
 */
export function noteRng(salt, loop, step) {
  return createRng(salt ^ Math.imul(loop, 2654435761) ^ Math.imul(step + 1, 40503));
}

/**
 * The boss lead, as a list of scale degrees rather than notes.
 *
 * One entry per quarter note; `null` is a rest. Every region defines its own
 * phrase and every note of it is a chord tone of whatever is sounding, so the lead
 * arrives in the region's own harmony instead of importing the Cistern's.
 *
 * @param {object} spec
 * @param {(number|null)[]} spec.phrase
 * @param {number} [spec.gain]
 * @param {number} [spec.reverb]
 * @param {number} [spec.delay]
 * @param {number} [spec.transpose] semitones applied after the degree lookup
 * @param {number} [spec.minIntensity]
 * @param {string} [spec.id]
 * @returns {Layer}
 */
export function degreeLead(spec) {
  const phrase = spec.phrase;
  const transpose = spec.transpose ?? 0;
  return {
    id: spec.id ?? 'lead',
    minIntensity: spec.minIntensity ?? 1,
    gain: 1,
    loopSteps: phrase.length * 4,
    /** @param {StepContext} cx */
    step(cx) {
      if (cx.stepInLoop % 4 !== 0) return;
      const degree = phrase[cx.stepInLoop / 4];
      if (degree === null || degree === undefined) return;
      const note = chordDegree(cx.chord, degree);
      if (note === undefined) return;
      pluck(cx.graph, {
        time: cx.time,
        freq: midiToFreq(note + transpose),
        gain: (spec.gain ?? 0.5) * (0.88 + noteRng(0x1ead, cx.loop, cx.stepInLoop)() * 0.24),
        bus: cx.bus,
        reverb: spec.reverb ?? 0.4,
        delay: spec.delay ?? 0.5,
      });
    },
  };
}
