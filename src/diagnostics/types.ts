/**
 * Rhythm Diagnostic Layer - Types
 * Decoupled and modular for easy extension, replacement, or separation.
 */

import { NoteEvent } from '../utils/scorePlaybackParser';

export type RhythmAccuracyRating = 'Perfect' | 'Great' | 'Good' | 'Early' | 'Late' | 'Miss';

export interface RhythmOnset {
  timestampSeconds: number; // audio context seconds or relative playback seconds
  scoreBeat?: number;       // beat relative to score
  source: 'mic' | 'tap';
  energy?: number;
}

export interface NoteRhythmEvaluation {
  noteIndex: number;
  pitch: number;
  expectedBeat: number;
  expectedTimeSeconds: number;
  measureNumber: number;
  rating: RhythmAccuracyRating;
  offsetMs: number; // negative = early (rushing), positive = late (dragging)
  matchedOnset?: RhythmOnset;
}

export type MeasureRhythmIssueType = 'rushing' | 'dragging' | 'missed_notes' | 'uneven' | 'accurate';

export interface MeasureRhythmDiagnosis {
  measureNumber: number;
  totalNotes: number;
  perfectCount: number;
  goodCount: number;
  earlyCount: number;
  lateCount: number;
  missCount: number;
  averageOffsetMs: number;
  primaryIssue: MeasureRhythmIssueType;
  explanation: string;
  remedyRecommendation?: string;
  suggestedTempoBpm?: number;
}

export interface DisambiguationResult {
  likelyCause: 'cognitive_speed_load' | 'mechanical_note_bottleneck' | 'genuine_rhythm_deficit' | 'inconclusive';
  reason: string;
  recommendedPath: 'stay_in_repertoire' | 'finger_technique_rehearsal' | 'isolate_rhythm_gym';
  suggestedActionLabel?: string;
  suggestedStrategyId?: string;
}

export interface RhythmDiagnosisResult {
  evaluations: Record<number, RhythmAccuracyRating>;
  detailedNotes: NoteRhythmEvaluation[];
  measureDiagnoses: Record<number, MeasureRhythmDiagnosis>;
  problemMeasureNumbers: number[];
  overallAccuracyPercent: number;
  summaryText: string;
  disambiguation?: DisambiguationResult;
  remedyActions: {
    label: string;
    actionKey: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'success' | 'amber';
  }[];
}

export interface RhythmDiagnosticConfig {
  perfectWindowMs?: number; // default ±50ms
  goodWindowMs?: number;    // default ±120ms
  maxWindowMs?: number;     // default ±260ms
}
