import type { NoteEvent } from './scorePlaybackParser';

/** One snapshot per onset, including already sustained notes. No audio-clock changes. */
export function ensembleFrames(notes: readonly NoteEvent[]): Map<number, NoteEvent[]> {
  const sorted = notes.filter(n => n.durationBeats > 0).slice().sort((a, b) => a.beat - b.beat);
  const frames = new Map<number, NoteEvent[]>();
  let active: NoteEvent[] = [];
  for (let i = 0; i < sorted.length;) {
    const beat = sorted[i].beat;
    active = active.filter(n => n.beat + n.durationBeats > beat + 1e-7);
    while (i < sorted.length && sorted[i].beat === beat) active.push(sorted[i++]);
    frames.set(beat, active.slice());
  }
  return frames;
}

/** Conservative balance: preserve dynamics; attenuate doubling and dense textures only. */
export function ensembleGains(active: readonly NoteEvent[], mix: ReadonlyMap<string, number>): Map<string, number> {
  const parts = new Map<string, Set<number>>();
  const instruments = new Map<string, string>();
  for (const note of active) {
    if (note.percussion !== undefined) continue;
    const id = note.partId ?? note.instrument ?? 'default';
    if ((mix.get(id) ?? 1) <= 0) continue;
    if (!parts.has(id)) parts.set(id, new Set());
    parts.get(id)!.add(note.pitch);
    instruments.set(id, note.instrument ?? 'default');
  }
  const groups = new Map<string, string[]>();
  for (const [id, pitches] of parts) {
    const key = [...pitches].sort((a, b) => a - b).join(',');
    const group = groups.get(key) ?? [];
    group.push(id);
    groups.set(key, group);
  }
  const density = Math.min(1, Math.sqrt(6 / Math.max(1, groups.size)));
  const gains = new Map<string, number>();
  for (const ids of groups.values()) {
    for (const id of ids) {
      const sameSample = ids.filter(other => instruments.get(other) === instruments.get(id)).length;
      // Same-sample unisons add coherently; use stronger attenuation for those.
      gains.set(id, density / Math.sqrt(ids.length * sameSample));
    }
  }
  return gains;
}
