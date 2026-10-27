import { metronomeMarkQuarterBpm, type MetronomeMeasure } from './metronome';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { musicXmlPlayback } from './musicXmlPlayback';

export interface NoteEvent {
  partId?: string;      // Score part this note belongs to (for the live part mix)
  instrument?: string;  // Soundfont instrument id used to voice this note (per-part sound)
  pitch: number;        // MIDI note number (e.g. 60 = C4)
  time: number;         // Start time in seconds from start
  duration: number;     // Duration in seconds
  beat: number;         // Start beat position (quarter note = 1.0)
  durationBeats: number;// Duration in beats
  measureNumber: number;// Measure index (1-based)
  velocity?: number;    // Dynamic velocity (0.0 to 1.0)
  sourceEventId?: string;
  staffId?: string;
  voiceId?: string;
  articulation?: string;
  expressionKey?: string;
  isPercussion?: boolean;
  rawNote?: any;        // Temporary helper for merging consecutive tied/slurred notes
}

export interface PartData {
  id: string;
  name: string;
  soundfontInstrument: string;
  volume?: number; // Authored MIDI channel volume, percent.
  pan?: number; // Authored pan normalized to -1..1.
  notes: NoteEvent[];
}

export interface TempoChange {
  beat: number;
  bpm: number;
  timeInSeconds: number;
}

export interface MetronomeClick {
  time: number;
  isDownbeat: boolean;
}

export interface CursorPosition {
  time: number;
  beat: number;
}

export interface ScorePlaybackData {
  title: string;
  intendedBpm: number;
  parts: PartData[];
  tempos: TempoChange[];
  durationInSeconds: number;
  clicks: MetronomeClick[];
  cursorPositions: CursorPosition[];
  measureStartBeats: number[];
  metronomeMeasures?: MetronomeMeasure[];
  measureStartBeatByNumber?: Record<number, number>;
  initialTimeSignature: { numerator: number; denominator: number };
}

/**
 * Maps a parsed instrument name to a General MIDI soundfont name.
 */
export function mapInstrumentToSoundfont(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes('flute') || normalized.includes('piccolo')) return 'flute';
  if (normalized.includes('clarinet')) return 'clarinet';
  if (normalized.includes('oboe')) return 'oboe';
  if (normalized.includes('bassoon')) return 'bassoon';
  if (normalized.includes('alto sax') || normalized.includes('alto 1') || normalized.includes('alto 2')) return 'alto_sax';
  if (normalized.includes('tenor sax')) return 'tenor_sax';
  if (normalized.includes('baritone sax')) return 'baritone_sax';
  if (normalized.includes('sax')) return 'alto_sax';
  if (normalized.includes('trumpet') || normalized.includes('cornet') || normalized.includes('soloist')) return 'trumpet';
  if (normalized.includes('horn') || normalized.includes('mellophone')) return 'french_horn';
  if (normalized.includes('trombone') || normalized.includes('euphonium') || normalized.includes('baritone')) return 'trombone';
  if (normalized.includes('tuba')) return 'tuba';
  if (normalized.includes('violin')) return 'violin';
  if (normalized.includes('viola')) return 'viola';
  if (normalized.includes('cello')) return 'cello';
  if (normalized.includes('contrabass') || normalized.includes('double bass')) return 'contrabass';
  if (normalized.includes('string')) return 'string_ensemble_1';
  if (normalized.includes('harp')) return 'orchestral_harp';
  if (normalized.includes('piano')) return 'acoustic_grand_piano';
  if (normalized.includes('glockenspiel') || normalized.includes('bell')) return 'glockenspiel';
  if (normalized.includes('xylophone')) return 'xylophone';
  if (normalized.includes('timpani')) return 'timpani';
  if (normalized.includes('percussion') || normalized.includes('drum')) return 'percussion';
  return 'acoustic_grand_piano'; // Neutral fallback when the score omits program metadata.
}

/**
 * Fallback transposition mappings in semitones.
 */
