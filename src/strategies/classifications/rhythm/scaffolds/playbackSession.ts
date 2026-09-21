import type { RhythmNote, TimeSignature, TapGrade, TargetEvent, Measure } from './rhythmEngine';
import type { AssistanceConfig } from '../types/aipcStrategy';
import { playOrchestralWoodblockNote, warmUpWoodblockNotes } from './woodblockSoundfontEngine';

export const DURATION_MAP: Record<string, number> = {
  '1': 4.0,   // Whole
  '2': 2.0,   // Half
  '4': 1.0,   // Quarter
  '8': 0.5,   // Eighth
  '16': 0.25, // Sixteenth
  '2d': 3.0,  // Dotted Half
  '4d': 1.5,  // Dotted Quarter
  '8d': 0.75, // Dotted Eighth
  '4t': 2 / 3, // Quarter Triplet
  '8t': 1 / 3, // Eighth Triplet
  '16t': 1 / 6, // Sixteenth Triplet
  '8dt': 0.5,  // Dotted Eighth Triplet
  '32': 0.125, // Thirty-second
  '16d': 0.375, // Dotted Sixteenth
};

let instanceCount = 0;

export class PlaybackSession {
  public id: string;
  public audioContext: AudioContext;
  public cancelled: boolean = false;
  public completionTimer: number | null = null;
  public targetEventsQueue: TargetEvent[] = [];
  
  public bpm: number;
  public timeSignature: TimeSignature;
  public pattern: RhythmNote[];
  public measures: Measure[] | null;
  public assistanceConfig: AssistanceConfig | null;
  private countdownOverride: number | null;
  private playRhythmNotes: boolean;
  private isMuted: boolean;
  private onBeatCallback: (clickIndex: number, quarterPosition: number) => void;
  private onNoteCallback: (noteIndex: number, quarterPosition: number) => void;
  private onNoteMissedCallback: (noteIndex: number) => void;
  private onCompleteCallback: () => void;

  private scheduledNodes: AudioNode[] = [];
  private scheduledTimers: number[] = [];
  private tickerId: number | null = null;
  
  constructor(
    bpm: number,
    timeSignature: TimeSignature,
    pattern: RhythmNote[],
    countdownOverride: number | null,
    playRhythmNotes: boolean,
    isMuted: boolean,
    measures: Measure[] | null,
    assistanceConfig: AssistanceConfig | null,
    onBeatCallback: (clickIndex: number, quarterPosition: number) => void,
    onNoteCallback: (noteIndex: number, quarterPosition: number) => void,
    onNoteMissedCallback: (noteIndex: number) => void,
    onCompleteCallback: () => void
  ) {
    this.bpm = bpm;
    this.timeSignature = timeSignature;
    this.pattern = pattern;
    this.measures = measures;
    this.assistanceConfig = assistanceConfig;
    this.countdownOverride = countdownOverride;
    this.playRhythmNotes = playRhythmNotes;
    this.isMuted = isMuted;
    this.onBeatCallback = onBeatCallback;
    this.onNoteCallback = onNoteCallback;
    this.onNoteMissedCallback = onNoteMissedCallback;
    this.onCompleteCallback = onCompleteCallback;

    this.id = Math.random().toString(36).substring(2, 8);
    
    // Initialize fresh AudioContext for this session
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    console.log(`[PlaybackSession ${this.id}] Initialized with new AudioContext state: ${this.audioContext.state}`);
  }

