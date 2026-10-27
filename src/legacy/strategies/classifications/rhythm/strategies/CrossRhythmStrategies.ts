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

// ── 1. Common Subdivision Grid Strategy (R33) ──────────────────────────────────
export interface CommonSubdivisionGridState {
  ratio: [number, number]; // e.g. [3, 2] or [4, 3]
  totalSlots: number;      // e.g. 6 or 12
  slotVolume: number;      // 1.0 -> 0.5 -> 0.25 -> 0.0
  coincidenceOnly: boolean;
  isRetest: boolean;
}

export class CommonSubdivisionGridStrategy extends BaseStrategy {
  readonly strategyId = 'R33';
  readonly name = 'Common Subdivision Grid (LCM)';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'subdivision_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<CommonSubdivisionGridState>;

  constructor(ratio: [number, number] = [3, 2]) {
    super();
    const totalSlots = ratio[0] * ratio[1];
    this.scaffoldController = new StrategyScaffoldController<CommonSubdivisionGridState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        ratio,
        totalSlots,
        slotVolume: 1.0,
        coincidenceOnly: false,
        isRetest: false,
      },
      progressActionDescription: 'attenuate subdivision slot volume and fade non-coincident clicks',
      regressActionDescription: 'restore full-volume subdivision lattice support',
      completionCondition: 'dual layers executed accurately without acoustic slot clicks',
      onProgress: (state) => {
        if (state.slotVolume > 0.5) {
          return {
            newState: { ...state, slotVolume: 0.5 },
            isComplete: false,
            message: 'Subdivision clicks attenuated to 50% volume.',
          };
        }
        if (state.slotVolume > 0.2) {
          return {
            newState: { ...state, slotVolume: 0.2 },
            isComplete: false,
            message: 'Subdivision clicks attenuated to 20% volume (whisper grid).',
          };
        }
        if (!state.coincidenceOnly) {
          return {
            newState: { ...state, slotVolume: 0.0, coincidenceOnly: true },
            isComplete: false,
            message: 'Intermediate slots muted! Listening to coincidence anchors (downbeats) only.',
          };
        }
        return {
          newState: { ...state, slotVolume: 0.0, coincidenceOnly: false, isRetest: true },
          isComplete: true,
          message: 'Common subdivision grid mastered! Ready for unscaffolded retest.',
        };
      },
      onRegress: (state) => {
        if (state.coincidenceOnly) {
          return {
            newState: { ...state, coincidenceOnly: false, slotVolume: 0.5 },
            canRegress: true,
            message: 'Restoring 50% subdivision slot guidance.',
          };
        }
        return {
          newState: { ...state, slotVolume: 1.0, coincidenceOnly: false },
          canRegress: true,
          message: 'Restoring full 100% subdivision grid.',
        };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.coincidenceOnly) return 4;
        if (state.slotVolume <= 0.2) return 2;
        if (state.slotVolume <= 0.5) return 1;
        return 0;
      },
      isOriginalContextRetest: (state) => state.isRetest,
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
      temporalSupport: isRetest ? 'None' : level === 0 ? 'Maximum' : level <= 2 ? 'High' : 'Moderate',
      subdivisionClicks: state.slotVolume > 0,
      subdivisionRatio: state.totalSlots,
      description: `LCM Common Subdivision Grid: ${state.ratio[0]}:${state.ratio[1]} (Slot volume ${(state.slotVolume * 100).toFixed(0)}%)`,
      learnerPrompt: isRetest
        ? `Retest! Perform the ${state.ratio[0]}:${state.ratio[1]} polyrhythm smoothly without the subdivision grid.`
        : state.slotVolume > 0
        ? `Hear the ${state.totalSlots}-slot LCM grid! Fit ${state.ratio[0]} against ${state.ratio[1]} onto the shared micro-ticks.`
        : `Slots muted: Rely on your inner composite rhythm to keep both streams in phase!`,
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
    _signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    return `Cross-layer phase assimilation reflects inability to construct dual-frequency attentional lattices (${hypothesis.capacityId}). ` +
      `Projecting both streams onto their Least Common Multiple (LCM) subdivision grid converts conflicting periodicities ` +
      `into an unambiguous single composite pattern, anchoring micro-timing before progressive volume fading.`;
  }
}

// ── 2. Coincidence Anchoring Strategy (R34) ──────────────────────────────────
export interface CoincidenceAnchoringState {
  ratio: [number, number];
  entryAttackIndex: number; // 0 = start at downbeat; 1 = start at attack 2 (rotated entry)
  coincidenceCueVolume: number;
  isRetest: boolean;
}