export function getFallbackTransposition(name: string): number {
  const normalized = name.toLowerCase();
  if (normalized.includes('baritone sax')) return -21;
  if (normalized.includes('tenor sax')) return -14;
  if (normalized.includes('alto sax')) return -9;
  if (normalized.includes('soprano sax')) return -2;
  if (normalized.includes('bass clarinet')) return -14;
  if (normalized.includes('alto clarinet')) return -9;
  if (normalized.includes('clarinet')) return -2; // Bb Clarinet
  if (normalized.includes('trumpet') || normalized.includes('cornet') || normalized.includes('flugelhorn')) return -2; // Bb Trumpet
  if (normalized.includes('french horn') || normalized.includes('english horn') || normalized.includes('horn in f')) return -7;
  return 0;
}

/**
 * Parses the tempo timeline from the sheet's measures and optional raw XML.
 */
export function parseTempoTimeline(osmd: OpenSheetMusicDisplay, rawXml?: string | null): TempoChange[] {
  const measures = osmd.Sheet?.SourceMeasures;
  let currentBpm = 120;
  let foundBpm = false;

  // 1. Check raw XML directly for embedded tempo tags
  if (rawXml) {
    const soundMatch = rawXml.match(/<sound[^>]*\btempo=["'](\d+(?:\.\d+)?)["']/i);
    if (soundMatch) {
      currentBpm = Math.round(parseFloat(soundMatch[1]));
      foundBpm = true;
    } else {
      const perMinuteMatch = rawXml.match(/<per-minute[^>]*>(\d+(?:\.\d+)?)<\/per-minute>/i);
      if (perMinuteMatch) {
        const mark = rawXml.match(/<metronome\b[^>]*>([\s\S]*?)<\/metronome>/i)?.[1] || '';
        const beatUnit = mark.match(/<beat-unit[^>]*>([^<]+)<\/beat-unit>/i)?.[1] || 'quarter';
        const dots = (mark.match(/<beat-unit-dot\b/g) || []).length;
        currentBpm = Math.round(metronomeMarkQuarterBpm(parseFloat(perMinuteMatch[1]), beatUnit, dots));
        foundBpm = true;
      }
    }
  }

  // 2. Check OSMD measures for TempoInBPM if not found in raw XML
  if (!foundBpm && measures && measures.length > 0) {
    for (const m of measures) {
      if (m.TempoInBPM && m.TempoInBPM > 0) {
        currentBpm = Math.round(m.TempoInBPM);
        foundBpm = true;
        break;
      }
    }
  }

  // 3. Known piece fallbacks if not explicitly marked
  if (!foundBpm) {
    const title = (osmd.Sheet?.TitleString || '').toLowerCase();
    if (title.includes('whale') || (rawXml && rawXml.toLowerCase().includes('whale'))) {
      currentBpm = 120;
      foundBpm = true;
    } else if (title.includes('neruda') || (rawXml && rawXml.toLowerCase().includes('neruda'))) {
      currentBpm = 108;
      foundBpm = true;
    } else if (title.includes('cruel') || (rawXml && rawXml.toLowerCase().includes('cruel'))) {
      currentBpm = 70;
      foundBpm = true;
    }
  }

  const tempos: TempoChange[] = [{ beat: 0, bpm: currentBpm, timeInSeconds: 0 }];
  let lastBpm = currentBpm;

  if (measures) {
    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];
      const measureStartBeat = measure.AbsoluteTimestamp.RealValue * 4;

      if (measure.TempoInBPM && measure.TempoInBPM > 0 && measure.TempoInBPM !== lastBpm) {
        const roundedBpm = Math.round(measure.TempoInBPM);
        if (measureStartBeat === 0) {
          tempos[0].bpm = roundedBpm;
          lastBpm = roundedBpm;
        } else {
          const timeInSeconds = beatToSeconds(measureStartBeat, tempos);
          tempos.push({
            beat: measureStartBeat,
            bpm: roundedBpm,
            timeInSeconds,
          });
          lastBpm = roundedBpm;
        }
      }
    }
  }

  return tempos;
}

/**
 * Calculates absolute time in seconds for a given beat position using a tempo timeline.
 */
