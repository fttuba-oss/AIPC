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

export type SubdivisionGridStage = 
  | 'semiquaver_grid' // 16th-note ticks
  | 'quaver_grid'      // 8th-note ticks
  | 'beat_click'       // Quarter-note click only
  | 'sparse_click'     // Downbeat only
  | 'unsupported';     // Original notation unsupported

export interface ExplicitSubdivisionState {
  gridStage: SubdivisionGridStage;
  subdivisionRatio: number;
}

export class ExplicitSubdivisionStrategy extends BaseStrategy {
  readonly strategyId = 'R07';
  readonly name = 'Explicit Subdivision';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'subdivision_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<ExplicitSubdivisionState>;

  constructor() {
    super();

    const stages: SubdivisionGridStage[] = [
      'semiquaver_grid',
      'quaver_grid',
      'beat_click',
      'sparse_click',
      'unsupported',
    ];

    this.scaffoldController = new StrategyScaffoldController<ExplicitSubdivisionState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        gridStage: 'semiquaver_grid',
        subdivisionRatio: 4,
      },
      progressActionDescription: 'reduce subdivision grid density toward beat-only and unsupported',
      regressActionDescription: 'restore finer subdivision grid support',
      completionCondition: 'original rhythm performed evenly without subdivision support',
      onProgress: (state) => {
        const idx = stages.indexOf(state.gridStage);
        if (idx < stages.length - 1) {
          const nextStage = stages[idx + 1];
          const ratio = nextStage === 'semiquaver_grid' ? 4 : nextStage === 'quaver_grid' ? 2 : 1;
          return {
            newState: { gridStage: nextStage, subdivisionRatio: ratio },
            isComplete: nextStage === 'unsupported',
            message: `Subdivision grid reduced to ${nextStage}.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Subdivision grid fully faded.' };
      },
      onRegress: (state) => {
        const idx = stages.indexOf(state.gridStage);
        if (idx > 0) {
          const prevStage = stages[idx - 1];
          const ratio = prevStage === 'semiquaver_grid' ? 4 : 2;
          return {
            newState: { gridStage: prevStage, subdivisionRatio: ratio },
            canRegress: true,
            message: `Restoring finer subdivision grid ${prevStage}.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at maximum subdivision support.' };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.gridStage) {
          case 'semiquaver_grid': return 0;
          case 'quaver_grid': return 1;
          case 'beat_click': return 2;
          case 'sparse_click': return 3;
          case 'unsupported': return 5;
        }
      },
      isOriginalContextRetest: (state) => state.gridStage === 'unsupported',
    });
  }

  generateScaffold(
    level: AssistanceLevel,
    musicalContext: MusicalScoreContext
  ): StrategyScaffoldPayload {
    const isRetest = level === 5 || this.scaffoldController.isRetest();
    const state = this.scaffoldController.getState();

    const xml = musicalContext.xmlContent || '';
    const hasEmbeddedTriplets = xml.includes('<actual-notes>3') || xml.includes('8t') || xml.includes('4t');
    const effectiveRatio = hasEmbeddedTriplets && state.subdivisionRatio >= 2
      ? 3
      : state.subdivisionRatio;

    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : level === 0 ? 'Maximum' : level === 1 ? 'High' : level === 2 ? 'Moderate' : 'Low',
      subdivisionClicks: state.gridStage === 'semiquaver_grid' || state.gridStage === 'quaver_grid',
      subdivisionRatio: effectiveRatio,
      sparseClicksEveryNBeats: state.gridStage === 'sparse_click' ? 4 : undefined,
      description: hasEmbeddedTriplets
        ? `Explicit Subdivision: triplet grid (${effectiveRatio} per beat)`
        : `Explicit Subdivision: grid = ${state.gridStage}`,
      learnerPrompt: isRetest
        ? 'Retest time! Perform the original rhythm without any subdivision clicks.'
        : effectiveRatio > 1
        ? hasEmbeddedTriplets
          ? `Audible triplet subdivision grid active (3 ticks per beat) matching embedded triplets! Match every micro-tick evenly!`
          : `Audible subdivision grid active (${effectiveRatio} per beat). Match every micro-tick evenly!`
        : 'Primary beat click only. Keep the micro-grid subdivisions active inside your head!',
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
    return `Uneven subdivision reflects instability in internal grid formation (${hypothesis.capacityId}). ` +
      `Providing an explicit acoustic subdivision grid anchors the micro-timing lattice, ` +
      `then fading the grid forces the learner to generate equal subdivisions autonomously.`;
  }
}
