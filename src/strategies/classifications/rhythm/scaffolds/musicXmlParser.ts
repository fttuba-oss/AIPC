import { DURATION_MAP } from './rhythmEngine';

export interface ParsedNote {
  duration: string; // e.g. "4", "8", "8t", etc.
  isRest: boolean;
  beats: number;
  pitch?: string;
  isTiedStart: boolean;
  isTiedStop: boolean;
}

export interface ParsedMeasure {
  measureNumber: number;
  timeSignature: { beatsPerMeasure: number; beatValue: number };
  tempoBPM: number;
  notes: ParsedNote[];
  syncopationScore: number;
  densityScore: number;
}

export interface PartRhythmProfile {
  partId: string;
  partName: string;
  measures: ParsedMeasure[];
}

// Helper to determine metrical strength of a beat position in a measure
// Higher number = metrically stronger
function getMetricalStrength(beatPos: number, beatsPerMeasure: number): number {
  if (beatPos === 0) return 3; // Downbeat is strongest
  
  if (beatsPerMeasure === 4) {
    if (beatPos === 2) return 2; // Beat 3 is strong
    if (beatPos === 1 || beatPos === 3) return 1; // Beats 2 and 4 are medium-strong
    if (beatPos % 1 === 0.5) return 0; // Eighth note offbeats
    return -1; // Sixteenth note offbeats
  }
  
  if (beatsPerMeasure === 3) {
    if (beatPos === 1 || beatPos === 2) return 1; // Beats 2 and 3 are medium
    if (beatPos % 1 === 0.5) return 0; // Eighth note offbeats
    return -1;
  }

  if (beatsPerMeasure === 6) {
    if (beatPos === 1.5) return 2;
    if (beatPos === 0.5 || beatPos === 1.0 || beatPos === 2.0 || beatPos === 2.5) return 0;
    return -1;
  }

  if (beatPos % 1 === 0) return 1;
  if (beatPos % 0.5 === 0) return 0;
  return -1;
}