export function beatToSeconds(beat: number, tempos: TempoChange[]): number {
  let active = tempos[0];
  for (let i = 1; i < tempos.length; i++) {
    if (tempos[i].beat <= beat) {
      active = tempos[i];
    } else {
      break;
    }
  }
  const elapsedBeats = beat - active.beat;
  return active.timeInSeconds + (elapsedBeats / active.bpm) * 60;
}

/**
 * Converts playback seconds to quarter-note beats.
 */
export function secondsToBeats(secs: number, tempos: TempoChange[]): number {
  if (!tempos || tempos.length === 0) return secs * 2;
  let active = tempos[0];
  for (let i = 1; i < tempos.length; i++) {
    if (tempos[i].timeInSeconds <= secs) active = tempos[i];
    else break;
  }
  return active.beat + ((secs - active.timeInSeconds) / 60) * active.bpm;
}

/**
 * Helper to determine if two OSMD notes share a tie (a slur preserves note attacks).
 */
function areNotesTiedOrSlurredTogether(noteA: any, noteB: any): boolean {
  if (!noteA || !noteB) return false;
  if (noteA.NoteTie !== undefined) {
    const notes = noteA.NoteTie.Notes || [];
    if (notes.includes(noteB)) return true;
  }
  return false;
}

/**
 * Parses the visual score and builds a timing-accurate representation for MIDI playback and tracker sync.
 */
