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

export class SyncopationTiesStrategy extends BaseStrategy {
  readonly strategyId = 'R20';
  readonly name = 'X-Ray Rhythm & Syncopation Ghost Beats';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'metrical_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  private fadingController = new FadingController();

  private assistanceLadder: Record<AssistanceLevel, RhythmAssistanceConfig> = {
    0: {
      level: 0,
      temporalSupport: 'Maximum',
      ghostNotesAudible: true,
      ghostNotesGain: 1.0,
      description: 'X-Ray Rhythm: Ghost every missing beat and tied duration audibly and notationally (R20).',
      learnerPrompt: 'X-Ray Mode activated! Every hidden beat inside the tie is made audible with a soft ghost tap.',
    },
    1: {
      level: 1,
      temporalSupport: 'High',
      ghostNotesAudible: true,
      ghostNotesGain: 0.5, // Attenuated ghost notes
      description: 'Attenuated Ghost Beats: Softened audio cues during tied notes.',
      learnerPrompt: 'The ghost taps are quieter now (50% volume). Feel the underlying beat even as you sustain the tie.',
    },
    2: {
      level: 2,
      temporalSupport: 'Moderate',
      ghostNotesAudible: false,
      selectedMetricPositions: [1, 2, 3, 4],
      description: 'Embodied beat tapping: Tap the hidden beat physically while speaking the written rhythm (R06).',
      learnerPrompt: 'Ghost taps are muted. Tap your foot on the hidden beats while holding the sustained note.',
    },
    3: {
      level: 3,
      temporalSupport: 'Low',
      ghostNotesAudible: false,
      sparseClicksEveryNBeats: 1,
      description: 'Whispered subdivision: Whisper the subdivision across the tie to anchor off-beat release.',
      learnerPrompt: 'Whisper "1-&-2-&" under your breath during the tie. Land cleanly on the off-beat attack.',
    },
    4: {
      level: 4,
      temporalSupport: 'Minimal',
      sparseClicksEveryNBeats: 4, // Downbeat click only
      description: 'Metric anchor: Single downbeat click per bar (R14). Internal metrical organization.',
      learnerPrompt: 'Only the downbeat click is sounding. Rely on your internal metric lattice.',
    },
    5: {
      level: 5,
      temporalSupport: 'None',
      ghostNotesAudible: false,
      description: 'Original score notation retest without ghost beats or metric prompts.',
      learnerPrompt: 'Retest time! Original notation, no ghost beats. Play the syncopation with total rhythmic confidence.',
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
    return `Timing errors clustering after ties or rests stem from loss of ${hypothesis.name} (${hypothesis.capacityId}). ` +
      `Making the latent metrical pulse explicit via audible ghost notes ("X-Ray Rhythm") reconstitutes ` +
      `the metric frame before fading assistance.`;
  }
}
