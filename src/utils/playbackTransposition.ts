export interface PlaybackTransposeChange {
  measureIndex: number;
  beatOffset: number;
  staff?: number;
  semitones: number;
}

/** MusicXML chromatic already includes interval quality; diatonic is for spelling only. */
export function soundingSemitones(chromatic: number, octaveChange = 0): number {
  return chromatic + 12 * octaveChange;
}

/** OSMD counts from C0; MIDI counts from C-1. Written C4 is OSMD 48, MIDI 60. */
export function writtenPitchToMidi(osmdHalfTone: number, transposition: number): number {
  return osmdHalfTone + 12 + transposition;
}

export function transpositionAt(changes: readonly PlaybackTransposeChange[], measureIndex: number, beatOffset: number, staff = 1): number {
  let general = 0;
  const staves = new Map<number, number>();
  for (const change of changes) {
    if (change.measureIndex > measureIndex ||
      (change.measureIndex === measureIndex && change.beatOffset > beatOffset + 1e-7)) continue;
    if (change.staff === undefined) {
      general = change.semitones;
      staves.clear();
    } else staves.set(change.staff, change.semitones);
  }
  return staves.get(staff) ?? general;
}

/** Read playback instructions without transposing the engraved notation. Missing tags mean concert pitch. */
export function readPlaybackTranspositions(document: Document): Map<string, PlaybackTransposeChange[]> {
  const result = new Map<string, PlaybackTransposeChange[]>();
  const children = (element: Element, name: string) => Array.from(element.children).filter(child => child.localName === name);
  const value = (element: Element, name: string, fallback = 0) => {
    const text = children(element, name)[0]?.textContent?.trim();
    const number = text ? Number(text) : fallback;
    return Number.isFinite(number) ? number : fallback;
  };
  const root = document.documentElement;
  const parts = root.localName === 'score-partwise' ? children(root, 'part') : [];
  const readMeasures = (id: string, measures: Element[]) => {
    const changes: PlaybackTransposeChange[] = [];
    let divisions = 1;
    measures.forEach((measure, measureIndex) => {
      let beatOffset = 0;
      for (const element of Array.from(measure.children)) {
        if (element.localName === 'attributes') {
          divisions = Math.max(1, value(element, 'divisions', divisions));
          for (const transpose of children(element, 'transpose')) {
            const staff = Number(transpose.getAttribute('number'));
            changes.push({ measureIndex, beatOffset,
              staff: staff > 0 ? staff : undefined,
              semitones: soundingSemitones(value(transpose, 'chromatic'), value(transpose, 'octave-change')) });
          }
        } else if (element.localName === 'backup') beatOffset -= value(element, 'duration') / divisions;
        else if (element.localName === 'forward' ||
          (element.localName === 'note' && !children(element, 'chord').length)) {
          beatOffset += value(element, 'duration') / divisions;
        }
      }
    });
    result.set(id, changes);
  };
  for (const part of parts) readMeasures(part.getAttribute('id') || '', children(part, 'measure'));
  if (root.localName === 'score-timewise') {
    const byPart = new Map<string, Element[]>();
    for (const measure of children(root, 'measure')) {
      for (const part of children(measure, 'part')) {
        const id = part.getAttribute('id') || '';
        if (!byPart.has(id)) byPart.set(id, []);
        byPart.get(id)!.push(part);
      }
    }
    for (const [id, measures] of byPart) readMeasures(id, measures);
  }
  return result;
}
