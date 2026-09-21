import { BaseStrategy } from '../../../core/base/BaseStrategy';
import { ScaffoldDimension, ProgressionMode } from '../../../core/types/strategy';
import { ReferenceAudioStrategy } from '../strategies/ReferenceAudioStrategy';
import { TempoLadderStrategy } from '../strategies/TempoLadderStrategy';
import { ExplicitSubdivisionStrategy } from '../strategies/ExplicitSubdivisionStrategy';
import { SinglePitchReductionStrategy } from '../strategies/SinglePitchReductionStrategy';
import { TransitionIsolationStrategy } from '../strategies/TransitionIsolationStrategy';
import { BurstPracticeStrategy } from '../strategies/BurstPracticeStrategy';
import { RhythmicVariationStrategy } from '../strategies/RhythmicVariationStrategy';
import { 
  FullMetronomeStrategy, 
  SparseMetronomeStrategy, 
  GapClickStrategy, 
  SynchronisationContinuationStrategy, 
  GhostBeatStrategy 
} from '../strategies/PulseStrategies';
import {
  CommonSubdivisionGridStrategy,
  CoincidenceAnchoringStrategy,
  LayerAlternationExchangeStrategy,
  BeatPlusCounterRhythmStrategy,
  PolyrhythmWheelStrategy,
  AsymmetricAdditiveStrategy
} from '../strategies/CrossRhythmStrategies';
import { ReferenceShadowFingeringStrategy } from '../strategies/ReferenceShadowFingeringStrategy';
import { TempoReductionStrongClickStrategy } from '../strategies/TempoReductionStrongClickStrategy';


export interface StrategyRegistryEntry {
  strategyId: string;
  name: string;
  family: string;
  applicableCapacities: string[];
  useConditions: string[];
  procedureSteps: string[];
  scaffoldDimension: ScaffoldDimension;
  progressionMode: ProgressionMode;
  progressAction: string;
  regressAction: string;
  completionCondition: string;
  successCriteria: string;
  transferRetest: string;
  factory: (options?: any) => BaseStrategy;
}

export class RhythmStrategyRegistry {
  private static registry: Map<string, StrategyRegistryEntry> = new Map();