export class CoincidenceAnchoringStrategy extends BaseStrategy {
  readonly strategyId = 'R34';
  readonly name = 'Coincidence Point Anchoring & Rotated Entry';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'metrical_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<CoincidenceAnchoringState>;

  constructor(ratio: [number, number] = [3, 2]) {
    super();
    this.scaffoldController = new StrategyScaffoldController<CoincidenceAnchoringState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        ratio,
        entryAttackIndex: 0,
        coincidenceCueVolume: 1.0,
        isRetest: false,
      },
      progressActionDescription: 'rotate entry point and fade coincidence accent cue',
      regressActionDescription: 'anchor back to phase-0 downbeat coincidence',
      completionCondition: 'polyrhythm initiated reliably from any phase position',
      onProgress: (state) => {
        if (state.entryAttackIndex === 0 && state.coincidenceCueVolume > 0.5) {
          return {
            newState: { ...state, coincidenceCueVolume: 0.4 },
            isComplete: false,
            message: 'Downbeat coincidence accent reduced to gentle guide.',
          };
        }
        if (state.entryAttackIndex === 0) {
          return {
            newState: { ...state, entryAttackIndex: 1, coincidenceCueVolume: 0.5 },
            isComplete: false,
            message: 'Rotated Entry: Starting performance on Attack 2 (breaking downbeat dependence)!',
          };
        }
        return {
          newState: { ...state, coincidenceCueVolume: 0, isRetest: true },
          isComplete: true,
          message: 'Coincidence anchoring mastered across all entry points! Ready for retest.',
        };
      },
      onRegress: (state) => {
        if (state.entryAttackIndex > 0) {
          return {
            newState: { ...state, entryAttackIndex: 0, coincidenceCueVolume: 1.0 },
            canRegress: true,
            message: 'Returning to Phase 0 downbeat entry with accented coincidence cue.',
          };
        }
        return {
          newState: { ...state, coincidenceCueVolume: 1.0 },
          canRegress: true,
          message: 'Restoring full coincidence cue volume.',
        };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.entryAttackIndex > 0) return 3;
        if (state.coincidenceCueVolume < 0.5) return 2;
        return 0;
      },
      isOriginalContextRetest: (state) => state.isRetest,
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
      description: `Coincidence Anchoring: Entry point #${state.entryAttackIndex} (Accent cue ${(state.coincidenceCueVolume * 100).toFixed(0)}%)`,
      learnerPrompt: isRetest
        ? 'Retest! Perform the passage entering cleanly without coincidence accents.'
        : state.entryAttackIndex === 0
        ? 'Lock into the downbeat coincidence punch! Both hands strike simultaneously at beat 1.'
        : 'Rotated entry: Enter on the counter-attack, preserving independence from the downbeat!',
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
    _signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    return `Phase slip across cycle boundaries indicates weak anchor stability (${hypothesis.capacityId}). ` +
      `Highlighting the coincident downbeat provides an unambiguous point of phase convergence, ` +
      `while systematic entry rotation ensures the motor schema is robust from any starting beat.`;
  }
}

// ── 3. Layer Alternation & Exchange Strategy (R35) ───────────────────────────
export interface LayerAlternationState {
  currentStage: 'layer_a_solo' | 'layer_b_solo' | 'alternating_cycles' | 'combined' | 'exchanged_limbs';
  cycleCount: number;
  isRetest: boolean;
}

export class LayerAlternationExchangeStrategy extends BaseStrategy {
  readonly strategyId = 'R35';
  readonly name = 'Layer Alternation & Hand Exchange';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'technical_complexity';
  readonly progressionMode: ProgressionMode = 'increase_difficulty';

  public scaffoldController: StrategyScaffoldController<LayerAlternationState>;

