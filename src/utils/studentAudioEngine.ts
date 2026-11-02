import { partDynamicAt, REFERENCE_DYNAMIC, type PartDynamics } from './scoreDynamics';
import { articulatedGate } from './noteArticulation';
import { FluidR3Player } from './fluidR3Player';
import { VscoPercussion, sampleFamily } from './vscoPercussion';
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
import { ensembleFrames, ensembleGains } from './ensembleBalance';
import { beatToSeconds, secondsToBeats, type NoteEvent, type TempoChange } from './scorePlaybackParser';


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
  dynamics?: PartDynamics[];
  metronomeMeasures?: MetronomeMeasure[];
}

export class StudentAudioEngine {
  private metronomeSynth: Tone.PolySynth | null = null;
  private hallReverb: Tone.Freeverb | null = null;
  private outputLimiter: Tone.Limiter | null = null;
  private automaticBalance = false;
  private partBuses = new Map<string, Tone.Gain>();
  private fluid = new FluidR3Player();
  private percussion = new VscoPercussion();
  private dynamicLevels = new Map<string, number>();
  private dynamicBeat = 0;
  private fluidRoutes = new Map<string, { partId: string; staff: number }>();
  private balanceFrames = new Map<number, NoteEvent[]>();

  setAutomaticBalance(enabled: boolean) {
    this.automaticBalance = enabled;
    this.refreshPartGains(Tone.now());
  }

  private partBus(id: string): Tone.Gain {
    let bus = this.partBuses.get(id);
    if (!bus) {
      bus = new Tone.Gain(this.partMix.get(id) ?? 1).connect(this.hallReverb || this.backingVolume!);
      this.partBuses.set(id, bus);
    }
    return bus;
  }

  private currentBalanceNotes: NoteEvent[] = [];
  private refreshPartGains(time: number, immediate = false) {
    const automatic = this.automaticBalance
      ? ensembleGains(this.currentBalanceNotes, this.partMix) : new Map<string, number>();
    for (const [route, part] of this.fluidRoutes) {
      const level = this.activeConfig?.dynamics?.length
        ? partDynamicAt(this.activeConfig.dynamics, part.partId, this.dynamicBeat, part.staff) / REFERENCE_DYNAMIC : 1;
      this.fluid.gain(route, (this.partMix.get(part.partId) ?? 1) * (automatic.get(part.partId) ?? 1) * level, time);
    }
    for (const [id, bus] of this.partBuses) {
      this.percussion.expression(id, this.dynamicLevels.get(id) ?? 1, time);
      const gain = (this.partMix.get(id) ?? 1) * (automatic.get(id) ?? 1);
      bus.gain.cancelScheduledValues(time);
      if (immediate) bus.gain.setValueAtTime(gain, time);
      else bus.gain.setTargetAtTime(gain, time, 0.025);
    }
  }

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

  constructor() {
    // Lazy initialized on first user gesture
  }

