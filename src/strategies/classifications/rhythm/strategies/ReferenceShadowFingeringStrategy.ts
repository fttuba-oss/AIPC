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

export type ShadowFingeringStage = 
  | 'shadow_guided'       // Level 0: Reference audio + visual cursor, silent shadow-fingering
  | 'active_playing'      // Level 1: Active playing attempt without reference audio
  | 'original_retest';    // Level 2: Original context retest

export interface ShadowFingeringState {
  currentStage: ShadowFingeringStage;
  attemptCount: number;
  maxAttempts: number;
}

export class ReferenceShadowFingeringStrategy extends BaseStrategy {
  readonly strategyId = 'DI-REF-SHADOW-01';
  readonly name = 'Reference Audio + Shadow Fingering';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'aural_model_availability';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<ShadowFingeringState>;

  constructor() {
    super();

    const stageLadder: ShadowFingeringStage[] = [
      'shadow_guided',
      'active_playing',
      'original_retest',
    ];

    this.scaffoldController = new StrategyScaffoldController<ShadowFingeringState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        currentStage: 'shadow_guided',
        attemptCount: 0,
        maxAttempts: 3,
      },
      progressActionDescription: 'transition from silent shadow rehearsal to active playing attempt and original retest',
      regressActionDescription: 're-listen to reference audio and shadow finger',
      completionCondition: 'active playing attempt on instrument executed with rhythmic accuracy',
      onProgress: (state) => {
        const currentIdx = stageLadder.indexOf(state.currentStage);
        if (currentIdx < stageLadder.length - 1) {
          const nextStage = stageLadder[currentIdx + 1];
          return {
            newState: { ...state, currentStage: nextStage, attemptCount: 0 },
            isComplete: nextStage === 'original_retest',
            message: `Progressing to ${nextStage === 'active_playing' ? 'Active Playing Attempt' : 'Original Retest'}.`,
          };
        }
        return { newState: state, isComplete: true, message: 'Reference shadow sequence complete.' };
      },
      onRegress: (state) => {
        return {
          newState: { ...state, currentStage: 'shadow_guided', attemptCount: state.attemptCount + 1 },
          canRegress: true,
          message: 'Returning to Reference Audio + Shadow Fingering.',
        };
      },
      mapStateToSupportLevel: (state) => {
        switch (state.currentStage) {
          case 'shadow_guided': return 0;
          case 'active_playing': return 2;
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

    const isShadow = state.currentStage === 'shadow_guided';
    const config: RhythmAssistanceConfig = {
      level,
      temporalSupport: isRetest ? 'None' : isShadow ? 'Maximum' : 'Low',
      description: isShadow 
        ? 'DI-REF-SHADOW-01: Listen to reference audio and shadow-finger silently along with the moving cursor.'
        : 'DI-REF-SHADOW-01: Active playing attempt on your instrument at target tempo.',
      shadowFingeringMode: isShadow,
      learnerPrompt: isShadow
        ? '👀 Listen to the audio and shadow-finger silently on your instrument as the cursor moves.'
        : '🎵 Now play it for real on your instrument! Match the timing you just practiced.',
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

    // If max attempts reached at active playing stage without success, trigger refer/pivot
    if (state.currentStage === 'active_playing' && newAttemptCount >= state.maxAttempts && metrics.accuracyRate < 0.70) {
      return {
        action: 'refer_to_teacher',
        previousLevel: level,
        newLevel: level,
        consecutiveSuccesses: 0,
        consecutiveFailures: consecutiveFailures + 1,
        message: 'Active playing attempt after shadow fingering did not resolve timing errors (suggests motor execution breakdown RC08).',
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
    return `Learner demonstrated rhythmic instability for ${signature.label}. ` +
      `Reference Audio + Shadow Fingering provides ground-truth auditory-visual demonstration while eliminating ` +
      `acoustic production pressure, verifying whether perceptual representation (RC05) or instrumental execution (RC08) is the primary constraint.`;
  }
}
