import { AssistanceLevel, BaseAssistanceConfig } from '../../../core/types/fading';
import { RhythmicCapacityId } from './capacities';

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

export interface RhythmAssistanceConfig extends BaseAssistanceConfig {
  subdivisionClicks?: boolean;
  subdivisionRatio?: number;            // 2 for eighths, 3 for triplets, 4 for sixteenths, 6 for sextuplets
  beatSubdivisions?: Record<number, number>; // Specific subdivision ratio per beat position (e.g. triplets on beat 2)
  embeddedSubdivisionType?: 'duple' | 'triplet' | 'quadruple' | 'mixed' | 'tuplet';
  gapClick?: { playBars: number; silentBars: number };
  sparseClicksEveryNBeats?: number;
  randomDropoutProb?: number;
  selectedMetricPositions?: number[];
  ghostNotesAudible?: boolean;
  ghostNotesGain?: number;              // 1.0 (full) to 0.0 (silent)
  singlePitchOnly?: boolean;
  transitionLoopOnly?: boolean;
  targetTempoPercent?: number;          // 60%, 80%, 100%
  articulationNeutralized?: boolean;
  shadowFingeringMode?: boolean;
  reducedBpm?: number;
  strongClick?: boolean;
}

export interface RhythmStrategyRecord {
  strategyId: string;                   // e.g. 'R03', 'R07', 'R12', 'R20'
  name: string;
  strategyFamily: StrategyFamily;
  primaryCapacityIds: RhythmicCapacityId[];
  secondaryCapacityIds?: RhythmicCapacityId[];
  mechanismClaim: string;
  useWhen: string[];
  avoidWhen: string[];
  procedureSteps: string[];
  progressionRules: string[];
  regressionRules: string[];
  dosageGuidance: {
    loopLength: string;
    attempts: number;
    stoppingRule: string;
  };
  evidenceSummary: string;
  assistanceLevels: Record<AssistanceLevel, RhythmAssistanceConfig>;
}
