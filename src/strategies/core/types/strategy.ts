import { AssistanceLevel, BaseAssistanceConfig, FadingEvaluationResult } from './fading';
import { TeacherReferralPacket } from './referral';

export type ProblemClassificationId =
  | 'rhythm'
  | (string & {}); // Extensible string type allowing any future classification id

export interface PerformanceAttemptMetrics {
  meanOffsetMs?: number;
  timingVariabilityMs?: number;
  driftSlope?: number;
  reentryErrorMs?: number;
  pitchAccuracyPercent?: number;
  notesAttempted: number;
  missCount: number;
  accuracyRate: number; // 0.0 to 1.0
  passed: boolean;
}

export interface GenericProblemSignature {
  id: string;
  classification: ProblemClassificationId;
  label: string;
  observation: string;
  measureRange: [number, number];
  candidateCapacityIds: string[];
}

export interface GenericHypothesis {
  capacityId: string;
  name: string;
  confidence: number; // 0.0 to 1.0
  operationalDefinition: string;
}

export type ScaffoldDimension =
  | 'aural_model_availability'
  | 'subdivision_support'
  | 'external_pulse_support'
  | 'unsupported_time'
  | 'metrical_support'
  | 'tempo_demand'
  | 'technical_complexity'
  | 'musical_context_span'
  | 'continuous_execution_span'
  | 'rhythmic_transformation'
  | (string & {});

export type ProgressionMode =
  | 'withdraw_support'
  | 'increase_difficulty'
  | 'expand_context'
  | 'restore_original_task';

export interface StrategyScaffoldDescriptor<TState = any> {
  scaffoldDimension: ScaffoldDimension;
  progressionMode: ProgressionMode;
  currentState: TState;
  progressAction: string;
  regressAction: string;
  completionCondition: string;
}

export interface DiagnosticEvidence {
  probeId?: string;
  contrastDescription?: string;
  measurements?: Record<string, number | string | boolean>;
  timingVariabilitySlowVsTarget?: { slowMs: number; targetMs: number };
  singlePitchVsMelody?: { singlePitchAcc: number; melodyAcc: number };
  clapVsInstrument?: { clapAcc: number; instrumentAcc: number };
  slurredVsArticulated?: { slurredAcc: number; articulatedAcc: number };
  transitionSpecificFailures?: string[];
  isTransitionSpecific?: boolean;
  isTempoDependent?: boolean;
  representationEchoAccurate?: boolean;
  subdivisionGridStabilises?: boolean;
  clickDropoutDriftPresent?: boolean;
}

export interface StrategyScaffoldPayload {
  strategyId: string;
  strategyName: string;
  level: AssistanceLevel;
  scaffoldXml: string | null;           // Transformed score slice or null for original
  measureRange: [number, number];
  assistanceConfig: BaseAssistanceConfig;
  mascotInstruction: string;
  isRetest: boolean;
  scaffoldDescriptor?: StrategyScaffoldDescriptor;
}

export interface StrategyExecutionRecord {
  strategyId: string;
  strategyName: string;
  reason: string;
  attemptsCount: number;
  outcome: 'resolved' | 'switched' | 'failed' | 'in_progress';
  finalState?: any;
  startedAt: number;
  completedAt?: number;
}

export interface StrategySessionState {
  sessionId: string;
  classification: ProblemClassificationId;
  problemSignature: GenericProblemSignature;
  leadingHypothesis: GenericHypothesis;
  strategyId: string;
  strategyName: string;
  currentLevel: AssistanceLevel;
  attemptsAtCurrentLevel: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  history: Array<{
    attemptNumber: number;
    level: AssistanceLevel;
    metrics: PerformanceAttemptMetrics;
    result: FadingEvaluationResult;
    timestamp: number;
    scaffoldState?: any;
  }>;
  status: 'active' | 'retest' | 'resolved' | 'referred_to_teacher';
  referralPacket?: TeacherReferralPacket;
  strategyChain?: StrategyExecutionRecord[];
}

