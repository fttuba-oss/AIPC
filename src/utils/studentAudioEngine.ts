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
import { beatToSeconds, type NoteEvent, type TempoChange } from './scorePlaybackParser';
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

export interface SectionPlaybackConfig {
  intendedBpm?: number;
  bpm?: number;
  timeSignature: [number, number]; // [numerator, denominator]
  startMeasure: number;
  endMeasure: number;
  countInBeats?: number;
  instrumentName?: string;
  notes?: NoteEvent[];
  startBeat?: number;
  totalBeats?: number;
  startFromBeat?: number;
  ladderLevel?: number;
  tempos?: TempoChange[];
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

  private scheduledEventIds: number[] = [];
  private countInTimer: any = null;
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

    // Concert Hall Reverb space (adds authentic acoustic room presence and natural air)
    this.hallReverb = new Tone.Freeverb({
      roomSize: 0.65,
      dampening: 3400,
      wet: 0.16,
    }).connect(this.backingVolume);

    // High quality expressive synth fallback
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth6' },
      envelope: {
        attack: 0.03,
        decay: 0.1,
        sustain: 0.75,
        release: 0.15,
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

  setAudioBackingMuted(muted: boolean) {
    this.isAudioBackingMuted = muted;
    if (this.backingVolume) {
      this.backingVolume.mute = muted;
    }
  }

  setMetronomeMuted(muted: boolean) {
    this.isMetronomeMuted = muted;
    if (this.metronomeVolume) {
      this.metronomeVolume.mute = muted;
    }
  }

  /**
   * Dynamically adjust the playback BPM.
   * Rescales playback so MIDI notes, metronome clicks, and tracker cursor adjust in real-time.
   */
  setBpm(newBpm: number) {
    const clamped = Math.max(30, Math.min(300, Math.round(newBpm)));
    if (clamped === this.currentBpm) return;

    if (this.isPlaying && this.activeConfig && Tone.Transport.state === 'started') {
      const beatsPerMeasure = this.activeConfig.timeSignature[0] || 4;
      const sectionStartBeat = this.activeConfig.startBeat ?? ((this.activeConfig.startMeasure - 1) * beatsPerMeasure);
      const totalMeasures = (this.activeConfig.endMeasure - this.activeConfig.startMeasure) + 1;
      const totalBeats = this.activeConfig.totalBeats ?? (totalMeasures * beatsPerMeasure);

      const elapsedRealSeconds = Tone.Transport.seconds;
      const currentRelativeBeat = elapsedRealSeconds * (this.currentBpm / 60);

      this.currentBpm = clamped;
      this.speedMultiplier = clamped / this.intendedBpm;

      if (currentRelativeBeat >= totalBeats) {
        this.finishPlayback();
        return;
      }

      this.rescheduleRemaining(sectionStartBeat, currentRelativeBeat, beatsPerMeasure, totalBeats);
    } else {
      this.currentBpm = clamped;
      this.speedMultiplier = clamped / this.intendedBpm;
    }
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
    this.setBpm(Math.round(this.intendedBpm * multiplier));
  }

  getIntendedBpm(): number {
    return this.intendedBpm;
  }

  getCurrentBpm(): number {
    return this.currentBpm;
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  setOnTick(cb: (beatNumber: number, isCountIn: boolean) => void) {
    this.onTickCallback = cb;
  }

  setOnTimeUpdate(cb: (timeSec: number, totalSec: number, elapsedRealSec?: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  getElapsedPlaybackSeconds(): number {
    if (!this.isPlaying || Tone.Transport.state !== 'started') return 0;
    return Math.max(0, Tone.Transport.seconds);
  }

  setOnEnd(cb: () => void) {
    this.onEndCallback = cb;
  }

  /**
   * Starts playback of a section with count-in and synchronized notes
   */
  async startSectionPlayback(config: SectionPlaybackConfig, requestedBpm?: number) {
    await Tone.start();
    this.ensureInitialized();
    this.stop();

    this.activeConfig = config;
    this.intendedBpm = config.intendedBpm ?? config.bpm ?? 120;
    this.currentBpm = requestedBpm ?? config.bpm ?? this.intendedBpm;
    this.speedMultiplier = this.currentBpm / this.intendedBpm;

    const beatsPerMeasure = config.timeSignature[0] || 4;
    const countInBeats = config.countInBeats ?? 4;
    const secondsPerBeatAtCurrentBpm = 60 / this.currentBpm;

    const sectionStartBeat = config.startBeat ?? ((config.startMeasure - 1) * beatsPerMeasure);
    const totalMeasures = (config.endMeasure - config.startMeasure) + 1;
    const totalBeats = config.totalBeats ?? (totalMeasures * beatsPerMeasure);

    // Section duration in baseline score seconds
    this.sectionDurationSeconds = totalBeats * (60 / this.intendedBpm);
    this.sectionStartTimeSeconds = sectionStartBeat * (60 / this.intendedBpm);

    // Filter notes for the section
    const sectionNotes = (config.notes || []).filter(
      n => n.measureNumber >= config.startMeasure && n.measureNumber <= config.endMeasure
    );

    let currentCountIn = 1;

    // 1. Audible & Visual Count-In at currentBpm
    const runCountIn = () => {
      if (currentCountIn <= countInBeats) {
        const clickPitch = currentCountIn === 1 ? 'C6' : 'G5';
        if (!this.isMetronomeMuted && this.metronomeSynth) {
          this.metronomeSynth.triggerAttackRelease(clickPitch, '32n');
        }
        if (this.onTickCallback) {
          this.onTickCallback(currentCountIn, true);
        }

        const countInProgress = -(countInBeats - currentCountIn + 1) * (60 / this.intendedBpm);
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(countInProgress, this.sectionDurationSeconds);
        }

        currentCountIn++;
        this.countInTimer = setTimeout(runCountIn, secondsPerBeatAtCurrentBpm * 1000);
      } else {
        // 2. Start Transport Music & Metronome in perfect sync
        const startFromRelativeBeat = config.startFromBeat !== undefined
          ? Math.max(0, Math.min(totalBeats - 0.1, config.startFromBeat - sectionStartBeat))
          : 0;
        this.startTransportMusic(
          sectionNotes,
          sectionStartBeat,
          beatsPerMeasure,
          totalBeats,
          startFromRelativeBeat
        );
      }
    };

    this.isPlaying = true;
    runCountIn();
  }

    private shouldPlayMetronomeClick(b: number, beatInBar: number, beatsPerMeasure: number, ladderLevel: number): boolean {
    if (ladderLevel === 0) return false; // Level 0: Silent transfer test
    const barIndex = Math.floor(b / beatsPerMeasure);
    if (ladderLevel === 1) return (beatInBar === 0 || beatInBar === 2) && (barIndex % 2 === 0);
    if (ladderLevel === 2) return beatInBar === 0; // Downbeat only
    if (ladderLevel === 3) return (barIndex % 4 < 2); // Gap click: 2 bars on, 2 bars off
    return true; // Level 4 and 5
  }

  private startTransportMusic(
    sectionNotes: NoteEvent[],
    sectionStartBeat: number,
    beatsPerMeasure: number,
    totalBeats: number,
    startFromRelativeBeat: number = 0
  ) {
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    this.scheduledEventIds = [];

    // Tone.Transport runs at real seconds baseline (bpm = 60)
    Tone.Transport.bpm.value = 60;

    const getBeatTime = (beat: number): number => {
      if (this.activeConfig?.tempos && this.activeConfig.tempos.length > 0) {
        const trueTime = beatToSeconds(beat, this.activeConfig.tempos);
        const startTime = beatToSeconds(sectionStartBeat + startFromRelativeBeat, this.activeConfig.tempos);
        return Math.max(0, (trueTime - startTime) / this.speedMultiplier);
      }
      return (beat - (sectionStartBeat + startFromRelativeBeat)) * (60 / this.currentBpm);
    };

    const totalRealDuration = getBeatTime(sectionStartBeat + totalBeats);

    // 1. Schedule Metronome clicks on Transport according to ladderLevel
    const ladderLevel = this.activeConfig?.ladderLevel ?? 4;
    for (let b = 0; b < totalBeats; b++) {
      if (b >= startFromRelativeBeat) {
        const beatInBar = b % beatsPerMeasure;
        const isDownbeat = beatInBar === 0;
        const clickPitch = isDownbeat ? 'C6' : 'G5';
        const eventTime = getBeatTime(sectionStartBeat + b);
        const nextBeatTime = getBeatTime(sectionStartBeat + b + 1);
        const beatDuration = Math.max(0.2, nextBeatTime - eventTime);
        const shouldClick = this.shouldPlayMetronomeClick(b, beatInBar, beatsPerMeasure, ladderLevel);

        const eventId = Tone.Transport.schedule((time) => {
          if (!this.isMetronomeMuted && this.metronomeSynth && shouldClick) {
            this.metronomeSynth.triggerAttackRelease(clickPitch, '32n', time);
          }
          Tone.Draw.schedule(() => {
            if (this.onTickCallback) {
              this.onTickCallback(beatInBar + 1, false);
            }
          }, time);
        }, eventTime);

        this.scheduledEventIds.push(eventId);

        // Level 5 Subdivisions (16th-note ticks)
        if (ladderLevel === 5 && !this.isMetronomeMuted && this.metronomeSynth) {
          for (let sub = 1; sub <= 3; sub++) {
            const subTime = eventTime + (sub * (beatDuration / 4));
            const subPitch = sub === 2 ? 'G4' : 'E4';
            const subId = Tone.Transport.schedule((time) => {
              if (!this.isMetronomeMuted && this.metronomeSynth) {
                this.metronomeSynth.triggerAttackRelease(subPitch, '64n', time, 0.45);
              }
            }, subTime);
            this.scheduledEventIds.push(subId);
          }
        }
      }
    }

    // 2. Schedule Melodic MIDI Notes on Transport
    sectionNotes.forEach((note) => {
      const relativeBeats = note.beat - sectionStartBeat;
      if (relativeBeats >= startFromRelativeBeat && relativeBeats < totalBeats) {
        const eventTime = getBeatTime(note.beat);
        const nextEventTime = getBeatTime(note.beat + note.durationBeats);
        const playDuration = Math.max(0.04, (nextEventTime - eventTime) - 0.015);
        const noteName = Tone.Frequency(note.pitch, 'midi').toNote();
        const velocity = note.velocity ?? 0.8;

        const eventId = Tone.Transport.schedule((time) => {
          if (!this.isAudioBackingMuted) {
            if (this.sampler && this.sampler.loaded) {
              this.sampler.triggerAttackRelease(noteName, playDuration, time, velocity);
            } else if (this.synth) {
              this.synth.triggerAttackRelease(noteName, playDuration, time, velocity);
            }
          }
        }, eventTime);
        this.scheduledEventIds.push(eventId);
      }
    });

    // 3. High-resolution time update loop reading Transport.seconds
    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsedRealSeconds = Tone.Transport.seconds;
      
      // Calculate current score beat from elapsed time
      let currentScoreBeat = sectionStartBeat + startFromRelativeBeat;
      if (this.activeConfig?.tempos && this.activeConfig.tempos.length > 0) {
        const startSec = beatToSeconds(sectionStartBeat + startFromRelativeBeat, this.activeConfig.tempos);
        const targetSec = startSec + (elapsedRealSeconds * this.speedMultiplier);
        // Find beat for targetSec
        let activeT = this.activeConfig.tempos[0];
        for (const t of this.activeConfig.tempos) {
          if (t.timeInSeconds <= targetSec) activeT = t;
          else break;
        }
        currentScoreBeat = activeT.beat + ((targetSec - activeT.timeInSeconds) / 60) * activeT.bpm;
      } else {
        currentScoreBeat += elapsedRealSeconds * (this.currentBpm / 60);
      }

      // Convert current beat into score baseline seconds so OSMD cursor aligns with scoreData.tempos
      const scoreCurrentTime = this.activeConfig?.tempos
        ? beatToSeconds(currentScoreBeat, this.activeConfig.tempos)
        : (currentScoreBeat / this.intendedBpm) * 60;

      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(scoreCurrentTime, this.sectionDurationSeconds, elapsedRealSeconds);
      }

      if (elapsedRealSeconds >= totalRealDuration) {
        this.finishPlayback();
      }
    }, 20);

    Tone.Transport.start('+0.05');
  }

