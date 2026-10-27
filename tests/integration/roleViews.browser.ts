import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const xml = fs.readFileSync('public/Ode_To_Joy_Demo.musicxml', 'utf8').replace('Ode to Joy (Demo)', 'Integration score');

test('teacher dispatch → student completion → teacher progress, shared viewer, and isolated workbenches', { timeout: 90000 }, async () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipc-browser-'));
 fs.writeFileSync(path.join(root,'students.json'),JSON.stringify([{id:'browser_student',name:'Browser Student',instrument:'Flute'},{id:'other_student',name:'Other Student',instrument:'Trumpet'}]));
 const log=fs.openSync(path.join(root,'vite.log'),'w');
 const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5190','--strictPort'],{cwd:process.cwd(),env:{...process.env,AIPC_STORAGE_ROOT:root},stdio:['ignore',log,log]});
 let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
 try {
  const base='http://127.0.0.1:5190';
  await new Promise<void>((resolve,reject)=>{const deadline=Date.now()+15000;const poll=async()=>{try{if((await fetch(base)).ok)return resolve();}catch{}if(Date.now()>deadline)return reject(new Error(fs.readFileSync(path.join(root,'vite.log'),'utf8')));setTimeout(poll,150);};void poll();});
  browser=await chromium.launch({executablePath:process.env.AIPC_CHROMIUM_PATH || '/usr/lib/chromium/chromium',headless:true,timeout:15000,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],env:{...process.env,XDG_CONFIG_HOME:path.join(root,'config'),XDG_CACHE_HOME:path.join(root,'cache')}});
  const teacher=await browser.newPage(), student=await browser.newPage();
  // Exercise the supported synthesized fallback without external soundfont downloads.
  await teacher.route('https://**/*', route => route.abort());
  const errors:string[]=[];teacher.on('pageerror',e=>errors.push(e.message));student.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(base+'/teacher.html');
  await teacher.getByRole('heading',{name:'Score files manager'}).waitFor();
  assert.equal(await teacher.locator('nav button').count(),4);
  await teacher.getByLabel('Upload score').setInputFiles({name:'integration.musicxml',mimeType:'application/xml',buffer:Buffer.from(xml)});
  await teacher.getByRole('button',{name:'Play & follow',exact:true}).waitFor();
  await teacher.waitForFunction(()=>!!document.querySelector('svg') && !document.querySelector('button[disabled]')?.textContent?.includes('Play & follow'));
  await teacher.getByRole('button',{name:'Play & follow',exact:true}).click();
  await teacher.waitForFunction(()=>parseFloat(document.querySelector('[aria-label="Playback time"]')?.textContent ?? '0') > 0.1);
  const cursor = teacher.locator('[data-score-cursor]');
  const firstPosition = await cursor.evaluate((element: HTMLElement) => element.style.transform);
  await teacher.waitForFunction(previous => {
    const element = document.querySelector<HTMLElement>('[data-score-cursor]');
    return !!element?.style.transform && element.style.transform !== previous;
  }, firstPosition);
  await teacher.getByRole('button',{name:'Stop',exact:true}).click();
  await teacher.getByRole('button',{name:'Practice plan dispatcher',exact:true}).click();
  await teacher.getByLabel('Plan score').selectOption({label:'Integration score'});
  await teacher.getByLabel('Plan title').fill('Browser practice');
  await teacher.getByLabel('Instructions').fill('Practise slowly, then mark done.');
  await teacher.getByLabel('Browser Student · Flute').check();
  await teacher.getByRole('button',{name:'Dispatch practice plan',exact:true}).click();
  await teacher.getByText('Practice plan sent to 1 student.').waitFor();
  await teacher.getByRole('button',{name:'Student progress dashboard',exact:true}).click();
  await teacher.getByText('Browser Student · Browser practice').waitFor();
  await student.goto(base+'/student.html');await student.getByRole('heading',{name:'Practice plan manager'}).waitFor();
  assert.equal(await student.locator('nav button').count(),2);
  await student.getByRole('button',{name:'Mark done',exact:true}).click();
  await student.getByRole('button',{name:'Mark not done',exact:true}).waitFor();
  await teacher.locator('.status.completed').waitFor();
  await student.getByRole('button',{name:'Open score',exact:true}).click();
  await student.getByRole('button',{name:'Play & follow',exact:true}).waitFor();
  await student.locator('svg').first().waitFor();
  await student.getByRole('button',{name:'Practice plan manager',exact:true}).click();
  await student.getByRole('button',{name:'Mark not done',exact:true}).click();
  await teacher.locator('.status.assigned').waitFor();
  await student.getByLabel('Demo student').selectOption('other_student');
  await student.getByText('No practice plans assigned to you yet.').waitFor();
  await student.reload();await student.getByRole('button',{name:'Mark done',exact:true}).waitFor();
  // Independent practice workbench makes no backend calls and records viewer callbacks.
  const workbench=await browser.newPage();let calls=0;
  workbench.on('request',r=>{if(r.url().includes('/api/'))calls++;});
  await workbench.goto(base+'/dev-practice.html');await workbench.getByLabel('Plan title').fill('Independent plan');
  await workbench.getByLabel('Demo student · Trumpet').check();
  await workbench.getByRole('button',{name:'Dispatch practice plan'}).click();
  await workbench.getByRole('button',{name:'Mark done',exact:true}).waitFor();
  await workbench.getByRole('button',{name:'Open score',exact:true}).first().click();
  await workbench.getByText(/Viewer callback:/).waitFor();
  await workbench.goto(base+'/dev-score.html');await workbench.getByRole('heading',{name:'Score files manager'}).waitFor();
  assert.equal(calls,0);assert.deepEqual(errors,[]);
  console.log('Verified both role views, score upload/rendering, dispatch, completion/reopen synchronization, student isolation, and independent workbenches.');
 } finally {
  await browser?.close();child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',()=>resolve());setTimeout(()=>{child.kill('SIGKILL');resolve();},3000).unref();});fs.closeSync(log);fs.rmSync(root,{recursive:true,force:true});
 }
});
