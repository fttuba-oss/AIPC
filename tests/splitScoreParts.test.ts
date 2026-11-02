import test from 'node:test';
import assert from 'node:assert/strict';
import { combinedPartNames, splitLineGroups, type LineGroup } from '../src/utils/splitScoreParts.ts';
import { expandTextureParts, sunnyIslandTexture, textureAtMeasure } from '../src/utils/practiceTexture.ts';
const group = (start: number, notes: number[], voice = '1', duration = 1): LineGroup<number> => ({ start, duration, voice, notes });

test('recognises named player pairs without treating an ordinary chordal instrument as two players', () => {
  assert.deepEqual(combinedPartNames('1st &amp; 2nd Flutes'), ['Flute 1', 'Flute 2']);
  assert.deepEqual(combinedPartNames('3rd & 4th Horns in F'), ['Horn 3 in F', 'Horn 4 in F']);
  assert.equal(combinedPartNames('Piano'), null);
  assert.equal(combinedPartNames('1st & 2nd Piano'), null);
});
test('assigns upper/lower chord tones and shares a single unison line', () => {
  const [upper, lower] = splitLineGroups([group(0, [72, 76]), group(1, [74])], n => n);
  assert.deepEqual(upper.map(g => g.notes), [[76], [74]]);
  assert.deepEqual(lower.map(g => g.notes), [[72], [74]]);
});
test('mixed chord and independent-voice encoding keeps its original onsets and durations', () => {
  const [upper, lower] = splitLineGroups([group(0, [72, 76]), group(1, [74]), group(2, [76]), group(2, [67], '2', 2), group(3, [77])], n => n);
  assert.deepEqual(upper.map(g => [g.start, g.notes]), [[0, [76]], [1, [74]], [2, [76]], [3, [77]]]);
  assert.deepEqual(lower.map(g => [g.start, g.duration, g.notes]), [[0, 1, [72]], [1, 1, [74]], [2, 2, [67]]]);
});
test('extra source chord tones are preserved, and a lower-voice solo is not copied to the upper player', () => {
  const [upper, lower] = splitLineGroups([group(0, [72, 76, 79])], n => n);
  assert.deepEqual([...upper[0].notes, ...lower[0].notes].sort(), [72, 76, 79]);
  const solo = splitLineGroups([group(0, [67], '2')], n => n, ['1', '2']);
  assert.equal(solo[0].length, 0);
  assert.equal(solo[1].length, 1);
});
test('extracted players have separate role IDs and flute 2 supports the tune at 41–43, returning at 44', () => {
  const parts = [{ sourceId: 'P2', id: 'flute1', index: 0 }, { sourceId: 'P2', id: 'flute2', index: 1 }];
  const map = expandTextureParts(sunnyIslandTexture, parts)!;
  assert.ok(textureAtMeasure(map, 21)?.melody.includes('flute1'));
  assert.ok(textureAtMeasure(map, 21)?.melody.includes('flute2'));
  assert.ok(textureAtMeasure(map, 42)?.melody.includes('flute1'));
  assert.ok(textureAtMeasure(map, 42)?.accompaniment.includes('flute2'));
  assert.ok(textureAtMeasure(map, 44)?.melody.includes('flute2'));
  assert.ok(!map.some(s => [...s.melody, ...s.countermelody, ...s.accompaniment].includes('P2')));
});