  private rescheduleRemaining(
    sectionStartBeat: number,
    startFromRelativeBeat: number,
    beatsPerMeasure: number,
    totalBeats: number
  ) {
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    this.scheduledEventIds = [];

    const secondsPerBeat = 60 / this.currentBpm;
    const remainingBeats = totalBeats - startFromRelativeBeat;
    const totalRemainingRealSeconds = remainingBeats * secondsPerBeat;

    const sectionNotes = (this.activeConfig?.notes || []).filter(
      n => n.measureNumber >= (this.activeConfig?.startMeasure ?? 1) &&
           n.measureNumber <= (this.activeConfig?.endMeasure ?? 1)
    );

    // 1. Reschedule Metronome clicks
    for (let b = 0; b < totalBeats; b++) {
      if (b >= startFromRelativeBeat) {
        const beatInBar = b % beatsPerMeasure;
        const isDownbeat = beatInBar === 0;
        const clickPitch = isDownbeat ? 'C6' : 'G5';
        const eventTime = (b - startFromRelativeBeat) * secondsPerBeat;

        const eventId = Tone.Transport.schedule((time) => {
          if (!this.isMetronomeMuted && this.metronomeSynth) {
            this.metronomeSynth.triggerAttackRelease(clickPitch, '32n', time);
          }
          Tone.Draw.schedule(() => {
            if (this.onTickCallback) {
              this.onTickCallback(beatInBar + 1, false);
            }
          }, time);
        }, eventTime);

        this.scheduledEventIds.push(eventId);
      }
    }

    // 2. Reschedule Notes
    sectionNotes.forEach((note) => {
      const relativeBeats = note.beat - sectionStartBeat;
      if (relativeBeats >= startFromRelativeBeat && relativeBeats < totalBeats) {
        const eventTime = (relativeBeats - startFromRelativeBeat) * secondsPerBeat;
        const playDuration = Math.max(0.04, (note.durationBeats * secondsPerBeat) - 0.015);
        const noteName = Tone.Frequency(note.pitch, 'midi').toNote();
        const velocity = note.velocity ?? 0.8;

        const eventId = Tone.Transport.schedule((time) => {
          if (!this.isAudioBackingMuted) {
            if (this.sampler && this.sampler.loaded) {
              this.sampler.triggerAttackRelease(noteName, playDuration, time, velocity);
            } else if (this.synth) {
              this.synth.triggerAttackRelease(noteName, playDuration, time, velocity);
            }
          }
        }, eventTime);
        this.scheduledEventIds.push(eventId);
      }
    });

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsedRealSeconds = Tone.Transport.seconds;
      const elapsedBeatsSinceReschedule = elapsedRealSeconds * (this.currentBpm / 60);
      const currentScoreBeat = sectionStartBeat + startFromRelativeBeat + elapsedBeatsSinceReschedule;

      const scoreCurrentTime = this.activeConfig?.tempos
        ? beatToSeconds(currentScoreBeat, this.activeConfig.tempos)
        : (currentScoreBeat / this.intendedBpm) * 60;

      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(scoreCurrentTime, this.sectionDurationSeconds);
      }

