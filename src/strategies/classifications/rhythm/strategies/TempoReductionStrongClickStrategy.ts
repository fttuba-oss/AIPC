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

export interface SlowClickState {
  targetBpm: number;
  currentBpm: number;
  stage: 'reduced_strong_click' | 'accelerating' | 'target_retest';
  attemptCount: number;
  maxAttempts: number;
}

export class TempoReductionStrongClickStrategy extends BaseStrategy {
  readonly strategyId = 'DI-SLOW-CLICK-01';
  readonly name = 'Tempo Reduction + Strong Downbeat Click';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'tempo_demand';
  readonly progressionMode: ProgressionMode = 'increase_difficulty';

  public scaffoldController: StrategyScaffoldController<SlowClickState>;

  constructor(targetBpm: number = 84) {
    super();

    const reducedBpm = Math.max(48, Math.round(targetBpm - Math.min(20, targetBpm * 0.20)));

    this.scaffoldController = new StrategyScaffoldController<SlowClickState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        targetBpm,
        currentBpm: reducedBpm,
        stage: 'reduced_strong_click',
        attemptCount: 0,
        maxAttempts: 3,
      },
      progressActionDescription: 'accelerate from reduced tempo with strong clicks toward target tempo and unassisted retest',
      regressActionDescription: 'drop back to initial reduced tempo with strong clicks',
      completionCondition: 'original passage performed cleanly at target tempo',
      onProgress: (state) => {
        if (state.stage === 'reduced_strong_click') {
          const midBpm = Math.round((state.targetBpm + state.currentBpm) / 2);
          return {
            newState: { ...state, stage: 'accelerating', currentBpm: midBpm, attemptCount: 0 },
            isComplete: false,
            message: `Tempo increased to intermediate ${midBpm} BPM.`,
          };
        } else if (state.stage === 'accelerating') {
          return {
            newState: { ...state, stage: 'target_retest', currentBpm: state.targetBpm, attemptCount: 0 },
            isComplete: true,
            message: `Progressing to target tempo (${state.targetBpm} BPM) unassisted retest.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Tempo progression complete.' };
      },
      onRegress: (state) => {
        const reduced = Math.max(48, Math.round(state.targetBpm - Math.min(20, state.targetBpm * 0.20)));
        return {
          newState: { ...state, stage: 'reduced_strong_click', currentBpm: reduced, attemptCount: state.attemptCount + 1 },
          canRegress: true,
          message: `Resetting to safe reduced tempo of ${reduced} BPM with strong metronome clicks.`,
        };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.stage) {
          case 'reduced_strong_click': return 0;
          case 'accelerating': return 2;
          case 'target_retest': return 5;
        }
      },
      isOriginalContextRetest: (state) => state.stage === 'target_retest',
    });
  }

  generateScaffold(
    level: AssistanceLevel,
    musicalContext: MusicalScoreContext
  ): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const state = this.scaffoldController.getState();

    // Use current adaptive BPM from state
    const effectiveBpm = isRetest ? musicalContext.tempoBpm : state.currentBpm;

    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : 'Maximum',
      description: isRetest 
        ? `DI-SLOW-CLICK-01: Retest at target tempo (${musicalContext.tempoBpm} BPM) unassisted.`
        : `DI-SLOW-CLICK-01: Reduced tempo (${effectiveBpm} BPM) with strong accented clicks on every beat.`,
      reducedBpm: effectiveBpm,
      strongClick: !isRetest,
      learnerPrompt: isRetest
        ? `🎯 Target Tempo Retest! Play the original passage at ${musicalContext.tempoBpm} BPM with steady timing.`
        : `🐢 Slowed down to ${effectiveBpm} BPM with a clear, strong beat. Lock your timing into the metronome!`,
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

  evaluateAttempt(
    level: AssistanceLevel,
    metrics: PerformanceAttemptMetrics,
    consecutiveSuccesses: number,
    consecutiveFailures: number,
    attemptsAtLevel: number
  ): FadingEvaluationResult {
    const state = this.scaffoldController.getState();
    const newAttemptCount = state.attemptCount + 1;
    this.scaffoldController.setState({ ...state, attemptCount: newAttemptCount });

    // If max attempts reached at reduced tempo without resolving error
    if (state.stage === 'reduced_strong_click' && newAttemptCount >= state.maxAttempts && metrics.accuracyRate < 0.70) {
      return {
        action: 'refer_to_teacher',
        previousLevel: level,
        newLevel: level,
        consecutiveSuccesses: 0,
        consecutiveFailures: consecutiveFailures + 1,
        message: 'Timing errors persist even at reduced tempo with strong metronome guidance (indicates representational/structural issue rather than velocity limit).',
        isRetest: false,
      };
    }

    return this.scaffoldController.evaluateAttempt(
      metrics,
      consecutiveSuccesses,
      consecutiveFailures,
      attemptsAtLevel
    );
  }

  getMechanismRationale(
    signature: GenericProblemSignature,
    _hypothesis: GenericHypothesis
  ): string {
    return `Timing errors for ${signature.label} may stem from velocity load or motor planning congestion. ` +
      `Reducing the tempo expands the temporal integration window, while strong metronome guidance anchors phase ` +
      `synchronisation, isolating whether the bottleneck is motor execution speed (RC08) or underlying rhythmic comprehension (RC05).`;
  }
}
