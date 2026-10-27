import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrackerAnchors, trackerPositionAt, type TrackerAnchor } from '../../src/modules/score/engine/scoreTracker.ts';
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

test('centred whole-bar symbols and empty measures start at the barline, not the glyph', () => {
  const anchors = buildTrackerAnchors([
    { beat: 0, endBeat: 4, left: 10, right: 210, top: 0, height: 64, system: 0, entries: [{ beat: 0, x: 110 }] },
    { beat: 4, endBeat: 8, left: 210, right: 410, top: 0, height: 64, system: 0, entries: [] },
  ]);
  assert.equal(trackerPositionAt(anchors, 0)?.x, 10);
  assert.equal(trackerPositionAt(anchors, 2)?.x, 110);
  assert.equal(trackerPositionAt(anchors, 4)?.x, 210);
  assert.equal(trackerPositionAt(anchors, 6)?.x, 310);
});
test('bar boundaries remain explicit through leading rests, interior attacks and line breaks', () => {
  const anchors = buildTrackerAnchors([
    { beat: 0, endBeat: 4, left: 10, right: 210, top: 0, height: 64, system: 0, entries: [{ beat: 0, x: 110 }, { beat: 2, x: 150 }] },
    { beat: 4, endBeat: 5, left: 20, right: 100, top: 150, height: 64, system: 1, entries: [] },
  ]);
  assert.equal(trackerPositionAt(anchors, 0)?.x, 10);
  assert.equal(trackerPositionAt(anchors, 2)?.x, 150);
  assert.ok(trackerPositionAt(anchors, 3.999)!.x > 209);
  assert.equal(trackerPositionAt(anchors, 4)?.x, 20);
  assert.equal(trackerPositionAt(anchors, 4)?.top, 150);
  assert.equal(trackerPositionAt(anchors, 4.5)?.x, 60);
});


test('pitched attacks align with the notehead left edge, including the first beat', () => {
  const anchors = buildTrackerAnchors([{ beat: 0, endBeat: 4, left: 10, right: 210, top: 0, height: 64, system: 0,
    entries: [{ beat: 0, x: 40, isNote: true }, { beat: 2, x: 130, isNote: true }] }]);
  assert.equal(trackerPositionAt(anchors, 0)?.x, 40);
  assert.equal(trackerPositionAt(anchors, 2)?.x, 130);
});