  constructor() {
    super();
    this.scaffoldController = new StrategyScaffoldController<LayerAlternationState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        currentStage: 'layer_a_solo',
        cycleCount: 2,
        isRetest: false,
      },
      progressActionDescription: 'progress through solo streams, alternating cycles, and hand exchange',
      regressActionDescription: 'isolate individual layer to re-stabilize periodic spacing',
      completionCondition: 'seamless coordination maintained after exchanging limbs/timbres',
      onProgress: (state) => {
        if (state.currentStage === 'layer_a_solo') {
          return {
            newState: { ...state, currentStage: 'layer_b_solo' },
            isComplete: false,
            message: 'Layer A secured! Now isolating Layer B (Counter-Stream) against reference pulse.',
          };
        }
        if (state.currentStage === 'layer_b_solo') {
          return {
            newState: { ...state, currentStage: 'alternating_cycles' },
            isComplete: false,
            message: 'Alternating Cycles: 1 cycle Layer A, 1 cycle Layer B without pausing!',
          };
        }
        if (state.currentStage === 'alternating_cycles') {
          return {
            newState: { ...state, currentStage: 'combined' },
            isComplete: false,
            message: 'Combined Practice: Producing both Layer A and Layer B simultaneously.',
          };
        }
        if (state.currentStage === 'combined') {
          return {
            newState: { ...state, currentStage: 'exchanged_limbs' },
            isComplete: false,
            message: 'Limb / Timbre Exchange: Reverse hand/finger roles to prove cognitive independence!',
          };
        }
        return {
          newState: { ...state, isRetest: true },
          isComplete: true,
          message: 'Layer alternation & exchange mastered! Ready for unscaffolded retest.',
        };
      },
      onRegress: (state) => {
        if (state.currentStage === 'combined' || state.currentStage === 'exchanged_limbs') {
          return {
            newState: { ...state, currentStage: 'alternating_cycles' },
            canRegress: true,
            message: 'Motor coupling detected; returning to alternating non-overlapping cycles.',
          };
        }
        return {
          newState: { ...state, currentStage: 'layer_a_solo' },
          canRegress: true,
          message: 'Re-stabilizing Layer A solo.',
        };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.currentStage === 'exchanged_limbs') return 4;
        if (state.currentStage === 'combined') return 3;
        if (state.currentStage === 'alternating_cycles') return 2;
        if (state.currentStage === 'layer_b_solo') return 1;
        return 0;
      },
      isOriginalContextRetest: (state) => state.isRetest,
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
      temporalSupport: isRetest ? 'None' : level <= 1 ? 'Maximum' : 'Moderate',
      description: `Layer Alternation: ${state.currentStage.replace(/_/g, ' ')}`,
      learnerPrompt: isRetest
        ? 'Retest! Perform both layers simultaneously with natural acoustic balance.'
        : state.currentStage === 'layer_a_solo'
        ? 'Play Layer A alone along with the metronome click until intervals are effortless.'
        : state.currentStage === 'layer_b_solo'
        ? 'Play Layer B alone, keeping steady periodic subdivision.'
        : state.currentStage === 'alternating_cycles'
        ? 'Cycle alternation: Measure 1 = Layer A, Measure 2 = Layer B!'
        : state.currentStage === 'combined'
        ? 'Combine both layers together!'
        : 'Exchange roles: Swap hands or instruments between the layers!',
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
    _signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    return `Bimanual entrainment (Haken-Kelso-Bunz motor coupling) causes one hand to involuntarily ` +
      `lock into the timing of the other (${hypothesis.capacityId}). Alternating isolated cycles prevents cross-talk, ` +
      `and exchanging limbs decouples rhythmic representation from specific effector muscle groups.`;
  }
}

// ── 4. Beat Plus Counter-Rhythm Strategy (R36) ──────────────────────────────
export interface BeatPlusCounterState {
  referenceMode: 'audible_click' | 'gross_motor_stepping' | 'whisper_pulse' | 'internalized';
  counterLayerVolume: number;
  isRetest: boolean;
}

export class BeatPlusCounterRhythmStrategy extends BaseStrategy {
  readonly strategyId = 'R36';
  readonly name = 'Beat Plus Counter-Rhythm (Anchor Grounding)';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'external_pulse_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<BeatPlusCounterState>;

