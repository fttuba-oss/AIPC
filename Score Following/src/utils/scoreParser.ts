import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

export interface NoteEvent {
  pitch: number;        // MIDI note number (e.g., 60 = C4)
  time: number;         // Start time in seconds from start
  duration: number;     // Duration in seconds
  beat: number;         // Start beat position (quarter note = 1.0)
  durationBeats: number;// Duration in beats
  velocity?: number;    // Dynamic velocity (0.0 to 1.0)
  rawNote?: any;        // Temporary helper for merging consecutive tied/slurred notes
}

export interface PartData {
  id: string;
  name: string;
  soundfontInstrument: string;
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

export interface PracticePart {
  fileId: string;
  partIdInFile: string;
  audioPartId: string; // unique ID: `${fileId}::${partIdInFile}`
  name: string;
  group: string;
  soundfontInstrument: string;
}

export interface ScoreData {
  title: string;
  parts: PartData[];
  tempos: TempoChange[];
  durationInSeconds: number;
  clicks: MetronomeClick[];
  cursorPositions: CursorPosition[];
  initialTimeSignature?: { numerator: number; denominator: number };
}


/**
 * Maps a parsed MusicXML instrument name to a standard General MIDI soundfont name.
 */
export function mapInstrumentToSoundfont(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes('flute')) return 'flute';
  if (normalized.includes('clarinet')) return 'clarinet';
  if (normalized.includes('oboe')) return 'oboe';
  if (normalized.includes('bassoon')) return 'bassoon';
  if (normalized.includes('alto sax') || normalized.includes('alto 1') || normalized.includes('alto 2')) return 'alto_sax';
  if (normalized.includes('tenor sax')) return 'tenor_sax';
  if (normalized.includes('baritone sax')) return 'baritone_sax';
  if (normalized.includes('soprano sax')) return 'soprano_sax';
  if (normalized.includes('sax')) return 'alto_sax';
  if (normalized.includes('trumpet') || normalized.includes('cornet') || normalized.includes('soloist')) return 'trumpet';
  if (normalized.includes('horn') || normalized.includes('mellophone')) return 'french_horn';
  if (normalized.includes('trombone')) return 'trombone';
  if (normalized.includes('baritone') || normalized.includes('euphonium')) return 'trombone';
  if (normalized.includes('tuba') || normalized.includes('bass')) return 'tuba';
  if (normalized.includes('glockenspiel') || normalized.includes('bell')) return 'glockenspiel';
  if (normalized.includes('xylophone')) return 'xylophone';
  if (normalized.includes('marimba')) return 'marimba';
  if (normalized.includes('timpani')) return 'timpani';
  if (normalized.includes('drum') || normalized.includes('snare') || normalized.includes('cymbal') || normalized.includes('percussion') || normalized.includes('triangle') || normalized.includes('bass drum')) return 'synth_drum';
  return 'acoustic_grand_piano'; // default fallback
}

/**
 * Maps a General MIDI program number (0-based) to a soundfont instrument name.
 * Used as a fallback when the part name is generic (e.g. "Score").
 */
export function midiProgramToSoundfont(program: number): string {
  // GM program numbers are 0-indexed
  if (program >= 0 && program <= 7)   return 'acoustic_grand_piano';
  if (program >= 8 && program <= 15)  return 'acoustic_grand_piano'; // chromatic perc
  if (program >= 16 && program <= 23) return 'acoustic_grand_piano'; // organ
  if (program >= 24 && program <= 31) return 'acoustic_grand_piano'; // guitar
  if (program >= 32 && program <= 39) return 'acoustic_grand_piano'; // bass
  if (program >= 40 && program <= 47) return 'violin';               // strings
  if (program >= 48 && program <= 55) return 'string_ensemble_1';    // ensemble
  if (program >= 56 && program <= 63) return 'trumpet';              // brass (56=trumpet, 57=trombone, 58=tuba, 60=french horn)
  if (program === 57) return 'trombone';
  if (program === 58) return 'tuba';
  if (program === 60) return 'french_horn';
  if (program >= 64 && program <= 71) return 'alto_sax';             // reed (64=soprano sax, 65=alto sax, 66=tenor sax, 67=baritone sax, 68=oboe, 69=english horn, 70=bassoon, 71=clarinet)
  if (program === 64) return 'soprano_sax';
  if (program === 65) return 'alto_sax';
  if (program === 66) return 'tenor_sax';
  if (program === 67) return 'baritone_sax';
  if (program === 68) return 'oboe';
  if (program === 70) return 'bassoon';
  if (program === 71) return 'clarinet';
  if (program >= 72 && program <= 79) return 'flute';               // pipe (72=piccolo, 73=flute, 74=recorder, 75=pan flute)
  if (program === 73) return 'flute';
  return 'acoustic_grand_piano';
}


