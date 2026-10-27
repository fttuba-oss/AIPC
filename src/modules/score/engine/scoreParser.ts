import JSZip from 'jszip';
import { ParsedScore, ParsedScoreMeasure, ParsedScoreNote } from '../../../contracts/portal';

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};

export function pitchToMidi(step: string, octave: number, alter: number = 0): number {
  const base = STEP_TO_SEMITONE[step.toUpperCase()] ?? 0;
  return 12 * (octave + 1) + base + alter;
}

export function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = noteNames[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function semitonesToIntervalName(semitones: number): string {
  switch (semitones) {
    case 5: return 'Perfect 4th';
    case 6: return 'Tritone';
    case 7: return 'Perfect 5th';
    case 8: return 'Minor 6th';
    case 9: return 'Major 6th';
    case 10: return 'Minor 7th';
    case 11: return 'Major 7th';
    case 12: return 'Octave';
    default:
      if (semitones > 12) return `Compound (${semitones}st)`;
      return `${semitones} semitones`;
  }
}

// Longuet-Higgins & Lee (LHL) Metrical Strength Helper
function getMetricalStrength(beatPos: number, beatsPerMeasure: number): number {
  if (beatPos === 0) return 3; // Downbeat is strongest
  
  if (beatsPerMeasure === 4) {
    if (beatPos === 2) return 2; // Beat 3
    if (beatPos === 1 || beatPos === 3) return 1; // Beats 2 and 4
    if (beatPos % 1 === 0.5) return 0; // Eighth offbeats
    return -1; // Sixteenth offbeats
  }
  
  if (beatsPerMeasure === 3) {
    if (beatPos === 1 || beatPos === 2) return 1;
    if (beatPos % 1 === 0.5) return 0;
    return -1;
  }

  if (beatsPerMeasure === 6) {
    if (beatPos === 1.5) return 2;
    if (beatPos % 0.5 === 0) return 0;
    return -1;
  }

  if (beatPos % 1 === 0) return 1;
  if (beatPos % 0.5 === 0) return 0;
  return -1;
}

export function calculateMeasureSyncopation(notes: ParsedScoreNote[], beatsPerMeasure: number): number {
  let syncopation = 0;
  let currentBeat = 0;

  for (const note of notes) {
    const noteBeats = note.durationQuarter;

    if (!note.isRest && !note.isTied) {
      const onsetStrength = getMetricalStrength(currentBeat, beatsPerMeasure);
      const step = 0.25;

      for (let checkBeat = currentBeat + step; checkBeat < currentBeat + noteBeats; checkBeat += step) {
        const roundedBeat = Math.round(checkBeat * 100) / 100;
        if (roundedBeat < beatsPerMeasure) {
          const innerStrength = getMetricalStrength(roundedBeat, beatsPerMeasure);
          if (innerStrength > onsetStrength) {
            syncopation += (innerStrength - onsetStrength);
          }
        }
      }
    } else if (note.isRest) {
      const restStrength = getMetricalStrength(currentBeat, beatsPerMeasure);
      if (restStrength >= 2) {
        syncopation += 0.5;
      }
    }

    currentBeat += noteBeats;
  }

  return syncopation;
}

/**
 * Unzips compressed .mxl file or returns plain XML string
 */
export async function unpackMusicXml(fileBuffer: ArrayBuffer): Promise<string> {
  const header = new Uint8Array(fileBuffer.slice(0, 4));
  const isZip = header[0] === 0x50 && header[1] === 0x4B;

  if (!isZip) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(fileBuffer);
  }

  const zip = await JSZip.loadAsync(fileBuffer);
  let rootFilePath = '';
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const match = containerXml.match(/full-path="([^"]+)"/);
    if (match && match[1]) {
      rootFilePath = match[1];
    }
  }

  if (!rootFilePath) {
    const xmlFileNames = Object.keys(zip.files).filter(
      name => name.endsWith('.xml') && !name.startsWith('META-INF/')
    );
    if (xmlFileNames.length > 0) {
      rootFilePath = xmlFileNames[0];
    }
  }

  if (!rootFilePath || !zip.file(rootFilePath)) {
    throw new Error('Could not find MusicXML rootfile inside compressed .mxl container.');
  }

  return await zip.file(rootFilePath)!.async('text');
}

/**
 * Parses MusicXML string into structured ParsedScore model
 */
