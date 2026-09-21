import { BaseStrategy, MusicalScoreContext } from '../../../core/base/BaseStrategy';
import { AssistanceLevel, FadingEvaluationResult } from '../../../core/types/fading';
import { 
  PerformanceAttemptMetrics, 
  StrategyScaffoldPayload, 
  GenericProblemSignature, 
  GenericHypothesis,
  ScaffoldDimension,
  ProgressionMode 
} from '../../../core/types/strategy';
import { StrategyScaffoldController } from '../../../core/controllers/StrategyScaffoldController';
import { RhythmAssistanceConfig } from '../types/rhythmStrategy';

// ── 1. Full Metronome (R10) ──────────────────────────────────────────────────
export interface FullMetronomeState {
  clickVolume: number;
  isRetest: boolean;
}

export class FullMetronomeStrategy extends BaseStrategy {
  readonly strategyId = 'R10';
  readonly name = 'Full Metronome Synchronisation';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'external_pulse_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<FullMetronomeState>;

  constructor() {
    super();
    this.scaffoldController = new StrategyScaffoldController<FullMetronomeState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: { clickVolume: 1.0, isRetest: false },
      progressActionDescription: 'reduce external click volume toward autonomous timekeeping',
      regressActionDescription: 'restore full volume click guidance',
      completionCondition: 'beat synchronisation verified within tolerance',
      onProgress: (state) => {
        if (state.clickVolume > 0.4) {
          const nextVol = Math.round((state.clickVolume - 0.3) * 10) / 10;
          return {
            newState: { clickVolume: nextVol, isRetest: false },
            isComplete: false,
            message: `Click volume reduced to ${Math.round(nextVol * 100)}%.`,
          };
        }
        return {
          newState: { clickVolume: 0, isRetest: true },
          isComplete: true,
          message: 'Full metronome mastered! Ready for unassisted retest.',
        };
      },
      onRegress: (state) => {
        if (state.clickVolume < 1.0) {
          return {
            newState: { clickVolume: 1.0, isRetest: false },
            canRegress: true,
            message: 'Restoring full volume click support.',
          };
        }
        return { newState: state, canRegress: false, message: 'Already at maximum click support.' };
      },
      mapStateToSupportLevel: (state) => (state.isRetest ? 5 : state.clickVolume >= 0.8 ? 0 : 2),
      isOriginalContextRetest: (state) => state.isRetest,
    });
  }

  generateScaffold(level: AssistanceLevel, musicalContext: MusicalScoreContext): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : 'Maximum',
      description: 'Full metronome: continuous beat click on every beat.',
      learnerPrompt: isRetest
        ? 'Retest time! Play without click with solid beat synchronisation.'
        : 'Lock into the continuous click on every beat. Mask the click sound with your note onset.',
    };
    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: [musicalContext.startMeasure, musicalContext.endMeasure],
      assistanceConfig: config,
      mascotInstruction: config.learnerPrompt,
      isRetest,
      scaffoldDescriptor: this.scaffoldController.getDescriptor(),
    };
  }

  evaluateAttempt(_level: AssistanceLevel, metrics: PerformanceAttemptMetrics, successes: number, failures: number, attempts: number): FadingEvaluationResult {
    return this.scaffoldController.evaluateAttempt(metrics, successes, failures, attempts);
  }

  getMechanismRationale(_signature: GenericProblemSignature, hypothesis: GenericHypothesis): string {
    return `Unstable beat synchronisation (${hypothesis.capacityId}) requires continuous external acoustic reference ` +
      `to calibrate predictive sensorimotor phase-locking.`;
  }
}

// ── 2. Sparse Metronome (R11) ────────────────────────────────────────────────
export interface SparseMetronomeState {
  sparseClicksEveryNBeats: number;
  isRetest: boolean;
}

export class SparseMetronomeStrategy extends BaseStrategy {
  readonly strategyId = 'R11';
  readonly name = 'Sparse Metronome';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 1;
  readonly scaffoldDimension: ScaffoldDimension = 'external_pulse_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<SparseMetronomeState>;

