import * as Tone from 'tone';
import type { NoteEvent, PartData } from './scorePlaybackParser';
import { DEFAULT_ORCHESTRA_MIX, instrumentBalance, partBalance, partLevel, type InstrumentFamily, type OrchestraMix } from './orchestraMix';
import { matchOrchestralPreset } from './orchestralSampleEngine';

export type PatchBuffers = Record<string, AudioBuffer>;
export type PatchLoader = (instrument: string) => Promise<PatchBuffers | null>;
const patchCache = new Map<string, Promise<PatchBuffers | null>>();
const scriptCache = new Map<string, Promise<Record<string, string> | null>>();

function decodeSamples(urls: Record<string, string>, baseUrl = ''): Promise<PatchBuffers | null> {
  return new Promise(resolve => {
    let done = false;
    let bank: Tone.ToneAudioBuffers | undefined;
    const finish = (result: PatchBuffers | null) => {
      if (done) return;
      done = true; clearTimeout(timer); bank?.dispose(); resolve(result);
    };
    const timer = setTimeout(() => finish(null), 5000);
    try {
      bank = new Tone.ToneAudioBuffers({ urls, baseUrl,
        onload: () => {
          const decoded: PatchBuffers = {};
          for (const key of Object.keys(urls)) {
            const buffer = bank?.get(key).get();
            if (buffer) decoded[key] = buffer;
          }
          finish(Object.keys(decoded).length ? decoded : null);
        },
        onerror: () => finish(null),
      });
    } catch { finish(null); }
  });
}
function soundfontUrls(instrument: string): Promise<Record<string, string> | null> {
  if (!/^[a-z_0-9]+$/.test(instrument)) return Promise.resolve(null);
  if (scriptCache.has(instrument)) return scriptCache.get(instrument)!;
  const pending = new Promise<Record<string, string> | null>(resolve => {
    const existing = (window as any).MIDI?.Soundfont?.[instrument];
    if (existing) { resolve(existing); return; }
    const script = document.createElement('script');
    const finish = (value: Record<string, string> | null) => {
      clearTimeout(timer); script.onload = script.onerror = null; script.remove(); resolve(value);
    };
    const timer = setTimeout(() => finish(null), 4000);
    script.onload = () => finish((window as any).MIDI?.Soundfont?.[instrument] ?? null);
    script.onerror = () => finish(null);
    script.src = `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/${instrument}-mp3.js`;
    document.head.appendChild(script);
  });
  scriptCache.set(instrument, pending); return pending;
}

/** Share immutable decoded buffers, never a sounding sampler, between independently mixed parts. */
export const loadPatchBuffers: PatchLoader = (instrument) => {
  if (instrument.startsWith('drum_')) return Promise.resolve(null);
  if (patchCache.has(instrument)) return patchCache.get(instrument)!;
  const pending = (async () => {
    const preset = matchOrchestralPreset(instrument);
    // Do not substitute a solo patch for an ensemble or a differently named instrument.
    if (preset && (preset.id === instrument || instrument === 'acoustic_grand_piano' && preset.id === 'piano')) {
      const decoded = await decodeSamples(preset.samples, `https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/${preset.folder}/`);
      if (decoded) return decoded;
    }
    const legacy = await soundfontUrls(instrument);
    return legacy ? decodeSamples(legacy) : null;
  })();
  patchCache.set(instrument, pending); return pending;
};

interface PartChannel { gain: Tone.Gain; pan: Tone.Panner; calibration: number }
interface Voice {
  trigger(note: string, duration: number, time: number, velocity: number): void;
  release(time?: number): void;
  dispose(): void;
}

/** Part buses provide live gain/pan without changing expressive note velocities. */
export class OrchestraMixer {
  private channels = new Map<string, PartChannel>();
  private voices = new Map<string, Voice>();
  private pending = new Map<string, Promise<void>>();
  private sections = new Map<InstrumentFamily, Tone.Gain>();
  private dry: Tone.Gain;
  private send: Tone.Gain;
  private reverb: Tone.Freeverb;
  private settings = { ...DEFAULT_ORCHESTRA_MIX };
  private overrides: Record<string, number> = {};
  private unavailable = new Set<string>();
  private disposed = false;