// Calculate the Longuet-Higgins & Lee (LHL) Syncopation for a single measure
export function calculateMeasureSyncopation(notes: ParsedNote[], beatsPerMeasure: number): number {
  let syncopation = 0;
  let currentBeat = 0;

  notes.forEach((note) => {
    const noteBeats = note.beats;

    if (!note.isRest && !note.isTiedStop) {
      const onsetStrength = getMetricalStrength(currentBeat, beatsPerMeasure);

      const step = 0.25; // Check every sixteenth note grid point
      for (let checkBeat = currentBeat + step; checkBeat < currentBeat + noteBeats; checkBeat += step) {
        const roundedCheckBeat = Math.round(checkBeat * 100) / 100;
        
        if (roundedCheckBeat < beatsPerMeasure) {
          const innerStrength = getMetricalStrength(roundedCheckBeat, beatsPerMeasure);
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
  });

  return syncopation;
}

function durationToBeats(durationName: string): number {
  return DURATION_MAP[durationName] || 1.0;
}

function getRhythmDurationToken(type: string | null, hasDot: boolean, isTriplet: boolean): string {
  if (isTriplet) {
    if (type === 'half') return '2t';
    if (type === 'quarter') return '4t';
    if (type === 'eighth') {
      return hasDot ? '8dt' : '8t';
    }
    if (type === '16th') return '16t';
    return '8t';
  }
  
  if (hasDot) {
    if (type === 'half') return '2d';
    if (type === 'quarter') return '4d';
    if (type === 'eighth') return '8d';
    return '4d';
  }

  switch (type) {
    case 'whole': return '1';
    case 'half': return '2';
    case 'quarter': return '4';
    case 'eighth': return '8';
    case '16th': return '16';
    default: return '4';
  }
}

export function parseMusicXml(xmlString: string): PartRhythmProfile[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
  
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML file format: ' + parserError.textContent);
  }

  const partElements = xmlDoc.querySelectorAll('score-partwise > part-list > score-part');
  const partsMap = new Map<string, string>();
  partElements.forEach((part) => {
    const id = part.getAttribute('id') || '';
    const name = part.querySelector('part-name')?.textContent || 'Unnamed Part';
    if (id) partsMap.set(id, name);
  });

  const profiles: PartRhythmProfile[] = [];

  const partNodes = xmlDoc.querySelectorAll('score-partwise > part');
  partNodes.forEach((partNode) => {
    const partId = partNode.getAttribute('id') || '';
    const partName = partsMap.get(partId) || 'Unnamed Part';

    let currentTempoBPM = 120;
    let currentBeatsPerMeasure = 4;
    let currentBeatValue = 4;
    let currentDivisions = 1;

    const parsedMeasures: ParsedMeasure[] = [];
    const measureNodes = partNode.querySelectorAll('measure');

    measureNodes.forEach((measureNode, idx) => {
      const measureNum = parseInt(measureNode.getAttribute('number') || '0') || (idx + 1);

      const attributesNode = measureNode.querySelector('attributes');
      if (attributesNode) {
        const divisionsNode = attributesNode.querySelector('divisions');
        if (divisionsNode) {
          currentDivisions = parseInt(divisionsNode.textContent || '1') || 1;
        }

        const timeNode = attributesNode.querySelector('time');
        if (timeNode) {
          const beatsNode = timeNode.querySelector('beats');
          const beatTypeNode = timeNode.querySelector('beat-type');
          if (beatsNode && beatTypeNode) {
            currentBeatsPerMeasure = parseInt(beatsNode.textContent || '4') || 4;
            currentBeatValue = parseInt(beatTypeNode.textContent || '4') || 4;
          }
        }
      }

      const soundNode = measureNode.querySelector('direction sound');
      if (soundNode) {
        const tempoAttr = soundNode.getAttribute('tempo');
        if (tempoAttr) {
          currentTempoBPM = parseFloat(tempoAttr) || 120;
        }
      }

      const noteNodes = measureNode.querySelectorAll('note');
      const measureNotes: ParsedNote[] = [];

      noteNodes.forEach((noteNode) => {
        if (noteNode.querySelector('chord') !== null) {
          return;
        }

        const isRest = noteNode.querySelector('rest') !== null;

        const durationText = noteNode.querySelector('duration')?.textContent;
        const noteDurationTicks = durationText ? parseInt(durationText) : 0;
        
        let beats = noteDurationTicks / currentDivisions;
        if (beats <= 0) {
          beats = 0.25;
        }

        const typeText = noteNode.querySelector('type')?.textContent || null;
        const hasDot = noteNode.querySelector('dot') !== null;
        
        const timeModification = noteNode.querySelector('time-modification');
        const isTriplet = timeModification !== null && 
                          timeModification.querySelector('actual-notes')?.textContent === '3';

        const tieNodes = noteNode.querySelectorAll('tie');
        let isTiedStart = false;
        let isTiedStop = false;
        
        tieNodes.forEach((tie) => {
          const type = tie.getAttribute('type');
          if (type === 'start') isTiedStart = true;
          if (type === 'stop') isTiedStop = true;
        });

        const tiedNodes = noteNode.querySelectorAll('notations tied');
        tiedNodes.forEach((tied) => {
          const type = tied.getAttribute('type');
          if (type === 'start') isTiedStart = true;
          if (type === 'stop') isTiedStop = true;
        });

        let durationToken = getRhythmDurationToken(typeText, hasDot, isTriplet);
        beats = durationToBeats(durationToken);

        measureNotes.push({
          duration: durationToken,
          isRest: isRest,
          beats,
          isTiedStart,
          isTiedStop
        });
      });

      const syncopationScore = calculateMeasureSyncopation(measureNotes, currentBeatsPerMeasure);
      const densityScore = measureNotes.filter(n => !n.isRest && DURATION_MAP[n.duration] <= 0.5).length;

      if (measureNotes.length > 0) {
        parsedMeasures.push({
          measureNumber: measureNum,
          timeSignature: { beatsPerMeasure: currentBeatsPerMeasure, beatValue: currentBeatValue },
          tempoBPM: Math.round(currentTempoBPM),
          notes: measureNotes,
          syncopationScore: parseFloat(syncopationScore.toFixed(2)),
          densityScore
        });
      }
    });

    profiles.push({
      partId,
      partName,
      measures: parsedMeasures
    });
  });

  return profiles;
}

function get4BarPhrase(measures: ParsedMeasure[], targetMeasureNum: number): ParsedMeasure[] {
  const startMeasureNum = Math.floor((targetMeasureNum - 1) / 4) * 4 + 1;
  const phraseMeasures: ParsedMeasure[] = [];
  
  for (let i = 0; i < 4; i++) {
    const mNum = startMeasureNum + i;
    const found = measures.find(m => m.measureNumber === mNum);
    if (found) {
      phraseMeasures.push(found);
    }
  }
  return phraseMeasures;
}

export function generateLlmRhythmProfileJson(profile: PartRhythmProfile, limitMeasuresCount: number = 5): string {
  // 1. Sort syncopation and density separately
  const sortedBySync = [...profile.measures]
    .filter(m => m.syncopationScore > 0)
    .sort((a, b) => b.syncopationScore - a.syncopationScore);

  const sortedByDensity = [...profile.measures]
    .filter(m => m.densityScore > 2)
    .sort((a, b) => b.densityScore - a.densityScore);

  // 2. Extract standard phrases by alternating selection to balance syncopation and density
  const seenPhrases = new Set<number>();
  const candidatePhrases: { range: string; measures: ParsedMeasure[] }[] = [];
  
  let syncIndex = 0;
  let densityIndex = 0;

  while (candidatePhrases.length < limitMeasuresCount && (syncIndex < sortedBySync.length || densityIndex < sortedByDensity.length)) {
    // Pick syncopated phrase
    if (syncIndex < sortedBySync.length) {
      const candidate = sortedBySync[syncIndex++];
      const startMNum = Math.floor((candidate.measureNumber - 1) / 4) * 4 + 1;
      if (!seenPhrases.has(startMNum)) {
        seenPhrases.add(startMNum);
        const phrase = get4BarPhrase(profile.measures, candidate.measureNumber);
        if (phrase.length > 0) {
          candidatePhrases.push({
            range: `Measures ${phrase[0].measureNumber}-${phrase[phrase.length - 1].measureNumber}`,
            measures: phrase
          });
        }
      }
    }
    // Pick dense phrase
    if (candidatePhrases.length < limitMeasuresCount && densityIndex < sortedByDensity.length) {
      const candidate = sortedByDensity[densityIndex++];
      const startMNum = Math.floor((candidate.measureNumber - 1) / 4) * 4 + 1;
      if (!seenPhrases.has(startMNum)) {
        seenPhrases.add(startMNum);
        const phrase = get4BarPhrase(profile.measures, candidate.measureNumber);
        if (phrase.length > 0) {
          candidatePhrases.push({
            range: `Measures ${phrase[0].measureNumber}-${phrase[phrase.length - 1].measureNumber}`,
            measures: phrase
          });
        }
      }
    }
  }

  // 3. Fallback: if no phrases generated (simple piece), use top complex measures repeated
  let isFallback = false;
  if (candidatePhrases.length === 0 && profile.measures.length > 0) {
    isFallback = true;
    const sortedAll = [...profile.measures]
      .sort((a, b) => (b.syncopationScore + b.densityScore) - (a.syncopationScore + a.densityScore));

    for (const m of sortedAll) {
      // Repeat the target bar 4 times to create a repeated practice loop for simple scores
      const repeatedMeasures: ParsedMeasure[] = [
        { ...m, measureNumber: 1 },
        { ...m, measureNumber: 2 },
        { ...m, measureNumber: 3 },
        { ...m, measureNumber: 4 }
      ];
      candidatePhrases.push({
        range: `Repeated Bar ${m.measureNumber} (Fallback Complexity)`,
        measures: repeatedMeasures
      });
      if (candidatePhrases.length >= limitMeasuresCount) {
        break;
      }
    }
  }

  // 4. Sort standard phrase list chronologically for cleaner presentation
  if (!isFallback) {
    candidatePhrases.sort((a, b) => a.measures[0].measureNumber - b.measures[0].measureNumber);
  }

  const profileSummary = {
    partName: profile.partName,
    tempoBPM: profile.measures[0]?.tempoBPM || 120,
    timeSignature: `${profile.measures[0]?.timeSignature.beatsPerMeasure}/${profile.measures[0]?.timeSignature.beatValue}`,
    highDifficultyPhrases: candidatePhrases.map(phraseObj => ({
      phraseRange: phraseObj.range,
      measures: phraseObj.measures.map(m => ({
        measureNumber: m.measureNumber,
        syncopationScore: m.syncopationScore,
        densityScore: m.densityScore,
        rhythm: m.notes.map(n => n.duration + (n.isRest ? 'r' : ''))
      }))
    }))
  };

  return JSON.stringify(profileSummary, null, 2);
}

export const parseMusicXML = parseMusicXml;

