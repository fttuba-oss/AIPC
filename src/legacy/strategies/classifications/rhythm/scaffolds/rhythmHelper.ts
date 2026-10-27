import type { RhythmNote, TimeSignature, Measure } from './rhythmEngine';
import { DURATION_MAP } from './rhythmEngine';

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Calculate the total measure duration in quarter-note beats for ANY time signature.
 * E.g.:
 *  - 4/4 => 4 * (4/4) = 4.0 quarters
 *  - 3/4 => 3 * (4/4) = 3.0 quarters
 *  - 6/8 => 6 * (4/8) = 3.0 quarters (2 dotted-quarter beats)
 *  - 9/8 => 9 * (4/8) = 4.5 quarters (3 dotted-quarter beats)
 *  - 12/8 => 12 * (4/8) = 6.0 quarters (4 dotted-quarter beats)
 *  - 5/8 => 5 * (4/8) = 2.5 quarters
 *  - 7/8 => 7 * (4/8) = 3.5 quarters
 *  - 2/2 => 2 * (4/2) = 4.0 quarters
 */
export function getMeasureCapacityQuarters(timeSig: TimeSignature): number {
  const beatVal = timeSig.beatValue || 4;
  return timeSig.beatsPerMeasure * (4 / beatVal);
}

/**
 * Truncate notes that overflow the time signature's bar capacity,
 * or append rests to fill up any remaining space.
 */
export function balanceMeasure(notes: RhythmNote[], timeSig: TimeSignature): RhythmNote[] {
  const capacity = getMeasureCapacityQuarters(timeSig);
  const result: RhythmNote[] = [];
  let accum = 0;
  const EPSILON = 0.005;

  for (const note of notes) {
    const noteBeats = DURATION_MAP[note.duration] || 1.0;
    const projected = Math.round((accum + noteBeats) * 10000) / 10000;

    if (projected - capacity > EPSILON) {
      // Note overflows the bar. Fit a smaller note/rest in the remaining room.
      const room = Math.round((capacity - accum) * 10000) / 10000;
      if (room > 0.1) {
        const closestDuration = findClosestDuration(room);
        if (closestDuration) {
          result.push({
            id: uid(),
            duration: closestDuration,
            isRest: note.isRest // match rest mode of original note
          });
        }
      }
      accum = capacity;
      break;
    } else {
      result.push(note);
      accum = projected;
      if (Math.abs(accum - capacity) < EPSILON) {
        break; // perfectly filled
      }
    }
  }

  // Underfilled? Append rests.
  let gap = Math.round((capacity - accum) * 10000) / 10000;
  while (gap > 0.01) {
    const nextRestVal = getLargestFittingRest(gap);
    result.push({
      id: `ar-${uid()}`,
      duration: nextRestVal.duration,
      isRest: true
    });
    gap = Math.round((gap - nextRestVal.value) * 10000) / 10000;
  }

  return result;
}

/**
 * Split a flat RhythmNote list into Measure arrays using timeSignature.
 */
export function groupPatternIntoMeasures(notes: RhythmNote[], timeSig: TimeSignature): Measure[] {
  const capacity = getMeasureCapacityQuarters(timeSig);
  const measures: Measure[] = [];
  let currentNotes: RhythmNote[] = [];
  let accum = 0;
  const EPSILON = 0.005;

  notes.forEach((note) => {
    const noteBeats = DURATION_MAP[note.duration] || 1.0;
    const projected = Math.round((accum + noteBeats) * 10000) / 10000;

    if (projected - capacity > EPSILON && currentNotes.length > 0) {
      measures.push({
        id: uid(),
        timeSignature: timeSig,
        notes: balanceMeasure(currentNotes, timeSig)
      });
      currentNotes = [note];
      accum = noteBeats;
    } else {
      currentNotes.push(note);
      accum = projected;
    }
  });

  if (currentNotes.length > 0) {
    measures.push({
      id: uid(),
      timeSignature: timeSig,
      notes: balanceMeasure(currentNotes, timeSig)
    });
  }

  if (measures.length === 0) {
    measures.push({
      id: uid(),
      timeSignature: timeSig,
      notes: balanceMeasure([], timeSig)
    });
  }

  return measures;
}

/**
 * Flatten nested measures into a flat RhythmNote timeline.
 */
export function flattenMeasures(measures: Measure[]): RhythmNote[] {
  const flat = measures.flatMap(m => m.notes);
  for (let i = 0; i < flat.length - 1; i++) {
    if (flat[i].tied && !flat[i].isRest) {
      flat[i + 1].isTiedStop = true;
    }
  }
  return flat;
}

function getLargestFittingRest(gap: number): { duration: string; value: number } {
  const available = [
    { duration: '1', value: 4.0 },
    { duration: '2d', value: 3.0 },
    { duration: '2', value: 2.0 },
    { duration: '4d', value: 1.5 },
    { duration: '4', value: 1.0 },
    { duration: '8d', value: 0.75 },
    { duration: '8', value: 0.5 },
    { duration: '16', value: 0.25 }
  ];
  for (const item of available) {
    if (gap - item.value >= -0.005) {
      return item;
    }
  }
  return { duration: '16', value: 0.25 };
}