  private ensureInitialized() {
    if (this.backingVolume) return;

    this.outputLimiter = new Tone.Limiter(-1).toDestination();
    this.backingVolume = new Tone.Volume(-6).connect(this.outputLimiter);
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

  private partMix: Map<string, number> = new Map();

  /** Live per-part gain (0 = silent). Read at trigger time, so it applies during playback too. */
  setPartMix(mix: Record<string, number>) {
    this.partMix = new Map(Object.entries(mix));
    this.refreshPartGains(Tone.now());
  }

  async preloadInstruments(instruments: (string | { id: string; instrument: string; drum?: boolean })[]) {
    this.ensureInitialized();
    const parts = new Map(instruments.map(value => typeof value === 'string'
      ? [value, { id: value, instrument: value }] : [value.id, value]));
    if (parts.size) await this.fluid.prepare([...parts.values()], this.hallReverb!);
    this.refreshPartGains(Tone.now(), true);
  }

  private triggerNote(note: NoteEvent, noteName: string, duration: number, time: number, baseVelocity: number) {
    const id = note.partId ?? note.instrument ?? 'default';
    if ((this.partMix.get(id) ?? 1) <= 0) return;
    const velocity = Math.max(0, Math.min(1, baseVelocity));
    if (velocity === 0) return;
    if (this.percussion.play(note, time, duration, velocity, !!this.activeConfig?.dynamics?.length)) return;
    this.fluid.play(id + ':staff:' + (note.staffNumber ?? 1) + (note.percussion !== undefined ? ':gm-drums' : ''), note.pitch, velocity, time, duration);
  }

  private backingVolumePercent: number = 75;

  /** Reference MIDI master volume, 0-100 (75 = unity gain). */
  setBackingVolumePercent(percent: number) {
    this.backingVolumePercent = Math.max(0, Math.min(100, percent));
    if (this.backingVolume) {
      this.backingVolume.volume.value = this.backingVolumePercent <= 0
        ? -60
        : Math.max(-60, -6 + 20 * Math.log10(this.backingVolumePercent / 75));
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
    this.fluidRoutes.clear();
    const parts = (config.notes || []).filter(note => !sampleFamily(note)).map(note => {
      const partId = note.partId ?? note.instrument ?? 'default';
      const staff = note.staffNumber ?? 1;
      const id = partId + ':staff:' + staff + (note.percussion !== undefined ? ':gm-drums' : '');
      this.fluidRoutes.set(id, { partId, staff });
      return { id, instrument: note.percussion !== undefined ? 'piano' : note.instrument ?? 'trumpet', drum: note.percussion !== undefined };
    });
    await Promise.all([
      this.preloadInstruments(parts),
      this.percussion.prepare(config.notes || [], id => this.partBus(id)),
    ]);
    this.balanceFrames = ensembleFrames(config.notes || []);
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
    this.releaseBackingVoices();
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
    this.releaseBackingVoices();
    const beat = this.scoreBeat(scoreSeconds);
    if (beat >= this.sectionBounds().end - 1e-7) { this.finishPlayback(); return; }
    // Keep the transport running. Only replace future events, at the current score position.
    const now = Tone.Transport.getSecondsAtTime(Tone.now()) + 0.01;
    Tone.Transport.cancel(this.transportSeconds());
    const generation = ++this.playbackGeneration;
    this.transportOriginScoreSeconds = scoreSeconds;
    this.transportOriginRealSeconds = now;
    this.scheduleEvents(beat, now, generation);
    this.onTimeUpdateCallback?.(scoreSeconds, this.sectionDurationSeconds, this.getElapsedPlaybackSeconds());
  }

  private applyDynamics(beat: number) {
    this.dynamicBeat = beat;
    this.dynamicLevels.clear();
    const tracks = this.activeConfig?.dynamics;
    if (!tracks?.length) return;
    for (const id of new Set(tracks.map(track => track.partId))) {
      this.dynamicLevels.set(id, partDynamicAt(tracks, id, beat) / REFERENCE_DYNAMIC);
    }
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
    this.applyDynamics(fromBeat);
    const expressionBeats = new Set<number>();
    for (const track of config.dynamics || []) {
      for (let i = 0; i < track.points.length; i++) {
        const point = track.points[i];
        if (point.beat > fromBeat && point.beat < endBeat) expressionBeats.add(point.beat);
        const previous = track.points[i - 1];
        if (!point.ramp || !previous || point.beat <= fromBeat || previous.beat >= endBeat) continue;
        const start = this.scoreSeconds(Math.max(previous.beat, fromBeat));
        const end = this.scoreSeconds(Math.min(point.beat, endBeat));
        for (let seconds = start; seconds < end; seconds += 0.05 * this.speedMultiplier) expressionBeats.add(this.scoreBeat(seconds));
      }
    }
    for (const beat of [...expressionBeats].sort((a, b) => a - b)) Tone.Transport.schedule(time => {
      if (generation !== this.playbackGeneration) return;
      this.applyDynamics(beat); this.refreshPartGains(time);
    }, at(beat));
    this.currentBalanceNotes = (config.notes || []).filter(n => n.beat <= fromBeat && n.beat + n.durationBeats > fromBeat);
    this.refreshPartGains(Tone.now(), true);
    for (const [beat, active] of this.balanceFrames) {
      if (beat < fromBeat || beat >= endBeat) continue;
      Tone.Transport.schedule(time => {
        if (generation !== this.playbackGeneration) return;
        this.currentBalanceNotes = active;
        this.applyDynamics(beat); this.refreshPartGains(time);
      }, at(beat));
    }
    for (const note of config.notes || []) {
      const noteEnd = note.beat + note.durationBeats;
      if (note.beat >= endBeat || (note.percussionGrace ? note.beat < fromBeat - 1e-7 : noteEnd <= fromBeat + 1e-7)) continue;
      const eventBeat = Math.max(note.beat, fromBeat);
      const eventNote = eventBeat > note.beat ? { ...note, beat: eventBeat,
        velocity: config.dynamics?.length && note.partId ? partDynamicAt(config.dynamics, note.partId, eventBeat, note.staffNumber) : note.velocity,
        resumeOffsetSeconds: (this.scoreSeconds(eventBeat) - this.scoreSeconds(note.beat)) / this.speedMultiplier,
      } : note;
      const nominalDuration = (this.scoreSeconds(noteEnd) - this.scoreSeconds(eventBeat)) / this.speedMultiplier;
      const { duration, attackScale } = articulatedGate(note, nominalDuration);
      Tone.Transport.schedule((time) => {
        if (generation !== this.playbackGeneration || this.isAudioBackingMuted) return;
        // Expression carries the written level, including changes while a note is held.
        // A fixed reference attack avoids applying the written dynamic twice.
        const attack = config.dynamics?.length ? REFERENCE_DYNAMIC : note.velocity ?? 0.8;
        this.triggerNote(eventNote, Tone.Frequency(note.pitch, 'midi').toNote(), duration, time, attack * attackScale);
      }, at(eventBeat));
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
    this.stop(true);
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

  private releaseBackingVoices() {
    this.fluid.stop();
    this.percussion.stop();
  }

  stop(preservePercussionTails = false) {
    if (preservePercussionTails) this.fluid.stop(); else this.releaseBackingVoices();
    ++this.playbackGeneration;
    if (this.progressInterval) { clearInterval(this.progressInterval); this.progressInterval = null; }
    if (this.isPlaying) { Tone.Transport.stop(); Tone.Transport.cancel(); }
    this.isPlaying = false;
    this.countInActive = false;
  }
  dispose() {
    this.stop(); this.fluid.dispose(); this.percussion.dispose();
    this.metronomeSynth?.dispose(); this.metronomeSynth = null;
    this.hallReverb?.dispose(); this.hallReverb = null;
    this.backingVolume?.dispose(); this.backingVolume = null;
    this.metronomeVolume?.dispose(); this.metronomeVolume = null;
    this.outputLimiter?.dispose(); this.outputLimiter = null;
    for (const bus of this.partBuses.values()) bus.dispose(); this.partBuses.clear();
  }
  getIsPlaying(): boolean { return this.isPlaying; }

  getSectionStartTime(): number {
    return this.sectionStartTimeSeconds;
  }

  getActiveConfig(): SectionPlaybackConfig | null {
    return this.activeConfig;
  }
}
