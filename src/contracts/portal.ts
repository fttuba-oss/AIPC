export type PotentialPracticeCategory = 
  | 'fast_notes'
  | 'fast_tonguing'
  | 'extreme_register'
  | 'complex_rhythm'
  | 'leaps'
  | 'custom';

export interface CategoryMetadata {
  id: PotentialPracticeCategory;
  name: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  highlightColor: string;
  iconName: string;
  defaultGoal: string;
}

export interface PracticeArea {
  id: string;
  category: PotentialPracticeCategory;
  startMeasure: number;
  endMeasure: number;
  detectedReason: string;
  defaultGoal: string;
  status: 'suggested' | 'accepted' | 'edited' | 'removed';
  teacherGoal: string;
  teacherNote: string;
  targetTempo?: number;
  targetDetails?: string;
  isCustom?: boolean;
}

export interface MusicalSection {
  id: string;
  sectionNumber: number;
  title: string; // e.g. "Section 1 (Bars 1–4)"
  startMeasure: number;
  endMeasure: number;
  totalMeasures: number;
  challenges: PracticeArea[];
  status: 'all_approved' | 'partially_approved' | 'pending' | 'empty';
}

export interface InstrumentProfile {
  id: string;
  name: string;
  transposition: string;
  clef: 'treble' | 'bass';
  comfortableMinMidi: number; // e.g. 60 (C4)
  comfortableMaxMidi: number; // e.g. 79 (G5)
  highRegisterTriggerMidi: number; // e.g. 81 (A5)
  lowRegisterTriggerMidi: number; // e.g. 54 (F#3)
  rapidTonguingMsThreshold: number;
}

export interface PracticePlanGoal {
  areaId: string;
  sectionId?: string;
  sectionTitle?: string;
  category: PotentialPracticeCategory;
  measureRange: string; // e.g. "Bars 6–9"
  startMeasure: number;
  endMeasure: number;
  goal: string;
  targetTempo?: number;
  teacherNote?: string;
}

export interface PracticePlanSection {
  sectionNumber: number;
  title: string;
  startMeasure: number;
  endMeasure: number;
  goals: PracticePlanGoal[];
}

export interface PracticePlan {
  id: string;
  scoreTitle: string;
  studentName: string;
  studentInstrument: string;
  createdDate: string;
  status: 'draft' | 'assigned';
  sections: PracticePlanSection[];
  teacherGeneralNotes?: string;
}

export interface ParsedScoreMeasure {
  measureNumber: number;
  timeSignature: { beats: number; beatType: number };
  tempoBpm: number;
  isFullMeasureRest: boolean;
  notes: ParsedScoreNote[];
  syncopationScore: number;
  hasTuplets: boolean;
  minPitchMidi: number | null;
  maxPitchMidi: number | null;
  fastNotesCount: number;
  unslurredFastNotesCount: number;
  leapsCount: number;
  maxLeapIntervalSemitones: number;
}

export interface ParsedScoreNote {
  pitchMidi?: number;
  step?: string;
  octave?: number;
  alter?: number;
  isRest: boolean;
  durationQuarter: number;
  durationMs: number;
  isSlurred: boolean;
  hasStaccato: boolean;
  hasAccent: boolean;
  isTied: boolean;
  intervalFromPrev?: number; // Semitones from previous sounding note
}

export interface ParsedScore {
  title: string;
  composer?: string;
  parts: {
    id: string;
    name: string;
    instrument: string;
    measures: ParsedScoreMeasure[];
  }[];
  selectedPartId: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  instrument: string;
  grade?: string;
  avatarUrl?: string;
}

export interface StoredExercise {
  id: string;
  title: string;
  scoreTitle: string;
  scorePath: string;
  instrumentId: string;
  instrumentName: string;
  studentId: string;
  studentName: string;
  assignedDate: string;
  status: 'assigned' | 'in_progress' | 'completed';
  section: {
    id?: string;
    sectionNumber: number;
    title: string;
    startMeasure: number;
    endMeasure: number;
    goals: {
      areaId?: string;
      category: string;
      measureRange: string;
      startMeasure: number;
      endMeasure: number;
      goal: string;
      targetTempo?: number;
      teacherNote?: string;
    }[];
  };
  teacherGeneralNotes?: string;
}

/** A score in the teacher's library (the main asset exercises are created from). */
export interface LibraryScore {
  id: string;
  title: string;
  composer?: string;
  fileName?: string;
  /** URL the score XML can be fetched from (public path or storage API). */
  xmlPath: string;
  builtin?: boolean;
  uploadedAt: string;
}

export type ExerciseType = 'score_following' | 'rhythm';
export type RhythmKind = 'syncopation' | 'cross_rhythm' | 'other';

/** An exercise defined by the teacher on a score, before it is sent to students. */
export interface ExerciseTemplate {
  id: string;
  scoreId: string;
  type: ExerciseType;
  title: string;
  startMeasure: number;
  endMeasure: number;
  tempo: number;
  rhythmKind?: RhythmKind;
  /** Score parts (instruments) in which the tricky rhythm occurs. */
  parts: string[];
  notes: string;
  suggested: boolean;
  createdAt: string;
}

/** Free-text practice plan message for students. */
export interface PlanNote {
  id: string;
  date: string;
  scoreId?: string;
  scoreTitle?: string;
  text: string;
  createdAt: string;
}

export interface StoredSubmissionTake {
  id: string;
  takeNumber: number;
  timestamp: string;
  mode: 'audio' | 'video';
  mediaFile: string;
  durationSeconds: number;
  tempoUsed: number;
  selfRating?: number;
}

export interface StoredSubmission {
  id: string;
  exerciseId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  pieceName: string;
  instrumentName: string;
  submittedAt: string;
  sectionId: string;
  sectionName: string;
  measureRange: [number, number];
  timeSpentSeconds: number;
  takes: StoredSubmissionTake[];
  diagnosticResult?: {
    overallAccuracyPercent: number;
    summaryText: string;
    problemMeasureNumbers: number[];
    rushedCount: number;
    draggedCount: number;
    stableCount: number;
  };
  teacherFeedback?: string;
}

