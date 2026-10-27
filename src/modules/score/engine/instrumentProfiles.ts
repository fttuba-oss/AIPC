import { InstrumentProfile, CategoryMetadata, PotentialPracticeCategory } from '../../../contracts/portal';

export const INSTRUMENT_PROFILES: Record<string, InstrumentProfile> = {
  trumpet: {
    id: 'trumpet',
    name: 'Trumpet in Bb / C',
    transposition: 'Bb',
    clef: 'treble',
    comfortableMinMidi: 60, // C4
    comfortableMaxMidi: 79, // G5
    highRegisterTriggerMidi: 81, // A5 and above triggers High Register
    lowRegisterTriggerMidi: 54,  // F#3 or below
    rapidTonguingMsThreshold: 180, // Note <= 180ms unslurred requires rapid articulation
  },
  flute: {
    id: 'flute',
    name: 'Flute',
    transposition: 'C',
    clef: 'treble',
    comfortableMinMidi: 60, // C4
    comfortableMaxMidi: 84, // C6
    highRegisterTriggerMidi: 86, // D6 and above
    lowRegisterTriggerMidi: 59,  // B3
    rapidTonguingMsThreshold: 160,
  },
  clarinet: {
    id: 'clarinet',
    name: 'Clarinet in Bb',
    transposition: 'Bb',
    clef: 'treble',
    comfortableMinMidi: 50, // D3
    comfortableMaxMidi: 81, // A5
    highRegisterTriggerMidi: 83, // B5 / C6 Altissimo
    lowRegisterTriggerMidi: 50,
    rapidTonguingMsThreshold: 175,
  },
  alto_sax: {
    id: 'alto_sax',
    name: 'Alto Saxophone in Eb',
    transposition: 'Eb',
    clef: 'treble',
    comfortableMinMidi: 55, // Bb3
    comfortableMaxMidi: 79, // G5
    highRegisterTriggerMidi: 81, // A5 / Altissimo
    lowRegisterTriggerMidi: 54,
    rapidTonguingMsThreshold: 175,
  },
  french_horn: {
    id: 'french_horn',
    name: 'French Horn in F',
    transposition: 'F',
    clef: 'treble',
    comfortableMinMidi: 41, // F2
    comfortableMaxMidi: 77, // F5
    highRegisterTriggerMidi: 79, // G5 and above
    lowRegisterTriggerMidi: 41,
    rapidTonguingMsThreshold: 185,
  },
  trombone: {
    id: 'trombone',
    name: 'Trombone',
    transposition: 'C',
    clef: 'bass',
    comfortableMinMidi: 40, // E2
    comfortableMaxMidi: 67, // G4
    highRegisterTriggerMidi: 69, // A4 / Bb4
    lowRegisterTriggerMidi: 40,
    rapidTonguingMsThreshold: 190,
  },
  tuba: {
    id: 'tuba',
    name: 'Tuba',
    transposition: 'C',
    clef: 'bass',
    comfortableMinMidi: 28, // E1
    comfortableMaxMidi: 53, // F3
    highRegisterTriggerMidi: 55, // G3 and above
    lowRegisterTriggerMidi: 26,
    rapidTonguingMsThreshold: 200,
  }
};

export const CATEGORY_DEFINITIONS: Record<PotentialPracticeCategory, CategoryMetadata> = {
  fast_notes: {
    id: 'fast_notes',
    name: 'Fast Notes',
    shortLabel: 'Fast Notes',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    highlightColor: 'rgba(6, 182, 212, 0.22)',
    iconName: 'Zap',
    defaultGoal: 'Secure the notes and fingering pattern.'
  },
  fast_tonguing: {
    id: 'fast_tonguing',
    name: 'Fast or Rapid Tonguing',
    shortLabel: 'Rapid Tonguing',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    highlightColor: 'rgba(245, 158, 11, 0.22)',
    iconName: 'Flame',
    defaultGoal: 'Develop clean and even articulation.'
  },
  extreme_register: {
    id: 'extreme_register',
    name: 'Extreme Register',
    shortLabel: 'High Register',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-400',
    borderColor: 'border-rose-500/40',
    highlightColor: 'rgba(244, 63, 94, 0.22)',
    iconName: 'ChevronsUp',
    defaultGoal: 'Produce the notes reliably in this register.'
  },
  complex_rhythm: {
    id: 'complex_rhythm',
    name: 'Complex Rhythm',
    shortLabel: 'Complex Rhythm',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    highlightColor: 'rgba(168, 85, 247, 0.22)',
    iconName: 'Clock',
    defaultGoal: 'Internalise and reproduce the rhythm accurately.'
  },
  leaps: {
    id: 'leaps',
    name: 'Leaps (> Major 3rd)',
    shortLabel: 'Leaps',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    highlightColor: 'rgba(59, 130, 246, 0.22)',
    iconName: 'TrendingUp',
    defaultGoal: 'Secure pitch accuracy and clean slotting across leaps.'
  },
  custom: {
    id: 'custom',
    name: 'Teacher Defined Area',
    shortLabel: 'Teacher Goal',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400',
    borderColor: 'border-emerald-500/40',
    highlightColor: 'rgba(16, 185, 129, 0.22)',
    iconName: 'PenTool',
    defaultGoal: 'Master this specific musical passage.'
  }
};