  static {
    // 1. Reference Audio / Listen-Echo (R18)
    this.register({
      strategyId: 'R18',
      name: 'Reference Audio / Listen-Echo',
      family: 'Representation',
      applicableCapacities: ['RC04', 'RC05', 'RC06'],
      useConditions: ['Learner lacks clear auditory mental image of the rhythm; notation decoding causes hesitation.'],
      procedureSteps: ['Listen to short target cell.', 'Echo back in time via clapping or tapping.', 'Transfer rhythm to instrument.', 'Fade model.'],
      scaffoldDimension: 'aural_model_availability',
      progressionMode: 'withdraw_support',
      progressAction: 'reduce access to model (continuous -> echo -> model before attempt -> on request -> none)',
      regressAction: 'restore reference model access or shorten target cell',
      completionCondition: 'perform original material cleanly without reference model',
      successCriteria: '90%+ echo accuracy; timing variability < 25ms without model',
      transferRetest: 'Perform original passage unsupported without reference audio.',
      factory: (opts) => new ReferenceAudioStrategy(opts?.mode, opts?.usage),
    });

    // 2. Tempo Ladder (R22)
    this.register({
      strategyId: 'R22',
      name: 'Tempo Ladder Calibration',
      family: 'Tempo calibration',
      applicableCapacities: ['RC08', 'RC07'],
      useConditions: ['Passage is accurate at reduced tempo but timing breaks down near target tempo.'],
      procedureSteps: ['Start at stable baseline tempo.', 'Increase BPM by configurable step after 2 successes.', 'Regress to stable tempo on failure.', 'Consolidate at target.'],
      scaffoldDimension: 'tempo_demand',
      progressionMode: 'increase_difficulty',
      progressAction: 'increase BPM while preserving timing quality',
      regressAction: 'return to most recent stable tempo',
      completionCondition: 'original passage performed with stability at target tempo',
      successCriteria: 'Repeatable success (2 passes) inside tolerance before each BPM increase',
      transferRetest: 'Perform unassisted run at target tempo in original musical context.',
      factory: (opts) => new TempoLadderStrategy(opts),
    });

    // 3. Explicit Subdivision (R07)
    this.register({
      strategyId: 'R07',
      name: 'Explicit Subdivision',
      family: 'Subdivision',
      applicableCapacities: ['RC04', 'RC05'],
      useConditions: ['Short notes (16ths/triplets) are uneven or rushed; internal subdivision grid is weak.'],
      procedureSteps: ['Activate audible subdivision grid.', 'Align attacks with micro-ticks.', 'Fade grid to beat click and then silence.'],
      scaffoldDimension: 'subdivision_support',
      progressionMode: 'withdraw_support',
      progressAction: 'reduce subdivision grid density (16th -> 8th -> beat click -> unsupported)',
      regressAction: 'restore finer subdivision grid support',
      completionCondition: 'original rhythm performed evenly without subdivision support',
      successCriteria: 'Timing variability drops below 25ms on equal subdivisions',
      transferRetest: 'Original passage performed at target tempo with zero subdivision clicks.',
      factory: () => new ExplicitSubdivisionStrategy(),
    });

    // 4. Full Metronome (R10)
    this.register({
      strategyId: 'R10',
      name: 'Full Metronome Synchronisation',
      family: 'Synchronisation',
      applicableCapacities: ['RC02'],
      useConditions: ['Basic beat synchronisation is unstable; learner requires continuous external pulse.'],
      procedureSteps: ['Align attacks so metronome click is acoustically masked by onset.', 'Reduce click volume as phase locks.'],
      scaffoldDimension: 'external_pulse_support',
      progressionMode: 'withdraw_support',
      progressAction: 'reduce click volume toward autonomous timekeeping',
      regressAction: 'restore full volume click guidance',
      completionCondition: 'beat synchronisation verified within tolerance',
      successCriteria: 'Mean asynchrony within +/- 20ms across consecutive measures',
      transferRetest: 'Perform passage without continuous click maintaining beat alignment.',
      factory: () => new FullMetronomeStrategy(),
    });

    // 5. Sparse Metronome (R11)
    this.register({
      strategyId: 'R11',
      name: 'Sparse Metronome',
      family: 'Internalisation',
      applicableCapacities: ['RC03'],
      useConditions: ['Learner tracks every beat with click, but rushes or drags when clicks stop.'],
      procedureSteps: ['Play with beat click.', 'Reduce to beats 1 and 3.', 'Reduce to downbeat only.', 'Reduce to 1 click per 2 bars.'],
      scaffoldDimension: 'external_pulse_support',
      progressionMode: 'withdraw_support',
      progressAction: 'reduce click density by spacing click anchors further apart',
      regressAction: 'restore denser click anchors',
      completionCondition: 'stable tempo maintained with sparse anchors and unassisted retest',
      successCriteria: 'Drift slope absolute value < 1.5 ms/beat across measures',
      transferRetest: 'Perform 8 measures with zero click maintaining steady tempo.',
      factory: () => new SparseMetronomeStrategy(),
    });

    // 6. Gap Click (R12)
    this.register({
      strategyId: 'R12',
      name: 'Gap-Click Practice',
      family: 'Internalisation',
      applicableCapacities: ['RC03', 'RC09'],
      useConditions: ['Stable while click is present, but drifts during silence; re-entry error > 40ms.'],
      procedureSteps: ['Play with click.', 'Continue playing seamlessly during silent bars.', 'Check re-entry error when click resumes.'],
      scaffoldDimension: 'unsupported_time',
      progressionMode: 'increase_difficulty',
      progressAction: 'increase duration and unpredictability of silent intervals',
      regressAction: 'shorten silent intervals and restore click anchors',
      completionCondition: 're-entry error inside tolerance across silent intervals',
      successCriteria: 'Re-entry error within +/- 30ms across consecutive silent intervals',
      transferRetest: 'Full passage performed without click at target tempo.',
      factory: () => new GapClickStrategy(),
    });

    // 7. Synchronisation-Continuation (R13)
    this.register({
      strategyId: 'R13',
      name: 'Synchronisation-Continuation',
      family: 'Internalisation',
      applicableCapacities: ['RC03'],
      useConditions: ['Diagnosing and training pure endogenous pacemaker stability across extended duration.'],
      procedureSteps: ['Provide count-in and pacing bars.', 'Click mutes permanently.', 'Learner continues playing steadily.'],
      scaffoldDimension: 'unsupported_time',
      progressionMode: 'increase_difficulty',
      progressAction: 'lengthen unassisted continuation window and reduce paced warmup',
      regressAction: 'shorten unassisted continuation window and restore pacing',
      completionCondition: 'unassisted continuation drift slope below tolerance threshold',
      successCriteria: 'Drift slope absolute value < 1.2 ms/beat across continuation bars',
      transferRetest: 'Long-phrase execution without metronome drift.',
      factory: () => new SynchronisationContinuationStrategy(),
    });

    // 8. Ghost Beat / X-Ray Rhythm (R20)
    this.register({
      strategyId: 'R20',
      name: 'Ghost Beat / X-Ray Rhythm',
      family: 'Metric reconstruction',
      applicableCapacities: ['RC06', 'RC04'],
      useConditions: ['Errors cluster immediately following tied notes, rests, or syncopated downbeats.'],
      procedureSteps: ['Sound every missing or tied beat with an audible ghost note.', 'Attenuate ghost volume.', 'Fade to silent inner pulse.'],
      scaffoldDimension: 'metrical_support',
      progressionMode: 'withdraw_support',
      progressAction: 'remove audible and visible hidden-beat metrical cues progressively',
      regressAction: 'restore louder ghost beats and explicit metrical structure',
      completionCondition: 'original syncopations performed accurately unsupported',
      successCriteria: 'Timing error on offbeat attacks following ties < 25ms',
      transferRetest: 'Original score notation performed cleanly with no ghost beats.',
      factory: () => new GhostBeatStrategy(),
    });

    // 9. Single-Pitch Reduction (R03)
    this.register({
      strategyId: 'R03',
      name: 'Single-Pitch Reduction',
      family: 'Representation',
      applicableCapacities: ['RC08', 'RC05'],
      useConditions: ['Rhythm is clapped or spoken accurately, but collapses when playing melodic pitches on the instrument.'],
      procedureSteps: ['Play written rhythm on one comfortable mid-register pitch.', 'Reintroduce 2-note alternation.', 'Restore stepwise contour.', 'Full melody.'],
      scaffoldDimension: 'technical_complexity',
      progressionMode: 'restore_original_task',
      progressAction: 'restore original pitch and fingering complexity stage-by-stage',
      regressAction: 'simplify pitch demands back to single pitch or reduced contour',
      completionCondition: 'original notes and full melody restored with timing stability',
      successCriteria: 'Timing variability on single pitch matches clapped baseline; preserved when melody restored',
      transferRetest: 'Perform original melody with full tone, pitch, and articulation.',
      factory: (opts) => new SinglePitchReductionStrategy(opts?.fixedPitch),
    });

    // 10. Transition Isolation (R16)
    this.register({
      strategyId: 'R16',
      name: 'Transition Isolation & Chunking',
      family: 'Chunking',
      applicableCapacities: ['RC08', 'RC05'],
      useConditions: ['Errors cluster consistently at a specific fingering, register, or coordination transition.'],
      procedureSteps: ['Isolate 2-4 note bottleneck.', 'Loop smoothly with metronome.', 'Add lead-in note.', 'Add lead-out note.', 'Reintegrate into phrase.'],
      scaffoldDimension: 'musical_context_span',
      progressionMode: 'expand_context',
      progressAction: 'expand surrounding musical context from isolated cell toward full phrase',
      regressAction: 'shrink context back to smaller isolated problem cell',
      completionCondition: 'full original phrase executed smoothly across the transition',
      successCriteria: 'Zero hesitation or timing spike across the transition in 5 consecutive loops',
      transferRetest: 'Perform full 4-bar phrase smoothly through the bottleneck.',
      factory: (opts) => new TransitionIsolationStrategy(opts?.targetTransition),
    });

    // 11. Burst Practice (R23)
    this.register({
      strategyId: 'R23',
      name: 'Burst Practice',
      family: 'Tempo calibration',
      applicableCapacities: ['RC08'],
      useConditions: ['Short cell succeeds at target tempo, but longer continuous passage causes tension and timing collapse.'],
      procedureSteps: ['Execute rapid 3-note burst at tempo, then rest.', 'Expand to 6-note burst.', 'Join adjacent bursts into full passage.'],
      scaffoldDimension: 'continuous_execution_span',
      progressionMode: 'increase_difficulty',
      progressAction: 'lengthen continuous execution span toward full passage',
      regressAction: 'shorten continuous execution burst span',
      completionCondition: 'full continuous passage executed at target tempo without fatigue or tension',
      successCriteria: 'Clean burst execution with zero muscular tension spikes',
      transferRetest: 'Execute full continuous passage without stopping.',
      factory: () => new BurstPracticeStrategy(),
    });

    // 12. Rhythmic Variation (R24)
    this.register({
      strategyId: 'R24',
      name: 'Rhythmic Variation',
      family: 'Tempo calibration',
      applicableCapacities: ['RC08', 'RC05'],
      useConditions: ['Motor hesitation on equal subdivisions; finger movements are brittle or locked.'],
      procedureSteps: ['Play with dotted-long-short pairing.', 'Play with reverse short-long pairing.', 'Return to written even subdivisions.'],
      scaffoldDimension: 'rhythmic_transformation',
      progressionMode: 'restore_original_task',
      progressAction: 'move from stabilizing transformed practice rhythm back to written rhythm',
      regressAction: 'return to the stabilizing rhythmic variation pattern',
      completionCondition: 'original written rhythm executed evenly with pristine timing',
      successCriteria: 'Equal subdivisions balanced within 20ms of mathematical center',
      transferRetest: 'Perform written rhythm with fluid finger independence.',
      factory: () => new RhythmicVariationStrategy(),
    });

    // 14. Common Subdivision Grid (R33)
    this.register({
      strategyId: 'R33',
      name: 'Common Subdivision Grid (LCM)',
      family: 'Cross-Rhythm',
      applicableCapacities: ['RC11', 'RC04'],
      useConditions: ['Polyrhythm non-coincident attacks drift together (motor assimilation); learner lacks shared temporal subdivision lattice.'],
      procedureSteps: ['Sound all LCM subdivision slots.', 'Attenuate slot volume.', 'Fade to coincidence anchors only.', 'Unassisted retest.'],
      scaffoldDimension: 'subdivision_support',
      progressionMode: 'withdraw_support',
      progressAction: 'attenuate subdivision slot clicks from 100% to 50% to 20% to coincidence only',
      regressAction: 'restore full-density subdivision slots',
      completionCondition: 'coprime polyrhythm performed cleanly without intermediate slot clicks',
      successCriteria: 'Coupling ratio > 0.85; non-coincident attacks remain distinct',
      transferRetest: 'Perform polyrhythm at target tempo without acoustic subdivision grid.',
      factory: (opts) => new CommonSubdivisionGridStrategy(opts?.ratio),
    });

    // 15. Coincidence Anchoring (R34)
    this.register({
      strategyId: 'R34',
      name: 'Coincidence Point Anchoring & Rotated Entry',
      family: 'Cross-Rhythm',
      applicableCapacities: ['RC11', 'RC06'],
      useConditions: ['Learner relies exclusively on downbeat coincidence to trigger motor pattern; cannot recover or initiate from inner beats.'],
      procedureSteps: ['Anchor downbeat coincidence with accent.', 'Fade coincidence accent.', 'Rotate entry to Attack 2.', 'Rotate entry to Attack 3.'],
      scaffoldDimension: 'metrical_support',
      progressionMode: 'withdraw_support',
      progressAction: 'shift entry point to non-coincident attack and fade boundary accent',
      regressAction: 'return to phase-0 downbeat entry with accented guide',
      completionCondition: 'polyrhythm initiated smoothly from any phase position',
      successCriteria: 'Stable period length within 25ms regardless of starting attack index',
      transferRetest: 'Enter polyrhythm on offbeat attack without downbeat anchor.',
      factory: (opts) => new CoincidenceAnchoringStrategy(opts?.ratio),
    });

    // 16. Layer Alternation & Exchange (R35)
    this.register({
      strategyId: 'R35',
      name: 'Layer Alternation & Hand Exchange',
      family: 'Cross-Rhythm',
      applicableCapacities: ['RC11', 'RC08'],
      useConditions: ['Each layer is accurate alone, but combined coordination collapses into uneven shuffle.'],
      procedureSteps: ['Play Layer A alone.', 'Play Layer B alone.', 'Alternate 1 cycle A and 1 cycle B without pause.', 'Coordinate both layers.', 'Exchange limbs/timbres.'],
      scaffoldDimension: 'technical_complexity',
      progressionMode: 'increase_difficulty',
      progressAction: 'transition from solo layers to alternating cycles to combined to exchanged limbs',
      regressAction: 'return to alternating non-overlapping cycles',
      completionCondition: 'both layers periodic and coordinated; timing survives limb exchange',
      successCriteria: 'IOI variability < 25ms on both layers after role reversal',
      transferRetest: 'Perform polyrhythmic passage with reversed hand/voice assignments.',
      factory: () => new LayerAlternationExchangeStrategy(),
    });

    // 17. Beat Plus Counter-Rhythm (R36)
    this.register({
      strategyId: 'R36',
      name: 'Beat Plus Counter-Rhythm (Anchor Grounding)',
      family: 'Cross-Rhythm',
      applicableCapacities: ['RC12', 'RC02'],
      useConditions: ['Reference metre is abandoned when counter-rhythm enters (attentional capture).'],
      procedureSteps: ['Maintain reference beat in gross motor action (stepping).', 'Sound counter-rhythm with hand/voice.', 'Fade click to whisper.', 'Internalize reference pulse.'],
      scaffoldDimension: 'external_pulse_support',
      progressionMode: 'withdraw_support',
      progressAction: 'transfer pulse from external click to gross motor stepping to internal pacemaker',
      regressAction: 'restore audible reference pulse click',
      completionCondition: 'counter-rhythm produced stably while internal pulse remains locked to primary metre',
      successCriteria: 'Phase deviation on reference pulse < 35ms during counter-melody entries',
      transferRetest: 'Play counter-rhythm over unassisted internal metric pulse.',
      factory: () => new BeatPlusCounterRhythmStrategy(),
    });

    // 18. Polyrhythm Phase Wheel (R37)
    this.register({
      strategyId: 'R37',
      name: 'Circular Phase Wheel Visualization',
      family: 'Cross-Rhythm',
      applicableCapacities: ['RC11', 'RC05'],
      useConditions: ['Learner struggles to visualize cyclic recurrence and spatial phase relationships of simultaneous layers.'],
      procedureSteps: ['Observe concentric rotating rings.', 'Identify coincidence nodes and non-coincident gap geometry.', 'Fade coincidence flash.', 'Hide rotating cursor.'],
      scaffoldDimension: 'visual_support',
      progressionMode: 'withdraw_support',
      progressAction: 'fade visual cursor and coincidence flash to avoid eye-tracking dependency',
      regressAction: 'restore animated radial phase cursor',
      completionCondition: 'cycle maintained smoothly after visual wheel is hidden',
      successCriteria: 'Consistent inter-onset intervals without visual tracking aid',
      transferRetest: 'Perform cycle blindly with audio model only.',
      factory: (opts) => new PolyrhythmWheelStrategy(opts?.ratio, opts?.bpm),
    });

    // 19. Asymmetric Additive Grouping (R38)
    this.register({
      strategyId: 'R38',
      name: 'Asymmetric Additive Grouping (5/8, 7/8)',
      family: 'Asymmetric Metre',
      applicableCapacities: ['RC13', 'RC06'],
      useConditions: ['Asymmetric meters (3+2, 2+3, 2+2+3) are regularized into equal pulses or hesitations occur at boundary.'],
      procedureSteps: ['Chant syllables (Ta-ki-ta / Ta-ka) with equal eighth-note subdivision ticks.', 'Accent group macro-downbeats.', 'Fade subdivision ticks to 30%.', 'Mute subdivisions, feeling macro-pulse.'],
      scaffoldDimension: 'metrical_support',
      progressionMode: 'withdraw_support',
      progressAction: 'fade equal eighth-note subdivision ticks, leaving only asymmetric macro-accents',
      regressAction: 'restore full-volume eighth-note subdivision ticks',
      completionCondition: 'asymmetric phrase lilts naturally with mathematically exact 3:2 duration ratio',
      successCriteria: '3-group to 2-group duration ratio stays within 1.45 to 1.55 (exact 1.50)',
      transferRetest: 'Perform asymmetric passage without metronome click at performance tempo.',
      factory: (opts) => new AsymmetricAdditiveStrategy(opts?.groupingPattern),
    });

    // 20. Reference Audio + Shadow Fingering (DI-REF-SHADOW-01)
    this.register({
      strategyId: 'DI-REF-SHADOW-01',
      name: 'Reference Audio + Shadow Fingering',
      family: 'Representation',
      applicableCapacities: ['RC05', 'RC08'],
      useConditions: ['First-line general intervention: test whether auditory/visual representation or instrumental motor execution is the primary bottleneck.'],
      procedureSteps: ['Listen to ground truth audio with cursor tracking.', 'Shadow-finger silently on the instrument in real time.', 'Perform active playing attempt on instrument at target tempo.', 'Original retest.'],
      scaffoldDimension: 'aural_model_availability',
      progressionMode: 'withdraw_support',
      progressAction: 'transition from silent shadow rehearsal to active playing attempt and original retest',
      regressAction: 're-listen to reference audio and shadow-finger',
      completionCondition: 'active playing attempt on instrument executed with rhythmic accuracy',
      successCriteria: 'Rhythmic accuracy rate >= 80% on active playing attempt',
      transferRetest: 'Perform original passage on instrument at target tempo without reference audio.',
      factory: () => new ReferenceShadowFingeringStrategy(),
    });

    // 21. Tempo Reduction + Strong Downbeat Click (DI-SLOW-CLICK-01)
    this.register({
      strategyId: 'DI-SLOW-CLICK-01',
      name: 'Tempo Reduction + Strong Downbeat Click',
      family: 'Tempo calibration',
      applicableCapacities: ['RC08', 'RC07', 'RC05'],
      useConditions: ['First-line general intervention: test whether velocity load/motor speed or structural syntactic deficit is the primary constraint.'],
      procedureSteps: ['Reduce tempo by adaptive decrement (-20 BPM / 20%).', 'Provide strong click with accented downbeat.', 'Perform active playing attempt at reduced tempo.', 'Ladder up to target tempo.'],
      scaffoldDimension: 'tempo_demand',
      progressionMode: 'increase_difficulty',
      progressAction: 'accelerate from reduced tempo with strong clicks toward target tempo',
      regressAction: 'drop back to initial reduced tempo with strong clicks',
      completionCondition: 'original passage performed cleanly at target tempo',
      successCriteria: 'Rhythmic accuracy rate >= 85% at reduced tempo',
      transferRetest: 'Perform original passage unassisted at target tempo.',
      factory: (opts) => new TempoReductionStrongClickStrategy(opts?.targetBpm),
    });
  }

  public static register(entry: StrategyRegistryEntry): void {
    this.registry.set(entry.strategyId, entry);
  }

  public static get(strategyId: string): StrategyRegistryEntry | undefined {
    return this.registry.get(strategyId);
  }

  public static create(strategyId: string, options?: any): BaseStrategy {
    const entry = this.registry.get(strategyId);
    if (!entry) {
      throw new Error(`Strategy '${strategyId}' not found in RhythmStrategyRegistry.`);
    }
    return entry.factory(options);
  }

  public static getAll(): StrategyRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  public static findByCapacity(capacityId: string): StrategyRegistryEntry[] {
    return Array.from(this.registry.values()).filter(entry => 
      entry.applicableCapacities.includes(capacityId)
    );
  }
}