  constructor() {
    super();
    this.scaffoldController = new StrategyScaffoldController<BeatPlusCounterState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        referenceMode: 'audible_click',
        counterLayerVolume: 1.0,
        isRetest: false,
      },
      progressActionDescription: 'transfer reference pulse from acoustic click to gross motor embodiment',
      regressActionDescription: 'reinforce primary downbeat reference click',
      completionCondition: 'counter-rhythm produced without losing internal reference pulse',
      onProgress: (state) => {
        if (state.referenceMode === 'audible_click') {
          return {
            newState: { ...state, referenceMode: 'gross_motor_stepping' },
            isComplete: false,
            message: 'Embodied Pulse: Step feet or tap toe with beat while hands play counter-rhythm.',
          };
        }
        if (state.referenceMode === 'gross_motor_stepping') {
          return {
            newState: { ...state, referenceMode: 'whisper_pulse' },
            isComplete: false,
            message: 'Fading click to whisper volume; maintain embodied reference step.',
          };
        }
        if (state.referenceMode === 'whisper_pulse') {
          return {
            newState: { ...state, referenceMode: 'internalized' },
            isComplete: false,
            message: 'External click muted; perform counter-rhythm over your internal beat pulse.',
          };
        }
        return {
          newState: { ...state, isRetest: true },
          isComplete: true,
          message: 'Beat grounding secured against counter-periodicity! Ready for retest.',
        };
      },
      onRegress: (state) => {
        return {
          newState: { ...state, referenceMode: 'audible_click' },
          canRegress: true,
          message: 'Attentional capture detected; restoring audible reference beat.',
        };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.referenceMode === 'internalized') return 4;
        if (state.referenceMode === 'whisper_pulse') return 2;
        if (state.referenceMode === 'gross_motor_stepping') return 1;
        return 0;
      },
      isOriginalContextRetest: (state) => state.isRetest,
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
      temporalSupport: isRetest ? 'None' : state.referenceMode === 'audible_click' ? 'Maximum' : 'Moderate',
      description: `Beat Grounding: ${state.referenceMode.replace(/_/g, ' ')}`,
      learnerPrompt: isRetest
        ? 'Retest! Perform the counter-rhythm with steady inner pulse without external support.'
        : state.referenceMode === 'audible_click'
        ? 'Audible click active: Keep the base pulse completely steady while playing counter-accents.'
        : state.referenceMode === 'gross_motor_stepping'
        ? 'Step your feet or tap your heel on every quarter note while your fingers execute the counter-layer!'
        : 'Whisper click: Maintain the physical sensation of the pulse internally!',
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
    _signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    return `Attentional capture occurs when salient counter-accents drag the primary metric oscillator off phase (${hypothesis.capacityId}). ` +
      `Transferring the primary beat to gross motor channels (foot tap, torso sway) provides somatic immunity ` +
      `against auditory capture by the secondary counter-stream.`;
  }
}

// ── 5. Polyrhythm Phase Wheel Strategy (R37) ────────────────────────────────
export interface PolyrhythmWheelState {
  ratio: [number, number];
  cursorVisible: boolean;
  coincidenceFlash: boolean;
  tempoBpm: number;
  isRetest: boolean;
}

export class PolyrhythmWheelStrategy extends BaseStrategy {
  readonly strategyId = 'R37';
  readonly name = 'Circular Phase Wheel Visualization';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'visual_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<PolyrhythmWheelState>;

  constructor(ratio: [number, number] = [3, 2], initialBpm: number = 80) {
    super();
    this.scaffoldController = new StrategyScaffoldController<PolyrhythmWheelState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        ratio,
        cursorVisible: true,
        coincidenceFlash: true,
        tempoBpm: initialBpm,
        isRetest: false,
      },
      progressActionDescription: 'fade moving cursor and visual cues to avoid eye-tracking dependence',
      regressActionDescription: 'restore animated radial phase cursor',
      completionCondition: 'polyrhythm maintained with stationary or hidden visual wheel',
      onProgress: (state) => {
        if (state.coincidenceFlash) {
          return {
            newState: { ...state, coincidenceFlash: false },
            isComplete: false,
            message: 'Coincidence flash removed; track rotating phase line smoothly.',
          };
        }
        if (state.cursorVisible) {
          return {
            newState: { ...state, cursorVisible: false },
            isComplete: false,
            message: 'Moving cursor hidden! Rely on your auditory-motor internal model, not eye tracking.',
          };
        }
        return {
          newState: { ...state, isRetest: true },
          isComplete: true,
          message: 'Circular phase internalized! Ready for unscaffolded retest.',
        };
      },
      onRegress: (state) => {
        return {
          newState: { ...state, cursorVisible: true, coincidenceFlash: true },
          canRegress: true,
          message: 'Restoring rotating phase cursor and coincidence flash.',
        };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (!state.cursorVisible) return 3;
        if (!state.coincidenceFlash) return 1;
        return 0;
      },
      isOriginalContextRetest: (state) => state.isRetest,
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
      temporalSupport: isRetest ? 'None' : 'Moderate',
      description: `Phase Wheel: Cursor ${state.cursorVisible ? 'Visible' : 'Faded'}, Flash ${state.coincidenceFlash ? 'On' : 'Off'}`,
      learnerPrompt: isRetest
        ? 'Retest! Perform the polyrhythm cleanly without the visual wheel.'
        : state.cursorVisible
        ? `Watch the rotating phase line sweep through the ${state.ratio[0]}:${state.ratio[1]} nodes on concentric circles.`
        : 'Phase cursor faded: Imagine the clock-face circle spinning in your mind as you perform!',
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
    _signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    return `Linear notation fragments continuous cyclic polyrhythms into discrete bars (${hypothesis.capacityId}). ` +
      `Representing ratios as angles on concentric circles makes phase relationships instantly visible, ` +
      `allowing intuitive visual integration before fading.`;
  }
}

