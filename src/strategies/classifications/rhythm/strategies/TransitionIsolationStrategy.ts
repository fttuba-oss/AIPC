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

export type ContextSpanStage = 
  | 'isolated_bottleneck'   // 2-3 note problem cell
  | 'with_lead_in'          // problem cell + 1 lead-in note/beat
  | 'with_lead_out'         // problem cell + lead-in + lead-out
  | 'short_phrase'          // 1 full measure containing the cell
  | 'full_passage';         // Complete original phrase context

export interface TransitionIsolationState {
  spanStage: ContextSpanStage;
  targetTransitionDescription: string;
}

export class TransitionIsolationStrategy extends BaseStrategy {
  readonly strategyId = 'R16';
  readonly name = 'Transition Isolation & Chunking';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'musical_context_span';
  readonly progressionMode: ProgressionMode = 'expand_context';

  public scaffoldController: StrategyScaffoldController<TransitionIsolationState>;

  constructor(targetTransition = 'Bars 7-8 bottleneck') {
    super();

    const stages: ContextSpanStage[] = [
      'isolated_bottleneck',
      'with_lead_in',
      'with_lead_out',
      'short_phrase',
      'full_passage',
    ];

    this.scaffoldController = new StrategyScaffoldController<TransitionIsolationState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        spanStage: 'isolated_bottleneck',
        targetTransitionDescription: targetTransition,
      },
      progressActionDescription: 'expand surrounding musical context from isolated cell toward full phrase',
      regressActionDescription: 'shrink context back to smaller isolated problem cell',
      completionCondition: 'full original phrase executed smoothly across the transition',
      onProgress: (state) => {
        const idx = stages.indexOf(state.spanStage);
        if (idx < stages.length - 1) {
          const nextStage = stages[idx + 1];
          return {
            newState: { ...state, spanStage: nextStage },
            isComplete: nextStage === 'full_passage',
            message: `Context expanded to ${nextStage}.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Full phrase context reached.' };
      },
      onRegress: (state) => {
        const idx = stages.indexOf(state.spanStage);
        if (idx > 0) {
          const prevStage = stages[idx - 1];
          return {
            newState: { ...state, spanStage: prevStage },
            canRegress: true,
            message: `Shrinking context back to ${prevStage}.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at minimal isolated bottleneck cell.' };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.spanStage) {
          case 'isolated_bottleneck': return 0;
          case 'with_lead_in': return 1;
          case 'with_lead_out': return 2;
          case 'short_phrase': return 3;
          case 'full_passage': return 5;
        }
      },
      isOriginalContextRetest: (state) => state.spanStage === 'full_passage',
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
      transitionLoopOnly: state.spanStage !== 'full_passage',
      description: `Transition Isolation: span = ${state.spanStage}`,
      learnerPrompt: isRetest
        ? 'Retest time! Perform the complete musical phrase through the transition with seamless flow.'
        : `Focusing on ${state.spanStage}: ${state.targetTransitionDescription}. Loop smoothly without hesitation.`,
    };

    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: state.spanStage === 'full_passage' 
        ? [musicalContext.startMeasure, musicalContext.endMeasure]
        : [musicalContext.startMeasure, musicalContext.startMeasure + 1],
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
    return `Timing breakdown clusters sharply at a specific transition point (${hypothesis.name}, ${hypothesis.capacityId}). ` +
      `Isolating a short 2-4 note cell allows motor chunking to stabilize before systematically adding ` +
      `lead-in and lead-out notes to reintegrate the figure into the phrase.`;
  }
}
