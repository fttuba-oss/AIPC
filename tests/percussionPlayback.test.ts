import test from 'node:test';
import assert from 'node:assert/strict';
import { percussionKey, percussionEnvelope } from '../src/utils/percussionPlayback.ts';
import { ensembleGains } from '../src/utils/ensembleBalance.ts';
import type { NoteEvent } from '../src/utils/scorePlaybackParser.ts';

test('Sunny Island snare and tam-tam use drum keys, not their displayed E4 staff position', () => {
  assert.equal(percussionKey({ PlaybackInstrumentId: 'snare', displayStepUnpitched: 11, displayOctaveUnpitched: 1 },
    { SubInstruments: [{ idString: 'snare', fixedKey: 39 }] }), 38);
  assert.equal(percussionKey({ PlaybackInstrumentId: 'gong' }, { SubInstruments: [{ idString: 'gong', fixedKey: 53 }] }), 52);
});
test('timpani, bells, and ordinary pitched notes remain pitched', () => {
  assert.equal(percussionKey({ displayStepUnpitched: 0, displayOctaveUnpitched: 0 }, { Name: 'Timpani', SubInstruments: [{ idString: 'T1', fixedKey: -1 }] }), undefined);
  assert.equal(percussionKey({}, { Name: 'Tubular Bells' }), undefined);
});
test('drum selection distinguishes bass drum and sustaining cymbals from short snare noise', () => {
  assert.equal(percussionEnvelope(36).kick, true);
  assert.equal(percussionEnvelope(38).kick, false);
  assert.ok(percussionEnvelope(52).decay > percussionEnvelope(38).decay);
});
test('unpitched percussion does not become a melodic unison in automatic balancing', () => {
  const base = { beat: 0, durationBeats: 4, time: 0, duration: 2, measureNumber: 1 };
  const notes: NoteEvent[] = [{ ...base, partId: 'flute', pitch: 60 }, { ...base, partId: 'snare', pitch: 60, percussion: 38 }];
  assert.deepEqual([...ensembleGains(notes, new Map())], [['flute', 1]]);
});

test('concert part names distinguish Sunny Island cymbal and gong aliases', async () => {
  const { percussionFamily } = await import('../src/utils/percussionPlayback.ts');
  assert.equal(percussionFamily(52, 'Tam-tam'), 'tam-tam');
  assert.equal(percussionFamily(57, 'Suspended Cymbal'), 'suspended-cymbal');
  assert.equal(percussionFamily(57, 'Crash Cymbals'), 'crash');
  assert.equal(percussionFamily(35, 'Bass Drum'), 'bass-drum');
  assert.equal(percussionFamily(37, 'Snare Drum'), 'side-stick');
  assert.equal(percussionFamily(81, 'Unknown percussion'), undefined);
});