/**
 * Parses the tempo timeline from the sheet's measures.
 */
export function parseTempoTimeline(osmd: OpenSheetMusicDisplay): TempoChange[] {
  const measures = osmd.Sheet.SourceMeasures;
  if (!measures || measures.length === 0) {
    return [{ beat: 0, bpm: 120, timeInSeconds: 0 }];
  }

  // Find initial tempo. Default to 120 if none specified.
  let currentBpm = 120;
  for (const m of measures) {
    if (m.TempoInBPM && m.TempoInBPM > 0) {
      currentBpm = m.TempoInBPM;
      break;
    }
  }

  const tempos: TempoChange[] = [{ beat: 0, bpm: currentBpm, timeInSeconds: 0 }];
  let lastBpm = currentBpm;

  // Process all measures to locate tempo changes
  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i];
    const measureStartBeat = measure.AbsoluteTimestamp.RealValue * 4;

    if (measure.TempoInBPM && measure.TempoInBPM > 0 && measure.TempoInBPM !== lastBpm) {
      // Calculate absolute time of this tempo change
      const timeInSeconds = beatToSeconds(measureStartBeat, tempos);
      tempos.push({
        beat: measureStartBeat,
        bpm: measure.TempoInBPM,
        timeInSeconds,
      });
      lastBpm = measure.TempoInBPM;
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
 * Parse time-signature-aware metronome click ticks.
 */
export function parseMetronomeClicks(osmd: OpenSheetMusicDisplay, tempos: TempoChange[]): MetronomeClick[] {
  const clicks: MetronomeClick[] = [];
  const measures = osmd.Sheet.SourceMeasures;
  if (!measures) return [];

  let currentNumerator = 4;
  let currentDenominator = 4;

  measures.forEach((measure) => {
    const measureStartBeat = measure.AbsoluteTimestamp.RealValue * 4;
    
    // Update active time signature if explicitly defined in this measure
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

  // Defensive Deduplication: Prevent multiple metronome clicks scheduled at the exact same millisecond.
  // This solves the Tone.js Synth "Start time must be strictly greater than previous start time" exception.
  const uniqueClicks: MetronomeClick[] = [];
  const seenTimes = new Set<string>();

  clicks.forEach((click) => {
    const timeKey = click.time.toFixed(3); // 1ms resolution
    if (!seenTimes.has(timeKey)) {
      seenTimes.add(timeKey);
      uniqueClicks.push(click);
    }
  });

  return uniqueClicks;
}

/**
 * Helper to determine if two OSMD Notes are explicitly tied or part of the same slur.
 */
function areNotesTiedOrSlurredTogether(noteA: any, noteB: any): boolean {
  if (!noteA || !noteB) return false;

  // 1. Check if noteA has a tie that explicitly includes noteB
  if (noteA.NoteTie !== undefined) {
    const notes = noteA.NoteTie.Notes || [];
    if (notes.includes(noteB)) return true;
  }

  // 2. Check if they share the exact same slur object (meaning they are slurred together)
  const slursA = noteA.slurs || [];
  const slursB = noteB.slurs || [];

  if (slursA.length > 0 && slursB.length > 0) {
    const sharedSlur = slursA.some((sA: any) => slursB.includes(sA));
    if (sharedSlur) return true;
  }

  return false;
}

/**
 * Parses the visual score and builds a timing-accurate representation for synthesizer playback.
 */
export function parseScore(osmd: OpenSheetMusicDisplay): ScoreData {
  if (!osmd.Sheet) {
    throw new Error('OSMD score sheet not loaded');
  }

  const title = osmd.Sheet.TitleString || 'Unnamed Score';
  const tempos = parseTempoTimeline(osmd);

  // Map voices to their parent instruments to identify notes quickly during iteration
  const voiceToInstrumentMap = new Map<any, any>();
  const instruments = osmd.Sheet.Instruments;
  
  instruments.forEach((instrument) => {
    if (instrument.Voices) {
      instrument.Voices.forEach((voice) => {
        voiceToInstrumentMap.set(voice, instrument);
      });
    }
  });

  // Prepare part objects, using MIDI program as fallback when part name is generic
  const partsMap = new Map<string, PartData>();
  instruments.forEach((instrument) => {
    const partId = instrument.IdString || instrument.Id?.toString() || `P-${Math.random()}`;
    const name = instrument.Name || 'Unnamed Part';

    // Try name-based detection first
    let soundfontInstrument = mapInstrumentToSoundfont(name);
    
    // If name-based detection falls through to piano AND the name looks generic,
    // try to use the MIDI program number from the score to pick a better instrument
    const isGenericName = ['score', 'unnamed', 'part', 'instrument', 'voice'].some(
      g => name.toLowerCase() === g || name.toLowerCase().startsWith(g + ' ')
    );
    if (soundfontInstrument === 'acoustic_grand_piano' && isGenericName) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const midiInstr = (instrument as any).MidiInstrument;
      const program: number | undefined = midiInstr?.Program ?? midiInstr?.midiInstrumentId;
      if (program !== undefined) {
        soundfontInstrument = midiProgramToSoundfont(program);
      }
    }

    partsMap.set(partId, {
      id: partId,
      name,
      soundfontInstrument,
      notes: [],
    });
  });

  // Also collect unique visual cursor steps for visual sync
  const cursorPositions: CursorPosition[] = [];

  // Track active dynamic volume per part. Defaults to 0.75 (mf)
  const partRunningVolume = new Map<string, number>();
  partsMap.forEach((_, partId) => {
    partRunningVolume.set(partId, 0.75);
  });

  // Use the OSMD cursor iterator to scan the score chronologically
  osmd.cursor.reset();
  const iterator = osmd.cursor.Iterator;

  while (!iterator.EndReached) {
    const timestampInBeats = iterator.currentTimeStamp.RealValue * 4;
    const timeInSeconds = beatToSeconds(timestampInBeats, tempos);
    
    // Track cursor location
    cursorPositions.push({
      time: timeInSeconds,
      beat: timestampInBeats,
    });

    // Check if there are active dynamic volume expressions on this step
    let stepVolume: number | undefined;
    const activeExprs = (iterator as any).ActiveDynamicExpressions;
    if (activeExprs && activeExprs.length > 0) {
      activeExprs.forEach((expr: any) => {
        if (expr && (expr.dynamicEnum !== undefined || expr.DynEnum !== undefined)) {
          const dyn = expr.dynamicEnum !== undefined ? expr.dynamicEnum : expr.DynEnum;
          if (dyn >= 0 && dyn <= 3) {
            stepVolume = 0.35; // ppp / pppp
          } else if (dyn === 4) {
            stepVolume = 0.50; // pp
          } else if (dyn === 5) {
            stepVolume = 0.65; // p
          } else if (dyn === 6) {
            stepVolume = 0.72; // mp
          } else if (dyn === 7) {
            stepVolume = 0.82; // mf
          } else if (dyn === 8) {
            stepVolume = 0.92; // f
          } else if (dyn >= 9 && dyn <= 13) {
            stepVolume = 1.0;  // ff / fff
          } else if (dyn === 18) {
            stepVolume = 0.65; // fp
          } else if (dyn >= 19 && dyn <= 23) {
            stepVolume = 0.95; // sfz / fz
          }
        }
      });
    }

    if (stepVolume !== undefined) {
      // Update running volume for all parts
      for (const partId of partRunningVolume.keys()) {
        partRunningVolume.set(partId, stepVolume);
      }
    }

    const voiceEntries = iterator.CurrentVoiceEntries;
    if (voiceEntries) {
      voiceEntries.forEach((voiceEntry) => {
        const voice = voiceEntry.ParentVoice;
        const instrument = voiceToInstrumentMap.get(voice);
        if (!instrument) return;

        const partId = instrument.IdString || instrument.Id?.toString();
        const partData = partsMap.get(partId);
        if (!partData) return;

        if (voiceEntry.Notes) {
          voiceEntry.Notes.forEach((note) => {
            // Skip rests
            if (note.isRest()) return;

            // ONLY parse the note if it actually starts at this timestamp!
            // This prevents duplicate notes from being parsed on subsequent iterator steps.
            const noteTimestamp = note.getAbsoluteTimestamp?.();
            if (noteTimestamp && Math.abs(noteTimestamp.RealValue - iterator.currentTimeStamp.RealValue) > 0.0001) {
              return;
            }

            let pitch = note.Pitch?.getHalfTone();
            if (pitch === undefined) return;

            // Transpose written pitch to concert sounding pitch for MIDI playback.
            // Check OSMD parsed playback transpositions first, falling back to name detection.
            const transposition = 
              (instrument as any).playbackTranspose || 
              (instrument as any).PlaybackTranspose || 
              instrument.Transpose || 
              getFallbackTransposition(instrument.Name || '');
            pitch += transposition;

            const durationBeats = note.Length.RealValue * 4;
            const endBeat = timestampInBeats + durationBeats;
            const endTimeInSeconds = beatToSeconds(endBeat, tempos);
            const durationInSeconds = endTimeInSeconds - timeInSeconds;

            const velocity = partRunningVolume.get(partId) ?? 0.75;

            partData.notes.push({
              pitch,
              time: timeInSeconds,
              duration: durationInSeconds,
              beat: timestampInBeats,
              durationBeats,
              velocity,
              rawNote: note,
            });
          });
        }
      });
    }

    iterator.moveToNext();
  }

  const parts = Array.from(partsMap.values());

  // Post-process to merge consecutive notes of the exact same pitch if they are tied/slurred together
  parts.forEach((part) => {
    // Sort notes chronologically before merging
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
      const isAdjacent = Math.abs(note.time - (current.time + current.duration)) < 0.03; // within 30ms adjacency
      const isConnected = samePitch && isAdjacent && areNotesTiedOrSlurredTogether(current.rawNote, note.rawNote);

      if (isConnected) {
        // Merge! Add note duration to current note
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

    // Clean up temporary property for clean interfaces
    part.notes = merged.map(({ rawNote, ...rest }) => rest);
  });

  // Calculate total score duration
  let maxTime = 0;
  parts.forEach((part) => {
    part.notes.forEach((note) => {
      const noteEnd = note.time + note.duration;
      if (noteEnd > maxTime) {
        maxTime = noteEnd;
      }
    });
  });

  // Retrieve metronome clicks schedule
  const clicks = parseMetronomeClicks(osmd, tempos);

  // Reset the cursor visual back to start for the viewer
  osmd.cursor.reset();

  // Find time signature of the first measure
  let initialNumerator = 4;
  let initialDenominator = 4;
  if (osmd.Sheet.SourceMeasures && osmd.Sheet.SourceMeasures.length > 0) {
    for (const m of osmd.Sheet.SourceMeasures) {
      if (m.ActiveTimeSignature) {
        initialNumerator = m.ActiveTimeSignature.Numerator;
        initialDenominator = m.ActiveTimeSignature.Denominator;
        break;
      }
    }
  }

  return {
    title,
    parts,
    tempos,
    durationInSeconds: maxTime,
    clicks,
    cursorPositions,
    initialTimeSignature: {
      numerator: initialNumerator,
      denominator: initialDenominator,
    },
  };
}

/**
 * Helper to group parts by instrument family/name (e.g., Flute 1, Flute 2 -> Flute).
 */
export function getInstrumentGroup(name: string): string {
  let cleaned = name.toLowerCase();
  
  // Remove numbers
  cleaned = cleaned.replace(/\d+/g, '');
  
  // Remove roman numerals (I, II, III, IV, etc.)
  cleaned = cleaned.replace(/\b(i{1,3}|iv|v|vi{1,3}|ix|x)\b/g, '');
  
  // Remove common suffixes/prefixes/descriptors
  cleaned = cleaned.replace(/\b(part|solo|duet|trio|sect|section|midi|flat|flat|major|minor|in b|in bb|in a|in c|in f|in eb|alto|tenor|baritone|soprano|bass)\b/g, '');
  
  // Trim and replace multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Capitalize first letters
  let group = cleaned.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
    
  if (!group) return 'Other';
  
  // Standardize some names
  if (group.includes('Flute') || group.includes('Piccolo')) return 'Flute';
  if (group.includes('Clarinet')) return 'Clarinet';
  if (group.includes('Oboe') || group.includes('English Horn')) return 'Oboe';
  if (group.includes('Bassoon')) return 'Bassoon';
  if (group.includes('Sax')) return 'Saxophone';
  if (group.includes('Trumpet') || group.includes('Cornet')) return 'Trumpet';
  if (group.includes('Horn') || group.includes('Mellophone')) return 'French Horn';
  if (group.includes('Trombone')) return 'Trombone';
  if (group.includes('Euphonium') || group.includes('Baritone')) return 'Euphonium/Baritone';
  if (group.includes('Tuba') || group.includes('Bass')) return 'Tuba';
  if (group.includes('Percussion') || group.includes('Drum') || group.includes('Snare') || group.includes('Cymbal') || group.includes('Timpani')) return 'Percussion';
  
  return group;
}

/**
 * Parses XML or MXL score data programmatically in an offscreen DOM element.
 */
export async function parseXmlOffscreen(
  content: string | Uint8Array,
  _isMxl?: boolean
): Promise<ScoreData> {
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '1000px';
  document.body.appendChild(tempDiv);
  
  try {
    const osmd = new OpenSheetMusicDisplay(tempDiv, {
      autoResize: false,
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawMetronomeMarks: false,
      coloringEnabled: false,
      cursorsOptions: [{
        type: 1,
        color: '#10B981',
        alpha: 0,
        follow: false
      }]
    });
    
    await osmd.load(content as any);
    osmd.render();
    const parsed = parseScore(osmd);
    return parsed;
  } finally {
    document.body.removeChild(tempDiv);
  }
}

/**
 * Fallback transposition mappings to convert written pitches to concert sounding pitches
 * in semitones. Negative values shift the pitch down (e.g. Alto Sax Eb written C sounds Eb, so -9).
 */
export function getFallbackTransposition(name: string): number {
  const normalized = name.toLowerCase();
  
  if (normalized.includes('baritone sax')) return -21;
  if (normalized.includes('tenor sax')) return -14;
  if (normalized.includes('alto sax')) return -9;
  if (normalized.includes('soprano sax')) return -2;
  if (normalized.includes('sax')) return -9; // Default to Eb Alto Saxophone
  
  if (normalized.includes('bass clarinet')) return -14;
  if (normalized.includes('alto clarinet')) return -9;
  if (normalized.includes('clarinet')) return -2; // Bb Clarinet
  
  if (normalized.includes('trumpet') || normalized.includes('cornet') || normalized.includes('flugelhorn')) return -2; // Bb Trumpet
  
  if (normalized.includes('french horn') || normalized.includes('english horn') || normalized.includes('horn in f') || (normalized.includes('horn') && !normalized.includes('baritone'))) return -7; // F Horn
  
  return 0;
}
