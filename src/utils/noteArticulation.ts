import type { NoteEvent } from './scorePlaybackParser';

type SourceNote = any;
const voiceOf = (note: SourceNote) => note?.ParentVoiceEntry?.ParentVoice;
const beatOf = (note: SourceNote): number | undefined => {
  const value = note?.getAbsoluteTimestamp?.()?.RealValue;
  return typeof value === 'number' ? value * 4 : undefined;
};

/** Merge actual tie chains, including ties interleaved with chord notes. Slurs never merge attacks. */
export function articulateNotes(input: readonly NoteEvent[]): NoteEvent[] {
  const notes = [...input].sort((a, b) => a.beat - b.beat);
  const slurs = new Set<any>();
  for (const note of notes) for (const slur of note.rawNote?.NoteSlurs ?? note.rawNote?.slurs ?? []) slurs.add(slur);
  const ranges = [...slurs].map(slur => ({
    start: beatOf(slur.StartNote), end: beatOf(slur.EndNote),
    voices: new Set([voiceOf(slur.StartNote), voiceOf(slur.EndNote)]),
  })).filter(range => range.start !== undefined && range.end !== undefined);

  const merged: NoteEvent[] = [];
  const chains = new Map<object, Map<number, NoteEvent>>();
  for (const note of notes) {
    const tie = note.rawNote?.NoteTie;
    // Require shared source membership, not merely adjacent equal pitches or a slur.
    const tied = tie?.Notes?.includes(note.rawNote);
    const pitches = tied ? chains.get(tie) ?? new Map<number, NoteEvent>() : undefined;
    const previous = pitches?.get(note.pitch);
    if (previous && Math.abs(previous.beat + previous.durationBeats - note.beat) < 1e-7) {
      previous.duration = Math.max(previous.time + previous.duration, note.time + note.duration) - previous.time;
      previous.durationBeats = note.beat + note.durationBeats - previous.beat;
    } else {
      const copy = { ...note };
      merged.push(copy);
      if (pitches) { pitches.set(note.pitch, copy); chains.set(tie, pitches); }
    }
  }

  const voices = new Map<unknown, NoteEvent[]>();
  for (const note of merged) {
    const voice = voiceOf(note.rawNote);
    if (!voices.has(voice)) voices.set(voice, []);
    voices.get(voice)!.push(note);
  }
  for (const line of voices.values()) {
    const onsets = new Map<number, NoteEvent[]>();
    for (const note of line) {
      const key = Math.round(note.beat * 1e6);
      if (!onsets.has(key)) onsets.set(key, []);
      onsets.get(key)!.push(note);
    }
    for (let i = 0; i < line.length; i++) {
      const note = line[i];
      if (note.percussion !== undefined || !note.durationBeats) continue;
      // All chord tones at the next onset are considered; a rest breaks the connection.
      const nextBeat = note.beat + note.durationBeats;
      const next = (onsets.get(Math.round(nextBeat * 1e6)) ?? []).filter(n => Math.abs(n.beat - nextBeat) < 1e-7 && n.percussion === undefined);
      if (!next.length) continue;
      const underSlur = ranges.some(range => range.voices.has(voiceOf(note.rawNote)) &&
        note.beat >= range.start! - 1e-7 && nextBeat <= range.end! + 1e-7);
      if (!underSlur) continue;
      // Same-pitch samplers cannot overlap safely: releasing one also releases its repeated note.
      note.legatoToNext = !next.some(n => n.pitch === note.pitch);
      for (const following of next) following.legatoFromPrevious = true;
    }
  }
  return merged.map(({ rawNote: _source, ...note }) => note);
}

/** Onsets and score duration remain untouched. Only the audible gate and continuation attack change. */
export function articulatedGate(note: Pick<NoteEvent, 'legatoToNext' | 'legatoFromPrevious' | 'percussion'>, seconds: number): { duration: number; attackScale: number } {
  const overlap = note.legatoToNext && note.percussion === undefined ? Math.min(0.025, seconds * 0.1) : -Math.min(0.015, seconds * 0.1);
  return { duration: Math.max(0.01, seconds + overlap), attackScale: note.legatoFromPrevious && note.percussion === undefined ? 0.9 : 1 };
}
