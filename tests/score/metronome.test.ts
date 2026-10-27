import test from 'node:test';
import assert from 'node:assert/strict';
import { metronomeEvents, pulseQuarterNotes, countInPulses, meterAtBeat, type MetronomeMeasure } from '../../src/modules/score/engine/metronome.ts';
const bar = (startBeat: number, numerator = 4, denominator = 4, measureNumber = 1): MetronomeMeasure => ({
  measureNumber, startBeat, endBeat: startBeat + numerator * 4 / denominator, numerator, denominator,
});
test('each subdivision produces the exact number and spacing of clicks', () => {
  for (const [sub, divisions] of [['quarter', 1], ['eighth', 2], ['triplet', 3], ['sixteenth', 4]] as const) {
    const clicks = metronomeEvents([bar(0)], 0, 4, sub);
    assert.equal(clicks.length, divisions * 4);
    clicks.forEach((click, i) => assert.ok(Math.abs(click.beat - i / divisions) < 1e-9));
    assert.equal(clicks.filter(c => c.downbeat).length, 1);
  }
});
test('live rebuilding retains the subdivision and excludes clicks before the current position', () => {
  const clicks = metronomeEvents([bar(0), bar(4, 4, 4, 2)], 2.3, 8, 'sixteenth');
  assert.equal(clicks[0].beat, 2.5);
  assert.equal(clicks.at(-1)?.beat, 7.75);
  assert.equal(clicks.length, 22);
});
test('3/4 accents every three crotchets and counts three beats', () => {
  const clicks = metronomeEvents([bar(0, 3), bar(3, 3, 4, 2)], 0, 6, 'quarter');
  assert.deepEqual(clicks.filter(c => c.downbeat).map(c => c.beat), [0, 3]);
  assert.equal(countInPulses(3, 4), 3);
});
test('6/8 counts two dotted-crotchet pulses, with three quavers per pulse', () => {
  assert.equal(pulseQuarterNotes(6, 8), 1.5);
  assert.equal(countInPulses(6, 8), 2);
  assert.deepEqual(metronomeEvents([bar(0, 6, 8)], 0, 3, 'quarter').map(c => c.beat), [0, 1.5]);
  assert.deepEqual(metronomeEvents([bar(0, 6, 8)], 0, 3, 'triplet').map(c => c.beat), [0, .5, 1, 1.5, 2, 2.5]);
});
test('changing metre and pickup measures retain their actual bar boundaries', () => {
  const pickup = { ...bar(0), endBeat: 1 };
  const measures = [pickup, bar(1, 3, 4, 2), bar(4, 6, 8, 3)];
  const clicks = metronomeEvents(measures, 0, 7, 'quarter');
  assert.deepEqual(clicks.filter(c => c.downbeat).map(c => c.beat), [0, 1, 4]);
  assert.equal(meterAtBeat(measures, 4).denominator, 8);
});
test('gap-click and silent-transfer strategies remain silent in their intended bars', () => {
  const measures = Array.from({ length: 4 }, (_, i) => bar(i * 4, 4, 4, i + 1));
  assert.equal(metronomeEvents(measures, 0, 16, 'sixteenth', 0).length, 0);
  assert.equal(metronomeEvents(measures, 0, 16, 'eighth', 3).length, 16);
  assert.ok(metronomeEvents(measures, 0, 16, 'eighth', 3).every(c => c.beat < 8));
  assert.equal(metronomeEvents(measures, 0, 16, 'quarter', 5).length, 64);
});

test('metronome note values preserve the indicated pulse speed', async () => {
  const { metronomeMarkQuarterBpm } = await import('../../src/modules/score/engine/metronome.ts');
  assert.equal(metronomeMarkQuarterBpm(60, 'quarter', 1), 90);
  assert.equal(metronomeMarkQuarterBpm(80, 'half'), 160);
  assert.equal(metronomeMarkQuarterBpm(120, 'eighth'), 60);
});
