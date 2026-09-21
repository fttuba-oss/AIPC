import { PlaybackController, DURATION_MAP } from './playbackSession';

export interface RhythmNote {
  id: string;
  duration: string; // "1", "2", "4", "8", "16", "4d", "8d", "4t", "8t", "16t", "8dt"
  isRest: boolean;
  tied?: boolean; // true = a tie arc is drawn from this note to the next
  isTiedStop?: boolean; // true = this note is the sustained destination of a tie
  pitch?: string; // e.g. "C4", "E4", "G4"
}

export type Note = RhythmNote;

export interface TimeSignature {
  beatsPerMeasure: number;
  beatValue: number;
}

export interface Measure {
  id: string;
  timeSignature: TimeSignature;
  notes: RhythmNote[];
}

export interface TapGrade {
  rating: 'Perfect' | 'Great' | 'Good' | 'Early' | 'Late' | 'Miss';
  deltaMs: number; // Positive = late, negative = early
  noteIndex: number;
}

export interface TargetEvent {
  noteIndex: number;
  expectedTime: number; // Absolute Tone.now() time
  played: boolean;
  beatPosition: number; // Position in beats from start
}

export { DURATION_MAP } from './playbackSession';

// UI Name mapping
export const DURATION_NAMES: Record<string, string> = {
  '1': 'Whole',
  '2': 'Half',
  '4': 'Quarter',
  '8': 'Eighth',
  '16': 'Sixteenth',
  '2d': 'Dotted Half',
  '4d': 'Dotted Quarter',
  '8d': 'Dotted Eighth',
  '4t': 'Quarter Triplet',
  '8t': 'Eighth Triplet',
  '16t': 'Sixteenth Triplet',
  '8dt': 'Dotted Eighth Triplet',
};

import type { AssistanceConfig } from '../types/aipcStrategy';

export class RhythmEngine {
  private controller: PlaybackController;
  private pattern: RhythmNote[] = [];
  private measures: Measure[] | null = null;
  private tempoBPM: number = 120;
  private timeSignature: TimeSignature = { beatsPerMeasure: 4, beatValue: 4 };
  private playRhythmNotes: boolean = false;
  private isMuted: boolean = false;
  private speedMultiplier: number = 1.0;
  private userCalibrationOffset: number = 0; // In seconds
  private _countdownOverride: number | null = null; // null = use beatsPerMeasure
  private assistanceConfig: AssistanceConfig | null = null;
  public currentRunId: string = 'none';

  private onTimeUpdateCallback: ((seconds: number, beat: number) => void) | null = null;
  private onNoteMissedCallback: ((noteIndex: number) => void) | null = null;
  private onExerciseCompleteCallback: (() => void) | null = null;
  private onNoteSoundCallback: ((noteIndex: number) => void) | null = null;

  constructor() {
    this.controller = new PlaybackController();
  }

  setPattern(pattern: RhythmNote[], bpm: number, timeSig: TimeSignature, measures: Measure[] | null = null) {
    this.pattern = pattern;
    this.tempoBPM = bpm;
    this.timeSignature = timeSig;
    this.measures = measures;
  }

  setAssistanceConfig(config: AssistanceConfig | null) {
    this.assistanceConfig = config;
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  setMetronomeVolume(_db: number) {
    // Volume is statically balanced at -6dB in PlaybackSession, but we keep this method interface
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  setPlayRhythmNotes(play: boolean) {
    this.playRhythmNotes = play;
  }

  setCalibrationOffsetMs(ms: number) {
    this.userCalibrationOffset = ms / 1000;
  }

  setCountdownOverride(n: number | null) {
    this._countdownOverride = n;
  }

  get latencyOffset(): number {
    return 0.020 + this.userCalibrationOffset;
  }

  get totalBeats(): number {
    return this.pattern.reduce((acc, note) => acc + (DURATION_MAP[note.duration] || 1), 0);
  }

  get totalDurationSeconds(): number {
    const beats = this.totalBeats;
    return (beats / this.tempoBPM) * 60;
  }

  async start() {
    const countdownBeats = this._countdownOverride !== null ? this._countdownOverride : this.timeSignature.beatsPerMeasure;
    
    await this.controller.startSession(
      this.tempoBPM * this.speedMultiplier,
      this.timeSignature,
      this.pattern,
      this._countdownOverride,
      this.playRhythmNotes,
      this.isMuted,
      this.latencyOffset,
      this.measures,
      this.assistanceConfig,
      // onBeat
      (_clickIndex, quarterPos) => {
        const beatPosition = quarterPos - countdownBeats;
        const elapsedSeconds = (quarterPos * 60) / (this.tempoBPM * this.speedMultiplier);
        this.onTimeUpdateCallback?.(elapsedSeconds, beatPosition);
      },
      // onNote
      (noteIndex, _quarterPos) => {
        this.onNoteSoundCallback?.(noteIndex);
      },
      // onNoteMissed
      (noteIndex) => {
        this.onNoteMissedCallback?.(noteIndex);
      },
      // onComplete
      () => {
        this.onExerciseCompleteCallback?.();
      }
    );
  }

  pause() {
    // No-op for direct session
  }

  stop() {
    this.controller.stopSession();
    this.onTimeUpdateCallback?.(0, 0);
  }

  clearSchedule() {
    this.controller.stopSession();
  }

  registerStudentTap(): TapGrade | null {
    return this.controller.registerStudentTap(this.latencyOffset);
  }

  setTimeUpdateCallback(cb: (seconds: number, beat: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  setNoteMissedCallback(cb: (noteIndex: number) => void) {
    this.onNoteMissedCallback = cb;
  }

  setExerciseCompleteCallback(cb: () => void) {
    this.onExerciseCompleteCallback = cb;
  }

  setNoteSoundCallback(cb: (noteIndex: number) => void) {
    this.onNoteSoundCallback = cb;
  }

  testSound() {
    const ctxClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new ctxClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05 + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + 0.05);
    osc.stop(ctx.currentTime + 0.1);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  }
}
