import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

test('orchestral source interpretation, rendered audio, and independent score/mix UI', { timeout:120000 },async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipc-orchestra-'));
  const log=fs.openSync(path.join(root,'vite.log'),'w');
  const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','src/modules/score/vite.config.ts','--host','127.0.0.1','--port','5192'],{stdio:['ignore',log,log]});
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  try{
    const base='http://127.0.0.1:5192';
    const deadline=Date.now()+15000;
    while(true){try{if((await fetch(base+'/dev-score.html')).ok)break;}catch{}if(Date.now()>deadline)throw Error(fs.readFileSync(path.join(root,'vite.log'),'utf8'));await new Promise(r=>setTimeout(r,150));}
    browser=await chromium.launch({executablePath:process.env.AIPC_CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],env:{...process.env,XDG_CONFIG_HOME:path.join(root,'config'),XDG_CACHE_HOME:path.join(root,'cache')}});
    const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    await page.goto(base+'/dev-score.html');
    const source=await page.evaluate(async()=>{const harness=await import('/tests/score/orchestraHarness.ts');return harness.sourceChecks();});
    assert.equal(source.sourceCases,12);
    const rendered=await page.evaluate(async()=>{const harness=await import('/tests/score/orchestraHarness.ts');return harness.audioChecks();});
    console.log('Offline reference renders:',JSON.stringify(rendered));
    const sustained=await page.evaluate(async()=>{const harness=await import('/tests/score/orchestraHarness.ts');return harness.sustainedMuteCheck();});
    const full=await page.evaluate(async()=>{const harness=await import('/tests/score/orchestraHarness.ts');return harness.fullScoreChecks();});
    console.log('Sustained mute:',JSON.stringify(sustained),'Full-score source/mix audit:',JSON.stringify(full));
    const xml=fs.readFileSync('public/Ode_To_Joy_Demo.musicxml');
    await page.getByLabel('Upload score').setInputFiles({name:'orchestra.musicxml',mimeType:'application/xml',buffer:xml});
    await page.getByLabel('My practice part').selectOption('P1');
    await page.getByLabel('Visible score part').selectOption('P1');
    assert.equal(await page.getByLabel('Orchestra playback').inputValue(),'balanced');
    // Inspect the actual engine scheduling at the public class boundary, including separate part buses.
    await page.evaluate(async()=>{
      const {StudentAudioEngine}=await import('/src/modules/score/engine/studentAudioEngine.ts');
      const prototype=StudentAudioEngine.prototype;
      const start=prototype.startSectionPlayback;
      prototype.startSectionPlayback=async function(config:any,...rest:any[]){(window as any).__orchestraConfig=config;(window as any).__orchestraEngine=this;return start.call(this,config,...rest);};
    });
    await page.getByRole('button',{name:'Play & follow',exact:true}).click();
    await page.waitForFunction(()=>parseFloat(document.querySelector('[aria-label="Playback time"]')?.textContent??'0')>0.1);
    const scheduled=await page.evaluate(()=>{const config=(window as any).__orchestraConfig;return {parts:config.parts.map((p:any)=>p.id),noteParts:[...new Set(config.notes.map((n:any)=>n.partId))],pitches:config.parts[0].notes.slice(0,2).map((n:any)=>n.pitch)};});
    assert.deepEqual(scheduled.parts,['P1','P2']);assert.deepEqual(scheduled.noteParts,['P1','P2']);assert.deepEqual(scheduled.pitches,[76,76]);
    await page.evaluate(()=>{const mixer=(window as any).__orchestraEngine.orchestraMixer;const trigger=mixer.trigger.bind(mixer);(window as any).__resumed=[];mixer.trigger=(note:any,duration:number,time:number)=>{(window as any).__resumed.push({partId:note.partId,duration});return trigger(note,duration,time);};});
    await page.getByLabel('Mute my part',{exact:true}).check();
    assert.equal(await page.getByLabel('Guide part volume').isDisabled(),true);
    const gain=await page.evaluate(async()=>{
      await new Promise(r=>setTimeout(r,200));
      const engine=(window as any).__orchestraEngine;
      const mixer=engine.orchestraMixer;
      return {guide:mixer.channels.get('P1').gain.gain.value,backing:mixer.channels.get('P2').gain.gain.value,resumed:(window as any).__resumed};
    });
    assert.ok(gain.guide<0.001 && gain.backing>0);
    assert.ok(gain.resumed.some((note:any)=>note.partId==='P2' && note.duration>0 && note.duration<0.45),'Live mix changes must reschedule the remaining sustain beyond the scheduler look-ahead.');
    await page.getByLabel('Orchestra playback').selectOption('clear');
    await page.getByLabel('Visible score part').selectOption('P2');
    assert.equal(await page.getByLabel('My practice part').inputValue(),'P1');
    await page.evaluate(()=>(window as any).__orchestraEngine.seekToScoreBeat(15.99));
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Play & follow'&&!button.disabled));
    assert.equal(await page.getByRole('button',{name:'Stop',exact:true}).isDisabled(),true);
    await page.getByLabel('Mute my part',{exact:true}).uncheck();
    await page.getByLabel('Metronome volume').fill('0');
    await page.getByLabel('Orchestra volume').fill('0');
    await page.getByLabel('Guide part volume').fill('25');
    assert.equal(await page.getByLabel('Guide part volume').inputValue(),'25');

    // Exercise production patch loading with deterministic, locally supplied WAV samples.
    const sampledPage=await browser.newPage();sampledPage.on('pageerror',e=>errors.push(e.message));
    const wav=Buffer.alloc(44+44100*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
    for(let i=0;i<44100;i++)wav.writeInt16LE(Math.round(6000*Math.sin(2*Math.PI*440*i/44100)),44+i*2);
    const requests=new Set<string>();const sampleRequests=new Map<string,number>();
    await sampledPage.route('https://**/*',async route=>{
      const url=route.request().url();
      if(url.startsWith('https://cdn.jsdelivr.net/gh/nbrosowsky/')){requests.add('orchestral');sampleRequests.set(url,(sampleRequests.get(url)??0)+1);await route.fulfill({contentType:'audio/wav',body:wav});}
      else if(url.startsWith('https://gleitz.github.io/')){requests.add('soundfont');const patch=url.split('/').at(-1)!.replace('-mp3.js','');await route.fulfill({contentType:'application/javascript',body:`window.MIDI=window.MIDI||{};window.MIDI.Soundfont=window.MIDI.Soundfont||{};window.MIDI.Soundfont[${JSON.stringify(patch)}]={A4:${JSON.stringify('data:audio/wav;base64,'+wav.toString('base64'))}};`});}
      else await route.abort();
    });
    await sampledPage.goto(base+'/dev-score.html');
    const firstPart=xml.toString().match(/<part id="P1">([\s\S]*?)<\/part>/)![1];
    const sampledXml=xml.toString().replace('</part-list>','<score-part id="P3"><part-name>Flute copy</part-name></score-part></part-list>').replace('</score-partwise>',`<part id="P3">${firstPart}</part></score-partwise>`);
    await sampledPage.getByLabel('Upload score').setInputFiles({name:'sampled.musicxml',mimeType:'application/xml',buffer:Buffer.from(sampledXml)});
    await sampledPage.evaluate(async()=>{
      const {StudentAudioEngine}=await import('/src/modules/score/engine/studentAudioEngine.ts');const start=StudentAudioEngine.prototype.startSectionPlayback;
      StudentAudioEngine.prototype.startSectionPlayback=async function(...args:any[]){(window as any).__sampledEngine=this;return start.apply(this,args);};
    });
    await sampledPage.getByRole('button',{name:'Play & follow',exact:true}).click();
    await sampledPage.waitForFunction(()=>parseFloat(document.querySelector('[aria-label="Playback time"]')?.textContent??'0')>0.1);
    const patches=await sampledPage.evaluate(()=>{const engine=(window as any).__sampledEngine;return {fallback:engine.getFallbackParts(),voices:[...engine.orchestraMixer.voices.keys()]};});
    assert.deepEqual(patches.fallback,[]);assert.deepEqual(patches.voices.sort(),['P1:flute','P2:alto_sax','P3:flute']);assert.ok(requests.has('orchestral')&&requests.has('soundfont'));assert.ok([...sampleRequests.values()].every(count=>count===1),'Duplicate patches must share decoded sample loading.');
    await sampledPage.getByRole('button',{name:'Stop',exact:true}).click();await sampledPage.close();
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');fs.closeSync(log);fs.rmSync(root,{recursive:true,force:true});
  }
});