// ── 6. Asymmetric Additive Grouping Strategy (R38) ──────────────────────────
export interface AsymmetricAdditiveState {
  groupingPattern: number[]; // e.g. [3, 2] for 5/8, or [2, 2, 3] for 7/8
  syllables: string[];       // e.g. ['Ta-ki-ta', 'Ta-ka']
  subdivisionTickVolume: number;
  macroAccentVolume: number;
  isRetest: boolean;
}

export class AsymmetricAdditiveStrategy extends BaseStrategy {
  readonly strategyId = 'R38';
  readonly name = 'Asymmetric Additive Grouping (5/8, 7/8)';
  readonly classification = 'rhythm';
  readonly initialSupportLevel: AssistanceLevel = 0;
  readonly scaffoldDimension: ScaffoldDimension = 'metrical_support';
  readonly progressionMode: ProgressionMode = 'withdraw_support';

  public scaffoldController: StrategyScaffoldController<AsymmetricAdditiveState>;

  constructor(groupingPattern: number[] = [3, 2]) {
    super();
    const syllables = groupingPattern.map(len => len === 3 ? 'Ta-ki-ta' : 'Ta-ka');
    this.scaffoldController = new StrategyScaffoldController<AsymmetricAdditiveState>({
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      initialState: {
        groupingPattern,
        syllables,
        subdivisionTickVolume: 1.0,
        macroAccentVolume: 1.0,
        isRetest: false,
      },
      progressActionDescription: 'fade inner subdivision ticks, keeping only asymmetric macro-pulse',
      regressActionDescription: 'restore equal eighth-note subdivision ticks',
      completionCondition: 'asymmetrical lilt performed organically without smoothing or hesitations',
      onProgress: (state) => {
        if (state.subdivisionTickVolume > 0.4) {
          return {
            newState: { ...state, subdivisionTickVolume: 0.3 },
            isComplete: false,
            message: `Eighth-note subdivision ticks reduced to 30%. Feel the ${state.groupingPattern.join('+')} macro-beat pulse!`,
          };
        }
        if (state.subdivisionTickVolume > 0) {
          return {
            newState: { ...state, subdivisionTickVolume: 0 },
            isComplete: false,
            message: `Subdivision clicks muted. Metronome sounds only on asymmetric group downbeats (${state.groupingPattern.join('+')}).`,
          };
        }
        return {
          newState: { ...state, isRetest: true },
          isComplete: true,
          message: 'Asymmetric additive metre internalized! Ready for unscaffolded retest.',
        };
      },
      onRegress: (state) => {
        return {
          newState: { ...state, subdivisionTickVolume: 1.0 },
          canRegress: true,
          message: 'Restoring audible eighth-note subdivision grid.',
        };
      },
      mapStateToSupportLevel: (state) => {
        if (state.isRetest) return 5;
        if (state.subdivisionTickVolume === 0) return 3;
        if (state.subdivisionTickVolume <= 0.3) return 1;
        return 0;
      },
      isOriginalContextRetest: (state) => state.isRetest,
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
      temporalSupport: isRetest ? 'None' : state.subdivisionTickVolume > 0 ? 'Maximum' : 'Moderate',
      subdivisionClicks: state.subdivisionTickVolume > 0,
      description: `Additive ${state.groupingPattern.join('+')}/8: Syllables ${state.syllables.join('-')}`,
      learnerPrompt: isRetest
        ? `Retest! Perform the ${state.groupingPattern.join('+')}/8 measure fluently without subdivision clicks.`
        : state.subdivisionTickVolume > 0
        ? `Chant aloud: "${state.syllables.join(' - ')}" to feel the unequal long/short macro-beats (${state.groupingPattern.join('+')}/8)!`
        : `Feel the asymmetric lilt (${state.groupingPattern.join('+')}) solely via the accented macro-downbeats!`,
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
    _signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string {
    return `Western musical entrainment strongly defaults to symmetric duple or triple chunking (${hypothesis.capacityId}). ` +
      `Additive metres (e.g. 5/8 as 3+2, 7/8 as 2+2+3) suffer from regularisation error. ` +
      `Solkattu-style rhythmic syllables (ta-ki-ta ta-ka) provide phonetic anchors that bypass symmetric motor bias.`;
  }
}