export function parseScorePlayback(osmd: OpenSheetMusicDisplay, rawXml?: string | null): ScorePlaybackData {
  if (!osmd.Sheet) {
    throw new Error('OSMD score sheet not loaded');
  }

  const title = osmd.Sheet.TitleString || 'Practice Score';
  const tempos = parseTempoTimeline(osmd, rawXml);
  const intendedBpm = tempos[0]?.bpm ?? 120;

  const voiceToInstrumentMap = new Map<any, any>();
  const instruments = osmd.Sheet.Instruments || [];

  instruments.forEach((instrument) => {
    if (instrument.Voices) {
      instrument.Voices.forEach((voice) => {
        voiceToInstrumentMap.set(voice, instrument);
      });
    }
  });

  const partsMap = new Map<string, PartData>();
  instruments.forEach((instrument) => {
    const partId = instrument.IdString || (instrument as any).Id?.toString() || `P-${Math.random()}`;
    const name = instrument.Name || 'Instrument Part';
    const soundfontInstrument = mapInstrumentToSoundfont(name);

    partsMap.set(partId, {
      id: partId,
      name,
      soundfontInstrument,
      notes: [],
    });
  });

  const cursorPositions: CursorPosition[] = [];
  const partRunningVolume = new Map<string, number>();
  partsMap.forEach((_, partId) => {
    partRunningVolume.set(partId, 0.75);
  });

  const measures = osmd.Sheet?.SourceMeasures || [];
  const getMeasureNumberForBeat = (beat: number): number => {
    let matchedNum = 1;
    for (const m of measures) {
      const mBeat = m.AbsoluteTimestamp.RealValue * 4;
      if (beat >= mBeat - 0.001) {
        matchedNum = m.MeasureNumber;
      } else {
        break;
      }
    }
    return matchedNum;
  };

  const rules = (osmd as any).rules;
  const savedMinNumber = rules?.MinMeasureToDrawNumber;
  const savedMinIndex = rules?.MinMeasureToDrawIndex;
  const savedMaxNumber = rules?.MaxMeasureToDrawNumber;
  const savedMaxIndex = rules?.MaxMeasureToDrawIndex;

  try {
    if (rules) {
      rules.MinMeasureToDrawNumber = 1;
      rules.MinMeasureToDrawIndex = 0;
      rules.MaxMeasureToDrawNumber = Number.MAX_VALUE;
      rules.MaxMeasureToDrawIndex = Number.MAX_VALUE;
    }

    if (!rawXml && osmd.cursor) {
      osmd.cursor.reset();
      const iterator = osmd.cursor.Iterator;

      while (!iterator.EndReached) {
      const timestampInBeats = iterator.currentTimeStamp.RealValue * 4;
      const timeInSeconds = beatToSeconds(timestampInBeats, tempos);

      cursorPositions.push({
        time: timeInSeconds,
        beat: timestampInBeats,
      });

      // Source XML scopes expression to each part/staff/voice. Without it, retain neutral dynamics.
      const voiceEntries = iterator.CurrentVoiceEntries;
      const fallbackMeasureNumber = getMeasureNumberForBeat(timestampInBeats);

      if (voiceEntries) {
        voiceEntries.forEach((voiceEntry) => {
          const voice = voiceEntry.ParentVoice;
          const instrument = voiceToInstrumentMap.get(voice);
          if (!instrument) return;

          const partId = instrument.IdString || (instrument as any).Id?.toString();
          const partData = partsMap.get(partId);
          if (!partData) return;

          if (voiceEntry.Notes) {
            voiceEntry.Notes.forEach((note) => {
              if (note.isRest()) return;

              const noteTimestamp = note.getAbsoluteTimestamp?.();
              if (noteTimestamp && Math.abs(noteTimestamp.RealValue - iterator.currentTimeStamp.RealValue) > 0.0001) {
                return;
              }

              let pitch = note.Pitch?.getHalfTone();
              if (pitch === undefined) return;

              // OSMD's half-tone index is not MIDI; frequency avoids an octave offset.
              const frequency = note.Pitch?.Frequency;
              if (frequency > 0) pitch = 69 + 12 * Math.log2(frequency / 440);
              const transposition = instrument.PlaybackTranspose ?? (instrument as any).playbackTranspose ?? 0;
              pitch += transposition;

              const durationBeats = note.Length.RealValue * 4;
              const endBeat = timestampInBeats + durationBeats;
              const endTimeInSeconds = beatToSeconds(endBeat, tempos);
              const durationInSeconds = Math.max(0.04, endTimeInSeconds - timeInSeconds);

              const velocity = partRunningVolume.get(partId) ?? 0.75;
              const noteMeasureNumber = note.SourceMeasure?.MeasureNumber ??
                (voiceEntry as any)?.parentSourceStaffEntry?.parentMeasure?.MeasureNumber ??
                fallbackMeasureNumber;

              partData.notes.push({
                partId, instrument: partData.soundfontInstrument, voiceId: String(voice.VoiceId),
                pitch,
                time: timeInSeconds,
                duration: durationInSeconds,
                beat: timestampInBeats,
                durationBeats,
                measureNumber: noteMeasureNumber,
                velocity,
                rawNote: note,
              });
            });
          }
        });
      }

      iterator.moveToNext();
    }
  }

  const parts = rawXml
    ? musicXmlPlayback(rawXml, measures.map(m => m.AbsoluteTimestamp.RealValue * 4), tempos)
    : Array.from(partsMap.values());

  // Merge consecutive tied notes of the same pitch; never merge merely slurred attacks.
  parts.forEach((part) => {
    part.notes.sort((a, b) => a.time - b.time);

    const originalNotes = part.notes;
    const merged: NoteEvent[] = [];
    let current: NoteEvent | null = null;

    for (let i = 0; i < originalNotes.length; i++) {
      const note = originalNotes[i];
      if (!current) {
        current = { ...note };
        continue;
      }

      const samePitch = note.pitch === current.pitch;
      const isAdjacent = Math.abs(note.time - (current.time + current.duration)) < 0.03;
      const isConnected = samePitch && isAdjacent && areNotesTiedOrSlurredTogether(current.rawNote, note.rawNote);

      if (isConnected) {
        current.duration += note.duration;
        current.durationBeats += note.durationBeats;
      } else {
        merged.push(current);
        current = { ...note };
      }
    }
    if (current) {
      merged.push(current);
    }

    part.notes = merged.map(({ rawNote: _rn, ...rest }) => rest);
  });

  let maxTime = 0;
  parts.forEach((part) => {
    part.notes.forEach((note) => {
      const noteEnd = note.time + note.duration;
      if (noteEnd > maxTime) maxTime = noteEnd;
    });
  });

  // Calculate clicks
  const clicks: MetronomeClick[] = [];
  let currentNumerator = 4;
  let currentDenominator = 4;

  measures.forEach((measure) => {
    const measureStartBeat = measure.AbsoluteTimestamp.RealValue * 4;
    if (measure.ActiveTimeSignature) {
      currentNumerator = measure.ActiveTimeSignature.Numerator;
      currentDenominator = measure.ActiveTimeSignature.Denominator;
    }
    const beatFraction = 4.0 / currentDenominator;

    for (let b = 0; b < currentNumerator; b++) {
      const beatPosition = measureStartBeat + b * beatFraction;
      const timeInSeconds = beatToSeconds(beatPosition, tempos);
      clicks.push({
        time: timeInSeconds,
        isDownbeat: b === 0,
      });
    }
  });

  // Deduplicate clicks within 1ms
  const uniqueClicks: MetronomeClick[] = [];
  const seenTimes = new Set<string>();
  clicks.forEach((click) => {
    const timeKey = click.time.toFixed(3);
    if (!seenTimes.has(timeKey)) {
      seenTimes.add(timeKey);
      uniqueClicks.push(click);
    }
  });

  if (osmd.cursor) {
    osmd.cursor.reset();
  }

  let initialNumerator = 4;
  let initialDenominator = 4;
  if (measures.length > 0 && measures[0].ActiveTimeSignature) {
    initialNumerator = measures[0].ActiveTimeSignature.Numerator;
    initialDenominator = measures[0].ActiveTimeSignature.Denominator;
  }

  const measureStartBeats = measures.map(m => m.AbsoluteTimestamp.RealValue * 4);
  const measureStartBeatByNumber: Record<number, number> = {};
  measures.forEach((m) => {
    const mNum = (m as any).MeasureNumber ?? (m as any).measureNumber;
    if (mNum !== undefined) {
      measureStartBeatByNumber[mNum] = m.AbsoluteTimestamp.RealValue * 4;
    }
  });

    return {
      title,
      intendedBpm,
      parts,
      tempos,
      durationInSeconds: maxTime,
      clicks: uniqueClicks,
      cursorPositions,
      measureStartBeats,
      metronomeMeasures: measures.map(measure => ({
        measureNumber: measure.MeasureNumber,
        startBeat: measure.AbsoluteTimestamp.RealValue * 4,
        endBeat: (measure.AbsoluteTimestamp.RealValue + measure.Duration.RealValue) * 4,
        numerator: measure.ActiveTimeSignature?.Numerator || initialNumerator,
        denominator: measure.ActiveTimeSignature?.Denominator || initialDenominator,
      })),
      measureStartBeatByNumber,
      initialTimeSignature: {
        numerator: initialNumerator,
        denominator: initialDenominator,
      },
    };
  } finally {
    if (rules) {
      rules.MinMeasureToDrawNumber = savedMinNumber;
      rules.MinMeasureToDrawIndex = savedMinIndex;
      rules.MaxMeasureToDrawNumber = savedMaxNumber;
      rules.MaxMeasureToDrawIndex = savedMaxIndex;
    }
  }
}

