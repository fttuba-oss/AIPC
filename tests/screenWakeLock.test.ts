import test from 'node:test';
import assert from 'node:assert/strict';
import { keepScreenAwake, type ScreenLock } from '../src/utils/screenWakeLock.ts';
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture() {
  let visible = true, callback = () => {}, requests = 0, releases = 0, listening = true;
  const locks: ScreenLock[] = [];
  const env = {
    request: async () => {
      requests++; const lock: ScreenLock = { released: false, release: async () => { releases++; lock.released = true; }, addEventListener: () => {} };
      locks.push(lock); return lock;
    },
    visible: () => visible,
    listen: (listener: () => void) => { callback = listener; return () => { listening = false; }; },
  };
  return { env, hide: () => { visible = false; callback(); }, show: () => { visible = true; callback(); }, focus: () => callback(),
    counts: () => ({ requests, releases, listening }) };
}
test('keeps one lock while playing, releases in background, reacquires on return, and cleans up', async () => {
  const f = fixture(), stop = keepScreenAwake(f.env); await flush();
  f.focus(); await flush(); assert.equal(f.counts().requests, 1);
  f.hide(); await flush(); assert.equal(f.counts().releases, 1);
  f.show(); await flush(); assert.equal(f.counts().requests, 2);
  stop(); assert.deepEqual(f.counts(), { requests: 2, releases: 2, listening: false });
});
test('a pending request resolving after playback stops is immediately released', async () => {
  let resolve!: (value: ScreenLock) => void, released = false;
  const stop = keepScreenAwake({ request: () => new Promise(r => { resolve = r; }), visible: () => true, listen: () => () => {} });
  stop(); resolve({ release: async () => { released = true; }, addEventListener: () => {} });
  await flush(); assert.equal(released, true);
});
test('denied or unavailable wake lock does not break playback or repeatedly retry', async () => {
  let calls = 0;
  const stop = keepScreenAwake({ request: async () => { calls++; throw new Error('NotAllowedError'); }, visible: () => true, listen: () => () => {} });
  await flush(); assert.equal(calls, 1); stop();
  keepScreenAwake({ visible: () => true, listen: () => { throw new Error('Must not subscribe when unsupported'); } })();
});
