import test from 'node:test';
import assert from 'node:assert/strict';
import { ensembleFrames, ensembleGains } from '../src/utils/ensembleBalance.ts';
import type { NoteEvent } from '../src/utils/scorePlaybackParser.ts';
const note = (partId: string, pitch = 60, beat = 0, durationBeats = 4, instrument = 'flute'): NoteEvent =>
  ({ partId, instrument, pitch, beat, durationBeats, time: beat / 2, duration: durationBeats / 2, measureNumber: 1, velocity: 0.7 });

test('same-sample doubling keeps total coherent gain at one', () => {
  const notes = ['a', 'b', 'c', 'd'].map(id => note(id));
  const gains = ensembleGains(notes, new Map());
  assert.equal([...gains.values()].reduce((a, b) => a + b, 0), 1);
});
test('different timbres retain energy and muted duplicates do not attenuate the solo', () => {
  const notes = [note('a'), note('b', 60, 0, 4, 'trumpet')];
  const gains = ensembleGains(notes, new Map());
  assert.ok(Math.abs(gains.get('a')! - 1 / Math.sqrt(2)) < 1e-9);
  assert.deepEqual([...ensembleGains(notes, new Map([['b', 0]]))], [['a', 1]]);
});
test('independent sparse lines remain unchanged; dense textures are attenuated', () => {
  assert.deepEqual([...ensembleGains([note('a'), note('b', 64)], new Map()).values()], [1, 1]);
  const dense = Array.from({ length: 12 }, (_, i) => note(String(i), 48 + i));
  assert.ok([...ensembleGains(dense, new Map()).values()].every(g => Math.abs(g - Math.sqrt(0.5)) < 1e-9));
});
test('sustains contribute to density, ending notes expire, and source timing/dynamics are unchanged', () => {
  const notes = [note('a', 60, 0, 4), note('b', 64, 2, 1), note('c', 67, 4, 1)];
  const before = JSON.stringify(notes);
  const frames = ensembleFrames(notes);
  assert.deepEqual(frames.get(2)?.map(n => n.partId), ['a', 'b']);
  assert.deepEqual(frames.get(4)?.map(n => n.partId), ['c']);
  ensembleGains(frames.get(2)!, new Map());
  assert.equal(JSON.stringify(notes), before);
});
test('chord tones do not count as multiple parts and exact pitch sets define doubling', () => {
  const gains = ensembleGains([note('a', 60), note('a', 64), note('b', 60)], new Map());
  assert.deepEqual([...gains.values()], [1, 1]);
});