  /**
   * Determine the exact subdivision ratio for a given beat position,
   * taking into account embedded triplets/tuplets rather than just the time signature.
   */
  private getSubdivisionRatioForBeat(
    measureIndex: number | null,
    beatIndex: number,
    beatIntervalQuarters: number,
    quarterPosition: number
  ): number {
    if (!this.assistanceConfig) return 2;

    // 1. If explicit beatSubdivisions map is provided, look it up
    const globalBeatKey = Math.floor(quarterPosition);
    if (this.assistanceConfig.beatSubdivisions && this.assistanceConfig.beatSubdivisions[globalBeatKey] !== undefined) {
      return this.assistanceConfig.beatSubdivisions[globalBeatKey];
    }

    // 2. Inspect notes active during this beat in measure
    if (measureIndex !== null && this.measures && this.measures[measureIndex]) {
      const beatStartQ = beatIndex * beatIntervalQuarters;
      const beatEndQ = (beatIndex + 1) * beatIntervalQuarters;
      let accumQ = 0;

      for (const note of this.measures[measureIndex].notes) {
        const dur = DURATION_MAP[note.duration] || 1.0;
        const nStart = accumQ;
        const nEnd = accumQ + dur;
        accumQ += dur;

        // Check if note overlaps with this beat window
        if (nStart < beatEndQ - 0.01 && nEnd > beatStartQ + 0.01) {
          if (
            note.duration.includes('t') ||
            Math.abs(dur - 1 / 3) < 0.02 ||
            Math.abs(dur - 2 / 3) < 0.02 ||
            Math.abs(dur - 1 / 6) < 0.02
          ) {
            return 3; // Triplet subdivision for this beat!
          }
        }
      }
    }

    return this.assistanceConfig.subdivisionRatio || 2;
  }

  public async start(latencyOffset: number) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    warmUpWoodblockNotes(this.audioContext, ['C4', 'E4', 'G4', 'C5', 'E5']).catch(() => {});

    const bpm = this.bpm;
    const secondsPerQuarter = 60 / bpm;
    const beatValue = this.timeSignature.beatValue || 4;
    const beatsPerMeasure = this.timeSignature.beatsPerMeasure;
    const measureCapacityQuarters = (beatsPerMeasure * 4) / beatValue;

    // Determine click interval in quarter-note units
    // For /8 meters: click on eighth notes (0.5 quarters)
    // For /4 meters: click on quarter notes (1.0 quarter)
    // For /2 meters: click on quarter notes (1.0 quarter) or half notes
    const clickIntervalQuarters = beatValue === 8 ? 0.5 : 1.0;
    const clicksPerMeasure = Math.round(measureCapacityQuarters / clickIntervalQuarters);

    const countdownBeats = this.countdownOverride !== null ? this.countdownOverride : clicksPerMeasure;
    const countdownQuarters = countdownBeats * clickIntervalQuarters;

    // Calculate total beats in quarter-note units
    const totalBeats = this.pattern.reduce((acc, note) => acc + (DURATION_MAP[note.duration] || 1), 0);
    const totalQuarterBeats = countdownQuarters + totalBeats;
    const totalClicks = Math.round(totalQuarterBeats / clickIntervalQuarters);

    const startTime = this.audioContext.currentTime + 0.1; // 100ms startup lookahead

    console.log(`[PlaybackSession ${this.id}] Scheduling details: ` + JSON.stringify({
      bpm,
      secondsPerQuarter,
      beatsPerMeasure,
      beatValue,
      measureCapacityQuarters,
      clickIntervalQuarters,
      countdownBeats,
      countdownQuarters,
      totalBeats,
      totalQuarterBeats,
      totalClicks,
      startTime,
      audioCtxTime: this.audioContext.currentTime
    }));

