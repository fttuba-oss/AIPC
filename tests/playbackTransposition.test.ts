import test from 'node:test';
import assert from 'node:assert/strict';
import { soundingSemitones, transpositionAt, writtenPitchToMidi, type PlaybackTransposeChange } from '../src/utils/playbackTransposition.ts';

test('written C4 sounds at the correct concert MIDI pitch for common band instruments', () => {
  const cases = [0, -2, -9, -14, -21, -7, 12, 24, -12];
  for (const shift of cases) assert.equal(writtenPitchToMidi(48, shift), 60 + shift);
  assert.equal(soundingSemitones(-2, -1), -14);
  assert.equal(soundingSemitones(-9, -1), -21);
  assert.equal(soundingSemitones(0, 1), 12);
});
test('transposition persists, changes at the right measure and beat, and resets to explicit zero', () => {
  const changes: PlaybackTransposeChange[] = [
    { measureIndex: 0, beatOffset: 0, semitones: -2 },
    { measureIndex: 57, beatOffset: 2, semitones: -3 },
    { measureIndex: 58, beatOffset: 0, semitones: 0 },
  ];
  assert.equal(transpositionAt(changes, 57, 0), -2);
  assert.equal(transpositionAt(changes, 57, 2), -3);
  assert.equal(transpositionAt(changes, 58, 0), 0);
  assert.equal(transpositionAt([], 0, 0), 0);
});
test('staff-specific transposition overrides the part instruction without leaking to other staves', () => {
  const changes: PlaybackTransposeChange[] = [
    { measureIndex: 0, beatOffset: 0, semitones: -2 },
    { measureIndex: 1, beatOffset: 0, staff: 2, semitones: -14 },
    { measureIndex: 2, beatOffset: 0, semitones: 0 },
  ];
  assert.equal(transpositionAt(changes, 1, 0, 1), -2);
  assert.equal(transpositionAt(changes, 1, 0, 2), -14);
  assert.equal(transpositionAt(changes, 2, 0, 2), 0);
});
