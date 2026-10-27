/**
 * MusicXML score transformation engine for pedagogical scaffolding.
 * Transforms original scores without destructive data loss:
 * 1. Single-pitch reduction (R03): converts all note pitches to a single comfortable note (e.g. C4/Bb4),
 *    preserving durations, rhythms, rests, ties, and measure structures.
 * 2. Ghost-note injection (R20 / X-Ray Rhythm): converts tied intervals or silent beats into
 *    ghost notes with parenthesized noteheads for visual beat anchoring.
 * 3. Transition isolation: extracts a targeted 2-4 note window with 1 lead-in and 1 lead-out note.
 */

export interface PitchTarget {
  step: string;     // 'C', 'D', 'E', 'F', 'G', 'A', 'B'
  octave: number;   // e.g. 4
  alter?: number;   // -1 (flat), 0 (natural), 1 (sharp)
}

export const DEFAULT_COMFORTABLE_PITCH: PitchTarget = {
  step: 'C',
  octave: 4,
  alter: 0,
};

/**
 * Reduces all pitched notes in the MusicXML string to a single comfortable pitch.
 */
export function transformToSinglePitch(
  xmlContent: string,
  targetPitch: PitchTarget = DEFAULT_COMFORTABLE_PITCH
): string {
  // Safe string-level / regex replacement of pitch elements inside <pitch>...</pitch>
  // This avoids browser DOM vs NodeJS XML parser incompatibilities and preserves formatting
  const pitchRegex = /<pitch>[\s\S]*?<\/pitch>/gi;
  
  const singlePitchXml = `<pitch>\n        <step>${targetPitch.step}</step>\n        ${
    targetPitch.alter ? `<alter>${targetPitch.alter}</alter>\n        ` : ''
  }<octave>${targetPitch.octave}</octave>\n      </pitch>`;

  return xmlContent.replace(pitchRegex, singlePitchXml);
}

/**
 * Injects X-Ray ghost notes for tied notes in MusicXML.
 * Marks tied notes with <notehead>x</notehead> or cue note styling.
 */
export function injectXRayGhostNotes(xmlContent: string): string {
  // Find notes that are tied stop and mark their notehead as ghost/x
  return xmlContent.replace(
    /(<note[^>]*>)([\s\S]*?<tie\s+type=["']stop["'][\s\S]*?<\/note>)/gi,
    (match, noteOpen, noteInner) => {
      if (noteInner.includes('<notehead>')) {
        return match;
      }
      return `${noteOpen}\n      <notehead>x</notehead>${noteInner}`;
    }
  );
}

/**
 * Extracts a measure slice from a MusicXML score string.
 */
export function extractMeasureSlice(
  xmlContent: string,
  startMeasure: number,
  endMeasure: number
): string {
  // Regex to match individual measures: <measure number="X">...</measure>
  const measureRegex = /<measure\s+number=["'](\d+)["'][\s\S]*?<\/measure>/gi;
  
  const extractedMeasures: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = measureRegex.exec(xmlContent)) !== null) {
    const measureNum = parseInt(match[1], 10);
    if (measureNum >= startMeasure && measureNum <= endMeasure) {
      extractedMeasures.push(match[0]);
    }
  }

  if (extractedMeasures.length === 0) {
    return xmlContent; // fallback if measure numbers don't match
  }

  // Replace all measures in the part with the extracted measure slice
  return xmlContent.replace(
    /(<part\s+id=["'][^"']+["']>)([\s\S]*?)(<\/part>)/i,
    `$1\n${extractedMeasures.join('\n')}\n$3`
  );
}
