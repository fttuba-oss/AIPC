/**
 * Student Practice Audio & Metronome Engine
 * Built with Tone.js
 * Modeled after Score Following Architecture:
 * - Transport Clock baseline (60 BPM * speedMultiplier)
 * - Exact dynamic BPM control: altering metronome marking alters playback speed immediately
 * - Independent mute/unmute for sound demo vs metronome
 * - Sub-millisecond tracker synchronization
 */

import * as Tone from 'tone';
import { beatToSeconds, secondsToBeats, type NoteEvent, type TempoChange } from './scorePlaybackParser';
import { loadOrchestralSampler } from './orchestralSampleEngine';

function loadSoundfontScript(catalog: string, instrument: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const globalMidi = (window as any).MIDI;
    if (globalMidi?.Soundfont?.[instrument]) {
      resolve(globalMidi.Soundfont[instrument]);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://gleitz.github.io/midi-js-soundfonts/${catalog}/${instrument}-mp3.js`;
    script.async = true;

    const timer = setTimeout(() => {
      reject(new Error(`Timeout loading soundfont ${instrument}`));
    }, 4000);

    script.onload = () => {
      clearTimeout(timer);
      const midiData = (window as any).MIDI?.Soundfont?.[instrument];
      if (midiData) {
        resolve(midiData);
      } else {
        reject(new Error(`Soundfont data for ${instrument} not found.`));
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Failed to load soundfont script for ${instrument}`));
    };
    document.body.appendChild(script);
  });
}

import { metronomeEvents, meterAtBeat, pulseQuarterNotes, countInPulses, type MetronomeMeasure, type MetronomeSubdivision } from './metronome';
export type { MetronomeSubdivision } from './metronome';

export interface SectionPlaybackConfig {
  intendedBpm?: number;
  bpm?: number;
  timeSignature: [number, number]; // [numerator, denominator]
  startMeasure: number;
  endMeasure: number;
  countInBeats?: number; // Counted pulses; omitted means one bar in the active metre.
  instrumentName?: string;
  notes?: NoteEvent[];
  startBeat?: number;
  totalBeats?: number;
  startFromBeat?: number;
  ladderLevel?: number;
  subdivision?: MetronomeSubdivision;
  tempos?: TempoChange[];
  metronomeMeasures?: MetronomeMeasure[];
}

export class StudentAudioEngine {
  private synth: Tone.PolySynth | null = null;
  private sampler: Tone.Sampler | null = null;
  private metronomeSynth: Tone.PolySynth | null = null;
  private hallReverb: Tone.Freeverb | null = null;

  private backingVolume: Tone.Volume | null = null;
  private metronomeVolume: Tone.Volume | null = null;

  private isAudioBackingMuted: boolean = false;
  private isMetronomeMuted: boolean = false;
  private isPlaying: boolean = false;

  private playbackGeneration = 0;
  private countInActive = false;
  private transportOriginRealSeconds = 0;
  private musicStartTransportSeconds = 0;
  private countInPulseDuration = 0;
  private countInTotal = 0;
  private countInShown = 0;
  private progressInterval: any = null;

  private onTickCallback: ((beatNumber: number, isCountIn: boolean) => void) | null = null;
  private onTimeUpdateCallback: ((timeSec: number, totalSec: number, elapsedRealSec?: number) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  private activeConfig: SectionPlaybackConfig | null = null;
  private intendedBpm: number = 120;
  private currentBpm: number = 120;
  private speedMultiplier: number = 1.0;

  private sectionDurationSeconds: number = 0;
  private sectionStartTimeSeconds: number = 0;
  private transportOriginScoreSeconds: number = 0;
  private soundfontLoadedInstrument: string | null = null;

  constructor() {
    // Lazy initialized on first user gesture
  }

  private ensureInitialized() {
    if (this.backingVolume) return;

    this.backingVolume = new Tone.Volume(0).toDestination();
    this.metronomeVolume = new Tone.Volume(-2).toDestination();
    this.backingVolume.mute = this.isAudioBackingMuted;
    this.metronomeVolume.mute = this.isMetronomeMuted;
    this.setBackingVolumePercent(this.backingVolumePercent);

    // Concert Hall Reverb space (adds authentic acoustic room presence and natural air)
    this.hallReverb = new Tone.Freeverb({
      roomSize: 0.65,
      dampening: 3400,
      wet: 0.16,
    }).connect(this.backingVolume);

    // High quality expressive synth fallback
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.7,
        release: 0.1,
      },
    }).connect(this.hallReverb);

    // Crisp metronome click synth
    this.metronomeSynth = new Tone.PolySynth(Tone.MembraneSynth, {
      pitchDecay: 0.008,
      octaves: 2,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.035,
        sustain: 0.0,
        release: 0.02,
      },
    }).connect(this.metronomeVolume);
  }

  async preloadSoundfont(instrument: string = 'trumpet') {
    if (this.soundfontLoadedInstrument === instrument && this.sampler) return;
    this.ensureInitialized();

    const outputBus = this.hallReverb || this.backingVolume!;

    // 1. Primary: Real Acoustic Orchestral Instrument (VSCO 2 CE & Iowa EMS)
    try {
      const acousticSampler = await loadOrchestralSampler(instrument, outputBus);
      if (acousticSampler) {
        if (this.sampler) {
          try { this.sampler.dispose(); } catch { /* ignore */ }
        }
        this.sampler = acousticSampler;
        this.soundfontLoadedInstrument = instrument;
        console.log(`[StudentAudioEngine] Real acoustic orchestral instrument (${instrument}) loaded via VSCO 2 CE.`);
        return;
      }
    } catch (acousticErr) {
      console.warn(`[StudentAudioEngine] Orchestral sampler failed for ${instrument}, attempting legacy fallback`, acousticErr);
    }

    // 2. Secondary: MusyngKite Soundfont
    try {
      const soundData = await loadSoundfontScript('MusyngKite', instrument);
      this.sampler = await new Promise<Tone.Sampler>((resolve) => {
        const s = new Tone.Sampler({
          urls: soundData,
          onload: () => resolve(s),
        }).connect(outputBus);
      });
      this.soundfontLoadedInstrument = instrument;
      console.log(`[StudentAudioEngine] Soundfont for ${instrument} loaded successfully.`);
    } catch (e) {
      console.warn(`[StudentAudioEngine] Using PolySynth fallback for ${instrument}`, e);
    }
  }

  private partMix: Map<string, number> = new Map();

  /** Live per-part gain (0 = silent). Read at trigger time, so it applies during playback too. */
  setPartMix(mix: Record<string, number>) {
    this.partMix = new Map(Object.entries(mix));
  }

  private samplerByInstrument: Map<string, Tone.Sampler> = new Map();

  /** Loads (once) a sampler for each instrument id so every part can sound like its own instrument. */
  async preloadInstruments(instruments: string[]) {
    this.ensureInitialized();
    const outputBus = this.hallReverb || this.backingVolume!;
    const unique = Array.from(new Set(instruments.filter(Boolean)));
    await Promise.all(unique.map(async (inst) => {
      if (this.samplerByInstrument.has(inst)) return;
      try {
        const s = await loadOrchestralSampler(inst, outputBus);
        if (s) { this.samplerByInstrument.set(inst, s); return; }
      } catch { /* try legacy soundfont below */ }
      try {
        const data = await loadSoundfontScript('MusyngKite', inst);
        const s = await new Promise<Tone.Sampler>((resolve) => {
          const smp = new Tone.Sampler({ urls: data, onload: () => resolve(smp) }).connect(outputBus);
        });
        this.samplerByInstrument.set(inst, s);
      } catch (e) {
        console.warn('[StudentAudioEngine] No sampler for ' + inst + ', using default voice', e);
      }
    }));
  }

  private triggerNote(note: NoteEvent, noteName: string, duration: number, time: number, baseVelocity: number) {
    const gain = note.partId !== undefined && this.partMix.has(note.partId) ? this.partMix.get(note.partId)! : 1;
    if (gain <= 0) return;
    const velocity = Math.max(0.05, Math.min(1, baseVelocity * gain));
    const instrument = note.instrument;
    const own = instrument ? this.samplerByInstrument.get(instrument) : undefined;
    if (own && own.loaded) {
      own.triggerAttackRelease(noteName, duration, time, velocity);
    } else if (this.sampler && this.sampler.loaded) {
      this.sampler.triggerAttackRelease(noteName, duration, time, velocity);
    } else if (this.synth) {
      this.synth.triggerAttackRelease(noteName, duration, time, velocity);
    }
  }
  private backingVolumePercent: number = 75;

  /** Reference MIDI master volume, 0-100 (75 = unity gain). */
  setBackingVolumePercent(percent: number) {
    this.backingVolumePercent = Math.max(0, Math.min(100, percent));
    if (this.backingVolume) {
      this.backingVolume.volume.value = this.backingVolumePercent <= 0
        ? -60
        : Math.max(-60, 20 * Math.log10(this.backingVolumePercent / 75));
    }
  }

  setAudioBackingMuted(muted: boolean) {
    this.isAudioBackingMuted = muted;
    if (this.backingVolume) {
      this.backingVolume.mute = muted;
    }
  }

  private activeSubdivision: MetronomeSubdivision = 'quarter';

  setSubdivision(sub: MetronomeSubdivision) {
    if (sub === this.activeSubdivision) return;
    this.activeSubdivision = sub;
    if (this.activeConfig) this.activeConfig.subdivision = sub;
    if (this.isPlaying && !this.countInActive) this.rebuildFromCurrentPosition();
  }

  getSubdivision(): MetronomeSubdivision { return this.activeSubdivision; }

  setMetronomeMuted(muted: boolean) {
    this.isMetronomeMuted = muted;
    if (this.metronomeVolume) this.metronomeVolume.mute = muted;
  }

  setBpm(newBpm: number) {
    const clamped = Math.max(30, Math.min(300, Math.round(newBpm * 1000) / 1000));
    if (clamped === this.getCurrentBpm()) return;
    // Capture score position using the OLD speed before changing it.
    const position = this.getScorePlaybackSeconds();
    const remainingCountPulses = this.countInActive
      ? Math.max(0, (this.musicStartTransportSeconds - this.transportSeconds()) / this.countInPulseDuration) : 0;
    const baseline = position !== null ? this.tempoAtBeat(this.scoreBeat(position)) : this.intendedBpm;
    this.currentBpm = clamped;
    this.speedMultiplier = clamped / baseline;
    if (!this.isPlaying || !this.activeConfig) return;
    if (this.countInActive) {
      // Recount the remaining audible pulses at the new tempo, on the audio clock.
      const remaining = Math.max(0, this.countInTotal - this.countInShown);
      this.schedulePlayback(this.transportOriginScoreSeconds, remaining, this.countInShown,
        Math.max(0, remainingCountPulses - remaining));
    } else if (position !== null) {
      this.scheduleRemaining(position);
    }
  }

  setSpeedMultiplier(multiplier: number) { this.setBpm(this.intendedBpm * multiplier); }
  getIntendedBpm(): number { return this.intendedBpm; }
  getCurrentBpm(): number {
    if (!this.isPlaying || this.countInActive) return this.currentBpm;
    const seconds = this.getScorePlaybackSeconds();
    return seconds === null ? this.currentBpm : Math.round(this.tempoAtBeat(this.scoreBeat(seconds)) * this.speedMultiplier * 1000) / 1000;
  }
  getSpeedMultiplier(): number { return this.speedMultiplier; }
  setOnTick(cb: (beatNumber: number, isCountIn: boolean) => void) { this.onTickCallback = cb; }
  setOnTimeUpdate(cb: (timeSec: number, totalSec: number, elapsedRealSec?: number) => void) { this.onTimeUpdateCallback = cb; }
  setOnEnd(cb: () => void) { this.onEndCallback = cb; }

  private transportSeconds(): number {
    // Tone's scheduling clock includes look-ahead. Visuals use the audible clock instead.
    return Math.max(0, Tone.Transport.getSecondsAtTime(Tone.immediate()));
  }
  getElapsedPlaybackSeconds(): number {
    return this.isPlaying ? Math.max(0, this.transportSeconds() - this.musicStartTransportSeconds) : 0;
  }
  getScorePlaybackSeconds(): number | null {
    if (!this.isPlaying || this.countInActive) return null;
    return this.transportOriginScoreSeconds
      + Math.max(0, this.transportSeconds() - this.transportOriginRealSeconds) * this.speedMultiplier;
  }
  private scoreSeconds(beat: number): number {
    return this.activeConfig?.tempos?.length
      ? beatToSeconds(beat, this.activeConfig.tempos) : beat * 60 / this.intendedBpm;
  }
  private scoreBeat(seconds: number): number {
    return this.activeConfig?.tempos?.length
      ? secondsToBeats(seconds, this.activeConfig.tempos) : seconds * this.intendedBpm / 60;
  }
  private tempoAtBeat(beat: number): number {
    let bpm = this.intendedBpm;
    for (const t of this.activeConfig?.tempos || []) { if (t.beat > beat) break; bpm = t.bpm; }
    return bpm;
  }
  private sectionBounds() {
    const config = this.activeConfig!;
    const barLength = config.timeSignature[0] * 4 / config.timeSignature[1];
    const start = config.startBeat ?? (config.startMeasure - 1) * barLength;
    const end = start + (config.totalBeats ?? (config.endMeasure - config.startMeasure + 1) * barLength);
    return { start, end };
  }
  private measures(): MetronomeMeasure[] {
    const config = this.activeConfig!;
    if (config.metronomeMeasures?.length) return config.metronomeMeasures;
    const { start, end } = this.sectionBounds();
    const [numerator, denominator] = config.timeSignature;
    const length = numerator * 4 / denominator;
    const result: MetronomeMeasure[] = [];
    for (let beat = start, n = config.startMeasure; beat < end - 1e-7; beat += length, n++) {
      result.push({ startBeat: beat, endBeat: Math.min(end, beat + length), measureNumber: n, numerator, denominator });
    }
    return result;
  }

  async startSectionPlayback(config: SectionPlaybackConfig, requestedBpm?: number) {
    this.stop();
    const generation = this.playbackGeneration;
    await Tone.start();
    if (generation !== this.playbackGeneration) return;
    this.ensureInitialized();
    await this.preloadInstruments((config.notes || []).map(n => n.instrument ?? ''));
    if (generation !== this.playbackGeneration) return;
    this.activeConfig = config;
    this.intendedBpm = config.intendedBpm ?? config.bpm ?? 120;
    const originBeat = config.startFromBeat ?? config.startBeat ?? 0;
    // The BPM control sets the tempo at the selected start, even after a score tempo change.
    const originTempo = this.tempoAtBeat(originBeat);
    this.currentBpm = requestedBpm ?? config.bpm ?? originTempo;
    this.speedMultiplier = this.currentBpm / originTempo;
    this.intendedBpm = originTempo;
    if (config.subdivision) this.activeSubdivision = config.subdivision;
    const { start, end } = this.sectionBounds();
    const beat = Math.max(start, Math.min(end - 1e-7, config.startFromBeat ?? start));
    this.sectionStartTimeSeconds = this.scoreSeconds(start);
    this.sectionDurationSeconds = this.scoreSeconds(end) - this.sectionStartTimeSeconds;
    const meter = meterAtBeat(this.measures(), beat, { numerator: config.timeSignature[0], denominator: config.timeSignature[1] });
    this.isPlaying = true;
    this.schedulePlayback(this.scoreSeconds(beat), config.countInBeats ?? countInPulses(meter.numerator, meter.denominator));
  }

  /** Count-in and music share one transport; no browser timers determine audible beats. */
  private schedulePlayback(originScoreSeconds: number, count: number, shownOffset = 0, firstDelayPulses = 0) {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = 60;
    if (this.progressInterval) clearInterval(this.progressInterval);
    const generation = ++this.playbackGeneration;
    this.countInTotal = shownOffset + count;
    this.countInShown = shownOffset;
    this.countInActive = count > 0 || firstDelayPulses > 0;
    this.transportOriginScoreSeconds = originScoreSeconds;
    const config = this.activeConfig!;
    const meter = meterAtBeat(this.measures(), this.scoreBeat(originScoreSeconds), { numerator: config.timeSignature[0], denominator: config.timeSignature[1] });
    this.countInPulseDuration = pulseQuarterNotes(meter.numerator, meter.denominator) * 60 / this.currentBpm;
    this.musicStartTransportSeconds = (count + firstDelayPulses) * this.countInPulseDuration;
    this.transportOriginRealSeconds = this.musicStartTransportSeconds;
    for (let i = 0; i < count; i++) {
      Tone.Transport.schedule((time) => {
        if (generation !== this.playbackGeneration) return;
        if (!this.isMetronomeMuted) this.metronomeSynth?.triggerAttackRelease(shownOffset + i === 0 ? 'C6' : 'G5', 0.035, time);
        Tone.Draw.schedule(() => {
          if (generation !== this.playbackGeneration) return;
          this.countInShown = shownOffset + i + 1;
          this.onTickCallback?.(shownOffset + i + 1, true);
        }, time);
      }, (i + firstDelayPulses) * this.countInPulseDuration);
    }
    Tone.Transport.schedule((time) => Tone.Draw.schedule(() => {
      if (generation !== this.playbackGeneration) return;
      this.countInActive = false;
      this.onTickCallback?.(1, false);
    }, time), this.musicStartTransportSeconds);
    this.scheduleEvents(this.scoreBeat(originScoreSeconds), this.musicStartTransportSeconds, generation);
    this.startProgressUpdates();
    Tone.Transport.start();
  }

  private rebuildFromCurrentPosition() {
    const position = this.getScorePlaybackSeconds();
    if (position !== null) this.scheduleRemaining(position);
  }
  private scheduleRemaining(scoreSeconds: number) {
    const beat = this.scoreBeat(scoreSeconds);
    if (beat >= this.sectionBounds().end - 1e-7) { this.finishPlayback(); return; }
    // Keep the transport running. Only replace future events, at the current score position.
    const now = this.transportSeconds();
    Tone.Transport.cancel(now);
    const generation = ++this.playbackGeneration;
    this.transportOriginScoreSeconds = scoreSeconds;
    this.transportOriginRealSeconds = now;
    this.scheduleEvents(beat, now, generation);
    this.onTimeUpdateCallback?.(scoreSeconds, this.sectionDurationSeconds, this.getElapsedPlaybackSeconds());
  }

  private scheduleEvents(fromBeat: number, fromRealSeconds: number, generation: number) {
    const config = this.activeConfig!;
    const endBeat = this.sectionBounds().end;
    const startSeconds = this.scoreSeconds(fromBeat);
    const at = (beat: number) => fromRealSeconds + (this.scoreSeconds(beat) - startSeconds) / this.speedMultiplier;
    const clicks = metronomeEvents(this.measures(), fromBeat, endBeat, this.activeSubdivision, config.ladderLevel);
    for (const click of clicks) {
      Tone.Transport.schedule((time) => {
        if (generation !== this.playbackGeneration) return;
        if (!this.isMetronomeMuted) {
          const pitch = click.subdivision ? (click.subdivision === 2 ? 'G4' : 'E4') : click.downbeat ? 'C6' : 'G5';
          this.metronomeSynth?.triggerAttackRelease(pitch, 0.035, time, click.subdivision ? 0.4 : 0.8);
        }
        if (!click.subdivision) Tone.Draw.schedule(() => {
          if (generation === this.playbackGeneration) this.onTickCallback?.(click.beatNumber, false);
        }, time);
      }, at(click.beat));
    }
    for (const note of config.notes || []) {
      if (note.measureNumber < config.startMeasure || note.measureNumber > config.endMeasure || note.beat < fromBeat - 1e-7 || note.beat >= endBeat) continue;
      const duration = Math.max(0.04, (this.scoreSeconds(note.beat + note.durationBeats) - this.scoreSeconds(note.beat)) / this.speedMultiplier - 0.015);
      Tone.Transport.schedule((time) => {
        if (generation !== this.playbackGeneration || this.isAudioBackingMuted) return;
        this.triggerNote(note, Tone.Frequency(note.pitch, 'midi').toNote(), duration, time, note.velocity ?? 0.8);
      }, at(note.beat));
    }
    Tone.Transport.schedule((time) => Tone.Draw.schedule(() => {
      if (generation === this.playbackGeneration) this.finishPlayback();
    }, time), at(endBeat));
  }

  private startProgressUpdates() {
    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsed = this.transportSeconds();
      if (this.countInActive && elapsed < this.musicStartTransportSeconds) {
        this.onTimeUpdateCallback?.(-(this.musicStartTransportSeconds - elapsed) * this.speedMultiplier, this.sectionDurationSeconds);
        return;
      }
      this.countInActive = false;
      const seconds = this.getScorePlaybackSeconds();
      if (seconds !== null) this.onTimeUpdateCallback?.(seconds, this.sectionDurationSeconds, this.getElapsedPlaybackSeconds());
    }, 35);
  }

  private finishPlayback() {
    this.stop();
    this.onEndCallback?.();
  }

  seekToScoreBeat(targetScoreBeat: number, targetBpm?: number) {
    if (!this.activeConfig) return;
    const { start, end } = this.sectionBounds();
    const beat = Math.max(start, Math.min(end - 1e-7, targetScoreBeat));
    if (targetBpm !== undefined) {
      const tempo = this.tempoAtBeat(beat);
      this.intendedBpm = tempo;
      this.currentBpm = Math.max(30, Math.min(300, targetBpm));
      this.speedMultiplier = this.currentBpm / tempo;
    }
    if (this.isPlaying) {
      const seconds = this.scoreSeconds(beat);
      if (this.countInActive) this.schedulePlayback(seconds, this.countInTotal);
      else this.scheduleRemaining(seconds);
    }
  }

  stop() {
    ++this.playbackGeneration;
    if (this.progressInterval) { clearInterval(this.progressInterval); this.progressInterval = null; }
    if (this.isPlaying) { Tone.Transport.stop(); Tone.Transport.cancel(); }
    this.isPlaying = false;
    this.countInActive = false;
  }
  getIsPlaying(): boolean { return this.isPlaying; }

  getSectionStartTime(): number {
    return this.sectionStartTimeSeconds;
  }

  getActiveConfig(): SectionPlaybackConfig | null {
    return this.activeConfig;
  }
}
