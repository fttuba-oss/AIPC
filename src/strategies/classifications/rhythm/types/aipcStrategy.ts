/**
 * AIPC Rhythm Strategy Knowledge-Base Specification Data Types
 * Based on AIPC Rhythm Strategy Specification v0.1
 */

// 1. Controlled Vocabulary: Rhythmic Capacities (RC01 - RC10)
export type RhythmicCapacityId =
  | 'RC01' // Beat perception
  | 'RC02' // Beat synchronisation
  | 'RC03' // Internal pulse
  | 'RC04' // Subdivision
  | 'RC05' // Pattern representation
  | 'RC06' // Metrical organisation
  | 'RC07' // Temporal adaptation
  | 'RC08' // Rhythmic execution
  | 'RC09' // Self-monitoring and correction
  | 'RC10'; // Expressive timing control

export interface RhythmicCapacity {
  id: RhythmicCapacityId;
  name: string;
  operationalDefinition: string;
  typicalFailure: string;
}

// 2. Problem Signature
export interface ProblemSignature {
  id: string; // e.g., 'PS-RUSH-01'
  label: string;
  observation: string;
  metric: 'mean_offset' | 'variability' | 'drift_slope' | 'reentry_error' | 'error_rate';
  direction?: 'early' | 'late' | 'compressed' | 'expanded' | 'unstable' | 'omitted' | 'displaced';
  locationPattern?: 'global' | 'progressive' | 'boundary_linked' | 'pattern_linked' | 'intermittent';
  candidateCapacityIds: RhythmicCapacityId[];
  exclusions?: string[];
}

// 3. Strategy Families (F01 - F11)
export type StrategyFamily =
  | 'Representation'
  | 'Embodiment'
  | 'Subdivision'
  | 'Synchronisation'
  | 'Internalisation'
  | 'Chunking'
  | 'Metric reconstruction'
  | 'Tempo calibration'
  | 'Adaptation and recovery'
  | 'Feedback and monitoring'
  | 'Reintegration and transfer';

// 4. Strategy Record Schema
export interface StrategyRecord {
  strategyId: string; // e.g. 'R07', 'R12'
  name: string;
  strategyFamily: StrategyFamily;
  primaryCapacityIds: RhythmicCapacityId[];
  secondaryCapacityIds?: RhythmicCapacityId[];
  mechanismClaim: string;
  useWhen: string[];
  avoidWhen: string[];
  procedureSteps: string[];
  progressionRules: string[];
  regressionRules?: string[];
  dosageGuidance?: {
    loopLength?: string;
    attempts?: number;
    stoppingRule?: string;
  };
  successCriterionTemplate: string;
  transferTestTemplate: string;
  evidenceSummary: string;
  evidenceStrength: 'direct' | 'indirect' | 'pedagogical_convention' | 'expert_consensus';
  version: string;
}

// 5. Assistance Level (Scale 0 to 5: 0 = Most Assistance, 5 = Least Assistance / Retest)
export type AssistanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface AssistanceConfig {
  level: AssistanceLevel;
  temporalSupport: 'Maximum' | 'High' | 'Moderate' | 'Low' | 'Minimal' | 'None';
  description: string;
  subdivisionClicks?: boolean;
  subdivisionRatio?: number;
  beatSubdivisions?: Record<number, number>;
  embeddedSubdivisionType?: 'duple' | 'triplet' | 'quadruple' | 'mixed' | 'tuplet';
  gapClick?: { playBars: number; silentBars: number };
  sparseClicksEveryNBeats?: number;
  randomDropoutProb?: number;
  selectedMetricPositions?: number[];
  clicksOnlyOnDownbeat?: boolean;
  continuationAfterBars?: number;
  perturbedBeat?: { measureIndex: number; beatIndex: number; offsetMs: number };
  tempoRamp?: { startBpm: number; endBpm: number };
  singlePitchNoteOnly?: boolean;
  singlePitchOnly?: boolean;
  ghostNotesAudible?: boolean;
  loopMeasureIndex?: number;
}

// 6. Performance Metrics Model
export interface PerformanceMetrics {
  meanAsynchronyMs: number; // Average offset (+ is late, - is early)
  timingVariabilityMs: number; // Standard deviation of onset errors
  driftSlope: number; // Slope of asynchrony over time (rushing/dragging trend)
  reentryErrorMs?: number; // Timing error after silent gap
  rhythmErrorRate: number; // % of incorrect durations / missed notes
  recoveryBeats?: number; // Beats required to re-stabilize after perturbation
  totalNotesAttempted: number;
}

// 7. Diagnostic Recommendation & Decision Unit
export interface RecommendationRecord {
  recommendationId: string;
  exerciseId: string;
  exerciseTitle: string;
  problemSignatureId: string;
  problemLabel: string;
  observationSummary: string;
  hypothesizedCapacity: RhythmicCapacityId;
  capacityName: string;
  confidence: number; // 0.0 to 1.0
  selectionReason: string;
  alternativeHypotheses: Array<{
    capacity: RhythmicCapacityId;
    capacityName: string;
    reasonNotSelected: string;
  }>;
  prescribedStrategyId: string;
  strategyName: string;
  strategyFamily: StrategyFamily;
  suggestedAssistanceLevel: AssistanceLevel;
  baselineMetrics: PerformanceMetrics;
  decision: 'continue' | 'progress' | 'regress' | 'switch_strategy' | 'refer_to_teacher';
  timestamp: string;
}