  constructor(destination: Tone.ToneAudioNode, private loader: PatchLoader = loadPatchBuffers) {
    this.dry = new Tone.Gain(0.94).connect(destination);
    this.reverb = new Tone.Freeverb({ wet: 1, roomSize: 0.35, dampening: 4500 }).connect(destination);
    this.send = new Tone.Gain(0.06).connect(this.reverb);
    for (const family of ['woodwinds', 'brass', 'strings', 'percussion', 'other'] as InstrumentFamily[]) {
      const bus = new Tone.Gain(1); bus.connect(this.dry); bus.connect(this.send); this.sections.set(family, bus);
    }
  }
  async prepare(parts: readonly PartData[]): Promise<void> {
    const balance = partBalance(parts);
    const jobs: Promise<void>[] = [];
    for (const part of parts) {
      if (this.disposed) return;
      if (!this.channels.has(part.id)) {
        const calibration = balance.get(part.id)!;
        const pan = new Tone.Panner(calibration.pan).connect(this.sections.get(calibration.family)!);
        const gain = new Tone.Gain(calibration.gain * partLevel(part.id, this.settings, this.overrides)).connect(pan);
        this.channels.set(part.id, { gain, pan, calibration: calibration.gain });
      }
      for (const patch of new Set(part.notes.map(n => n.instrument ?? part.soundfontInstrument))) {
        const key = `${part.id}:${patch}`;
        if (this.voices.has(key)) continue;
        if (!this.pending.has(key)) this.pending.set(key, this.createVoice(part, patch, key));
        jobs.push(this.pending.get(key)!);
      }
    }
    await Promise.all(jobs);
  }
  private async createVoice(part: PartData, patch: string, key: string) {
    const samples = await this.loader(patch);
    if (this.disposed) return;
    const channel = this.channels.get(part.id)!.gain;
    if (samples) {
      const sampler = new Tone.Sampler({ urls: samples, attack: 0.008, release: 0.12 }).connect(channel);
      this.voices.set(key, {
        trigger: (note, duration, time, velocity) => sampler.triggerAttackRelease(note, duration, time, velocity),
        release: time => sampler.releaseAll(time), dispose: () => sampler.dispose(),
      });
    } else if (patch.startsWith('drum_')) {
      // Percussion stays an independent voice/drum identity and is never pitch-deduplicated.
      const pitch = Number(patch.slice(5));
      if ([42, 44, 46, 49, 51, 52, 55, 57, 59].includes(pitch)) {
        const noise = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 }, volume: -12 }).connect(channel);
        this.voices.set(key, { trigger: (_note, duration, time, velocity) => noise.triggerAttackRelease(Math.min(duration, 0.12), time, velocity), release: time => noise.triggerRelease(time), dispose: () => noise.dispose() });
      } else {
        const drum = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }, volume: -8 }).connect(channel);
        this.voices.set(key, { trigger: (note, duration, time, velocity) => drum.triggerAttackRelease(note, Math.min(duration, 0.15), time, velocity), release: time => drum.triggerRelease(time), dispose: () => drum.dispose() });
      }
    } else {
      this.unavailable.add(part.name);
      const family = instrumentBalance(patch).family;
      const synth = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 24, options: { oscillator: { type: family === 'woodwinds' ? 'sine' : 'triangle' },
        envelope: { attack: 0.015, decay: 0.08, sustain: 0.65, release: 0.1 } }, volume: -6,
      }).connect(channel);
      this.voices.set(key, { trigger: (note, duration, time, velocity) => synth.triggerAttackRelease(note, duration, time, velocity), release: time => synth.releaseAll(time), dispose: () => synth.dispose() });
    }
  }
  setMix(settings: OrchestraMix, overrides: Record<string, number> = {}) {
    this.settings = { ...settings }; this.overrides = { ...overrides };
    for (const [id, channel] of this.channels) channel.gain.gain.rampTo(channel.calibration * partLevel(id, settings, overrides), 0.02);
  }
  trigger(note: NoteEvent, duration: number, time: number) {
    if (this.disposed || !note.partId || partLevel(note.partId, this.settings, this.overrides) <= 0) return;
    const voice = this.voices.get(`${note.partId}:${note.instrument}`);
    voice?.trigger(Tone.Frequency(note.pitch, 'midi').toNote(), duration, time, Math.max(0, Math.min(1, note.velocity ?? 0.75)));
  }
  releaseAll(time?: number) { for (const voice of this.voices.values()) voice.release(time); }
  getFallbackParts() { return [...this.unavailable]; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of this.voices.values()) voice.dispose();
    for (const channel of this.channels.values()) { channel.gain.dispose(); channel.pan.dispose(); }
    for (const section of this.sections.values()) section.dispose();
    this.dry.dispose(); this.send.dispose(); this.reverb.dispose(); this.voices.clear(); this.channels.clear();
  }
}
