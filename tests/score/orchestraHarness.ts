import * as Tone from 'tone';
import JSZip from 'jszip';
import { musicXmlPlayback } from '../../src/modules/score/engine/musicXmlPlayback';
import { OrchestraMixer, type PatchLoader } from '../../src/modules/score/engine/orchestraAudio';
import { DEFAULT_ORCHESTRA_MIX, orchestraNotes, type OrchestraMix } from '../../src/modules/score/engine/orchestraMix';
import type { PartData, NoteEvent } from '../../src/modules/score/engine/scorePlaybackParser';

const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
export function sourceChecks() {
  const note = (pitch = 'C', extra = '', voice = '1', staff = '1') => `<note><pitch><step>${pitch}</step><octave>4</octave></pitch><duration>1</duration><voice>${voice}</voice><type>quarter</type><staff>${staff}</staff>${extra}</note>`;
  const list = `<part-list><score-part id="p1"><part-name>Clarinet</part-name><midi-instrument id="i1"><midi-program>72</midi-program></midi-instrument></score-part><score-part id="p2"><part-name>Trumpet</part-name><midi-instrument id="i2"><midi-program>57</midi-program></midi-instrument></score-part></part-list>`;
  const raw = `<score-partwise>${list}<part id="p1"><measure number="1"><attributes><divisions>1</divisions><transpose><chromatic>0</chromatic></transpose></attributes><direction><direction-type><dynamics><p/></dynamics></direction-type></direction>${note()}</measure></part><part id="p2"><measure number="1"><attributes><divisions>1</divisions><transpose><chromatic>-2</chromatic></transpose></attributes><direction><direction-type><dynamics><ff/></dynamics></direction-type></direction>${note('D')}</measure></part></score-partwise>`;
  const tempos = [{ beat: 0, bpm: 120, timeInSeconds: 0 }];
  const parts = musicXmlPlayback(raw, [0], tempos);
  check(parts[0].notes[0].pitch === 60, 'Explicit zero transposition must produce C4/MIDI 60, not an inferred Bb transposition or octave offset.');
  check(parts[1].notes[0].pitch === 60, 'Written D4 on Bb trumpet must sound C4.');
  check(parts[0].notes[0].velocity! < parts[1].notes[0].velocity!, 'Dynamics must remain part-specific.');
  check(parts[0].notes[0].instrument === 'clarinet' && parts[1].notes[0].instrument === 'trumpet', 'GM patches must survive scheduling.');
  check(parts.every(p => p.notes.every(n => n.partId === p.id && !!n.sourceEventId)), 'Part identity and source provenance must survive parsing.');
  const concert = musicXmlPlayback(raw.replace('<transpose><chromatic>-2</chromatic></transpose>', ''), [0], tempos);
  check(concert[1].notes[0].pitch === 62, 'MusicXML without transpose must not be transposed by instrument name.');
  const octave = musicXmlPlayback(raw.replace('<chromatic>-2</chromatic>', '<chromatic>-2</chromatic><octave-change>1</octave-change>'), [0], tempos);
  check(octave[1].notes[0].pitch === 72, 'Octave transposition must be preserved.');
  const scope = `<score-partwise>${list}<part id="p1"><measure number="1"><attributes><divisions>1</divisions></attributes><direction><direction-type><dynamics><mp/></dynamics></direction-type></direction><direction><direction-type><dynamics><p/></dynamics></direction-type><staff>1</staff></direction><direction><direction-type><dynamics><ff/></dynamics></direction-type><voice>1</voice><staff>1</staff></direction>${note('C','','1','1')}<backup><duration>1</duration></backup>${note('E','','2','1')}<backup><duration>1</duration></backup>${note('G','','1','2')}</measure></part></score-partwise>`;
  const scoped = musicXmlPlayback(scope,[0],tempos)[0].notes;
  check(scoped[0].velocity === 0.9 && scoped[1].velocity === 0.45 && scoped[2].velocity === 0.55, 'Staff/voice dynamics must not bleed into other staves or voices.');
  const tie = `<score-partwise>${list}<part id="p1"><measure number="1"><attributes><divisions>1</divisions></attributes>${note('C','<tie type="start"/>')}${note('C','<tie type="stop"/>')}${note('C','<notations><slur type="start" number="1"/></notations>')}${note('C','<notations><slur type="stop" number="1"/></notations>')}</measure></part></score-partwise>`;
  const tied = musicXmlPlayback(tie,[0],tempos)[0].notes;
  check(tied.length === 3 && tied[0].durationBeats === 2 && tied[1].durationBeats === 1, 'Only ties merge; repeated notes under a slur must reattack.');
  const tempoTied = musicXmlPlayback(tie,[0],[...tempos,{beat:1,bpm:60,timeInSeconds:0.5}])[0].notes;
  check(tempoTied[0].duration === 1.5, 'A tied duration must follow tempo changes.');
  const percussion = `<score-partwise><part-list><score-part id="drums"><part-name>Percussion</part-name><midi-instrument id="snare"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument></score-part></part-list><part id="drums"><measure number="1"><attributes><divisions>1</divisions></attributes><note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><instrument id="snare"/></note></measure></part></score-partwise>`;
  const drum = musicXmlPlayback(percussion,[0],tempos)[0].notes[0];
  check(drum.pitch === 38 && drum.instrument === 'drum_38' && drum.isPercussion, 'Unpitched MIDI drum identity must be preserved.');
  const cue=musicXmlPlayback(raw.replace('<type>quarter</type>','<cue/><type>quarter</type>'),[0],tempos);
  check(cue[0].notes.length===0 && cue[1].notes.length===1,'Cue-only notes must not duplicate another instrument in playback.');
  const authored=musicXmlPlayback(raw.replace('<midi-program>72</midi-program>','<midi-program>72</midi-program><volume>40</volume><pan>-45</pan>'),[0],tempos);
  check(authored[0].volume===40 && authored[0].pan===-0.5,'Authored channel volume and placement must survive parsing.');
  return { sourceCases: 12, parts: parts.map(p => ({ id:p.id, pitch:p.notes[0].pitch, velocity:p.notes[0].velocity, patch:p.notes[0].instrument })) };
}

