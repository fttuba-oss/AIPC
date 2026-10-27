import test from 'node:test';
import assert from 'node:assert/strict';
import { subdivisionNotation } from '../../src/modules/score/engine/subdivisionNotation.ts';
test('simple beats use crotchets, quavers, triplets and semiquavers', () => {
  const quarter = subdivisionNotation(1, 'quarter');
  assert.equal(quarter.flags, 0);
  assert.equal(quarter.dotted, false);
  const eighths = subdivisionNotation(1, 'eighth');
  assert.equal(eighths.count, 2);
  assert.equal(eighths.flags, 1);
  const triplets = subdivisionNotation(1, 'triplet');
  assert.equal(triplets.count, 3);
  assert.equal(triplets.flags, 1);
  assert.equal(triplets.tuplet, true);
  assert.equal(subdivisionNotation(1, 'sixteenth').flags, 2);
});
test('compound beats show their actual dotted note values', () => {
  const beat = subdivisionNotation(1.5, 'quarter');
  assert.equal(beat.dotted, true);
  assert.equal(beat.flags, 0);
  const halves = subdivisionNotation(1.5, 'eighth');
  assert.equal(halves.dotted, true);
  assert.equal(halves.flags, 1);
  const thirds = subdivisionNotation(1.5, 'triplet');
  assert.equal(thirds.count, 3);
  assert.equal(thirds.flags, 1);
  assert.equal(thirds.dotted, false);
  assert.equal(thirds.tuplet, false, 'Three ordinary quavers fill a dotted-crotchet beat.');
  const quarters = subdivisionNotation(1.5, 'sixteenth');
  assert.equal(quarters.dotted, true);
  assert.equal(quarters.flags, 2);
});
test('minim and quaver pulses use the appropriate notation', () => {
  assert.equal(subdivisionNotation(2, 'quarter').openHead, true);
  assert.equal(subdivisionNotation(2, 'eighth').flags, 0);
  assert.equal(subdivisionNotation(.5, 'quarter').flags, 1);
  assert.equal(subdivisionNotation(.5, 'sixteenth').flags, 3);
});
