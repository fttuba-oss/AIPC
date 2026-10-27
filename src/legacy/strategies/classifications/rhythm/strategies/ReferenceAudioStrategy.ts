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

export type ReferenceAudioFunction = 'diagnostic_probe' | 'intervention' | 'feedback';

export type ReferenceAudioMode = 
  | 'reference_model'
  | 'listen_echo'
  | 'reference_comparison'
  | 'reference_fading';

export type ModelAvailabilityStage = 
  | 'continuous_model'      // Level 5: Full audio model provided on every trial
  | 'listen_echo'           // Level 4: Hear model -> echo back immediately (tap/clap/speak)
  | 'model_before_attempt'  // Level 3: Hear model once before performing on instrument
  | 'model_on_request'      // Level 2: Model silent unless requested; perform directly
  | 'no_model'              // Level 1: Zero model access, notation only
  | 'original_retest';      // Level 0: Original context retest unsupported

export interface ReferenceAudioState {
  currentStage: ModelAvailabilityStage;
  activeMode: ReferenceAudioMode;
  usageFunction: ReferenceAudioFunction;
  cellLengthBars: number; // prefer short isolated problem cells
}

export class ReferenceAudioStrategy extends BaseStrategy {
  readonly strategyId = 'R18';
  readonly name = 'Reference Audio / Listen-Echo';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'aural_model_availability';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<ReferenceAudioState>;

  constructor(initialMode: ReferenceAudioMode = 'listen_echo', usage: ReferenceAudioFunction = 'intervention') {
    super();

    const stageLadder: ModelAvailabilityStage[] = [
      'continuous_model',
      'listen_echo',
      'model_before_attempt',
      'model_on_request',
      'no_model',
      'original_retest',
    ];

    this.scaffoldController = new StrategyScaffoldController<ReferenceAudioState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        currentStage: initialMode === 'reference_model' ? 'continuous_model' : 'listen_echo',
        activeMode: initialMode,
        usageFunction: usage,
        cellLengthBars: 1, // Short isolated problem cell
      },
      progressActionDescription: 'reduce reference-model availability toward independent audiation',
      regressActionDescription: 'restore reference model access or shorten problem cell',
      completionCondition: 'perform original material without reference model',
      onProgress: (state) => {
        const currentIdx = stageLadder.indexOf(state.currentStage);
        if (currentIdx < stageLadder.length - 1) {
          const nextStage = stageLadder[currentIdx + 1];
          return {
            newState: { ...state, currentStage: nextStage },
            isComplete: nextStage === 'original_retest',
            message: `Aural model access reduced to ${nextStage}.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Reference model fully faded.' };
      },
      onRegress: (state) => {
        const currentIdx = stageLadder.indexOf(state.currentStage);
        if (currentIdx > 0) {
          const prevStage = stageLadder[currentIdx - 1];
          return {
            newState: { ...state, currentStage: prevStage },
            canRegress: true,
            message: `Restoring reference model access to ${prevStage}.`,
          };
        }
        return { newState: state, canRegress: false, message: 'Already at maximum reference model support.' };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.currentStage) {
          case 'continuous_model': return 0;
          case 'listen_echo': return 1;
          case 'model_before_attempt': return 2;
          case 'model_on_request': return 3;
          case 'no_model': return 4;
          case 'original_retest': return 5;
        }
      },
      isOriginalContextRetest: (state) => state.currentStage === 'original_retest',
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
      temporalSupport: isRetest ? 'None' : level === 0 ? 'Maximum' : level === 1 ? 'High' : level === 2 ? 'Moderate' : 'Low',
      description: `Reference Audio [${state.activeMode}]: stage = ${state.currentStage}`,
      learnerPrompt: this.getLearnerPrompt(state.currentStage),
    };

    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: [musicalContext.startMeasure, musicalContext.startMeasure + state.cellLengthBars - 1],
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
    return `Timing errors for ${signature.label} indicate an unstable internal temporal representation (${hypothesis.capacityId}). ` +
      `Providing an exact reference audio model eliminates decoding guesswork and establishes aural imagery, ` +
      `which is progressively faded until unassisted execution is achieved.`;
  }

  private getLearnerPrompt(stage: ModelAvailabilityStage): string {
    switch (stage) {
      case 'continuous_model':
        return 'Listen to this short rhythm first. Absorb the exact groove and duration proportions.';
      case 'listen_echo':
        return 'Listen to this short rhythm first. Then tap or speak it back in time!';
      case 'model_before_attempt':
        return 'Listen to the audio model once. Then perform it on your instrument without the model playing.';
      case 'model_on_request':
        return 'Play from the notation. The audio model is off, but available if you get stuck.';
      case 'no_model':
        return 'No audio model this time. Rely entirely on your inner audiation.';
      case 'original_retest':
        return 'Retest time! Play the original passage cleanly with zero audio reference.';
    }
  }
}
