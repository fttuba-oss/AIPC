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
