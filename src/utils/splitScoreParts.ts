/** Runtime extraction of explicitly named pairs of monophonic wind/brass players.
 * Keep the uploaded XML untouched. Do not infer player parts from arbitrary chords.
 */
export interface ExtractedPart {
  sourceId: string; id: string; name: string; index: number;
  reviewBars: number[];
}
export interface SplitScore {
  xml: string | null; parts: ExtractedPart[];
}
const children = (el: Element, tag: string) => Array.from(el.children).filter(e => e.localName === tag);
const text = (el: Element, tag: string, fallback = '') => children(el, tag)[0]?.textContent || fallback;

export function combinedPartNames(name: string): string[] | null {
  const clean = name.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(\d+)(?:st|nd|rd|th)?\s*(?:&|and)\s*(\d+)(?:st|nd|rd|th)?\s+(Flutes?|Horns?|Clarinets?|Trumpets?|Trombones?|Oboes?|Bassoons?)(.*)$/i);
  if (!match || match[1] === match[2]) return null;
  const family = match[3].replace(/s$/i, '');
  return [match[1], match[2]].map(n => `${family} ${n}${match[4]}`);
}

export interface LineGroup<T> { start: number; duration: number; voice: string; notes: T[] }
/** Explicit voices take precedence from their first entry in the measure.
 * Before that entry, a shared voice may encode both players as chords/unisons.
 */