/**
 * Selects the optimal part matching the given instrument and returns its target notes for the measure range.
 */
export function getTargetPartAndNotes(
  scorePlaybackData: ScorePlaybackData | null,
  instrumentName: string,
  measureRange: [number, number],
  partId?: string | null
): { activePart: PartData | undefined; targetNotes: NoteEvent[]; sectionStartBeat: number; totalSectionEndBeat: number } {
  if (!scorePlaybackData || !scorePlaybackData.parts || scorePlaybackData.parts.length === 0) {
    return { activePart: undefined, targetNotes: [], sectionStartBeat: 0, totalSectionEndBeat: 0 };
  }

  // 0. The student chose a specific part: use it directly
  const explicit = partId ? scorePlaybackData.parts.find(p => p.id === partId) : undefined;
  if (explicit) {
    const targetNotes = explicit.notes.filter(n => n.measureNumber >= measureRange[0] && n.measureNumber <= measureRange[1]);
    const startMap = scorePlaybackData.measureStartBeatByNumber?.[measureRange[0]];
    const fbStart = (scorePlaybackData.measureStartBeats || [])[measureRange[0] - 1] ?? ((measureRange[0] - 1) * 4);
    const endMap = scorePlaybackData.measureStartBeatByNumber?.[measureRange[1] + 1];
    const fbEnd = (scorePlaybackData.measureStartBeats || [])[measureRange[1]] ?? (measureRange[1] * 4);
    return {
      activePart: explicit,
      targetNotes,
      sectionStartBeat: targetNotes.length > 0 ? targetNotes[0].beat : (startMap ?? fbStart),
      totalSectionEndBeat: targetNotes.length > 0
        ? targetNotes[targetNotes.length - 1].beat + (targetNotes[targetNotes.length - 1].durationBeats || 1)
        : (endMap ?? fbEnd),
    };
  }

  // 1. Keyword-based matching
  const cleanInst = instrumentName.toLowerCase()
    .replace(/\b(in|bb|c|eb|f|d|g|a|solo|part|first|second|third|1|2|3)\b/g, '')
    .replace(/[^a-z]/g, '')
    .trim();

  let candidates = scorePlaybackData.parts.filter(p => {
    const cleanPart = p.name.toLowerCase();
    return (
      (cleanInst.length > 0 && cleanPart.includes(cleanInst)) ||
      (cleanPart.includes('trumpet') && instrumentName.toLowerCase().includes('trumpet')) ||
      (cleanPart.includes('horn') && instrumentName.toLowerCase().includes('horn')) ||
      (cleanPart.includes('trombone') && instrumentName.toLowerCase().includes('trombone')) ||
      (cleanPart.includes('flute') && instrumentName.toLowerCase().includes('flute')) ||
      (cleanPart.includes('clarinet') && instrumentName.toLowerCase().includes('clarinet')) ||
      (cleanPart.includes('sax') && instrumentName.toLowerCase().includes('sax')) ||
      (cleanPart.includes('tuba') && instrumentName.toLowerCase().includes('tuba'))
    );
  });

  if (candidates.length === 0) {
    candidates = scorePlaybackData.parts;
  }

  // 2. Pick the candidate that actually has notes in the target measure range
  let chosenPart = candidates.find(p =>
    p.notes.some(n => n.measureNumber >= measureRange[0] && n.measureNumber <= measureRange[1])
  );

  // If multiple or none found in range, pick the candidate with the most notes in the piece
  if (!chosenPart) {
    chosenPart = [...candidates].sort((a, b) => b.notes.length - a.notes.length)[0];
  }

  const activeNotes = chosenPart?.notes || [];
  const targetNotes = activeNotes.filter(
    n => n.measureNumber >= measureRange[0] && n.measureNumber <= measureRange[1]
  );

  console.log('[getTargetPartAndNotes DEBUG] ' + JSON.stringify({
    chosenPartName: chosenPart?.name,
    totalActiveNotes: activeNotes.length,
    activeNotesMeasureNumbers: activeNotes.map(n => n.measureNumber),
    measureRange,
    targetNotesCount: targetNotes.length,
  }));

  const measureStartBeats = scorePlaybackData.measureStartBeats || [];
  const startBeatFromMap = scorePlaybackData.measureStartBeatByNumber?.[measureRange[0]];
  const fallbackStartBeat = measureStartBeats[measureRange[0] - 1] ?? ((measureRange[0] - 1) * 4);
  const sectionStartBeat = targetNotes.length > 0
    ? targetNotes[0].beat
    : (startBeatFromMap ?? fallbackStartBeat);

  const endBeatFromMap = scorePlaybackData.measureStartBeatByNumber?.[measureRange[1] + 1];
  const fallbackEndBeat = measureStartBeats[measureRange[1]] ?? (measureRange[1] * 4);
  const totalSectionEndBeat = targetNotes.length > 0
    ? targetNotes[targetNotes.length - 1].beat + (targetNotes[targetNotes.length - 1].durationBeats || 1)
    : (endBeatFromMap ?? fallbackEndBeat);

  return { activePart: chosenPart, targetNotes, sectionStartBeat, totalSectionEndBeat };
}
