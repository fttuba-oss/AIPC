import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedPracticePart, sunnyIslandTexture, textureAtMeasure, textureForScore } from '../src/utils/practiceTexture.ts';
import { matchPartToInstrument, type ScorePartInfo } from '../src/utils/scoreParts.ts';

test('the student tenor/baritone sax part is not mistaken for the first alto sax', () => {
  const parts: ScorePartInfo[] = ['1st Alto Saxophone in E♭', '2nd Alto Saxophone in E♭', 'Tenor Saxophone in B♭', 'Baritone Saxophone in E♭'].map((name, i) => ({ id: `s${i}`, name, section: 'Saxophones' }));
  assert.equal(matchPartToInstrument(parts, 'Tenor Saxophone'), 's2');
  assert.equal(matchPartToInstrument(parts, 'Baritone Saxophone'), 's3');
  assert.equal(matchPartToInstrument(parts, 'Alto Saxophone 2'), 's1');
});

test('saved analysis is bound to its score, not a matching title or unrelated score', () => {
  const { xml } = JSON.parse(readFileSync(new URL('../storage/scores/score_1792034229527_snur.json', import.meta.url), 'utf8'));
  assert.equal(textureForScore(xml), sunnyIslandTexture);
  assert.equal(textureForScore('<score-partwise><work-title>Sunny Island</work-title></score-partwise>'), null);
  assert.equal(textureForScore(xml.replace('Kahchun', 'Different')), null);
  assert.equal(textureForScore(null), null);
});

test('following Dayung Sampan hands melody from euphonium to trumpets; fixed instrument selection does not', () => {
  const e = textureAtMeasure(sunnyIslandTexture, 63);
  const f = textureAtMeasure(sunnyIslandTexture, 65);
  assert.equal(selectedPracticePart('lines', ['melody'], e, 'P21', 'P11', false), true);
  assert.equal(selectedPracticePart('lines', ['melody'], f, 'P21', 'P11', false), false);
  assert.equal(selectedPracticePart('lines', ['melody'], f, 'P13', 'P11', false), true);
  for (const span of [e, f]) assert.equal(selectedPracticePart('instruments', [], span, 'P21', 'P11', true), true);
});

test('own reference remains independent; own-only and empty line selections exclude other parts', () => {
  const f = textureAtMeasure(sunnyIslandTexture, 65);
  assert.equal(selectedPracticePart('lines', [], f, 'P11', 'P11', false), true);
  assert.equal(selectedPracticePart('own', [], undefined, 'fallback', null, false), true);
  assert.equal(selectedPracticePart('own', ['melody'], f, 'P13', 'P11', true), false);
  assert.equal(selectedPracticePart('lines', [], f, 'P13', 'P11', true), false);
  assert.equal(selectedPracticePart('lines', ['melody', 'countermelody'], f, 'P21', 'P11', false), true);
  assert.equal(selectedPracticePart('lines', ['melody'], undefined, 'P13', 'P11', true), false);
});

test('annotation spans cover every written bar once and never duplicate a part across roles', () => {
  for (let bar = 1; bar <= 116; bar++) {
    assert.equal(sunnyIslandTexture.filter(s => bar >= s.start && bar <= s.end).length, 1);
    const span = textureAtMeasure(sunnyIslandTexture, bar)!;
    const all = [...span.melody, ...span.countermelody, ...span.accompaniment];
    assert.equal(all.length, 31);
    assert.equal(new Set(all).size, 31);
  }
  assert.equal(textureAtMeasure(sunnyIslandTexture, 117), undefined);
});
