import test from 'node:test';
import assert from 'node:assert/strict';
import { dynamicAt, partDynamicAt, DYNAMIC_LEVELS, REFERENCE_DYNAMIC, type PartDynamics } from '../src/utils/scoreDynamics.ts';
test('a dynamic mark changes only at its timestamp, while hairpins interpolate', () => {
    const points = [{ beat: 0, level: DYNAMIC_LEVELS.p }, { beat: 4, level: DYNAMIC_LEVELS.f, ramp: true }, { beat: 8, level: DYNAMIC_LEVELS.pp }];
    assert.equal(dynamicAt(points, 0), DYNAMIC_LEVELS.p);
    assert.equal(dynamicAt(points, 2), (DYNAMIC_LEVELS.p + DYNAMIC_LEVELS.f) / 2);
    assert.equal(dynamicAt(points, 7), DYNAMIC_LEVELS.f);
    assert.equal(dynamicAt(points, 8), DYNAMIC_LEVELS.pp);
});
test('part and staff dynamic levels stay independent', () => {
    const tracks: PartDynamics[] = [
        { partId: 'flute', staff: 1, points: [{ beat: 0, level: DYNAMIC_LEVELS.p }] },
        { partId: 'brass', staff: 1, points: [{ beat: 0, level: DYNAMIC_LEVELS.f }] },
        { partId: 'piano', staff: 1, points: [{ beat: 0, level: DYNAMIC_LEVELS.ff }] },
        { partId: 'piano', staff: 2, points: [{ beat: 0, level: DYNAMIC_LEVELS.pp }] },
    ];
    assert.equal(partDynamicAt(tracks, 'flute', 0), DYNAMIC_LEVELS.p);
    assert.equal(partDynamicAt(tracks, 'brass', 0), DYNAMIC_LEVELS.f);
    assert.equal(partDynamicAt(tracks, 'piano', 0, 2), DYNAMIC_LEVELS.pp);
    assert.equal(partDynamicAt(tracks, 'piano', 0, 1), DYNAMIC_LEVELS.ff);
    assert.equal(partDynamicAt(tracks, 'unknown', 0), REFERENCE_DYNAMIC);
});
test('silent dynamics remain zero and seeking reads the current hairpin level', () => {
    const points = [{ beat: 0, level: 0 }, { beat: 8, level: 1, ramp: true }];
    assert.equal(dynamicAt(points, 0), 0);
    assert.equal(dynamicAt(points, 6), .75);
    assert.equal(dynamicAt(points, 20), 1);
});
