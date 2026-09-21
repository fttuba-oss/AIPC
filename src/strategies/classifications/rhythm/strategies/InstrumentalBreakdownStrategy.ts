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

export class InstrumentalBreakdownStrategy extends BaseStrategy {
  readonly strategyId = 'R03';
  readonly name = 'Single-Pitch Reduction & Transition Isolation';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'technical_complexity';
  readonly progressionMode: ProgressionMode = 'restore_original_task';

  private fadingController = new FadingController();

  private assistanceLadder: Record<AssistanceLevel, RhythmAssistanceConfig> = {
    0: {
      level: 0,
      temporalSupport: 'Maximum',
      singlePitchOnly: true,
      description: 'Single-pitch reduction: Play the written rhythm on one single comfortable pitch (R03).',
      learnerPrompt: 'Pitch complexity removed! Play the rhythm on one single comfortable note (e.g. concert Bb/C).',
    },
    1: {
      level: 1,
      temporalSupport: 'High',
      transitionLoopOnly: true,
      singlePitchOnly: false,
      description: 'Transition Isolator: Short 2-4 note loop around the bottleneck with 1 lead-in note.',
      learnerPrompt: 'We isolated the exact 3-note shift causing the hesitation. Loop just this small cell smoothly.',
    },
    2: {
      level: 2,
      temporalSupport: 'Moderate',
      articulationNeutralized: true,
      transitionLoopOnly: true,
      description: 'Articulation neutralization: Play the cell completely slurred/legato to decouple fingers from tonguing.',
      learnerPrompt: 'Slur all notes in the transition loop. Focus 100% on finger synchronisation without tonguing load.',
    },
    3: {
      level: 3,
      temporalSupport: 'Low',
      targetTempoPercent: 75,
      transitionLoopOnly: false,
      description: 'Tempo ladder: Reintegrate into phrase context at 75% target tempo.',
      learnerPrompt: 'Transition restored into the phrase at 75% tempo. Keep the motion fluid and relaxed.',
    },
    4: {
      level: 4,
      temporalSupport: 'Minimal',
      targetTempoPercent: 90,
      description: 'Near-target tempo ladder: Phrase context at 90% target tempo.',
      learnerPrompt: 'Tempo up to 90%! Maintain the clean finger placement you found in the loop.',
    },
    5: {
      level: 5,
      temporalSupport: 'None',
      singlePitchOnly: false,
      transitionLoopOnly: false,
      targetTempoPercent: 100,
      articulationNeutralized: false,
      description: 'Original passage retest at 100% tempo with full pitch, articulation, and expression.',
      learnerPrompt: 'Retest time! Original pitches, original articulation, full 100% tempo. Let\'s play!',
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
    return `Timing instability occurring only on the instrument (while vocalization is stable) points directly ` +
      `to ${hypothesis.name} (${hypothesis.capacityId}). Stripping away pitch variability and isolating the ` +
      `problematic transition allows motor pathway stabilization before rebuilding tempo.`;
  }
}