      if (elapsedRealSeconds >= totalRemainingRealSeconds) {
        this.finishPlayback();
      }
    }, 20);

    Tone.Transport.start();
  }

  private finishPlayback() {
    this.stop();
    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  seekToScoreBeat(targetScoreBeat: number) {
    if (!this.activeConfig) return;
    const beatsPerMeasure = this.activeConfig.timeSignature[0] || 4;
    const sectionStartBeat = this.activeConfig.startBeat ?? ((this.activeConfig.startMeasure - 1) * beatsPerMeasure);
    const totalMeasures = (this.activeConfig.endMeasure - this.activeConfig.startMeasure) + 1;
    const totalBeats = this.activeConfig.totalBeats ?? (totalMeasures * beatsPerMeasure);
    const relativeBeat = Math.max(0, Math.min(totalBeats - 0.1, targetScoreBeat - sectionStartBeat));

    if (this.isPlaying && Tone.Transport.state === 'started') {
      this.rescheduleRemaining(sectionStartBeat, relativeBeat, beatsPerMeasure, totalBeats);
    }
  }

  stop() {
    if (this.countInTimer) {
      clearTimeout(this.countInTimer);
      this.countInTimer = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (Tone.Transport.state === 'started') {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    }
    this.isPlaying = false;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getSectionStartTime(): number {
    return this.sectionStartTimeSeconds;
  }

  getActiveConfig(): SectionPlaybackConfig | null {
    return this.activeConfig;
  }
}
