import { parseMusicXmlToScore } from './scoreParser';
import type { ExerciseTemplate, RhythmKind, StudentProfile } from '../types/portal';

export const RHYTHM_KIND_LABEL: Record<RhythmKind, string> = {
  syncopation: 'Syncopation',
  cross_rhythm: 'Cross-rhythm',
  other: 'Rhythm',
};

const DEFAULT_RHYTHM_NOTES: Record<RhythmKind, string> = {
  syncopation: 'Subdivide the beat in your head before each off-beat entrance. Start slowly with the click, then raise the tempo.',
  cross_rhythm: 'Keep the underlying pulse steady against the tuplet / cross-rhythm. Clap or tap it slowly first, then play it.',
  other: 'Practise slowly with the click and lock into the subdivision.',
};

export const defaultRhythmNotes = (kind: RhythmKind) => DEFAULT_RHYTHM_NOTES[kind];

const MAX_RHYTHM_SUGGESTIONS = 12;

/** Normalise an instrument/part name for matching (e.g. "Flute 2" -> "flute 2"). */
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Instrument family without part number (e.g. "flute 2" -> "flute"). */
const family = (s: string) => normalise(s).replace(/\b(i{1,3}|iv|v|\d+)\b/g, '').replace(/\s+/g, ' ').trim();

/**
 * Students whose instrument matches one of the given score parts.
 * Exact part match is preferred (Flute 2 -> Flute 2); otherwise the instrument
 * family matches (Flute 2 student gets a "Flute" part).
 */
export function matchStudentsToParts(students: StudentProfile[], parts: string[]): StudentProfile[] {
  const selected = new Set<StudentProfile>();
  for (const part of parts) {
    const exactMatches = students.filter(s => normalise(s.instrument) === normalise(part));
    const matches = exactMatches.length > 0
      ? exactMatches
      : students.filter(s => family(s.instrument) === family(part));
    matches.forEach(s => selected.add(s));
  }
  return students.filter(s => selected.has(s));
}

export interface ScoreSection {
  label: string;
  start: number;
  end: number;
}

/**
 * Reads the last bar number and the rehearsal-mark sections (A, B, C…) of a score.
 * A leading "Intro" section is added when the first mark doesn't start at bar 1.
 */
export function extractScoreStructure(xml: string): { lastBar: number; sections: ScoreSection[] } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const part = doc.querySelector('score-partwise > part');
  const measures = part ? Array.from(part.querySelectorAll(':scope > measure')) : [];
  const numberOf = (el: Element, idx: number) => parseInt(el.getAttribute('number') || '', 10) || idx + 1;
  const lastBar = measures.length > 0 ? numberOf(measures[measures.length - 1], measures.length - 1) : 1;

  const marks: { label: string; start: number }[] = [];
  measures.forEach((m, idx) => {
    const text = m.querySelector('direction rehearsal')?.textContent?.trim();
    if (text) marks.push({ label: text, start: numberOf(m, idx) });
  });

  const sections: ScoreSection[] = [];
  if (marks.length > 0 && marks[0].start > 1) sections.push({ label: 'Intro', start: 1, end: marks[0].start - 1 });
  marks.forEach((mk, i) => {
    sections.push({ label: mk.label, start: mk.start, end: i + 1 < marks.length ? marks[i + 1].start - 1 : lastBar });
  });
  return { lastBar, sections };
}

interface Flagged {
  kind: RhythmKind;
  start: number;
  end: number;
  part: string;
  tempo: number;
}

/**
 * Analyse a MusicXML score and suggest exercises: one score-following exercise
 * for the full score plus rhythm exercises for syncopated and cross-rhythm
 * (tuplet) passages, merged across parts that share the same bars.
 */
export function suggestExercises(scoreId: string, xml: string): ExerciseTemplate[] {
  const parsed = parseMusicXmlToScore(xml);
  const now = new Date().toISOString();
  const firstPart = parsed.parts[0];
  const lastBar = Math.max(1, ...parsed.parts.map(p => p.measures[p.measures.length - 1]?.measureNumber || 1));
  const baseTempo = Math.round(firstPart?.measures[0]?.tempoBpm || 90);

  const templates: ExerciseTemplate[] = [
    {
      id: `tpl_${Date.now()}_follow`,
      scoreId,
      type: 'score_following',
      title: 'Score following – full score',
      startMeasure: 1,
      endMeasure: lastBar,
      tempo: baseTempo,
      parts: [],
      notes: 'Follow along with the full score while listening to the midi.',
      suggested: true,
      createdAt: now,
    },
  ];

  const flagged: Flagged[] = [];
  for (const part of parsed.parts) {
    for (const kind of ['cross_rhythm', 'syncopation'] as RhythmKind[]) {
      const bars = part.measures.filter(m =>
        !m.isFullMeasureRest && (kind === 'cross_rhythm' ? m.hasTuplets : (!m.hasTuplets && m.syncopationScore >= 1.5))
      );
      let i = 0;
      while (i < bars.length) {
        let j = i;
        while (j + 1 < bars.length && bars[j + 1].measureNumber <= bars[j].measureNumber + 1) j++;
        flagged.push({
          kind,
          start: bars[i].measureNumber,
          end: bars[j].measureNumber,
          part: part.name,
          tempo: Math.round(bars[i].tempoBpm),
        });
        i = j + 1;
      }
    }
  }

  // Merge identical ranges across parts
  const merged = new Map<string, Flagged & { parts: string[] }>();
  for (const f of flagged) {
    const key = `${f.kind}:${f.start}-${f.end}`;
    const existing = merged.get(key);
    if (existing) {
      if (!existing.parts.includes(f.part)) existing.parts.push(f.part);
    } else {
      merged.set(key, { ...f, parts: [f.part] });
    }
  }

  [...merged.values()]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .slice(0, MAX_RHYTHM_SUGGESTIONS)
    .forEach((m, idx) => {
      const range = m.start === m.end ? `Bar ${m.start}` : `Bars ${m.start}–${m.end}`;
      templates.push({
        id: `tpl_${Date.now()}_r${idx}`,
        scoreId,
        type: 'rhythm',
        title: `${RHYTHM_KIND_LABEL[m.kind]} – ${range}`,
        startMeasure: m.start,
        endMeasure: m.end,
        tempo: m.tempo || baseTempo,
        rhythmKind: m.kind,
        parts: m.parts,
        notes: DEFAULT_RHYTHM_NOTES[m.kind],
        suggested: true,
        createdAt: now,
      });
    });

  return templates;
}
