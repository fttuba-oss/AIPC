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

export class UnevenSubdivisionStrategy extends BaseStrategy {
  readonly strategyId = 'R07';
  readonly name = 'Explicit Subdivision Grid & Fading';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'subdivision_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  private fadingController = new FadingController();

  private assistanceLadder: Record<AssistanceLevel, RhythmAssistanceConfig> = {
    0: {
      level: 0,
      temporalSupport: 'Maximum',
      subdivisionClicks: true,
      subdivisionRatio: 4, // 16th-note subdivision
      description: 'Reference audio model playback and echo reproduction (R18).',
      learnerPrompt: 'Listen to the reference model, then speak or tap the rhythm exactly as heard.',
    },
    1: {
      level: 1,
      temporalSupport: 'High',
      subdivisionClicks: true,
      subdivisionRatio: 4,
      description: 'Continuous audible subdivision grid (R07/R08 - Fill every subdivision).',
      learnerPrompt: 'Play with the audible sixteenth-note click grid. Every note sits precisely on a tick.',
    },
    2: {
      level: 2,
      temporalSupport: 'Moderate',
      subdivisionClicks: true,
      subdivisionRatio: 2, // Faded down to eighths
      description: 'Audible-to-silent subdivision fading (R09).',
      learnerPrompt: 'Grid is lighter now (eighth notes only). Feel the sixteenths inside your mind between clicks.',
    },
    3: {
      level: 3,
      temporalSupport: 'Low',
      subdivisionClicks: false,
      sparseClicksEveryNBeats: 1, // Quarter-note beat click only
      description: 'Primary beat click only. Student vocalizes subdivisions.',
      learnerPrompt: 'Metronome clicks on the main beat only. Whisper "1-e-&-a" as you play.',
    },
    4: {
      level: 4,
      temporalSupport: 'Minimal',
      sparseClicksEveryNBeats: 2, // Every 2 beats
      description: 'Sparse beat click. Internalized subdivision.',
      learnerPrompt: 'Sparse clicks every two beats. Maintain equal subdivision spacing purely through internal pulse.',
    },
    5: {
      level: 5,
      temporalSupport: 'None',
      subdivisionClicks: false,
      description: 'Original rhythm unsupported at target tempo.',
      learnerPrompt: 'Retest time! Play the original passage without any subdivision clicks.',
    },
  };

  generateScaffold(
    level: AssistanceLevel,
    musicalContext: MusicalScoreContext
  ): StrategyScaffoldPayload {
    const baseConfig = this.assistanceLadder[level];
    const isRetest = level === 5;
    const xml = musicalContext.xmlContent || '';
    const hasEmbeddedTriplets = xml.includes('<actual-notes>3') || xml.includes('8t') || xml.includes('4t');

    const config: RhythmAssistanceConfig = {
      ...baseConfig,
      subdivisionRatio: hasEmbeddedTriplets && baseConfig.subdivisionClicks ? 3 : baseConfig.subdivisionRatio,
      learnerPrompt: hasEmbeddedTriplets && baseConfig.subdivisionClicks
        ? `Audible triplet subdivision grid active (3 ticks per beat) to match embedded triplets! Keep notes locked to the grid.`
        : baseConfig.learnerPrompt,
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
    return `Uneven subdivision reflects instability in ${hypothesis.name} (${hypothesis.capacityId}). ` +
      `Providing an external subdivision scaffold anchors the micro-timing lattice; then fading the grid ` +
      `forces cognitive encoding of equal proportional intervals.`;
  }
}
