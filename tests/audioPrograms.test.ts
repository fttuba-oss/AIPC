import test from 'node:test';
import assert from 'node:assert/strict';
import { FLUID_PROGRAMS } from '../src/utils/fluidR3Player.ts';
import { mapInstrumentToSoundfont } from '../src/utils/scorePlaybackParser.ts';
import { sampleFamily, chooseVelocityLayer } from '../src/utils/vscoPercussion.ts';
import assets from '../audio-assets.json';
const base = { pitch: 57, beat: 0, time: 0, duration: 1, durationBeats: 2, measureNumber: 1 };
test('orchestral mappings preserve instrument identity, including multiline sax labels', () => {
  assert.equal(mapInstrumentToSoundfont('Baritone\nSaxophone in E♭'), 'baritone_sax');
  assert.equal(mapInstrumentToSoundfont('Tubular Bells'), 'tubular_bells');
  assert.equal(mapInstrumentToSoundfont('String Bass'), 'double_bass');
  assert.equal(FLUID_PROGRAMS[mapInstrumentToSoundfont('Piccolo')], 72);
  assert.equal(FLUID_PROGRAMS[mapInstrumentToSoundfont('Timpani')], 47);
  assert.equal(FLUID_PROGRAMS[mapInstrumentToSoundfont('Clarinet')], 71);
});
test('rolls use dedicated recordings and side-stick remains the proper GM sound', () => {
  assert.equal(sampleFamily({...base,percussion:38,percussionName:'Snare',percussionRoll:true}), 'snare-roll');
  assert.equal(sampleFamily({...base,percussion:57,percussionName:'Suspended Cymbal',percussionRoll:true}), 'suspended-roll');
  assert.equal(sampleFamily({...base,percussion:37,percussionName:'Snare Drum'}), undefined);
  assert.equal(sampleFamily({...base,percussion:52,percussionName:'Tam-tam'}), 'tam-tam');
});
test('sample selection chooses an appropriate recorded dynamic and pins all assets to a source revision', () => {
  const layers=assets.vsco.families.snare;
  assert.equal(chooseVelocityLayer(layers,.2).velocity,.25);
  assert.equal(chooseVelocityLayer(layers,.9).velocity,1);
  assert.ok(layers.every(l=>l.files.length===2));
  assert.match(assets.vsco.commit,/^[a-f0-9]{40}$/);
  assert.ok(assets.vsco.baseUrl.includes(assets.vsco.commit));
});
