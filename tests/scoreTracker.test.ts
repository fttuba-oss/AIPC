import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerPositionAt, type TrackerAnchor } from '../src/utils/scoreTracker.ts';
const a = (beat: number, x: number, system = 0): TrackerAnchor => ({ beat, x, system, top: system * 150, height: 64 });
test('moves continuously between unevenly spaced note onsets', () => {
  const map = [a(0, 10), a(1, 110), a(1.25, 160), a(4, 300)];
  assert.equal(trackerPositionAt(map, .5)?.x, 60);
  assert.equal(trackerPositionAt(map, 1.125)?.x, 135);
  assert.equal(trackerPositionAt(map, 1.25)?.x, 160);
});
test('sustains to the old line edge and changes lines exactly at the boundary', () => {
  const map = [a(0, 10), a(3, 200), a(4, 300), a(4, 20, 1), a(5, 120, 1)];
  assert.equal(trackerPositionAt(map, 3.5)?.x, 250);
  assert.equal(trackerPositionAt(map, 3.5)?.top, 0);
  assert.equal(trackerPositionAt(map, 4)?.x, 20);
  assert.equal(trackerPositionAt(map, 4)?.top, 150);
  assert.equal(trackerPositionAt(map, 4.5)?.x, 70);
});
test('seeking backwards, looping and score limits have no retained animation state', () => {
  const map = [a(2, 20), a(4, 220)];
  assert.ok(Math.abs(trackerPositionAt(map, 3.8)!.x - 200) < 1e-9);
  assert.equal(trackerPositionAt(map, 2)?.x, 20);
  assert.equal(trackerPositionAt(map, -1)?.x, 20);
  assert.equal(trackerPositionAt(map, 100)?.x, 220);
  assert.equal(trackerPositionAt([], 0), null);
  assert.equal(trackerPositionAt(map, NaN), null);
});
