import { 
  PracticeArea, 
  ParsedScoreMeasure, 
  InstrumentProfile, 
  PotentialPracticeCategory,
  MusicalSection
} from '../types/portal';
import { CATEGORY_DEFINITIONS } from './instrumentProfiles';
import { midiToNoteName, semitonesToIntervalName } from './scoreParser';

interface MeasureFlag {
  measureNumber: number;
  category: PotentialPracticeCategory;
  reason: string;
}

/**
 * Clusters consecutive flagged measure numbers into contiguous PracticeArea ranges,
 * bounded within a specific musical section.
 */
function clusterMeasureFlags(
  flags: MeasureFlag[], 
  measures: ParsedScoreMeasure[]
): PracticeArea[] {
  flags.sort((a, b) => a.measureNumber - b.measureNumber);

  const byCategory: Record<PotentialPracticeCategory, MeasureFlag[]> = {
    fast_notes: [],
    fast_tonguing: [],
    extreme_register: [],
    complex_rhythm: [],
    leaps: [],
    custom: []
  };

  flags.forEach(f => {
    byCategory[f.category].push(f);
  });

  const practiceAreas: PracticeArea[] = [];

  Object.entries(byCategory).forEach(([catKey, catFlags]) => {
    const category = catKey as PotentialPracticeCategory;
    if (catFlags.length === 0) return;

    let currentStart = catFlags[0].measureNumber;
    let currentEnd = catFlags[0].measureNumber;
    let reasons: string[] = [catFlags[0].reason];

    for (let i = 1; i < catFlags.length; i++) {
      const nextM = catFlags[i].measureNumber;
      // If consecutive or 1 bar apart, cluster together
      if (nextM <= currentEnd + 2) {
        currentEnd = Math.max(currentEnd, nextM);
        if (!reasons.includes(catFlags[i].reason)) {
          reasons.push(catFlags[i].reason);
        }
      } else {
        practiceAreas.push(createPracticeArea(category, currentStart, currentEnd, reasons, measures));
        currentStart = nextM;
        currentEnd = nextM;
        reasons = [catFlags[i].reason];
      }
    }

    practiceAreas.push(createPracticeArea(category, currentStart, currentEnd, reasons, measures));
  });

  // Sort challenges chronologically by startMeasure then endMeasure
  return practiceAreas.sort((a, b) => {
    if (a.startMeasure !== b.startMeasure) return a.startMeasure - b.startMeasure;
    return a.endMeasure - b.endMeasure;
  });
}

function createPracticeArea(
  category: PotentialPracticeCategory,
  startMeasure: number,
  endMeasure: number,
  reasons: string[],
  measures: ParsedScoreMeasure[]
): PracticeArea {
  const meta = CATEGORY_DEFINITIONS[category];
  
  const inRangeMeasures = measures.filter(
    m => m.measureNumber >= startMeasure && m.measureNumber <= endMeasure
  );
  const avgTempo = inRangeMeasures.length > 0 
    ? Math.round(inRangeMeasures[0].tempoBpm)
    : 100;

  let targetTempo: number | undefined = undefined;
  if (category === 'fast_notes' || category === 'fast_tonguing') {
    targetTempo = avgTempo;
  }

  const id = `area-${category}-${startMeasure}-${endMeasure}-${Date.now().toString(36).slice(-4)}`;

  return {
    id,
    category,
    startMeasure,
    endMeasure,
    detectedReason: reasons.join(' • '),
    defaultGoal: meta.defaultGoal,
    status: 'suggested',
    teacherGoal: meta.defaultGoal,
    teacherNote: '',
    targetTempo,
    isCustom: false
  };
}

/**
 * Segments a score's measures into macro Musical Sections (chunks).
 * A new section starts after any rest of one full bar or more.
 */
