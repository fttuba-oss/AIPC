import test from 'node:test';
import assert from 'node:assert/strict';
import { notationPlacement } from '../src/utils/scoreDisplay.ts';

test('single-voice notation has a consistent side independent of changing note stems', () => {
  assert.equal(notationPlacement('1', ['1']), 'above');
  assert.equal(notationPlacement('5', ['5']), 'above');
});
test('independent voices use opposite sides rather than stacking marks on one side', () => {
  assert.equal(notationPlacement('1', ['1', '2']), 'above');
  assert.equal(notationPlacement('2', ['1', '2']), 'below');
});
