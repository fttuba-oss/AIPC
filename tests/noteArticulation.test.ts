import test from 'node:test';
import assert from 'node:assert/strict';
import { articulateNotes, articulatedGate } from '../src/utils/noteArticulation.ts';
import type { NoteEvent } from '../src/utils/scorePlaybackParser.ts';
const voice = {};
const note = (pitch: number, beat: number, durationBeats = 1, parentVoice = voice): NoteEvent => ({
  pitch, beat, durationBeats, time: beat / 2, duration: durationBeats / 2, velocity: 0.8, measureNumber: 1,
  rawNote: { ParentVoiceEntry: { ParentVoice: parentVoice }, getAbsoluteTimestamp: () => ({ RealValue: beat / 4 }) },
});
function slur(a: NoteEvent, b: NoteEvent) {
  const span = { StartNote: a.rawNote, EndNote: b.rawNote };
  a.rawNote.NoteSlurs = [span]; b.rawNote.NoteSlurs = [span];
}
function tie(...notes: NoteEvent[]) {
  const chain = { Notes: notes.map(n => n.rawNote) };
  for (const n of notes) n.rawNote.NoteTie = chain;
}

test('slurred repeated pitches retain separate audible attacks', () => {
  const a = note(60, 0), b = note(60, 1);slur(a,b);
  const result = articulateNotes([a,b]);
  assert.equal(result.length, 2);assert.equal(result[1].legatoFromPrevious, true);
  assert.equal(result[0].legatoToNext, false);
  assert.ok(articulatedGate(result[0], 0.5).duration < 0.5);
});
test('ties merge the full chain even when chord notes are interleaved', () => {
  const a = note(60,0), b=note(60,1), c=note(60,2);tie(a,b,c);
  const result=articulateNotes([a,note(64,0),b,note(67,1),c]);
  assert.equal(result.length,3);
  const tied=result.find(n=>n.pitch===60)!;
  assert.equal(tied.durationBeats,3);assert.equal(tied.duration,1.5);
  assert.equal(tied.time,0);assert.equal(tied.rawNote,undefined);
});
test('slur interior notes connect without changing onsets or written dynamics', () => {
  const notes=[note(60,0),note(62,1),note(64,2),note(65,3)];slur(notes[0],notes[2]);
  const result=articulateNotes(notes);
  assert.equal(result[0].legatoToNext,true);assert.equal(result[1].legatoToNext,true);
  assert.equal(result[1].legatoFromPrevious,true);assert.equal(result[2].legatoFromPrevious,true);
  assert.equal(result[2].legatoToNext,undefined);assert.equal(result[3].legatoFromPrevious,undefined);
  assert.deepEqual(result.map(n=>[n.beat,n.time,n.velocity]),notes.map(n=>[n.beat,n.time,n.velocity]));
  assert.equal(articulatedGate(result[1],0.5).duration,0.525);
  assert.equal(articulatedGate(result[1],0.5).attackScale,0.9);
});
test('rests and different voices do not create legato connections', () => {
  const a=note(60,0),b=note(62,2);slur(a,b);
  assert.equal(articulateNotes([a,b])[0].legatoToNext,undefined);
  const c=note(60,0),d=note(62,1,1,{});slur(c,d);
  assert.equal(articulateNotes([c,d])[0].legatoToNext,undefined);
});
test('untied repeated notes stay separate and percussion is not made legato', () => {
  assert.equal(articulateNotes([note(60,0),note(60,1)]).length,2);
  const a={...note(38,0),percussion:38},b={...note(38,1),percussion:38};slur(a,b);
  const result=articulateNotes([a,b]);assert.equal(result.length,2);
  assert.equal(result[0].legatoToNext,undefined);
  assert.equal(articulatedGate({...a,legatoToNext:true,legatoFromPrevious:true},0.5).attackScale,1);
});

test('tied percussion rolls sustain across barlines without restarting the sample', () => {
  const a={...note(57,0,4),percussion:57,percussionRoll:true};
  const b={...note(57,4,4),percussion:57,percussionRoll:true};tie(a,b);
  const result=articulateNotes([a,b]);
  assert.equal(result.length,1);assert.equal(result[0].durationBeats,8);
  assert.equal(result[0].percussionRoll,true);
});
