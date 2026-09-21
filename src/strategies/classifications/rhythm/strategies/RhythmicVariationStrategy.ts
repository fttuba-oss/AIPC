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

export type RhythmicVariationStage = 
  | 'dotted_long_short'    // Dotted 8th + 16th alteration (locks finger landing)
  | 'reverse_short_long'   // 16th + dotted 8th alteration (reverse snap)
  | 'triplet_variation'    // Triplet feel variation
  | 'original_written';    // Return to written even sixteenths

export interface RhythmicVariationState {
  variationStage: RhythmicVariationStage;
}

export class RhythmicVariationStrategy extends BaseStrategy {
  readonly strategyId = 'R24';
  readonly name = 'Rhythmic Variation';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'rhythmic_transformation';
  readonly progressionMode: ProgressionMode = 'restore_original_task';

  public scaffoldController: StrategyScaffoldController<RhythmicVariationState>;

  constructor() {
    super();

    const stages: RhythmicVariationStage[] = [
      'dotted_long_short',
      'reverse_short_long',
      'triplet_variation',
      'original_written',
    ];

    this.scaffoldController = new StrategyScaffoldController<RhythmicVariationState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        variationStage: 'dotted_long_short',
      },
      progressActionDescription: 'move from stabilizing transformed practice rhythm back to written rhythm',
      regressActionDescription: 'return to the stabilizing rhythmic variation pattern',
      completionCondition: 'original written rhythm executed evenly with pristine timing',
      onProgress: (state) => {
        const idx = stages.indexOf(state.variationStage);
        if (idx < stages.length - 1) {
          const nextStage = stages[idx + 1];
          return {
            newState: { variationStage: nextStage },
            isComplete: nextStage === 'original_written',
            message: `Rhythmic variation progressed to ${nextStage}.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Original written rhythm restored.' };
      },
      onRegress: (state) => {
        const idx = stages.indexOf(state.variationStage);
        if (idx > 0) {
          const prevStage = stages[idx - 1];
          return {
            newState: { variationStage: prevStage },
            canRegress: true,
            message: `Returning to stabilizing variation ${prevStage}.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at initial variation pattern.' };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.variationStage) {
          case 'dotted_long_short': return 0;
          case 'reverse_short_long': return 2;
          case 'triplet_variation': return 4;
          case 'original_written': return 5;
        }
      },
      isOriginalContextRetest: (state) => state.variationStage === 'original_written',
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
      temporalSupport: isRetest ? 'None' : 'Moderate',
      description: `Rhythmic Variation: ${state.variationStage}`,
      learnerPrompt: isRetest
        ? 'Retest time! Perform the written rhythm cleanly with equal, balanced subdivisions.'
        : `Practicing with rhythmic variation (${state.variationStage}). Use the altered rhythm to lock finger coordination.`,
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
    return `Motor hesitation on equal subdivisions often indicates synchronization rigidity (${hypothesis.name}, ${hypothesis.capacityId}). ` +
      `Altering the rhythm into long-short and short-long pairings shifts neuro-motor coordination boundaries ` +
      `before returning to the written rhythm with enhanced clarity and independence.`;
  }
}
