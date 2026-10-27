import type { NoteEvent, PartData } from './scorePlaybackParser';

export type OrchestraMode = 'balanced' | 'clear';
export interface OrchestraMix {
  mode: OrchestraMode;
  practicePartId: string;
  mutePracticePart: boolean;
  orchestraLevel: number;
  guideLevel: number;
  metronomeLevel: number;
}
export const DEFAULT_ORCHESTRA_MIX: OrchestraMix = {
  mode: 'balanced', practicePartId: '', mutePracticePart: false,
  orchestraLevel: 75, guideLevel: 75, metronomeLevel: 50,
};

export function assignedPartId(parts: readonly { id: string; name: string }[], instrumentName = ''): string {
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const instrument = normalize(instrumentName);
  if (!instrument) return '';
  const exact = parts.filter(part => normalize(part.name) === instrument);
  const matches = exact.length ? exact : parts.filter(part => normalize(part.name).includes(instrument) || instrument.includes(normalize(part.name)));
  return matches.length === 1 ? matches[0].id : '';
}

export interface RenderNote extends NoteEvent { contributingPartIds: string[] }
export type InstrumentFamily = 'woodwinds' | 'brass' | 'strings' | 'percussion' | 'other';
export function instrumentBalance(instrument: string): { family: InstrumentFamily; gainDb: number; pan: number } {
  if (/drum|timpani|cymbal|glock|xylophone|marimba|vibraphone|percussion/.test(instrument)) return { family: 'percussion', gainDb: -7, pan: 0.12 };
  if (/trumpet|trombone|tuba|horn|brass/.test(instrument)) return { family: 'brass', gainDb: -5, pan: 0.15 };
  if (/flute|piccolo|clarinet|oboe|bassoon|sax|recorder/.test(instrument)) return { family: 'woodwinds', gainDb: -2, pan: -0.12 };
  if (/violin|viola|cello|contrabass|string/.test(instrument)) return { family: 'strings', gainDb: -3, pan: /cello|contrabass/.test(instrument) ? 0.2 : -0.2 };
  return { family: 'other', gainDb: -4, pan: 0 };
}
export function partLevel(partId: string, mix: OrchestraMix, overrides: Record<string, number> = {}): number {
  const guide = partId === mix.practicePartId;
  if (guide && mix.mutePracticePart) return 0;
  return Math.max(0, overrides[partId] ?? 1) * Math.max(0, Math.min(100, guide ? mix.guideLevel : mix.orchestraLevel)) / 75;
}

/** No source mutation; proven duplicate imports are identified by provenance, never by pitch. */
export function orchestraNotes(notes: readonly NoteEvent[], mix: OrchestraMix, overrides: Record<string, number> = {}): RenderNote[] {
  const seen = new Set<string>();
  const groups = new Map<string, RenderNote>();
  const result: RenderNote[] = [];
  for (const note of notes) {
    if (note.sourceEventId) {
      const source = `${note.partId ?? ''}:${note.sourceEventId}`;
      if (seen.has(source)) continue;
      seen.add(source);
    }
    const id = note.partId ?? '';
    if (partLevel(id, mix, overrides) <= 0) continue;
    const rendered: RenderNote = { ...note, contributingPartIds: [id] };
    // Only fully specified, exactly equivalent cross-part patch unisons are reduced.
    // The guide stays independent so its fader never removes another audible line.
    if (mix.mode === 'clear' && id && note.instrument && !note.isPercussion && note.articulation !== undefined && note.expressionKey !== undefined) {
      const key = JSON.stringify([note.instrument, note.pitch, note.beat, note.durationBeats,
        note.articulation, note.expressionKey, note.velocity ?? 0.75, overrides[id] ?? 1, id === mix.practicePartId]);
      const group = groups.get(key);
      if (group && !group.contributingPartIds.includes(id)) {
        group.contributingPartIds.push(id);
        continue;
      }
      // Same-part independent voices are retained; do not overwrite their group identity.
      if (!group) groups.set(key, rendered);
    }
    result.push(rendered);
  }
  return result;
}

/** Conservative starting presets, not an acoustically calibrated orchestral library. */
export function partBalance(parts: readonly PartData[]): Map<string, { gain: number; pan: number; family: InstrumentFamily }> {
  const counts = new Map<string, number>();
  for (const part of parts) counts.set(part.soundfontInstrument, (counts.get(part.soundfontInstrument) ?? 0) + 1);
  const centeredScore = parts.every(part => part.pan === undefined || part.pan === 0);
  return new Map(parts.map(part => {
    const preset = instrumentBalance(part.soundfontInstrument);
    return [part.id, { gain: Math.pow(10, preset.gainDb / 20) / Math.sqrt(counts.get(part.soundfontInstrument)!) * Math.max(0, Math.min(100, part.volume ?? 100)) / 100, pan: centeredScore ? preset.pan : part.pan ?? preset.pan, family: preset.family }];
  }));
}