export function segmentMeasuresIntoSections(
  measures: ParsedScoreMeasure[],
  instrument: InstrumentProfile
): MusicalSection[] {
  const sections: MusicalSection[] = [];
  let currentChunkMeasures: ParsedScoreMeasure[] = [];
  let sectionIndex = 1;

  const finalizeCurrentSection = () => {
    if (currentChunkMeasures.length === 0) return;

    const startM = currentChunkMeasures[0].measureNumber;
    const endM = currentChunkMeasures[currentChunkMeasures.length - 1].measureNumber;

    // Analyze challenges within this section chunk
    const flags: MeasureFlag[] = [];

    currentChunkMeasures.forEach(m => {
      // 1. Fast Notes
      if (m.fastNotesCount >= 4) {
        flags.push({
          measureNumber: m.measureNumber,
          category: 'fast_notes',
          reason: `${m.fastNotesCount} rapid notes (${Math.round((60000 / m.tempoBpm) * 0.25)}ms per 16th)`
        });
      }

      // 2. Fast or Rapid Tonguing
      const hasStaccatoRun = m.notes.filter(n => n.hasStaccato && !n.isRest).length >= 4;
      if (m.unslurredFastNotesCount >= 4 || (hasStaccatoRun && m.tempoBpm >= 90)) {
        flags.push({
          measureNumber: m.measureNumber,
          category: 'fast_tonguing',
          reason: `Rapid articulated notes (${m.unslurredFastNotesCount} unslurred 16ths)`
        });
      }

      // 3. Extreme Register
      if (m.maxPitchMidi !== null && m.maxPitchMidi >= instrument.highRegisterTriggerMidi) {
        flags.push({
          measureNumber: m.measureNumber,
          category: 'extreme_register',
          reason: `High register: reaches ${midiToNoteName(m.maxPitchMidi)} (above ${midiToNoteName(instrument.comfortableMaxMidi)} ceiling)`
        });
      } else if (m.minPitchMidi !== null && m.minPitchMidi <= instrument.lowRegisterTriggerMidi) {
        flags.push({
          measureNumber: m.measureNumber,
          category: 'extreme_register',
          reason: `Low register: reaches ${midiToNoteName(m.minPitchMidi)}`
        });
      }

      // 4. Complex Rhythm
      if (m.syncopationScore >= 1.5 || m.hasTuplets) {
        const detail = m.hasTuplets 
          ? 'Irregular metric subdivision / tuplets' 
          : `Syncopated rhythm (LHL score ${m.syncopationScore})`;
        flags.push({
          measureNumber: m.measureNumber,
          category: 'complex_rhythm',
          reason: detail
        });
      }

      // 5. Leaps (intervals > 4 semitones / > Major 3rd)
      if (m.leapsCount >= 1) {
        const leapName = semitonesToIntervalName(m.maxLeapIntervalSemitones);
        flags.push({
          measureNumber: m.measureNumber,
          category: 'leaps',
          reason: `${m.leapsCount} melodic leap(s) up to ${leapName} (${m.maxLeapIntervalSemitones} semitones)`
        });
      }
    });

    const challenges = clusterMeasureFlags(flags, currentChunkMeasures);

    const titleRange = startM === endM ? `Bar ${startM}` : `Bars ${startM}–${endM}`;
    sections.push({
      id: `section-${sectionIndex}-${startM}-${endM}`,
      sectionNumber: sectionIndex,
      title: `Section ${sectionIndex} (${titleRange})`,
      startMeasure: startM,
      endMeasure: endM,
      totalMeasures: currentChunkMeasures.length,
      challenges,
      status: challenges.length === 0 ? 'empty' : 'pending'
    });

    sectionIndex++;
    currentChunkMeasures = [];
  };

  for (const m of measures) {
    if (m.isFullMeasureRest) {
      // 1 bar or more rest demarcates the end of the previous playing section
      finalizeCurrentSection();
    } else {
      currentChunkMeasures.push(m);
    }
  }

  // Finalize any trailing section
  finalizeCurrentSection();

  return sections;
}

/**
 * Backward compatibility helper returning flat list of all challenges across sections
 */
export function extractFlatPracticeAreas(sections: MusicalSection[]): PracticeArea[] {
  const flat: PracticeArea[] = [];
  sections.forEach(s => {
    flat.push(...s.challenges);
  });
  return flat;
}
