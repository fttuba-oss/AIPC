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

export type PitchComplexityStage = 
  | 'single_pitch'      // Play entire rhythm on single comfortable note
  | 'two_note_contour'  // Alternating between 2 pitch levels
  | 'stepwise_contour'  // Stepwise melodic motion
  | 'original_melody';  // Full original melody and register leaps

export interface SinglePitchReductionState {
  stage: PitchComplexityStage;
  fixedPitch: { step: string; octave: number; alter?: number };
}

export class SinglePitchReductionStrategy extends BaseStrategy {
  readonly strategyId = 'R03';
  readonly name = 'Single-Pitch Reduction';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'technical_complexity';
  readonly progressionMode: ProgressionMode = 'restore_original_task';

  public scaffoldController: StrategyScaffoldController<SinglePitchReductionState>;

  constructor(pitch = { step: 'B', octave: 4, alter: -1 }) {
    super();

    const stages: PitchComplexityStage[] = [
      'single_pitch',
      'two_note_contour',
      'stepwise_contour',
      'original_melody',
    ];

    this.scaffoldController = new StrategyScaffoldController<SinglePitchReductionState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        stage: 'single_pitch',
        fixedPitch: pitch,
      },
      progressActionDescription: 'restore original pitch and fingering complexity stage-by-stage',
      regressActionDescription: 'simplify pitch demands back to single pitch or reduced contour',
      completionCondition: 'original notes and full melody restored with timing stability',
      onProgress: (state) => {
        const idx = stages.indexOf(state.stage);
        if (idx < stages.length - 1) {
          const nextStage = stages[idx + 1];
          return {
            newState: { ...state, stage: nextStage },
            isComplete: nextStage === 'original_melody',
            message: `Pitch complexity advanced to ${nextStage}.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Original melody restored.' };
      },
      onRegress: (state) => {
        const idx = stages.indexOf(state.stage);
        if (idx > 0) {
          const prevStage = stages[idx - 1];
          return {
            newState: { ...state, stage: prevStage },
            canRegress: true,
            message: `Simplifying pitch demands back to ${prevStage}.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at single-pitch baseline.' };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.stage) {
          case 'single_pitch': return 0;
          case 'two_note_contour': return 2;
          case 'stepwise_contour': return 4;
          case 'original_melody': return 5;
        }
      },
      isOriginalContextRetest: (state) => state.stage === 'original_melody',
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
      temporalSupport: isRetest ? 'None' : level === 0 ? 'Maximum' : 'Moderate',
      singlePitchOnly: state.stage === 'single_pitch',
      description: `Single-Pitch Reduction: stage = ${state.stage}`,
      learnerPrompt: isRetest
        ? 'Retest time! Original melody, pitch contour, and dynamics. Play with rhythmic confidence!'
        : state.stage === 'single_pitch'
        ? `Pitch complexity removed! Play the rhythm on a single comfortable note (${state.fixedPitch.step}).`
        : `Reintroducing pitch contour (${state.stage}). Keep the fingers light and synchronized with the rhythm.`,
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
    return `Timing instability on the instrument disappears when singing/clapping (${hypothesis.name}, ${hypothesis.capacityId}). ` +
      `Stripping away pitch intervals eliminates finger/embouchure dual-task interference, allowing ` +
      `the rhythmic motor program to lock before reintegrating melodic complexity.`;
  }
}
