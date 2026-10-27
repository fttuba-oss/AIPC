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

export type BurstSpanStage = 
  | 'micro_burst_3_notes'  // 3-note high-speed burst
  | 'burst_6_notes'        // 6-note burst
  | 'single_measure_burst' // 1 measure burst
  | 'continuous_passage';  // Full continuous passage

export interface BurstPracticeState {
  burstStage: BurstSpanStage;
  burstLengthNotes: number;
}

export class BurstPracticeStrategy extends BaseStrategy {
  readonly strategyId = 'R23';
  readonly name = 'Burst Practice';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'continuous_execution_span';
  readonly progressionMode: ProgressionMode = 'increase_difficulty';

  public scaffoldController: StrategyScaffoldController<BurstPracticeState>;

  constructor() {
    super();

    const stages: BurstSpanStage[] = [
      'micro_burst_3_notes',
      'burst_6_notes',
      'single_measure_burst',
      'continuous_passage',
    ];

    this.scaffoldController = new StrategyScaffoldController<BurstPracticeState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        burstStage: 'micro_burst_3_notes',
        burstLengthNotes: 3,
      },
      progressActionDescription: 'lengthen continuous execution span toward full passage',
      regressActionDescription: 'shorten continuous execution burst span',
      completionCondition: 'full continuous passage executed at target tempo without fatigue or tension',
      onProgress: (state) => {
        const idx = stages.indexOf(state.burstStage);
        if (idx < stages.length - 1) {
          const nextStage = stages[idx + 1];
          const notes = nextStage === 'micro_burst_3_notes' ? 3 : nextStage === 'burst_6_notes' ? 6 : nextStage === 'single_measure_burst' ? 12 : 24;
          return {
            newState: { burstStage: nextStage, burstLengthNotes: notes },
            isComplete: nextStage === 'continuous_passage',
            message: `Burst span lengthened to ${nextStage}.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Continuous passage achieved.' };
      },
      onRegress: (state) => {
        const idx = stages.indexOf(state.burstStage);
        if (idx > 0) {
          const prevStage = stages[idx - 1];
          const notes = prevStage === 'micro_burst_3_notes' ? 3 : prevStage === 'burst_6_notes' ? 6 : 12;
          return {
            newState: { burstStage: prevStage, burstLengthNotes: notes },
            canRegress: true,
            message: `Shortening burst span to ${prevStage}.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at minimal micro-burst.' };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.burstStage) {
          case 'micro_burst_3_notes': return 0;
          case 'burst_6_notes': return 2;
          case 'single_measure_burst': return 4;
          case 'continuous_passage': return 5;
        }
      },
      isOriginalContextRetest: (state) => state.burstStage === 'continuous_passage',
    });
  }

  generateScaffold(
    level: AssistanceLevel,
    musicalContext: MusicalScoreContext
  ): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const state = this.scaffoldController.getState();

    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : level <= 1 ? 'High' : 'Moderate',
      description: `Burst Practice: span = ${state.burstStage}`,
      learnerPrompt: isRetest
        ? 'Retest time! Execute the full continuous passage without stopping.'
        : `Play in a rapid, relaxed ${state.burstLengthNotes}-note burst, then pause and reset.`,
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
    return `Motor coordination collapses over longer spans while short cells succeed at speed (${hypothesis.name}, ${hypothesis.capacityId}). ` +
      `Burst practice isolates short reflexive motor firings without allowing fatigue or tension to compound, ` +
      `gradually chaining bursts into a continuous phrase.`;
  }
}
