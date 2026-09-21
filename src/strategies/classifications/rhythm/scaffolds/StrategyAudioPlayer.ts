import { RhythmAssistanceConfig } from '../types/rhythmStrategy';
import { ClickAudioGenerator, AudioClickEvent } from './clickAudioGenerator';
import { PerformanceAttemptMetrics } from '../../../core/types/strategy';

export class StrategyAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentTimeout: any = null;
  private startTime: number = 0;
  private beatDurationSec: number = 0.5; // 120 bpm default
  private userTaps: number[] = [];
  private expectedTapTimes: number[] = [];
  private onFinishedCallback: ((metrics: PerformanceAttemptMetrics) => void) | null = null;
  private onBeatCallback: ((beatIndex: number, isDownbeat: boolean) => void) | null = null;

  private initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public startExecution(
    config: RhythmAssistanceConfig,
    bpm: number = 112,
    totalMeasures: number = 4,
    beatsPerMeasure: number = 4,
    onBeat?: (beatIndex: number, isDownbeat: boolean) => void,
    onFinished?: (metrics: PerformanceAttemptMetrics) => void
  ) {
    this.stop();
    this.initAudio();
    if (!this.audioCtx) return;

    this.isPlaying = true;
    this.userTaps = [];
    this.expectedTapTimes = [];
    this.onFinishedCallback = onFinished || null;
    this.onBeatCallback = onBeat || null;

    this.beatDurationSec = 60 / bpm;
    const schedule: AudioClickEvent[] = ClickAudioGenerator.generateSchedule(
      config,
      totalMeasures,
      beatsPerMeasure
    );

    this.startTime = this.audioCtx.currentTime + 0.1; // 100ms startup lookahead

    // Schedule all audio clicks
    for (const ev of schedule) {
      const audioTime = this.startTime + (ev.timeInBeats * this.beatDurationSec);
      this.scheduleClick(audioTime, ev.frequencyHz, ev.gain);

      if (ev.type === 'downbeat' || ev.type === 'beat') {
        this.expectedTapTimes.push(audioTime);
        
        // Schedule visual beat callback
        const delayMs = (audioTime - this.audioCtx.currentTime) * 1000;
        if (delayMs >= 0) {
          setTimeout(() => {
            if (this.isPlaying && this.onBeatCallback) {
              this.onBeatCallback(ev.timeInBeats, ev.type === 'downbeat');
            }
          }, delayMs);
        }
      }
    }

    const totalDurationMs = (totalMeasures * beatsPerMeasure * this.beatDurationSec + 0.5) * 1000;
    this.currentTimeout = setTimeout(() => {
      if (this.isPlaying) {
        this.stop();
        this.computeAndFinish();
      }
    }, totalDurationMs);
  }

  private scheduleClick(time: number, frequencyHz: number, gainValue: number) {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequencyHz, time);

    gain.gain.setValueAtTime(gainValue * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04); // crisp 40ms transient

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  public recordTap() {
    if (!this.isPlaying || !this.audioCtx) return;
    this.userTaps.push(this.audioCtx.currentTime);
  }

  public stop() {
    this.isPlaying = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private computeAndFinish() {
    if (this.expectedTapTimes.length === 0) return;

    // Calculate timing deltas for taps
    const deltas: number[] = [];
    let matchedTaps = 0;

    for (const expTime of this.expectedTapTimes) {
      // Find nearest tap within +/- 200ms
      const nearest = this.userTaps.find(t => Math.abs(t - expTime) < 0.25);
      if (nearest !== undefined) {
        deltas.push((nearest - expTime) * 1000); // in ms (+ is late, - is early)
        matchedTaps++;
      } else {
        deltas.push(100); // penalty for missed beat
      }
    }

    const meanOffset = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const variance = deltas.length > 0
      ? deltas.reduce((acc, d) => acc + Math.pow(d - meanOffset, 2), 0) / deltas.length
      : 0;
    const timingVariabilityMs = Math.sqrt(variance);

    // Calculate drift slope across taps (trend in ms/beat)
    let driftSlope = 0;
    if (deltas.length >= 4) {
      const n = deltas.length;
      const xMean = (n - 1) / 2;
      const yMean = meanOffset;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (deltas[i] - yMean);
        den += (i - xMean) * (i - xMean);
      }
      driftSlope = den !== 0 ? num / den : 0;
    }

    const missCount = this.expectedTapTimes.length - matchedTaps;
    const accuracyRate = matchedTaps / this.expectedTapTimes.length;
    
    // Pass criteria: accuracy > 75% and timing variability < 55ms
    const passed = accuracyRate >= 0.70 && timingVariabilityMs < 65 && Math.abs(driftSlope) < 8.0;

    const metrics: PerformanceAttemptMetrics = {
      passed,
      meanOffsetMs: Math.round(meanOffset),
      timingVariabilityMs: Math.round(timingVariabilityMs),
      driftSlope: parseFloat(driftSlope.toFixed(1)),
      notesAttempted: this.expectedTapTimes.length,
      missCount,
      accuracyRate: parseFloat(accuracyRate.toFixed(2)),
    };

    if (this.onFinishedCallback) {
      this.onFinishedCallback(metrics);
    }
  }
}