  constructor() {
    super();
    // Progression: every beat (1) -> beats 1 & 3 (2) -> downbeat only (4) -> 1 per 2 bars (8) -> retest
    const steps = [1, 2, 4, 8];
    this.scaffoldController = new StrategyScaffoldController<SparseMetronomeState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: { sparseClicksEveryNBeats: 1, isRetest: false },
      progressActionDescription: 'reduce click density by spacing clicks further apart',
      regressActionDescription: 'restore denser click anchors',
      completionCondition: 'stable tempo maintained with sparse anchors and unassisted retest',
      onProgress: (state) => {
        const idx = steps.indexOf(state.sparseClicksEveryNBeats);
        if (idx < steps.length - 1) {
          const next = steps[idx + 1];
          return {
            newState: { sparseClicksEveryNBeats: next, isRetest: false },
            isComplete: false,
            message: `Click density reduced: click every ${next} beats.`,
          };
        }
        return {
          newState: { sparseClicksEveryNBeats: 8, isRetest: true },
          isComplete: true,
          message: 'Sparse metronome mastered! Ready for unassisted retest.',
        };
      },
      onRegress: (state) => {
        const idx = steps.indexOf(state.sparseClicksEveryNBeats);
        if (idx > 0) {
          const prev = steps[idx - 1];
          return {
            newState: { sparseClicksEveryNBeats: prev, isRetest: false },
            canRegress: true,
            message: `Restoring denser clicks every ${prev} beats.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at maximum click density.' };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.sparseClicksEveryNBeats === 1) return 1;
        if (state.sparseClicksEveryNBeats === 2) return 2;
        if (state.sparseClicksEveryNBeats === 4) return 3;
        return 4;
      },
      isOriginalContextRetest: (state) => state.isRetest,
    });
  }

  generateScaffold(level: AssistanceLevel, musicalContext: MusicalScoreContext): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const state = this.scaffoldController.getState();
    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : level <= 1 ? 'High' : 'Moderate',
      sparseClicksEveryNBeats: state.sparseClicksEveryNBeats,
      description: `Sparse Metronome: click every ${state.sparseClicksEveryNBeats} beats`,
      learnerPrompt: isRetest
        ? 'Retest time! Play without click. Show you own the pulse.'
        : `Click is sounding every ${state.sparseClicksEveryNBeats} beats. Subdivide internally between clicks.`,
    };
    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: [musicalContext.startMeasure, musicalContext.endMeasure],
      assistanceConfig: config,
      mascotInstruction: config.learnerPrompt,
      isRetest,
      scaffoldDescriptor: this.scaffoldController.getDescriptor(),
    };
  }

  evaluateAttempt(_level: AssistanceLevel, metrics: PerformanceAttemptMetrics, successes: number, failures: number, attempts: number): FadingEvaluationResult {
    return this.scaffoldController.evaluateAttempt(metrics, successes, failures, attempts);
  }

  getMechanismRationale(_signature: GenericProblemSignature, hypothesis: GenericHypothesis): string {
    return `Reducing anchor density forces internal striatal oscillator timekeeping mechanisms (${hypothesis.capacityId}) ` +
      `to span larger temporal intervals without external cueing.`;
  }
}

// ── 3. Gap-Click Strategy (R12) ──────────────────────────────────────────────
export interface GapClickState {
  playBars: number;
  silentBars: number;
  randomDropout?: boolean;
  isRetest: boolean;
}

export class GapClickStrategy extends BaseStrategy {
  readonly strategyId = 'R12';
  readonly name = 'Gap-Click Practice';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'unsupported_time';
  readonly progressionMode: ProgressionMode = 'increase_difficulty';

  public scaffoldController: StrategyScaffoldController<GapClickState>;

  constructor() {
    super();
    // Progression: 4 play / 2 silent -> 2/2 -> 2/4 -> random dropout -> retest
    const gapStages: Array<{ playBars: number; silentBars: number; randomDropout: boolean }> = [
      { playBars: 4, silentBars: 2, randomDropout: false },
      { playBars: 2, silentBars: 2, randomDropout: false },
      { playBars: 2, silentBars: 4, randomDropout: false },
      { playBars: 2, silentBars: 4, randomDropout: true },
    ];

    this.scaffoldController = new StrategyScaffoldController<GapClickState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        playBars: gapStages[0].playBars,
        silentBars: gapStages[0].silentBars,
        randomDropout: gapStages[0].randomDropout,
        isRetest: false,
      },
      progressActionDescription: 'increase duration and unpredictability of silent intervals',
      regressActionDescription: 'shorten silent intervals and restore click anchors',
      completionCondition: 're-entry error inside tolerance across silent intervals',
      onProgress: (state) => {
        const idx = gapStages.findIndex(s => s.playBars === state.playBars && s.silentBars === state.silentBars && s.randomDropout === state.randomDropout);
        if (idx >= 0 && idx < gapStages.length - 1) {
          const next = gapStages[idx + 1];
          return {
            newState: {
              playBars: next.playBars,
              silentBars: next.silentBars,
              randomDropout: next.randomDropout,
              isRetest: false,
            },
            isComplete: false,
            message: `Gap extended: ${next.playBars} bars click / ${next.silentBars} bars silence${next.randomDropout ? ' (random)' : ''}.`,
          };
        }
        return {
          newState: { ...state, isRetest: true },
          isComplete: true,
          message: 'Gap-click mastered! Ready for unassisted retest.',
        };
      },
      onRegress: (state) => {
        const idx = gapStages.findIndex(s => s.playBars === state.playBars && s.silentBars === state.silentBars && s.randomDropout === state.randomDropout);
        if (idx > 0) {
          const prev = gapStages[idx - 1];
          return {
            newState: {
              playBars: prev.playBars,
              silentBars: prev.silentBars,
              randomDropout: prev.randomDropout,
              isRetest: false,
            },
            canRegress: true,
            message: `Shortening silence back to ${prev.playBars} bars click / ${prev.silentBars} bars silence.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at shortest gap duration.' };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.silentBars === 2 && state.playBars === 4) return 0;
        if (state.silentBars === 2 && state.playBars === 2) return 1;
        if (state.silentBars === 4 && !state.randomDropout) return 2;
        return 3;
      },
      isOriginalContextRetest: (state) => state.isRetest,
    });
  }