    // 1. Schedule Metronome clicks
    if (this.measures && this.measures.length > 0) {
      const firstTs = this.measures[0].timeSignature || this.timeSignature;
      const firstBeatValue = firstTs.beatValue || 4;
      const firstClickInterval = firstBeatValue === 8 ? 0.5 : 1.0;
      const firstMeasureCapacity = (firstTs.beatsPerMeasure * 4) / firstBeatValue;
      const firstClicksPerMeasure = Math.round(firstMeasureCapacity / firstClickInterval);
      const countdownClicks = this.countdownOverride !== null ? this.countdownOverride : firstClicksPerMeasure;

      let clickIndex = 0;
      // Countdown clicks
      for (let c = 0; c < countdownClicks; c++) {
        const clickQuarterPosition = c * firstClickInterval;
        const clickTime = startTime + clickQuarterPosition * secondsPerQuarter;
        const isDownbeat = c === 0;
        this.playOscillator(clickTime, isDownbeat, false);

        // Subdivision clicks during countdown if enabled
        if (this.assistanceConfig?.subdivisionClicks) {
          const ratio = this.getSubdivisionRatioForBeat(0, 0, firstClickInterval, 0);
          for (let sub = 1; sub < ratio; sub++) {
            const subTime = clickTime + (firstClickInterval * (sub / ratio)) * secondsPerQuarter;
            this.playOscillator(subTime, false, false, true);
          }
        }

        const currentClickIdx = clickIndex;
        const timer = window.setTimeout(() => {
          if (this.cancelled) return;
          this.onBeatCallback(currentClickIdx, clickQuarterPosition);
        }, Math.max(0, (clickTime - this.audioContext.currentTime) * 1000));
        this.scheduledTimers.push(timer);
        clickIndex++;
      }

      // Measure clicks
      let currentQuarter = countdownQuarters;
      for (let m = 0; m < this.measures.length; m++) {
        const mTs = this.measures[m].timeSignature || this.timeSignature;
        const mBeatVal = mTs.beatValue || 4;
        const mClickInterval = mBeatVal === 8 ? 0.5 : 1.0;
        const mCapacity = (mTs.beatsPerMeasure * 4) / mBeatVal;
        const mClicks = Math.round(mCapacity / mClickInterval);

        for (let k = 0; k < mClicks; k++) {
          const clickQuarterPosition = currentQuarter + k * mClickInterval;
          const clickTime = startTime + clickQuarterPosition * secondsPerQuarter;
          const isDownbeat = k === 0;

          let isAccent = false;
          if (mBeatVal === 8) {
            if (mTs.beatsPerMeasure === 6 && k === 3) isAccent = true;
            else if (mTs.beatsPerMeasure === 9 && (k === 3 || k === 6)) isAccent = true;
            else if (mTs.beatsPerMeasure === 12 && (k === 3 || k === 6 || k === 9)) isAccent = true;
            else if (mTs.beatsPerMeasure === 5 && k === 3) isAccent = true;
            else if (mTs.beatsPerMeasure === 7 && (k === 2 || k === 4)) isAccent = true;
          }

          // Check assistance scale configuration
          let shouldSoundClick = true;
          let actualClickTime = clickTime;

          if (this.assistanceConfig) {
            if (this.assistanceConfig.temporalSupport === 'None') {
              shouldSoundClick = false; // Zero clicks (Transfer verification)
            } else if (this.assistanceConfig.continuationAfterBars !== undefined && m >= this.assistanceConfig.continuationAfterBars) {
              shouldSoundClick = false; // Continuation without click (R13)
            } else if (this.assistanceConfig.clicksOnlyOnDownbeat && !isDownbeat) {
              shouldSoundClick = false; // R15: 1 click per bar on downbeat only
            } else if (this.assistanceConfig.selectedMetricPositions && this.assistanceConfig.selectedMetricPositions.length > 0) {
              if (!this.assistanceConfig.selectedMetricPositions.includes(k)) {
                shouldSoundClick = false; // R14: click on selected metric positions
              }
            } else if (this.assistanceConfig.gapClick) {
              const { playBars, silentBars } = this.assistanceConfig.gapClick;
              const cycleLength = playBars + silentBars;
              const barInCycle = m % cycleLength;
              if (barInCycle >= playBars) {
                shouldSoundClick = false; // Silent gap bar (R12)
              }
            } else if (this.assistanceConfig.sparseClicksEveryNBeats) {
              if (k % this.assistanceConfig.sparseClicksEveryNBeats !== 0) {
                shouldSoundClick = false; // Sparse click (R11)
              }
            } else if (this.assistanceConfig.randomDropoutProb && !isDownbeat) {
              if (Math.random() < this.assistanceConfig.randomDropoutProb) {
                shouldSoundClick = false; // Random dropout
              }
            }

            // Perturbation (R27)
            if (this.assistanceConfig.perturbedBeat) {
              const pb = this.assistanceConfig.perturbedBeat;
              if (m === pb.measureIndex && k === pb.beatIndex) {
                actualClickTime += pb.offsetMs / 1000;
              }
            }
          }

          if (shouldSoundClick) {
            this.playOscillator(actualClickTime, isDownbeat, isAccent);

            // Subdivision grid micro-clicks
            if (this.assistanceConfig?.subdivisionClicks) {
              const ratio = this.getSubdivisionRatioForBeat(m, k, mClickInterval, clickQuarterPosition);
              for (let sub = 1; sub < ratio; sub++) {
                const subTime = actualClickTime + (mClickInterval * (sub / ratio)) * secondsPerQuarter;
                this.playOscillator(subTime, false, false, true);
              }
            }
          }

          const currentClickIdx = clickIndex;
          const timer = window.setTimeout(() => {
            if (this.cancelled) return;
            this.onBeatCallback(currentClickIdx, clickQuarterPosition);
          }, Math.max(0, (clickTime - this.audioContext.currentTime) * 1000));
          this.scheduledTimers.push(timer);
          clickIndex++;
        }
        currentQuarter += mCapacity;
      }
    } else {
      // Single-meter fallback
      for (let c = 0; c < totalClicks; c++) {
        const clickQuarterPosition = c * clickIntervalQuarters;
        const clickTime = startTime + clickQuarterPosition * secondsPerQuarter;

        const clickInMeasure = c % clicksPerMeasure;
        const isDownbeat = clickInMeasure === 0;

        let isAccent = false;
        if (beatValue === 8) {
          if (beatsPerMeasure === 6 && clickInMeasure === 3) isAccent = true;
          else if (beatsPerMeasure === 9 && (clickInMeasure === 3 || clickInMeasure === 6)) isAccent = true;
          else if (beatsPerMeasure === 12 && (clickInMeasure === 3 || clickInMeasure === 6 || clickInMeasure === 9)) isAccent = true;
          else if (beatsPerMeasure === 5 && clickInMeasure === 3) isAccent = true;
          else if (beatsPerMeasure === 7 && (clickInMeasure === 2 || clickInMeasure === 4)) isAccent = true;
        }

        const isCountdown = c < countdownBeats;
        let shouldSoundClick = true;
        if (!isCountdown && this.assistanceConfig) {
          if (this.assistanceConfig.temporalSupport === 'None') {
            shouldSoundClick = false;
          }
        }

        if (shouldSoundClick) {
          this.playOscillator(clickTime, isDownbeat, isAccent);

          if (this.assistanceConfig?.subdivisionClicks) {
            const ratio = this.getSubdivisionRatioForBeat(null, clickInMeasure, clickIntervalQuarters, clickQuarterPosition);
            for (let sub = 1; sub < ratio; sub++) {
              const subTime = clickTime + (clickIntervalQuarters * (sub / ratio)) * secondsPerQuarter;
              this.playOscillator(subTime, false, false, true);
            }
          }
        }

        const timer = window.setTimeout(() => {
          if (this.cancelled) return;
          this.onBeatCallback(c, clickQuarterPosition);
        }, Math.max(0, (clickTime - this.audioContext.currentTime) * 1000));
        this.scheduledTimers.push(timer);
      }
    }

