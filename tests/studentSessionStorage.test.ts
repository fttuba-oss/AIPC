import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateActiveSession, recordSectionTime } from '../src/utils/studentRecordingManager.ts';

test('restricted browser storage does not prevent practice startup or in-session time tracking', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage access denied'); } });
  try {
    const session = getOrCreateActiveSession('Sunny Island', 'Flute 2');
    recordSectionTime(session.sessionId, 'trial', 'Full piece', [1, 116], 5);
    const reopened = getOrCreateActiveSession('Sunny Island', 'Flute 2');
    assert.equal(reopened.sessionId, session.sessionId);
    assert.equal(reopened.sections.trial.timeSpentSeconds, 5);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
