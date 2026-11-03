import test from 'node:test';
import assert from 'node:assert/strict';
import { unpitchedPercussionPartIds, availablePracticeRoles, selectedPracticePart, textureAtMeasure, sunnyIslandTexture } from '../src/utils/practiceTexture.ts';

test('percussion rhythm group includes unpitched tracks and excludes timpani, pitched and mixed tracks', () => {
  const parts = [
    { id: 'snare', name: 'Snare drum', notes: [{ percussion: 38 }] },
    { id: 'bass', name: 'Bass drum', notes: [{ percussion: 36 }] },
    { id: 'cowbell', name: 'Cowbells', notes: [{ percussion: 56 }] },
    { id: 'timp', name: 'Timpani', notes: [{ percussion: 47 }] },
    { id: 'glock', name: 'Glockenspiel', notes: [{}] },
    { id: 'mixed', name: 'Percussion 1', notes: [{ percussion: 38 }, {}] },
    { id: 'empty', name: 'Percussion 2', notes: [] },
  ];
  assert.deepEqual(unpitchedPercussionPartIds(parts), ['snare', 'bass', 'cowbell']);
});
test('rhythm group remains available to an accompaniment player while their musical role is suspended', () => {
  const span = textureAtMeasure(sunnyIslandTexture, 21);
  assert.deepEqual(availablePracticeRoles(['percussion', 'accompaniment'], span, 'P22'), ['percussion']);
  assert.equal(selectedPracticePart('lines', ['percussion'], span, 'P25', 'P22', false, ['P25', 'P26']), true);
  assert.equal(selectedPracticePart('lines', ['percussion'], span, 'P24', 'P22', true, ['P25', 'P26']), false);
});
test('percussion works without texture analysis and combines with other selections as a union', () => {
  const ids = ['P25', 'P26'];
  assert.equal(selectedPracticePart('lines', ['percussion'], undefined, 'P25', 'P2', false, ids), true);
  assert.equal(selectedPracticePart('lines', ['percussion'], undefined, 'P13', 'P2', true, ids), false);
  const span = textureAtMeasure(sunnyIslandTexture, 21);
  assert.equal(selectedPracticePart('lines', ['percussion', 'accompaniment'], span, 'P25', 'P2', false, ids), true);
  assert.equal(selectedPracticePart('own', ['percussion'], span, 'P25', 'P2', true, ids), false);
});