const event = (id: string, instrument = 'flute', pitch = 69): NoteEvent => ({ partId:id,instrument,sourceEventId:id,pitch,beat:0,time:0,duration:0.5,durationBeats:1,measureNumber:1,velocity:0.75,articulation:'',expressionKey:'mf' });
const part = (id: string, instrument = 'flute', pitch = 69): PartData => ({ id,name:id,soundfontInstrument:instrument,notes:[event(id,instrument,pitch)] });

async function render(parts: PartData[], settings: Partial<OrchestraMix> = {}, loader?: PatchLoader) {
  const mix = { ...DEFAULT_ORCHESTRA_MIX, ...settings };
  let mixer: OrchestraMixer | undefined;
  const sampled: PatchLoader = async () => {
    const buffer = new AudioBuffer({ length: 44100, numberOfChannels:1, sampleRate:44100 });
    const channel=buffer.getChannelData(0);
    for(let i=0;i<channel.length;i++)channel[i]=0.2*Math.sin(2*Math.PI*440*i/44100);
    return { A4:buffer };
  };
  const buffer = await Tone.Offline(async () => {
    const limiter = new Tone.Limiter(-3).toDestination();
    const headroom = new Tone.Gain(0.32).connect(limiter);
    mixer=new OrchestraMixer(headroom, loader ?? sampled);
    mixer.setMix(mix); await mixer.prepare(parts);
    for(const note of orchestraNotes(parts.flatMap(p=>p.notes),mix))mixer.trigger(note,0.5,0.05);
  },0.9,2,44100);
  const channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
  let peak=0,energy=0,count=0;
  for(const channel of channels)for(let i=0;i<channel.length;i++){const value=channel[i];check(Number.isFinite(value),'Rendered samples must be finite.');peak=Math.max(peak,Math.abs(value));if(i>=7000&&i<18000){energy+=value*value;count++;}}
  const fallback=mixer?.getFallbackParts() ?? [];
  mixer?.dispose();
  return {peak,rms:Math.sqrt(energy/count),fallback};
}

