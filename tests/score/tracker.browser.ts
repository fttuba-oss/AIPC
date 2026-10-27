import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const rest = '<note><rest/><duration>4</duration><voice>1</voice></note>';
const attributes = '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>';
const halfRest = '<note><rest/><duration>2</duration><voice>1</voice><type>half</type></note>';
const note = '<note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>half</type></note>';
const xml = `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Tracker bar starts</work-title></work><part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list><part id="P1"><measure number="1">${attributes}${rest}</measure><measure number="2">${halfRest}${note}</measure><measure number="3"><print new-system="yes"/>${rest}</measure><measure number="4">${halfRest}${note}</measure></part></score-partwise>`;

test('tracker starts every bar at its left boundary, including rests and a new system', { timeout: 60000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aipc-tracker-'));
  const log = fs.openSync(path.join(directory, 'vite.log'), 'w');
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'src/modules/score/vite.config.ts', '--host', '127.0.0.1', '--port', '5193'], { stdio: ['ignore', log, log] });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const base = 'http://127.0.0.1:5193';
    const deadline = Date.now() + 15000;
    while (true) { try { if ((await fetch(`${base}/dev-score.html`)).ok) break; } catch {} if (Date.now() > deadline) throw Error(fs.readFileSync(path.join(directory, 'vite.log'), 'utf8')); await new Promise(r => setTimeout(r, 150)); }
    browser = await chromium.launch({ executablePath: process.env.AIPC_CHROMIUM_PATH || '/usr/lib/chromium/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, XDG_CONFIG_HOME: path.join(directory, 'config'), XDG_CACHE_HOME: path.join(directory, 'cache') } });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(`${base}/dev-score.html`);
    await page.evaluate(async () => { const harness = await import('/tests/score/trackerHarness.ts'); harness.captureTrackerScore(); });
    await page.getByLabel('Upload score').setInputFiles({ name: 'tracker.musicxml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await page.locator('[data-score-cursor]').waitFor({ state: 'visible' });
    // Wait for cached geometry after OSMD's initial layout and rerender.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const idle = await page.evaluate(async () => (await import('/tests/score/trackerHarness.ts')).barGeometry(1));
    assert.ok(Math.abs(idle.cursor - idle.left) < 3, `Idle beat 1 is ${idle.cursor - idle.left}px past the left barline`);
    // Seeking a silent bar must target its boundary, not OSMD's centred rest cursor.
    const restBar = await page.evaluate(async () => (await import('/tests/score/trackerHarness.ts')).barGeometry(3));
    await page.mouse.click((restBar.left + restBar.right) / 2, restBar.top + 15);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const sought = await page.evaluate(async () => (await import('/tests/score/trackerHarness.ts')).barGeometry(3));
    assert.ok(Math.abs(sought.cursor - sought.left) < 3, `Seeking the rest bar starts ${sought.cursor - sought.left}px past its left edge`);
    await page.evaluate(async () => {
      const { StudentAudioEngine } = await import('/src/modules/score/engine/studentAudioEngine.ts');
      const original = StudentAudioEngine.prototype.startSectionPlayback;
      StudentAudioEngine.prototype.startSectionPlayback = async function(...args: any[]) { (window as any).__trackerEngine = this; return original.apply(this, args); };
    });
    await page.getByRole('button', { name: 'Play & follow', exact: true }).click();
    await page.waitForFunction(() => parseFloat(document.querySelector('[aria-label="Playback time"]')?.textContent ?? '0') > 0.1);
    for (const [bar, seconds] of [[1, 0], [2, 2], [3, 4], [4, 6]]) {
      await page.evaluate(seconds => { (window as any).__trackerEngine.getScorePlaybackSeconds = () => seconds; }, seconds);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const geometry = await page.evaluate(async bar => (await import('/tests/score/trackerHarness.ts')).barGeometry(bar), bar);
      assert.ok(Math.abs(geometry.cursor - geometry.left) < 3, `Bar ${bar} beat 1 is ${geometry.cursor - geometry.left}px past the left barline`);
    }
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const studentPage = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
    studentPage.on('pageerror', error => errors.push(error.message));
    const names = ['Flutes', '1st Clarinet', 'Oboe'];
    const roster = names.map((instrument, index) => ({ id: `student_${index}`, name: instrument, instrument }));
    const body = xml.match(/<part id="P1">([\s\S]*?)<\/part>/)![1];
    const otherBody = body.replace(rest, '<note><pitch><step>G</step><octave>3</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note>');
    const ensembleXml = `<?xml version="1.0"?><score-partwise version="4.0"><part-list>${names.map((name, index) => `<score-part id="P${index + 1}"><part-name>${name}</part-name></score-part>`).join('')}<score-part id="P4"><part-name>Bassoon</part-name></score-part></part-list>${names.map((_name, index) => `<part id="P${index + 1}">${body}</part>`).join('')}<part id="P4">${otherBody}</part></score-partwise>`;
    await studentPage.route('https://**/*', route => route.abort());
    await studentPage.route('**/api/practice/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/students')) return route.fulfill({ json: roster });
      const studentId = url.searchParams.get('studentId');
      const student = roster.find(person => person.id === studentId)!;
      return route.fulfill({ json: student ? [{ id: `plan_${student.id}`, title: 'Rest and note alignment', score: { id: 'tracker', title: 'Tracker ensemble', xmlPath: '/tracker.musicxml' }, studentId: student.id, studentName: student.name, instrumentName: student.instrument, range: [1, 4], notes: '', assignedAt: '2026-01-01', status: 'assigned' }] : [] });
    });
    await studentPage.route('**/tracker.musicxml', route => route.fulfill({ contentType: 'application/xml', body: ensembleXml }));
    await studentPage.goto(`${base}/student.html`);
    await studentPage.getByLabel('Demo student').waitFor();
    await studentPage.evaluate(async () => {
      (await import('/tests/score/trackerHarness.ts')).captureTrackerScore();
      const { StudentAudioEngine } = await import('/src/modules/score/engine/studentAudioEngine.ts');
      const original = StudentAudioEngine.prototype.startSectionPlayback;
      StudentAudioEngine.prototype.startSectionPlayback = async function(...args: any[]) { (window as any).__trackerEngine = this; return original.apply(this, args); };
    });
    for (let index = 0; index < roster.length; index++) {
      await studentPage.getByLabel('Demo student').selectOption(roster[index].id);
      await studentPage.getByRole('button', { name: 'Open score', exact: true }).click();
      await studentPage.waitForFunction(part => document.querySelector<HTMLSelectElement>('[aria-label="My practice part"]')?.value === part, `P${index + 1}`);
      assert.equal(await studentPage.getByLabel('Visible score part').inputValue(), `P${index + 1}`);
      await studentPage.getByLabel('Visible score part').selectOption('');
      await studentPage.locator('[data-score-cursor]').waitFor({ state: 'visible' });
      await studentPage.getByRole('button', { name: 'Play & follow', exact: true }).click();
      await studentPage.waitForFunction(() => parseFloat(document.querySelector('[aria-label="Playback time"]')?.textContent ?? '0') > 0.1);
      for (const beat of [0, 6, 8, 14]) {
        await studentPage.evaluate(beat => { (window as any).__trackerEngine.getScorePlaybackSeconds = () => beat / 2; }, beat);
        await studentPage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        if (beat === 0 || beat === 8) {
          const geometry = await studentPage.evaluate(async bar => (await import('/tests/score/trackerHarness.ts')).barGeometry(bar), beat / 4 + 1);
          assert.ok(Math.abs(geometry.cursor - geometry.left) < 2, `${names[index]}: rest bar starts ${geometry.cursor - geometry.left}px from its left edge`);
        } else {
          const geometry = await studentPage.evaluate(async beat => (await import('/tests/score/trackerHarness.ts')).noteGeometry(beat), beat);
          assert.ok(Number.isFinite(geometry.left) && Math.abs(geometry.cursor - geometry.left) < 2, `${names[index]}: tracker at note onset is ${geometry.cursor - geometry.left}px from the notehead's left edge`);
        }
      }
      if (index === 0) {
        await studentPage.evaluate(() => { (window as any).__trackerEngine.getScorePlaybackSeconds = () => 0; });
        await studentPage.getByLabel('My practice part').selectOption('P4');
        await studentPage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const attack = await studentPage.evaluate(async () => (await import('/tests/score/trackerHarness.ts')).noteGeometry(0));
        assert.ok(Math.abs(attack.cursor - attack.left) < 2, 'Changing My part must immediately retarget the full-score tracker');
        await studentPage.getByLabel('My practice part').selectOption('P1');
        await studentPage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const silent = await studentPage.evaluate(async () => (await import('/tests/score/trackerHarness.ts')).barGeometry(1));
        assert.ok(Math.abs(silent.cursor - silent.left) < 2, 'Returning to the resting flute must restore the barline anchor');
      }
      await studentPage.getByRole('button', { name: 'Stop', exact: true }).click();
      await studentPage.getByRole('button', { name: 'Practice plan manager', exact: true }).click();
    }
    await studentPage.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); server.kill('SIGTERM'); if (server.exitCode === null) await once(server, 'exit'); fs.closeSync(log); fs.rmSync(directory, { recursive: true, force: true });
  }
});