    // 2. Schedule rhythm notes (and populate grading queue)
    let currentQuarterPosition = countdownQuarters;
    this.pattern.forEach((note, index) => {
      const durationQuarters = DURATION_MAP[note.duration] || 1;
      const noteTime = startTime + currentQuarterPosition * secondsPerQuarter;

      if (!note.isRest && !note.isTiedStop) {
        // Calculate total sustained duration if this note starts a tie!
        let sustainedQuarters = durationQuarters;
        let lookahead = index + 1;
        while (lookahead < this.pattern.length && this.pattern[lookahead - 1].tied && !this.pattern[lookahead].isRest) {
          sustainedQuarters += (DURATION_MAP[this.pattern[lookahead].duration] || 1);
          lookahead++;
        }

        const sustainedSeconds = sustainedQuarters * secondsPerQuarter;

        // Trigger Rosewood Marimba sound if playRhythmNotes is enabled (for Demos)
        if (this.playRhythmNotes) {
          this.playRhythmNoteSound(noteTime, sustainedSeconds, note, index);
        }

        // Add note expectation to the grading queue
        this.targetEventsQueue.push({
          noteIndex: index,
          expectedTime: noteTime,
          played: false,
          beatPosition: currentQuarterPosition - countdownBeats
        });
      }

      // UI/Visual Callback
      const timer = window.setTimeout(() => {
        if (this.cancelled) return;
        this.onNoteCallback(index, currentQuarterPosition);
      }, Math.max(0, (noteTime - this.audioContext.currentTime) * 1000));
      this.scheduledTimers.push(timer);

      currentQuarterPosition += durationQuarters;
    });

