import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORCHESTRA_MIX, assignedPartId, orchestraNotes, partBalance, partLevel } from '../../src/modules/score/engine/orchestraMix';
import type { NoteEvent, PartData } from '../../src/modules/score/engine/scorePlaybackParser';
const event = (partId: string, extra: Partial<NoteEvent> = {}): NoteEvent => ({ partId, instrument: 'flute', sourceEventId: `${partId}:1`, pitch: 60, beat: 0, time: 0, duration: 1, durationBeats: 2, measureNumber: 1, velocity: 0.75, articulation: '', expressionKey: 'mf', ...extra });
const clear = { ...DEFAULT_ORCHESTRA_MIX, mode: 'clear' as const };

test('balanced mode preserves intentional unison parts and removes only repeated source events', () => {
  const first = event('flute1'), second = event('flute2');
  assert.equal(orchestraNotes([first, second, { ...first }], DEFAULT_ORCHESTRA_MIX).length, 2);
  assert.equal(orchestraNotes([first, event('flute1', { sourceEventId: 'other-voice' })], DEFAULT_ORCHESTRA_MIX).length, 2);
});
test('clear lines groups equivalent cross-part patch events without altering source data', () => {
  const source = [event('one'), event('two')]; const before = JSON.stringify(source);
  const result = orchestraNotes(source, clear);
  assert.equal(result.length, 1); assert.deepEqual(result[0].contributingPartIds, ['one','two']);
  assert.equal(JSON.stringify(source), before);
});
for (const [difference, extra] of Object.entries({
  timbre: { instrument: 'violin' }, octave: { pitch: 72 }, onset: { beat: 0.001 }, duration: { durationBeats: 3 },
  articulation: { articulation: 'staccato' }, expression: { expressionKey: 'ff' }, velocity: { velocity: 0.9 }, percussion: { isPercussion: true }, unknownArticulation: { articulation: undefined },
})) test(`clear lines preserves ${difference} differences`, () => {
  assert.equal(orchestraNotes([event('one'), event('two', extra)], clear).length, 2);
});
test('independent same-part voices and percussion identities are retained', () => {
  assert.equal(orchestraNotes([event('one'), event('one', { sourceEventId: 'voice2' })], clear).length, 2);
  assert.equal(orchestraNotes([event('one', { isPercussion: true }), event('two', { isPercussion: true })], clear).length, 2);
});
test('muting or zeroing the guide never removes another part doubling the same line', () => {
  const source = [event('guide'), event('backing1'), event('backing2')];
  assert.equal(orchestraNotes(source, { ...clear, practicePartId: 'guide' }).length, 2);
  for (const settings of [{ mutePracticePart: true }, { guideLevel: 0 }]) {
    const result = orchestraNotes(source, { ...clear, practicePartId: 'guide', ...settings });
    assert.equal(result.length, 1); assert.deepEqual(result[0].contributingPartIds, ['backing1','backing2']);
  }
  assert.equal(orchestraNotes(source, clear, { guide: 0 })[0].partId, 'backing1');
});
test('guide and orchestra levels are independent, including live faders below the old velocity clamp', () => {
  const settings = { ...DEFAULT_ORCHESTRA_MIX, practicePartId: 'guide', orchestraLevel: 0, guideLevel: 1 };
  assert.ok(partLevel('guide', settings) > 0 && partLevel('guide', settings) < 0.05);
  assert.equal(partLevel('other', settings), 0);
  assert.equal(partLevel('guide', { ...settings, mutePracticePart: true }), 0);
  assert.equal(orchestraNotes([event('one'), event('two')], clear, { one: 0.4, two: 0.7 }).length, 2);
});
test('balance presets use stable per-part attenuation and preserve pan and part identity', () => {
  const parts: PartData[] = ['one','two'].map(id => ({ id, name: id, soundfontInstrument: 'flute', notes: [event(id)] }));
  const levels = partBalance(parts), solo = partBalance(parts.slice(0,1));
  assert.ok(levels.get('one')!.gain < solo.get('one')!.gain);
  assert.equal(levels.get('one')!.gain, levels.get('two')!.gain);
  assert.ok(Math.abs(levels.get('one')!.pan) < 0.5);
});

test('assigned staff defaults resolve exact or unique names, never ambiguous families', () => {
  const parts = [{id:'f1',name:'Flute 1'},{id:'f2',name:'Flute 2'},{id:'tr',name:'Trumpet in Bb'}];
  assert.equal(assignedPartId(parts,'Flute 2'),'f2');
  assert.equal(assignedPartId(parts,'Trumpet'),'tr');
  assert.equal(assignedPartId(parts,'Flute'),'');
  assert.equal(assignedPartId(parts,''),'');
});
