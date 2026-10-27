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

export class ProgressiveRushingStrategy extends BaseStrategy {
  readonly strategyId = 'R12';
  readonly name = 'Progressive Rushing Pulse Stabilization';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 1; // Start at Level 1 (1 click/beat) or 0 if severe
  readonly scaffoldDimension: ScaffoldDimension = 'external_pulse_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  private fadingController = new FadingController({
    consecutiveSuccessesToAdvance: 2,
    consecutiveFailuresToRegress: 2,
    maxAttemptsPerLevel: 4,
  });

  private assistanceLadder: Record<AssistanceLevel, RhythmAssistanceConfig> = {
    0: {
      level: 0,
      temporalSupport: 'Maximum',
      subdivisionClicks: true,
      subdivisionRatio: 2,
      description: 'Full metronome with audible subdivision clicks.',
      learnerPrompt: 'Listen closely to the micro-grid! Match every subdivision and stay right on the click.',
    },
    1: {
      level: 1,
      temporalSupport: 'High',
      subdivisionClicks: false,
      description: 'Continuous beat click (1 click per beat).',
      learnerPrompt: 'Lock into the steady beat clicks. Don\'t anticipate the next beat.',
    },
    2: {
      level: 2,
      temporalSupport: 'Moderate',
      sparseClicksEveryNBeats: 4, // 1 click per measure in 4/4
      description: 'Sparse metronome: downbeat click only.',
      learnerPrompt: 'Downbeats only! Keep your own internal pulse steady across beats 2, 3, and 4.',
    },
    3: {
      level: 3,
      temporalSupport: 'Low',
      gapClick: { playBars: 2, silentBars: 2 },
      description: 'Gap-Click challenge: 2 bars click, 2 bars silence.',
      learnerPrompt: 'Metronome goes silent for 2 bars! Keep the tempo locked in your head so you land on the click when it returns.',
    },
    4: {
      level: 4,
      temporalSupport: 'Minimal',
      gapClick: { playBars: 2, silentBars: 4 },
      randomDropoutProb: 0.3,
      description: 'Extended silence gap: 2 bars click, 4 bars silence with random dropouts.',
      learnerPrompt: 'Extended silence! Trust your internal timekeeper all the way through.',
    },
    5: {
      level: 5,
      temporalSupport: 'None',
      description: 'Original passage retest without click at target tempo.',
      learnerPrompt: 'Retest time! Play the original passage cleanly with zero click. Show you own the pulse!',
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
      scaffoldXml: isRetest ? null : musicalContext.xmlContent, // Full score used with adaptive click
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
    return `Progressive rushing is driven by ${hypothesis.name} (${hypothesis.capacityId}). ` +
      `Instead of relying perpetually on an external click, this strategy trains the endogenous pacemaker ` +
      `by fading from a continuous micro-grid to sparse clicks and silent gap-clicks.`;
  }
}
