export type ReferralReason =
  | 'repeated_failure_at_maximum_support'
  | 'inconclusive_diagnostic_evidence'
  | 'transfer_deficit_on_retest'
  | 'suspected_biomechanical_fatigue'
  | 'expressive_timing_ambiguity';

export interface TeacherReferralPacket {
  referralId: string;
  timestamp: string;
  problemClassification: string;     // e.g., 'rhythm', 'intonation'
  problemSignatureId: string;
  problemLabel: string;
  leadingHypothesisId: string;
  leadingHypothesisName: string;
  alternativeHypotheses: Array<{
    capacityId: string;
    capacityName: string;
    confidence: number;
  }>;
  attemptedStrategyId: string;
  attemptedStrategyName: string;
  totalAttempts: number;
  finalSupportLevel: number;
  reason: ReferralReason;
  summaryForTeacher: string;
  studentFriendlyExitMessage: string;
  measureRange: [number, number];
}