    // 3. Schedule completion event
    const completionTime = startTime + totalQuarterBeats * secondsPerQuarter;
    const completionDelayMs = (completionTime - this.audioContext.currentTime) * 1000 + 350;
    
    console.log(`[PlaybackSession ${this.id}] completionDelayMs details: ` + JSON.stringify({
      completionTime,
      audioCtxTime: this.audioContext.currentTime,
      completionDelayMs
    }));

    this.completionTimer = window.setTimeout(() => {
      if (this.cancelled) return;
      console.log(`[PlaybackSession ${this.id}] Completion reached`);
      this.onCompleteCallback();
    }, Math.max(0, completionDelayMs));

    // 4. Start the animation frame missed-notes checker
    this.runTicker(latencyOffset);
  }

  public registerStudentTap(latencyOffset: number): TapGrade | null {
    if (this.cancelled) return null;

    const tapAudioTime = this.audioContext.currentTime;
    const offsetTime = tapAudioTime - latencyOffset;

    // Sequential Queue Matching:
    // Evaluates against the next unplayed expected note in chronological order.
    // Ahead-of-time taps immediately bind to the upcoming note as Early/Rushing.
    const targetEvent = this.targetEventsQueue.find(ev => !ev.played);
    if (!targetEvent) return null;

    const delta = offsetTime - targetEvent.expectedTime;
    const deltaMs = delta * 1000;
    const absDeltaMs = Math.abs(deltaMs);

    let rating: TapGrade['rating'] = 'Good';

    if (absDeltaMs <= 35) {
      rating = 'Perfect';
    } else if (absDeltaMs <= 75) {
      rating = 'Great';
    } else if (absDeltaMs <= 120) {
      rating = 'Good';
    } else if (deltaMs < 0) {
      rating = 'Early'; // Immediately register ahead-of-time tap as Early/Rushing
    } else {
      rating = 'Late';
    }

    targetEvent.played = true;

    return {
      rating,
      deltaMs,
      noteIndex: targetEvent.noteIndex
    };
  }

  private runTicker(latencyOffset: number) {
    const check = () => {
      if (this.cancelled) return;

      const now = this.audioContext.currentTime;
      const offsetNow = now - latencyOffset;

      this.targetEventsQueue.forEach(ev => {
        if (!ev.played && (offsetNow - ev.expectedTime) > 0.250) {
          ev.played = true;
          this.onNoteMissedCallback(ev.noteIndex);
        }
      });

      const limit = now - 2.0;
      this.targetEventsQueue = this.targetEventsQueue.filter(ev => ev.expectedTime > limit);

      this.tickerId = requestAnimationFrame(check);
    };

    this.tickerId = requestAnimationFrame(check);
  }

  private playOscillator(time: number, isDownbeat: boolean, isAccent: boolean = false, isSubdivision: boolean = false) {
    if (this.cancelled || this.isMuted) return;
    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      const freq = isDownbeat ? 1500 : isAccent ? 1250 : isSubdivision ? 2200 : 1000;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.0001, time);
      const targetVol = isDownbeat ? 0.35 : isAccent ? 0.25 : isSubdivision ? 0.22 : 0.20;
      gain.gain.exponentialRampToValueAtTime(targetVol, time + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + (isSubdivision ? 0.020 : 0.04));

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(time);
      osc.stop(time + (isSubdivision ? 0.025 : 0.05));

      this.scheduledNodes.push(osc, gain);
    } catch (e) {
      console.warn(`[PlaybackSession ${this.id}] Failed scheduling click:`, e);
    }
  }

  private playRhythmNoteSound(
    time: number,
    durationSeconds: number = 0.08,
    note?: RhythmNote,
    index?: number
  ) {
    if (this.cancelled || this.isMuted) return;
    try {
      // Determine acoustic woodblock register:
      // - Downbeats / Note 1 (Slot 1): Low resonant woodblock ('low' / 'C4')
      // - Tuplet subdivisions: Crisp mid/high woodblock ('high' / 'C5' / 'E5')
      let pitch = note?.pitch || 'C4';
      if (!note?.pitch && index !== undefined) {
        // Contour across notes: low downbeat, crisp high offbeats
        const contour = ['low', 'mid', 'high', 'high', 'mid', 'high'];
        pitch = contour[index % contour.length];
      }

      const nodes = playOrchestralWoodblockNote(
        this.audioContext,
        time,
        durationSeconds,
        pitch,
        null,
        0.90
      );
      this.scheduledNodes.push(...nodes);
    } catch (e) {
      console.warn(`[PlaybackSession ${this.id}] Failed scheduling orchestral woodblock note:`, e);
    }
  }

  public dispose() {
    this.cancelled = true;
    console.log(`[PlaybackSession ${this.id}] Disposing session`);

    // Cancel animation frame
    if (this.tickerId !== null) {
      cancelAnimationFrame(this.tickerId);
      this.tickerId = null;
    }

    // Clear all timeouts
    if (this.completionTimer !== null) {
      window.clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
    this.scheduledTimers.forEach(id => window.clearTimeout(id));
    this.scheduledTimers = [];

    // Stop and disconnect nodes
    this.scheduledNodes.forEach(node => {
      try {
        if ('stop' in node) {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {
        // Already stopped or not started
      }
    });
    this.scheduledNodes = [];

    // Close AudioContext to release device audio slot
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => {
        console.warn(`[PlaybackSession ${this.id}] Error closing context:`, err);
      });
    }
  }
}