function findClosestDuration(val: number): string | null {
  const durations = Object.entries(DURATION_MAP);
  let bestKey: string | null = null;
  let bestDiff = Infinity;
  for (const [key, beats] of durations) {
    const diff = Math.abs((beats as number) - val);
    if (diff < bestDiff && diff < 0.05) {
      bestDiff = diff;
      bestKey = key;
    }
  }
  return bestKey;
}

export interface EmbeddedSubdivisionAnalysis {
  hasTuplets: boolean;
  dominantRatio: number; // e.g. 3 for triplets, 4 for 16ths, 2 for 8ths
  type: 'duple' | 'triplet' | 'quadruple' | 'mixed' | 'tuplet';
  beatSubdivisionMap: Record<number, number>; // quarter-beat offset -> ratio
  measureSubdivisionMap: Record<number, number[]>; // measureIndex -> array of ratios per beat
  summary: string;
}

/**
 * Analyzes target measures to detect embedded subdivisions that depart from the global time signature.
 * For example, detects 8th-note or quarter-note triplets in 4/4 time so that subdivisions
 * and metronome micro-clicks adaptively pulse in triplets (3 per beat) rather than straight duples (2 or 4).
 */
export function analyzeEmbeddedSubdivisions(measures: Measure[] | null | undefined): EmbeddedSubdivisionAnalysis {
  if (!measures || measures.length === 0) {
    return {
      hasTuplets: false,
      dominantRatio: 2,
      type: 'duple',
      beatSubdivisionMap: {},
      measureSubdivisionMap: {},
      summary: 'Standard duple subdivisions (default)',
    };
  }

  let totalTripletNotes = 0;
  let totalSixteenthNotes = 0;
  let totalEighthNotes = 0;
  const beatSubdivisionMap: Record<number, number> = {};
  const measureSubdivisionMap: Record<number, number[]> = {};

  let globalQuarter = 0;

  measures.forEach((m, mIdx) => {
    const ts = m.timeSignature || { beatsPerMeasure: 4, beatValue: 4 };
    const beatVal = ts.beatValue || 4;
    const beatCapacity = 4 / beatVal; // duration of one beat in quarters
    const numBeats = ts.beatsPerMeasure;
    const measureBeatRatios: number[] = new Array(numBeats).fill(2);

    let noteQuarterOffset = 0;

    m.notes.forEach((note) => {
      const dur = DURATION_MAP[note.duration] || 1.0;
      const isTriplet = note.duration.includes('t') || Math.abs(dur - 1/3) < 0.02 || Math.abs(dur - 2/3) < 0.02 || Math.abs(dur - 1/6) < 0.02;
      const isSixteenth = note.duration === '16' || note.duration === '16d' || Math.abs(dur - 0.25) < 0.02;
      const isEighth = note.duration === '8' || note.duration === '8d' || Math.abs(dur - 0.5) < 0.02;

      if (isTriplet) totalTripletNotes++;
      else if (isSixteenth) totalSixteenthNotes++;
      else if (isEighth) totalEighthNotes++;

      // Which beat(s) does this note touch?
      const noteStartQuarter = noteQuarterOffset;
      const noteEndQuarter = noteQuarterOffset + dur;

      for (let b = 0; b < numBeats; b++) {
        const beatStart = b * beatCapacity;
        const beatEnd = (b + 1) * beatCapacity;

        // Check if note overlaps with this beat
        if (noteStartQuarter < beatEnd - 0.01 && noteEndQuarter > beatStart + 0.01) {
          const globalBeatKey = Math.floor(globalQuarter + beatStart);
          if (isTriplet) {
            measureBeatRatios[b] = 3;
            beatSubdivisionMap[globalBeatKey] = 3;
          } else if (isSixteenth && measureBeatRatios[b] !== 3) {
            measureBeatRatios[b] = 4;
            if (beatSubdivisionMap[globalBeatKey] !== 3) {
              beatSubdivisionMap[globalBeatKey] = 4;
            }
          }
        }
      }

      noteQuarterOffset += dur;
    });

    measureSubdivisionMap[mIdx] = measureBeatRatios;
    globalQuarter += (ts.beatsPerMeasure * 4) / beatVal;
  });

  const hasTuplets = totalTripletNotes > 0;
  let dominantRatio = 2;
  let type: EmbeddedSubdivisionAnalysis['type'] = 'duple';

  if (hasTuplets && totalSixteenthNotes > 0) {
    dominantRatio = 3; // Triplet takes precedence to avoid destructive metric clash
    type = 'mixed';
  } else if (hasTuplets) {
    dominantRatio = 3;
    type = 'triplet';
  } else if (totalSixteenthNotes > 0) {
    dominantRatio = 4;
    type = 'quadruple';
  } else {
    dominantRatio = 2;
    type = 'duple';
  }

  const summary = type === 'triplet'
    ? 'Embedded triplet subdivisions detected (3 ticks per beat)'
    : type === 'mixed'
    ? 'Mixed subdivisions: embedded triplets and straight figures present'
    : type === 'quadruple'
    ? 'Sixteenth-note subdivisions (4 ticks per beat)'
    : 'Eighth-note subdivisions (2 ticks per beat)';

  return {
    hasTuplets,
    dominantRatio,
    type,
    beatSubdivisionMap,
    measureSubdivisionMap,
    summary,
  };
}