export function parseMusicXmlToScore(xmlString: string): ParsedScore {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML parsing failed: ' + parserError.textContent);
  }

  const title = xmlDoc.querySelector('work-title')?.textContent?.trim() ||
                xmlDoc.querySelector('movement-title')?.textContent?.trim() ||
                'Untitled Piece';
  const composer = xmlDoc.querySelector('creator[type="composer"]')?.textContent?.trim();

  const partMap: Record<string, { name: string; instrument: string }> = {};
  const scoreParts = xmlDoc.querySelectorAll('part-list > score-part');
  scoreParts.forEach(sp => {
    const id = sp.getAttribute('id') || '';
    const name = sp.querySelector('part-name')?.textContent?.trim() || id;
    const instrument = sp.querySelector('instrument-name')?.textContent?.trim() || name;
    partMap[id] = { name, instrument };
  });

  const parsedParts: ParsedScore['parts'] = [];
  const partElements = xmlDoc.querySelectorAll('score-partwise > part');

  partElements.forEach(partEl => {
    const partId = partEl.getAttribute('id') || '';
    const partInfo = partMap[partId] || { name: partId, instrument: 'Instrument' };
    
    let currentDivisions = 4;
    let currentTimeSig = { beats: 4, beatType: 4 };
    let currentTempoBpm = 100;
    let isCurrentlySlurred = false;
    let lastSoundingPitchMidi: number | null = null;

    const measureElements = partEl.querySelectorAll(':scope > measure');
    const parsedMeasures: ParsedScoreMeasure[] = [];

    measureElements.forEach((measureEl, mIdx) => {
      const measureNum = parseInt(measureEl.getAttribute('number') || `${mIdx + 1}`, 10);

      // Check divisions
      const divEl = measureEl.querySelector('attributes > divisions');
      if (divEl && divEl.textContent) {
        currentDivisions = parseInt(divEl.textContent, 10) || currentDivisions;
      }

      // Check time signature
      const beatsEl = measureEl.querySelector('attributes > time > beats');
      const beatTypeEl = measureEl.querySelector('attributes > time > beat-type');
      if (beatsEl && beatTypeEl) {
        currentTimeSig = {
          beats: parseInt(beatsEl.textContent || '4', 10) || 4,
          beatType: parseInt(beatTypeEl.textContent || '4', 10) || 4
        };
      }

      // Check tempo direction
      const tempoSoundEl = measureEl.querySelector('direction sound[tempo]');
      if (tempoSoundEl) {
        currentTempoBpm = parseFloat(tempoSoundEl.getAttribute('tempo') || `${currentTempoBpm}`);
      } else {
        const perMinuteEl = measureEl.querySelector('direction-type metronome per-minute');
        if (perMinuteEl && perMinuteEl.textContent) {
          currentTempoBpm = parseFloat(perMinuteEl.textContent) || currentTempoBpm;
        }
      }

      const noteElements = measureEl.querySelectorAll('note');
      const parsedNotes: ParsedScoreNote[] = [];
      let minPitch: number | null = null;
      let maxPitch: number | null = null;
      let fastNotesInMeasure = 0;
      let unslurredFastNotesInMeasure = 0;
      let hasTuplets = false;
      let leapsInMeasure = 0;
      let maxLeapSemitones = 0;
      let soundingNotesCount = 0;
      // Check explicit whole-measure rest attribute or measure with only rests
      const hasMeasureRestAttr = measureEl.querySelector('rest[measure="yes"]') !== null;
      let hasAnySoundingNote = false;
      noteElements.forEach(n => {
        if (!n.querySelector('rest') && !n.querySelector('grace')) {
          hasAnySoundingNote = true;
        }
      });
      const isFullMeasureRest = hasMeasureRestAttr || !hasAnySoundingNote;

      if (isFullMeasureRest) {
        lastSoundingPitchMidi = null; // Cannot leap across a rest bar!
      }

      noteElements.forEach(noteEl => {
        const isGrace = noteEl.querySelector('grace') !== null;
        if (isGrace) return;

        const isRest = noteEl.querySelector('rest') !== null;
        
        let pitchMidi: number | undefined;
        let step: string | undefined;
        let octave: number | undefined;
        let alter = 0;
        let intervalFromPrev: number | undefined;

        if (isRest) {
          // Intervening rest breaks melodic leap continuity
          lastSoundingPitchMidi = null;
        } else {
          soundingNotesCount++;
          const pitchEl = noteEl.querySelector('pitch');
          if (pitchEl) {
            step = pitchEl.querySelector('step')?.textContent?.trim() || 'C';
            octave = parseInt(pitchEl.querySelector('octave')?.textContent?.trim() || '4', 10);
            alter = parseInt(pitchEl.querySelector('alter')?.textContent?.trim() || '0', 10);
            pitchMidi = pitchToMidi(step, octave, alter);

            if (minPitch === null || pitchMidi < minPitch) minPitch = pitchMidi;
            if (maxPitch === null || pitchMidi > maxPitch) maxPitch = pitchMidi;

            // Check melodic leap interval against immediately preceding connected note
            if (lastSoundingPitchMidi !== null) {
              const diff = Math.abs(pitchMidi - lastSoundingPitchMidi);
              intervalFromPrev = diff;
              // Leap definition: strictly greater than a Major 3rd (4 semitones) -> 5+ semitones
              if (diff > 4) {
                leapsInMeasure++;
                if (diff > maxLeapSemitones) maxLeapSemitones = diff;
              }
            }
            lastSoundingPitchMidi = pitchMidi;
          }
        }

        // Duration in quarters
        const durEl = noteEl.querySelector('duration');
        let durationQuarter = 1.0;
        if (durEl && durEl.textContent) {
          const rawDur = parseFloat(durEl.textContent);
          durationQuarter = rawDur / currentDivisions;
        } else {
          const typeEl = noteEl.querySelector('type')?.textContent?.trim();
          if (typeEl === 'whole') durationQuarter = 4.0;
          else if (typeEl === 'half') durationQuarter = 2.0;
          else if (typeEl === 'quarter') durationQuarter = 1.0;
          else if (typeEl === 'eighth') durationQuarter = 0.5;
          else if (typeEl === '16th') durationQuarter = 0.25;
          else if (typeEl === '32nd') durationQuarter = 0.125;
        }

        const timeMod = noteEl.querySelector('time-modification');
        if (timeMod) hasTuplets = true;

        const slurStarts = noteEl.querySelectorAll('notations slur[type="start"]');
        const slurStops = noteEl.querySelectorAll('notations slur[type="stop"]');
        if (slurStarts.length > 0) isCurrentlySlurred = true;

        const hasStaccato = noteEl.querySelector('notations articulations staccato') !== null;
        const hasAccent = noteEl.querySelector('notations articulations accent') !== null;
        const isTied = noteEl.querySelector('tie[type="stop"]') !== null ||
                       noteEl.querySelector('notations tied[type="stop"]') !== null;

        const durationMs = (60000 / currentTempoBpm) * durationQuarter;

        const parsedNote: ParsedScoreNote = {
          pitchMidi,
          step,
          octave,
          alter,
          isRest,
          durationQuarter,
          durationMs,
          isSlurred: isCurrentlySlurred,
          hasStaccato,
          hasAccent,
          isTied,
          intervalFromPrev
        };

        if (slurStops.length > 0) {
          isCurrentlySlurred = false;
        }

        if (!isRest && durationMs <= 165) {
          fastNotesInMeasure++;
          if (!parsedNote.isSlurred) {
            unslurredFastNotesInMeasure++;
          }
        }

        parsedNotes.push(parsedNote);
      });

      const syncopation = calculateMeasureSyncopation(parsedNotes, currentTimeSig.beats);

      parsedMeasures.push({
        measureNumber: measureNum,
        timeSignature: currentTimeSig,
        tempoBpm: currentTempoBpm,
        isFullMeasureRest,
        notes: parsedNotes,
        syncopationScore: syncopation,
        hasTuplets,
        minPitchMidi: minPitch,
        maxPitchMidi: maxPitch,
        fastNotesCount: fastNotesInMeasure,
        unslurredFastNotesCount: unslurredFastNotesInMeasure,
        leapsCount: leapsInMeasure,
        maxLeapIntervalSemitones: maxLeapSemitones
      });
    });

    parsedParts.push({
      id: partId,
      name: partInfo.name,
      instrument: partInfo.instrument,
      measures: parsedMeasures
    });
  });

  const selectedPartId = parsedParts.length > 0 ? parsedParts[0].id : '';

  return {
    title,
    composer,
    parts: parsedParts,
    selectedPartId
  };
}
