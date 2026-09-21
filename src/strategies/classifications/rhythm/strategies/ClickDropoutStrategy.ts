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
import { FadingController } from '../../../core/controllers/FadingController';
import { RhythmAssistanceConfig } from '../types/rhythmStrategy';

export class ClickDropoutStrategy extends BaseStrategy {
  readonly strategyId = 'R12_DROPOUT';
  readonly name = 'Click Dropout & Re-entry Precision';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'unsupported_time';
  readonly progressionMode: ProgressionMode = 'increase_difficulty';

  private fadingController = new FadingController();

  private assistanceLadder: Record<AssistanceLevel, RhythmAssistanceConfig> = {
    0: {
      level: 0,
      temporalSupport: 'Maximum',
      gapClick: { playBars: 4, silentBars: 2 },
      description: '4 bars click, 2 bars silent dropout.',
      learnerPrompt: 'The click plays for 4 bars, then drops out for 2 bars. Keep your pulse steady and nail the re-entry!',
    },
    1: {
      level: 1,
      temporalSupport: 'High',
      gapClick: { playBars: 2, silentBars: 2 },
      description: '2 bars click, 2 bars silent dropout.',
      learnerPrompt: 'Shorter warning now: 2 bars click, then 2 bars of silence. Hold your ground!',
    },
    2: {
      level: 2,
      temporalSupport: 'Moderate',
      gapClick: { playBars: 2, silentBars: 4 },
      description: '2 bars click, 4 bars silent dropout.',
      learnerPrompt: 'Longer gap: 4 bars of silence! Subdivide mentally to prevent drifting early.',
    },
    3: {
      level: 3,
      temporalSupport: 'Low',
      sparseClicksEveryNBeats: 4, // 1 click per measure
      description: 'Single anchor click on measure 1 downbeat only.',
      learnerPrompt: 'Only one click at the start of each bar. You are driving the rhythm now.',
    },
    4: {
      level: 4,
      temporalSupport: 'Minimal',
      randomDropoutProb: 0.5,
      description: 'Unpredictable random click dropout.',
      learnerPrompt: 'Unpredictable dropouts! Stay alert—the click will disappear and reappear randomly.',
    },
    5: {
      level: 5,
      temporalSupport: 'None',
      description: 'Original passage retest without any click.',
      learnerPrompt: 'Retest time! Play the full section completely solo without any click.',
    },
  };

  generateScaffold(
    level: AssistanceLevel,
    musicalContext: MusicalScoreContext
  ): StrategyScaffoldPayload {
    const config = this.assistanceLadder[level];
    const isRetest = level === 5;

    return {
      strategyId: this.strategyId,
      strategyName: this.name,
      level,
      scaffoldXml: isRetest ? null : musicalContext.xmlContent,
      measureRange: [musicalContext.startMeasure, musicalContext.endMeasure],
      assistanceConfig: config,
      mascotInstruction: config.learnerPrompt,
      isRetest,
    };
  }

  evaluateAttempt(
    level: AssistanceLevel,
    metrics: PerformanceAttemptMetrics,
    consecutiveSuccesses: number,
    consecutiveFailures: number,
    attemptsAtLevel: number
  ): FadingEvaluationResult {
    return this.fadingController.evaluateAttempt(
      level,
      metrics,
      consecutiveSuccesses,
      consecutiveFailures,
      attemptsAtLevel
    );
  }

  getMechanismRationale(
    _signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    return `Drifting when external click stops indicates reliance on external synchronization rather than ` +
      `${hypothesis.name} (${hypothesis.capacityId}). Systematically lengthening silent gaps strengthens ` +
      `internal representation and reduces re-entry error upon beat restoration.`;
  }
}