export class PlaybackController {
  public instanceId: number;
  private activeSession: PlaybackSession | null = null;

  constructor() {
    instanceCount++;
    this.instanceId = instanceCount;
    console.log(`[PlaybackController ${this.instanceId}] constructed`);
  }

  public async startSession(
    bpm: number,
    timeSignature: TimeSignature,
    pattern: RhythmNote[],
    countdownOverride: number | null,
    playRhythmNotes: boolean,
    isMuted: boolean,
    latencyOffset: number,
    measures: Measure[] | null = null,
    assistanceConfig: AssistanceConfig | null = null,
    onBeat: (clickIndex: number, quarterPosition: number) => void,
    onNote: (noteIndex: number, quarterPosition: number) => void,
    onNoteMissed: (noteIndex: number) => void,
    onComplete: () => void
  ) {
    console.log(`[PlaybackController ${this.instanceId}] startSession() requested`);
    
    // Explicitly cancel and dispose previous session
    if (this.activeSession) {
      console.log(`[PlaybackController ${this.instanceId}] Terminating active session ${this.activeSession.id}`);
      this.activeSession.dispose();
      this.activeSession = null;
    }

    const session = new PlaybackSession(
      bpm,
      timeSignature,
      pattern,
      countdownOverride,
      playRhythmNotes,
      isMuted,
      measures,
      assistanceConfig,
      onBeat,
      onNote,
      onNoteMissed,
      onComplete
    );

    this.activeSession = session;
    await session.start(latencyOffset);
  }

  public registerStudentTap(latencyOffset: number): TapGrade | null {
    if (this.activeSession) {
      return this.activeSession.registerStudentTap(latencyOffset);
    }
    return null;
  }

  public stopSession() {
    console.log(`[PlaybackController ${this.instanceId}] stopSession() requested`);
    if (this.activeSession) {
      this.activeSession.dispose();
      this.activeSession = null;
    }
  }

  public dispose() {
    console.log(`[PlaybackController ${this.instanceId}] dispose() called`);
    this.stopSession();
  }
}
