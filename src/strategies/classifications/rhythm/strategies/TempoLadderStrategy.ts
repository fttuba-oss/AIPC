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

export interface TempoLadderConfig {
  targetBpm: number;
  initialStableBpm?: number;
  incrementType?: 'fixed' | 'percentage' | 'adaptive';
  fixedBpmStep?: number;
  percentageStep?: number;
}

export interface TempoLadderState {
  targetBpm: number;
  currentBpm: number;
  stableBpm: number;
  incrementType: 'fixed' | 'percentage' | 'adaptive';
  stepSize: number;
  tempoHistory: Array<{ bpm: number; passed: boolean; variabilityMs?: number }>;
  breakdownThresholdBpm?: number;
  isCompleted: boolean;
}

export class TempoLadderStrategy extends BaseStrategy {
  readonly strategyId = 'R22';
  readonly name = 'Tempo Ladder Calibration';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 1;
  readonly scaffoldDimension: ScaffoldDimension = 'tempo_demand';
  readonly progressionMode: ProgressionMode = 'increase_difficulty';

  public scaffoldController: StrategyScaffoldController<TempoLadderState>;

  constructor(config: TempoLadderConfig = { targetBpm: 120 }) {
    super();

    const targetBpm = config.targetBpm || 120;
    const initialStableBpm = config.initialStableBpm ?? Math.round(targetBpm * 0.70);
    const incrementType = config.incrementType || 'fixed';
    const stepSize = config.fixedBpmStep || 4;

    this.scaffoldController = new StrategyScaffoldController<TempoLadderState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        targetBpm,
        currentBpm: initialStableBpm,
        stableBpm: initialStableBpm,
        incrementType,
        stepSize,
        tempoHistory: [{ bpm: initialStableBpm, passed: true }],
        isCompleted: false,
      },
      progressActionDescription: 'increase BPM toward target tempo while preserving timing stability',
      regressActionDescription: 'decrease BPM to the most recent stable tempo rung and mark threshold',
      completionCondition: `original passage performed with stability at target tempo (${targetBpm} BPM)`,
      onProgress: (state, metrics) => {
        const history = [...state.tempoHistory, { bpm: state.currentBpm, passed: true, variabilityMs: metrics.timingVariabilityMs }];
        const newStableBpm = state.currentBpm;

        // Check if we are already at or above target tempo
        if (state.currentBpm >= state.targetBpm) {
          return {
            newState: {
              ...state,
              stableBpm: newStableBpm,
              tempoHistory: history,
              isCompleted: true,
            },
            isComplete: true,
            message: `Target tempo ${state.targetBpm} BPM mastered! Ready for original-context retest.`,
          };
        }

        // Calculate next BPM step
        let nextBpm: number;
        if (state.incrementType === 'percentage') {
          nextBpm = Math.round(state.currentBpm * (1 + (config.percentageStep || 0.05)));
        } else if (state.incrementType === 'adaptive') {
          // If accuracy is very high and variability is low, take an 8-bpm jump, otherwise 4
          const jump = (metrics.accuracyRate > 0.95 && (metrics.timingVariabilityMs || 50) < 15) ? 8 : 4;
          nextBpm = state.currentBpm + jump;
        } else {
          nextBpm = state.currentBpm + state.stepSize;
        }

        if (nextBpm > state.targetBpm) {
          nextBpm = state.targetBpm;
        }

        return {
          newState: {
            ...state,
            currentBpm: nextBpm,
            stableBpm: newStableBpm,
            tempoHistory: history,
          },
          isComplete: nextBpm >= state.targetBpm && state.currentBpm >= state.targetBpm,
          message: `Advancing tempo from ${state.currentBpm} BPM to ${nextBpm} BPM (target: ${state.targetBpm} BPM).`,
        };
      },
      onRegress: (state, metrics) => {
        const history = [...state.tempoHistory, { bpm: state.currentBpm, passed: false, variabilityMs: metrics.timingVariabilityMs }];
        const breakdownThreshold = state.currentBpm;

        // Regress back to most recent stable tempo
        const regressBpm = state.stableBpm < state.currentBpm ? state.stableBpm : Math.max(40, state.currentBpm - state.stepSize);

        return {
          newState: {
            ...state,
            currentBpm: regressBpm,
            breakdownThresholdBpm: breakdownThreshold,
            tempoHistory: history,
          },
          canRegress: true,
          message: `Breakdown detected at ${breakdownThreshold} BPM. Regressing to stable baseline ${regressBpm} BPM.`,
        };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isCompleted || state.currentBpm >= state.targetBpm) return 5;
        const ratio = state.currentBpm / state.targetBpm;
        if (ratio < 0.70) return 0;
        if (ratio < 0.80) return 1;
        if (ratio < 0.90) return 2;
        if (ratio < 0.95) return 3;
        return 4;
      },
      isOriginalContextRetest: (state) => state.isCompleted && state.currentBpm >= state.targetBpm,
    });
  }

  generateScaffold(
    level: AssistanceLevel,
    musicalContext: MusicalScoreContext
  ): StrategyScaffoldPayload {
    const state = this.scaffoldController.getState();
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const effectiveBpm = isRetest ? state.targetBpm : state.currentBpm;

    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : level <= 1 ? 'High' : level <= 3 ? 'Moderate' : 'Low',
      targetTempoPercent: Math.round((effectiveBpm / state.targetBpm) * 100),
      description: `Tempo Ladder: ${effectiveBpm} BPM (${Math.round((effectiveBpm / state.targetBpm) * 100)}% of target ${state.targetBpm} BPM)`,
      learnerPrompt: isRetest 
        ? `Final Retest at full target tempo ${state.targetBpm} BPM! Perform cleanly without error.`
        : `Playing at ${effectiveBpm} BPM. Keep the timing relaxed and stable before stepping up.`,
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
    _level: AssistanceLevel,
    metrics: PerformanceAttemptMetrics,
    consecutiveSuccesses: number,
    consecutiveFailures: number,
    attemptsAtLevel: number
  ): FadingEvaluationResult {
    return this.scaffoldController.evaluateAttempt(
      metrics,
      consecutiveSuccesses,
      consecutiveFailures,
      attemptsAtLevel
    );
  }

  getMechanismRationale(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    const state = this.scaffoldController.getState();
    return `Timing is stable at lower tempos but breaks down near ${state.targetBpm} BPM (${hypothesis.name}, ${hypothesis.capacityId}). ` +
      `Systematically increasing tempo in small increments allows motor programs to consolidate ` +
      `without triggering tension or coordination collapse.`;
  }
}