export function splitLineGroups<T>(groups: LineGroup<T>[], pitch: (note: T) => number, voiceOrder?: string[]): [LineGroup<T>[], LineGroup<T>[]] {
  const voices = voiceOrder || [...new Set(groups.map(g => g.voice))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const first = voices[0];
  const second = voices[1];
  const lowerStart = second ? Math.min(...groups.filter(g => g.voice === second).map(g => g.start)) : Infinity;
  const result: [LineGroup<T>[], LineGroup<T>[]] = [[], []];
  for (const group of groups) {
    if (group.voice === second) { result[1].push(group); continue; }
    if (group.voice !== first) continue;
    if (group.start >= lowerStart) { result[0].push(group); continue; }
    const notes = [...group.notes].sort((a, b) => pitch(b) - pitch(a));
    result[0].push({ ...group, notes: notes.slice(0, 1) });
    // Extra chord tones remain in the lower extracted part, never silently disappear.
    result[1].push({ ...group, notes: notes.length > 1 ? notes.slice(1) : notes });
  }
  return result;
}

export function splitCombinedScore(xml?: string | null): SplitScore {
  if (!xml) return { xml: xml ?? null, parts: [] };
  const doc = new DOMParser().parseFromString(xml.replace(/&amp;amp;/g, '&amp;'), 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'score-partwise') return { xml, parts: [] };
  const result: ExtractedPart[] = [];
  const make = (tag: string, value?: string) => { const el = doc.createElement(tag); if (value !== undefined) el.textContent = value; return el; };
  const pitch = (note: Element) => {
    const p = children(note, 'pitch')[0];
    return p ? (Number(text(p, 'octave')) + 1) * 12 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[text(p, 'step')] ?? 0) + Number(text(p, 'alter', '0')) : -Infinity;
  };
  for (const definition of Array.from(doc.getElementsByTagName('score-part'))) {
    const names = combinedPartNames(text(definition, 'part-name'));
    const sourceId = definition.getAttribute('id') || '';
    const source = children(doc.documentElement, 'part').find(p => p.getAttribute('id') === sourceId);
    if (!names || !source) continue;
    // A piano/grand staff or three genuinely independent voices needs explicit editing.
    const sourceNotes = Array.from(source.getElementsByTagName('note'));
    const voiceOrder = [...new Set(sourceNotes.map(n => text(n, 'voice', '1')))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (new Set(sourceNotes.map(n => text(n, 'voice', '1'))).size > 2 || sourceNotes.some(n => text(n, 'staff', '1') !== '1')) continue;
    if (Array.from(source.getElementsByTagName('words')).some(w => /\bsolo\b|^\s*[12]\s*\.?\s*$/.test(w.textContent || ''))) continue;
    const output = names.map((name, index) => {
      let id = `${sourceId}_player_${index + 1}`;
      while (Array.from(doc.getElementsByTagName('score-part')).some(p => p.getAttribute('id') === id)) id += '_';
      const def = definition.cloneNode(true) as Element;
      def.setAttribute('id', id);
      for (const tag of ['part-name', 'part-abbreviation']) {
        let el = children(def, tag)[0]; if (!el) { el = make(tag); def.append(el); }
        el.textContent = name;
      }
      const instruments = new Map<string, string>();
      for (const instrument of children(def, 'score-instrument')) {
        const old = instrument.getAttribute('id') || '';
        const next = `${id}_instrument_${instruments.size + 1}`;
        instruments.set(old, next); instrument.setAttribute('id', next);
      }
      for (const midi of children(def, 'midi-instrument')) {
        const next = instruments.get(midi.getAttribute('id') || ''); if (next) midi.setAttribute('id', next);
      }
      const part = make('part'); part.setAttribute('id', id);
      definition.parentNode!.insertBefore(def, definition);
      source.parentNode!.insertBefore(part, source);
      const info: ExtractedPart = { sourceId, id, name, index, reviewBars: [] };
      result.push(info);
      return { part, info, instruments };
    });
    let divisions = 1;
    for (const measure of children(source, 'measure')) {
      const bar = Number(measure.getAttribute('number'));
      const groups: LineGroup<Element>[] = [];
      const extras: { start: number; element: Element }[] = [];
      let cursor = 0, length = 0;
      for (const el of Array.from(measure.children)) {
        if (el.localName === 'attributes') divisions = Number(text(el, 'divisions', String(divisions)));
        if (el.localName === 'backup') { cursor -= Number(text(el, 'duration')); continue; }
        if (el.localName === 'forward') { cursor += Number(text(el, 'duration')); length = Math.max(length, cursor); continue; }
        if (el.localName !== 'note') { extras.push({ start: cursor, element: el }); continue; }
        const duration = Number(text(el, 'duration', '0'));
        const chord = !!children(el, 'chord').length;
        if (chord && groups.length) groups.at(-1)!.notes.push(el);
        else {
          groups.push({ start: cursor, duration, voice: text(el, 'voice', '1'), notes: [el] });
          cursor += duration;
        }
        length = Math.max(length, cursor);
      }
      const lines = splitLineGroups(groups, pitch, voiceOrder);
      const grace = (group: LineGroup<Element>) => !!children(group.notes[0], 'grace').length;
      const review = lines.some(line => line.some(g => g.notes.filter(n => children(n, 'pitch').length).length > 1));
      if (review) output.forEach(o => o.info.reviewBars.push(bar));
      output.forEach(({ part, instruments }, index) => {
        const m = measure.cloneNode(false) as Element;
        part.append(m);
        let position = 0;
        const rest = (ticks: number, wholeMeasure = false) => {
          if (ticks <= 0) return;
          if (wholeMeasure) {
            const note = make('note'), r = make('rest'); r.setAttribute('measure', 'yes');
            note.append(r, make('duration', String(ticks)), make('voice', '1')); m.append(note); position += ticks; return;
          }
          const values: [number, string, boolean][] = [[4, 'whole', false], [3, 'half', true], [2, 'half', false], [1.5, 'quarter', true], [1, 'quarter', false], [.75, 'eighth', true], [.5, 'eighth', false], [.25, '16th', false], [.125, '32nd', false], [.0625, '64th', false]];
          let left = ticks;
          while (left > 1e-7) {
            const value = values.find(([v]) => Number.isInteger(v * divisions) && v * divisions <= left + 1e-7);
            if (!value) { const f = make('forward'); f.append(make('duration', String(left))); m.append(f); position += left; break; }
            const [quarters, type, dot] = value; const duration = quarters * divisions;
            const note = make('note'); note.append(make('rest'), make('duration', String(duration)), make('voice', '1'), make('type', type));
            if (dot) note.append(make('dot')); m.append(note); position += duration; left -= duration;
          }
        };
        type Event = { start: number; group?: LineGroup<Element>; extra?: Element };
        const events: Event[] = [...extras.map(e => ({ start: e.start, extra: e.element })), ...lines[index].map(group => ({ start: group.start, group }))];
        events.sort((a, b) => a.start - b.start || (a.extra && b.extra ? 0 : a.extra ? -1 : b.extra ? 1 : Number(!grace(a.group!)) - Number(!grace(b.group!))));
        for (const event of events) {
          if (event.extra) {
            const el = event.extra.cloneNode(true) as Element;
            if (el.localName === 'barline') { m.append(el); continue; }
            // Directions keep their absolute musical location even inside a sustained note.
            if (el.localName === 'direction' || el.localName === 'harmony') {
              const delta = event.start - position;
              if (delta) {
                let offset = children(el, 'offset')[0];
                if (!offset) { offset = make('offset'); const anchor = children(el, 'voice')[0] || children(el, 'staff')[0] || children(el, 'sound')[0]; el.insertBefore(offset, anchor || null); }
                offset.textContent = String(Number(offset.textContent || '0') + delta);
              }
              for (const tag of ['voice', 'staff']) children(el, tag).forEach(e => { e.textContent = '1'; });
            }
            m.append(el); continue;
          }
          const group = event.group!;
          rest(group.start - position);
          const base = groups.find(g => g.start === group.start && g.voice === group.voice && g.notes.some(n => group.notes.includes(n)))?.notes[0];
          group.notes.forEach((original, chordIndex) => {
            const note = original.cloneNode(true) as Element;
            for (const tag of ['chord', 'voice', 'staff', 'stem']) children(note, tag).forEach(e => e.remove());
            if (chordIndex > 0) note.insertBefore(make('chord'), children(note, 'pitch')[0] || children(note, 'rest')[0] || note.firstChild);
            const type = children(note, 'type')[0];
            note.insertBefore(make('voice', '1'), type || children(note, 'notations')[0] || null);
            if (base && base !== original) {
              if (!children(note, 'beam').length) for (const beam of children(base, 'beam')) note.insertBefore(beam.cloneNode(true), children(note, 'notations')[0] || null);
              const common = children(base, 'notations')[0];
              if (common) {
                let notations = children(note, 'notations')[0]; if (!notations) { notations = make('notations'); note.append(notations); }
                for (const mark of Array.from(common.children)) if (['articulations', 'slur', 'fermata'].includes(mark.localName) && !children(notations, mark.localName).length) notations.append(mark.cloneNode(true));
              }
            }
            for (const instrument of children(note, 'instrument')) {
              const id = instruments.get(instrument.getAttribute('id') || ''); if (id) instrument.setAttribute('id', id);
            }
            m.append(note);
          });
          position = Math.max(position, group.start + group.duration);
        }
        rest(length - position, position === 0);
        for (const barline of children(m, 'barline')) if (barline.getAttribute('location') !== 'left') m.append(barline);
      });
    }
    definition.remove(); source.remove();
  }
  return { xml: result.length ? new XMLSerializer().serializeToString(doc) : xml, parts: result };
}