export async function audioChecks() {
  const parts=[part('guide'),part('backing')];
  const balanced=await render(parts);
  const clear=await render(parts,{mode:'clear'});
  check(balanced.rms > clear.rms*1.7, 'The clear renderer must actually reduce equivalent sample doubling.');
  const guideOnly=await render(parts,{practicePartId:'guide',orchestraLevel:0});
  const quietGuide=await render(parts,{practicePartId:'guide',orchestraLevel:0,guideLevel:25});
  check(quietGuide.rms > 0 && quietGuide.rms < guideOnly.rms*0.45, 'Guide fader must attenuate actual audio independently.');
  const muted=await render(parts,{mode:'clear',practicePartId:'guide',mutePracticePart:true});
  check(muted.rms > 0 && Math.abs(muted.rms-clear.rms)<0.001, 'Muting the guide must leave the doubled backing line audible.');
  const silent=await render(parts,{practicePartId:'guide',orchestraLevel:0,guideLevel:0});
  check(silent.peak < 1e-6,'Zero faders must silence the output.');
  const colours=await render([part('flute'),part('violin','violin')],{mode:'clear'});
  check(colours.rms > clear.rms*1.3,'Different timbres must both reach the renderer in Clear lines.');
  const dense=await render(Array.from({length:31},(_,i)=>part(`part_${i}`)));
  check(dense.peak < 0.95 && dense.peak > 0,'Dense unisons should retain output headroom in this reference render.');
  const fallback=await render([part('fallback')],{},async()=>null);
  check(fallback.rms > 0 && fallback.fallback.includes('fallback'),'Missing samples must produce an audible, identified synthesis fallback.');
  return { balanced, clear, guideOnly, quietGuide, muted, silent, colours, dense, fallback };
}

export async function fullScoreChecks() {
  const zip=await JSZip.loadAsync(await (await fetch('/sailing-with-whales-rossano-galante.mxl')).arrayBuffer());
  const container=new DOMParser().parseFromString(await zip.file('META-INF/container.xml')!.async('text'),'application/xml');
  const file=container.querySelector('rootfile')!.getAttribute('full-path')!;
  const parts=musicXmlPlayback(await zip.file(file)!.async('text'),[],[{beat:0,bpm:120,timeInSeconds:0}]);
  const notes=parts.flatMap(part=>part.notes);
  const balanced=orchestraNotes(notes,DEFAULT_ORCHESTRA_MIX);
  const clear=orchestraNotes(notes,{...DEFAULT_ORCHESTRA_MIX,mode:'clear'});
  check(parts.length===31 && notes.length>10000,'The complete 31-part score must parse, including percussion.');
  check(balanced.length===notes.length,'Balanced orchestra must retain every source event.');
  check(clear.length<balanced.length && clear.length>0,'Clear lines must remain a nonempty conservative reduction.');
  const mutedPart=parts[0].id;
  const muted=orchestraNotes(notes,{...DEFAULT_ORCHESTRA_MIX,mode:'clear',practicePartId:mutedPart,mutePracticePart:true});
  check(muted.every(note=>!note.contributingPartIds.includes(mutedPart)),'Muted part must not remain in a reduced group.');
  check(new Set(clear.map(note=>note.instrument)).size===new Set(notes.map(note=>note.instrument)).size,'Full-score reduction must retain every instrument patch.');
  check(notes.every(note=>Number.isFinite(note.pitch)&&Number.isFinite(note.time)&&note.duration>0),'Full-score events must have finite pitches and positive durations.');
  return {parts:parts.length,events:notes.length,balanced:balanced.length,clear:clear.length,patches:new Set(notes.map(n=>n.instrument)).size};
}
export async function sustainedMuteCheck() {
  let mixer: OrchestraMixer | undefined;
  const mix={...DEFAULT_ORCHESTRA_MIX,practicePartId:'guide',orchestraLevel:0};
  const rendered=await Tone.Offline(async()=>{
    const headroom=new Tone.Gain(0.32).toDestination();
    mixer=new OrchestraMixer(headroom,async()=>{
      const buffer=new AudioBuffer({length:44100,numberOfChannels:1,sampleRate:44100});
      const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.sin(2*Math.PI*440*i/44100)*0.2;
      return {A4:buffer};
    });
    mixer.setMix(mix);await mixer.prepare([part('guide')]);
    mixer.trigger(event('guide'),0.8,0.05);
    Tone.getContext().setTimeout(()=>mixer!.setMix({...mix,mutePracticePart:true}),0.25);
  },0.9,2,44100);
  const data=rendered.getChannelData(0);
  const energy=(a:number,b:number)=>Math.sqrt(data.slice(a,b).reduce((sum,v)=>sum+v*v,0)/(b-a));
  const before=energy(5000,9000),after=energy(22000,28000);
  mixer?.dispose();check(before>0 && after<before*0.15,'A live mute must silence an already sustained sample, not just future attacks.');
  return {before,after};
}
