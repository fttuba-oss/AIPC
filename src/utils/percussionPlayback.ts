/** XML midi-unpitched is one-based; its display-step/octave are staff placement, never pitch. */
export function percussionKey(
  note: { PlaybackInstrumentId?: string; displayStepUnpitched?: number; displayOctaveUnpitched?: number },
  instrument: { Name?: string; SubInstruments?: { idString: string; fixedKey: number }[] },
): number | undefined {
  const sub = instrument.SubInstruments?.find(value => value.idString === note.PlaybackInstrumentId);
  if (sub && sub.fixedKey >= 1 && sub.fixedKey <= 128) return sub.fixedKey - 1;
  if (note.displayStepUnpitched || note.displayOctaveUnpitched) {
    return /bass drum|kick/i.test(instrument.Name ?? '') ? 36 : 38;
  }
  return undefined;
}

export function percussionEnvelope(key: number): { kick: boolean; decay: number } {
  return { kick: key === 35 || key === 36,
    decay: [49, 51, 52, 53, 55, 57, 59].includes(key) ? 0.9 : key === 46 ? 0.2 : 0.09 };
}

export type OrchestralPercussion = 'snare' | 'side-stick' | 'bass-drum' | 'crash' | 'suspended-cymbal' | 'tam-tam';
/** Concert part names resolve the ambiguities in GM drum numbers (e.g. tam-tam vs Chinese cymbal). */
export function percussionFamily(key: number, name = ''): OrchestralPercussion | undefined {
  const label = name.toLowerCase().replace(/\s+/g, ' ');
  if (/tam[ -]?tam|gong/.test(label)) return 'tam-tam';
  if (/suspend/.test(label)) return 'suspended-cymbal';
  if (key === 37) return 'side-stick';
  if (/snare/.test(label) || key === 38 || key === 40) return 'snare';
  if (/bass drum|concert bass|kick/.test(label) || key === 35 || key === 36) return 'bass-drum';
  if (/crash/.test(label) || key === 49 || key === 57) return 'crash';
  return undefined;
}