  generateScaffold(level: AssistanceLevel, musicalContext: MusicalScoreContext): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const state = this.scaffoldController.getState();
    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : level <= 1 ? 'High' : 'Moderate',
      gapClick: isRetest ? undefined : { playBars: state.playBars, silentBars: state.silentBars },
      randomDropoutProb: state.randomDropout ? 0.4 : undefined,
      description: `Gap Click: ${state.playBars} bars on / ${state.silentBars} bars silent`,
      learnerPrompt: isRetest
        ? 'Retest time! Play the entire section without any metronome.'
        : `Metronome sounds for ${state.playBars} bars, then goes silent for ${state.silentBars} bars. Nail the re-entry!`,
    };
    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: [musicalContext.startMeasure, musicalContext.endMeasure],
      assistanceConfig: config,
      mascotInstruction: config.learnerPrompt,
      isRetest,
      scaffoldDescriptor: this.scaffoldController.getDescriptor(),
    };
  }

  evaluateAttempt(_level: AssistanceLevel, metrics: PerformanceAttemptMetrics, successes: number, failures: number, attempts: number): FadingEvaluationResult {
    return this.scaffoldController.evaluateAttempt(metrics, successes, failures, attempts);
  }

  getMechanismRationale(_signature: GenericProblemSignature, hypothesis: GenericHypothesis): string {
    return `Drifting when external click stops indicates reliance on external synchronization rather than ` +
      `${hypothesis.name} (${hypothesis.capacityId}). Systematically lengthening silent gaps strengthens ` +
      `internal timekeeping representations and minimizes re-entry error.`;
  }
}

// ── 4. Synchronisation-Continuation Strategy (R13) ───────────────────────────
export interface SyncContinuationState {
  pacedBars: number;
  continuationBars: number;
  isRetest: boolean;
}

