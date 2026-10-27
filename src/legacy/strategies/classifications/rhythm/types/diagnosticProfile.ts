/**
 * AIPC Rhythm Diagnostic & Intervention - Core Data Models
 * Specification Version: 1.0 (AIPC_Rhythm_Diagnostic_Intervention_Refactor_Spec.md)
 */

export type EvidenceDirection = 'strengthens' | 'weakens' | 'neutral' | 'uncertain';

export type EvidenceSource =
  | 'baseline_performance'
  | 'score_context'
  | 'learner_report'
  | 'teacher_annotation'
  | 'diagnostic_intervention'
  | 'targeted_probe'
  | 'original_context_retest';

export interface PassageLocation {
  measureNumber: number;
  noteIndex?: number;
  beatPosition?: number;
  pitch?: string;
  description?: string;
}

export interface DiagnosticEvidence {
  id: string;
  source: EvidenceSource;
  interventionId?: string;
  attemptId?: string;
  capacityId: string;
  direction: EvidenceDirection;
  weight: number; // e.g. 1.0 = moderate, 2.0 = strong
  observation: string;
  metrics?: Record<string, number | string | boolean>;
  createdAt: string;
}

export interface CapacityHypothesis {
  capacityId: string; // RC01 - RC10
  label: string;
  evidenceScore: number; // normalized 0 to 5
  confidence: 'low' | 'moderate' | 'high';
  status: 'possible' | 'leading' | 'reduced' | 'unresolved';
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
}

export interface DiagnosticProfile {
  problemSignatureId: string;
  hypotheses: CapacityHypothesis[];
  evidence: DiagnosticEvidence[];
  persistentLocations: PassageLocation[];
  unresolvedQuestions: string[];
  updatedAt: string;
}

export type InterventionResponse =
  | 'substantial_repeated_improvement'
  | 'partial_improvement'
  | 'temporary_improvement'
  | 'no_meaningful_change'
  | 'persistent_rhythm_error'
  | 'persistent_local_note_error'
  | 'persistent_articulation_error'
  | 'support_dependent_improvement'
  | 'worsened'
  | 'insufficient_data';

export type DecisionOutcome = 'Pass' | 'Persist' | 'Pivot' | 'Refer';

export interface DecisionResult {
  decision: DecisionOutcome;
  reason: string;
  nextInterventionId?: string;
  recommendedStrategyId?: string;
  nextLevel?: number;
  retestRequired?: boolean;
  fadingSteps?: string[];
  teacherHandoff?: TeacherHandoffRecord;
}

export interface TeacherHandoffRecord {
  studentId: string;
  assignmentId?: string;
  passageId: string;
  problemSignatureId: string;
  problemName: string;
  baselineSummary: string;
  interventionsAttempted: Array<{
    interventionId: string;
    interventionName: string;
    attempts: number;
    response: InterventionResponse;
  }>;
  persistentLocations: PassageLocation[];
  leadingHypotheses: CapacityHypothesis[];
  learnerReport?: string;
  reasonForReferral: string;
  suggestedTeacherCheck: string[];
  supportingAttemptIds: string[];
  createdAt: string;
}