export class SynchronisationContinuationStrategy extends BaseStrategy {
  readonly strategyId = 'R13';
  readonly name = 'Synchronisation-Continuation';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'unsupported_time';
  readonly progressionMode: ProgressionMode = 'increase_difficulty';

  public scaffoldController: StrategyScaffoldController<SyncContinuationState>;

  constructor() {
    super();
    // 8 paced / 8 free -> 4 paced / 16 free -> count-in only -> retest
    const stages: Array<{ pacedBars: number; continuationBars: number }> = [
      { pacedBars: 8, continuationBars: 8 },
      { pacedBars: 4, continuationBars: 16 },
      { pacedBars: 1, continuationBars: 24 },
    ];

    this.scaffoldController = new StrategyScaffoldController<SyncContinuationState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: { pacedBars: stages[0].pacedBars, continuationBars: stages[0].continuationBars, isRetest: false },
      progressActionDescription: 'lengthen unassisted continuation window and reduce paced warmup',
      regressActionDescription: 'shorten unassisted continuation window and restore pacing',
      completionCondition: 'unassisted continuation drift slope below tolerance threshold',
      onProgress: (state) => {
        const idx = stages.findIndex(s => s.pacedBars === state.pacedBars && s.continuationBars === state.continuationBars);
        if (idx >= 0 && idx < stages.length - 1) {
          const next = stages[idx + 1];
          return {
            newState: { pacedBars: next.pacedBars, continuationBars: next.continuationBars, isRetest: false },
            isComplete: false,
            message: `Continuation lengthened: ${next.pacedBars} bars paced / ${next.continuationBars} bars continuation.`,
          };
        }
        return {
          newState: { ...state, isRetest: true },
          isComplete: true,
          message: 'Synchronisation-continuation mastered! Ready for unassisted retest.',
        };
      },
      onRegress: (state) => {
        const idx = stages.findIndex(s => s.pacedBars === state.pacedBars && s.continuationBars === state.continuationBars);
        if (idx > 0) {
          const prev = stages[idx - 1];
          return {
            newState: { pacedBars: prev.pacedBars, continuationBars: prev.continuationBars, isRetest: false },
            canRegress: true,
            message: `Returning to ${prev.pacedBars} paced / ${prev.continuationBars} continuation bars.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at shortest continuation span.' };
      },
      mapStateToSupportLevel: (state) => (state.isRetest ? 5 : state.pacedBars === 8 ? 0 : state.pacedBars === 4 ? 2 : 4),
      isOriginalContextRetest: (state) => state.isRetest,
    });
  }

  generateScaffold(level: AssistanceLevel, musicalContext: MusicalScoreContext): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const state = this.scaffoldController.getState();
    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : 'Moderate',
      description: `Sync-Continuation: ${state.pacedBars} paced bars, then ${state.continuationBars} bars unassisted`,
      learnerPrompt: isRetest
        ? 'Retest time! Play without pacing. Demonstrate steady endogenous tempo.'
        : `Synchronize with the click for ${state.pacedBars} bars, then continue playing steadily for ${state.continuationBars} bars when click stops.`,
    };
    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: [musicalContext.startMeasure, musicalContext.endMeasure],
      assistanceConfig: config,
      mascotInstruction: config.learnerPrompt,
      isRetest,
      scaffoldDescriptor: this.scaffoldController.getDescriptor(),
    };
  }

  evaluateAttempt(_level: AssistanceLevel, metrics: PerformanceAttemptMetrics, successes: number, failures: number, attempts: number): FadingEvaluationResult {
    return this.scaffoldController.evaluateAttempt(metrics, successes, failures, attempts);
  }

  getMechanismRationale(_signature: GenericProblemSignature, hypothesis: GenericHypothesis): string {
    return `Assessing and training endogenous pacemaker drift (${hypothesis.capacityId}) ` +
      `by transitioning from auditory synchronisation directly to self-sustained motor continuation.`;
  }
}

// ── 5. Ghost Beat / X-Ray Rhythm Strategy (R20) ──────────────────────────────
export interface GhostBeatState {
  ghostGain: number;
  ghostAudible: boolean;
  isRetest: boolean;
}

export class GhostBeatStrategy extends BaseStrategy {
  readonly strategyId = 'R20';
  readonly name = 'Ghost Beat / X-Ray Rhythm';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'metrical_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<GhostBeatState>;

  constructor() {
    super();
    // Progression: loud ghost (1.0) -> attenuated ghost (0.5) -> whispered/tap (0.2) -> internal (silent) -> retest
    const gains = [1.0, 0.5, 0.2, 0.0];

    this.scaffoldController = new StrategyScaffoldController<GhostBeatState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: { ghostGain: 1.0, ghostAudible: true, isRetest: false },
      progressActionDescription: 'remove audible and visible hidden-beat metrical cues progressively',
      regressActionDescription: 'restore louder ghost beats and explicit metrical structure',
      completionCondition: 'original syncopations performed accurately unsupported',
      onProgress: (state) => {
        const idx = gains.indexOf(state.ghostGain);
        if (idx < gains.length - 1) {
          const next = gains[idx + 1];
          return {
            newState: { ghostGain: next, ghostAudible: next > 0, isRetest: false },
            isComplete: next === 0,
            message: next > 0 ? `Ghost beat attenuated to ${Math.round(next * 100)}% volume.` : 'Ghost beats muted (internal subdivision only).',
          };
        }
        return {
          newState: { ghostGain: 0, ghostAudible: false, isRetest: true },
          isComplete: true,
          message: 'Ghost beats fully removed! Ready for unassisted retest.',
        };
      },
      onRegress: (state) => {
        const idx = gains.indexOf(state.ghostGain);
        if (idx > 0) {
          const prev = gains[idx - 1];
          return {
            newState: { ghostGain: prev, ghostAudible: true, isRetest: false },
            canRegress: true,
            message: `Restoring louder ghost beats (${Math.round(prev * 100)}%).`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at maximum ghost beat support.' };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.ghostGain >= 0.8) return 0;
        if (state.ghostGain >= 0.4) return 1;
        if (state.ghostGain > 0) return 3;
        return 4;
      },
      isOriginalContextRetest: (state) => state.isRetest,
    });
  }

  generateScaffold(level: AssistanceLevel, musicalContext: MusicalScoreContext): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const state = this.scaffoldController.getState();
    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : level <= 1 ? 'Maximum' : 'Moderate',
      ghostNotesAudible: state.ghostAudible,
      ghostNotesGain: state.ghostGain,
      description: `Ghost Beat / X-Ray Rhythm: gain = ${Math.round(state.ghostGain * 100)}%`,
      learnerPrompt: isRetest
        ? 'Retest time! Original notation, no ghost beats. Play the syncopations with total confidence.'
        : state.ghostAudible
        ? `X-Ray Mode! Hidden beats inside ties are sounded with soft ghost notes (${Math.round(state.ghostGain * 100)}%).`
        : 'Ghost beats are muted. Tap or whisper the hidden pulse internally!',
    };
    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: [musicalContext.startMeasure, musicalContext.endMeasure],
      assistanceConfig: config,
      mascotInstruction: config.learnerPrompt,
      isRetest,
      scaffoldDescriptor: this.scaffoldController.getDescriptor(),
    };
  }

  evaluateAttempt(_level: AssistanceLevel, metrics: PerformanceAttemptMetrics, successes: number, failures: number, attempts: number): FadingEvaluationResult {
    return this.scaffoldController.evaluateAttempt(metrics, successes, failures, attempts);
  }

  getMechanismRationale(_signature: GenericProblemSignature, hypothesis: GenericHypothesis): string {
    return `Timing errors clustering after ties or syncopations reflect metrical organization loss (${hypothesis.capacityId}). ` +
      `Making latent beats audible ("X-Ray Rhythm") restores metric lattice hierarchy ` +
      `before progressively withdrawing auditory cues.`;
  }
}
