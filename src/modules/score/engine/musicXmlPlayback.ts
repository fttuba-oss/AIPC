import type { NoteEvent, PartData, TempoChange } from './scorePlaybackParser';
import { beatToSeconds, mapInstrumentToSoundfont } from './scorePlaybackParser';

const GM: Record<number, string> = {
  1: 'acoustic_grand_piano', 2: 'bright_acoustic_piano', 7: 'harpsichord',
  9: 'celesta', 10: 'glockenspiel', 12: 'vibraphone', 13: 'marimba', 14: 'xylophone', 15: 'tubular_bells',
  41: 'violin', 42: 'viola', 43: 'cello', 44: 'contrabass', 45: 'tremolo_strings', 46: 'pizzicato_strings', 47: 'orchestral_harp', 48: 'timpani',
  49: 'string_ensemble_1', 50: 'string_ensemble_2', 57: 'trumpet', 58: 'trombone', 59: 'tuba', 60: 'muted_trumpet', 61: 'french_horn', 62: 'brass_section',
  65: 'soprano_sax', 66: 'alto_sax', 67: 'tenor_sax', 68: 'baritone_sax', 69: 'oboe', 70: 'english_horn', 71: 'bassoon', 72: 'clarinet',
  73: 'piccolo', 74: 'flute', 75: 'recorder', 76: 'pan_flute', 115: 'steel_drums', 116: 'woodblock', 117: 'taiko_drum', 118: 'melodic_tom',
};
const DYNAMICS: Record<string, number> = { pppp: 0.18, ppp: 0.25, pp: 0.35, p: 0.45, mp: 0.55, mf: 0.68, f: 0.8, ff: 0.9, fff: 0.96, ffff: 1, sfz: 0.95, sf: 0.9, fp: 0.8 };
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const direct = (element: Element, tag: string) => Array.from(element.children).filter(child => child.localName === tag);
const child = (element: Element, tag: string) => direct(element, tag)[0];
const text = (element: Element, tag: string, fallback = '') => child(element, tag)?.textContent?.trim() || fallback;
const numeric = (element: Element, tag: string, fallback = 0) => Number(text(element, tag, String(fallback)));
const velocity = (percent: number) => Math.max(0, Math.min(1, percent * 90 / 12700));
interface Expression { beat: number; staff?: string; voice?: string; value: number; order: number }

/** Canonical sounding events from the source, using OSMD's measure/tempo timeline for cursor alignment. */
export function musicXmlPlayback(rawXml: string, measureStarts: number[], tempos: TempoChange[]): PartData[] {
  const doc = new DOMParser().parseFromString(rawXml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid MusicXML.');
  const partList = child(doc.documentElement, 'part-list');
  if (!partList) throw new Error('MusicXML has no part list.');
  const metadata = new Map(direct(partList, 'score-part').map(part => [part.getAttribute('id')!, part]));
  return direct(doc.documentElement, 'part').map(part => {
    const id = part.getAttribute('id')!;
    const meta = metadata.get(id);
    const name = meta ? text(meta, 'part-name', 'Instrument') : 'Instrument';
    const programs = new Map<string, { patch: string; drum?: number; channel: number; program: number; bank: number; volume?: number; pan?: number }>();
    for (const instrument of meta ? direct(meta, 'midi-instrument') : []) {
      const program = numeric(instrument, 'midi-program');
      const drum = numeric(instrument, 'midi-unpitched');
      programs.set(instrument.getAttribute('id')!, { patch: GM[program] ?? mapInstrumentToSoundfont(name), drum: drum > 0 ? drum - 1 : undefined, channel: numeric(instrument, 'midi-channel'), program, bank: numeric(instrument, 'midi-bank'),
        volume: child(instrument, 'volume') ? Math.max(0, Math.min(100, numeric(instrument, 'volume'))) : undefined,
        pan: child(instrument, 'pan') ? Math.max(-1, Math.min(1, numeric(instrument, 'pan') / 90)) : undefined });
    }
    const firstProgram = programs.values().next().value;
    const soundfontInstrument = firstProgram?.channel === 10 ? 'percussion' : firstProgram?.patch ?? mapInstrumentToSoundfont(name);
    // Unrendered continuous/technical expressions prohibit automatic reduction for this part.
    const uncertainExpression = part.querySelector('pedal, glissando, slide, bend, tremolo') ? id : '';
    const wedgeMarks: { beat: number; type: string; number: string; staff?: string; voice?: string }[] = [];
    const expressions: Expression[] = [];
    const notes: (NoteEvent & { tieStart: boolean; tieStop: boolean; ownVelocity?: number })[] = [];
    let divisions = 1, transpose = 0, fallbackStart = 0;
    const staffTranspose = new Map<string, number>();
    let order = 0;
    const measures = direct(part, 'measure');
    measures.forEach((measure, measureIndex) => {
      const start = measureStarts[measureIndex] ?? fallbackStart;
      const writtenNumber = measure.getAttribute('number');
      const measureNumber = writtenNumber !== null && Number.isFinite(Number(writtenNumber)) ? Number(writtenNumber) : measureIndex + 1;
      let cursor = 0, lastOnset = 0, extent = 0;
      const expression = (element: Element, beat: number, staff?: string, voice?: string) => {
        for (const wedge of Array.from(element.querySelectorAll('direction-type > wedge'))) {
          wedgeMarks.push({ beat, type: wedge.getAttribute('type') ?? '', number: wedge.getAttribute('number') ?? '1', staff, voice });
        }
        const sound = child(element, 'sound');
        const mark = element.querySelector('direction-type > dynamics')?.firstElementChild?.localName;
        const explicit = sound?.getAttribute('dynamics') ?? (element.localName === 'sound' ? element.getAttribute('dynamics') : null);
        const value = explicit !== null ? velocity(Number(explicit)) : mark ? DYNAMICS[mark] : undefined;
        if (value !== undefined && Number.isFinite(value)) expressions.push({ beat, staff, voice, value, order: order++ });
      };
      Array.from(measure.children).forEach((entry, entryIndex) => {
        switch (entry.localName) {
          case 'attributes': {
            divisions = numeric(entry, 'divisions', divisions) || divisions;
            for (const trans of direct(entry, 'transpose')) {
              const value = numeric(trans, 'chromatic') + 12 * numeric(trans, 'octave-change');
              const staff = trans.getAttribute('number');
              if (staff) staffTranspose.set(staff, value);
              else { transpose = value; staffTranspose.clear(); }
            }
            break;
          }
          case 'backup': cursor -= numeric(entry, 'duration') / divisions; break;
          case 'forward': cursor += numeric(entry, 'duration') / divisions; extent = Math.max(extent, cursor); break;
          case 'direction': expression(entry, start + cursor + numeric(entry, 'offset') / divisions, text(entry, 'staff') || undefined, text(entry, 'voice') || undefined); break;
          case 'sound': expression(entry, start + cursor); break;
          case 'note': {
            const durationBeats = numeric(entry, 'duration') / divisions;
            const onset = child(entry, 'chord') ? lastOnset : cursor;
            if (!child(entry, 'chord')) { lastOnset = cursor; cursor += durationBeats; }
            extent = Math.max(extent, cursor);
            if (child(entry, 'rest') || child(entry, 'cue') || durationBeats <= 0) break;
            const staff = text(entry, 'staff', '1'), voice = text(entry, 'voice', '1');
            const program = programs.get(child(entry, 'instrument')?.getAttribute('id') ?? '') ?? firstProgram;
            const pitched = child(entry, 'pitch'), unpitched = child(entry, 'unpitched');
            const isPercussion = !!unpitched || program?.channel === 10;
            if (!pitched && !unpitched) break;
            const pitch = isPercussion ? program?.drum ?? 38 :
              12 * (numeric(pitched!, 'octave') + 1) + (STEP[text(pitched!, 'step')] ?? 0) + numeric(pitched!, 'alter') + (staffTranspose.get(staff) ?? transpose);
            const beat = start + onset;
            const ties = direct(entry, 'tie');
            const tieStart = ties.some(tie => tie.getAttribute('type') === 'start');
            const tieStop = ties.some(tie => tie.getAttribute('type') === 'stop');
            const articulation = Array.from(entry.querySelectorAll('notations > articulations > *, notations > technical > *, notations > ornaments > *, notations > fermata, notations > arpeggiate, notations > non-arpeggiate')).map(mark => `${mark.localName}:${mark.textContent?.trim() ?? ''}`).sort().join('|');
            const slur = entry.querySelector('notations > slur') ? '|slurred' : '';
            notes.push({ partId: id, instrument: isPercussion ? `drum_${pitch}` : program?.patch ?? soundfontInstrument,
              sourceEventId: `${id}:${measureIndex}:${entryIndex}`, staffId: staff, voiceId: voice,
              pitch, beat, durationBeats, time: beatToSeconds(beat, tempos), duration: beatToSeconds(beat + durationBeats, tempos) - beatToSeconds(beat, tempos),
              measureNumber, isPercussion, articulation: articulation + slur,
              expressionKey: `${program?.program ?? ''}:${program?.bank ?? 0}:${program?.volume ?? ''}:${program?.pan ?? ''}:${uncertainExpression}`, tieStart, tieStop,
              ownVelocity: entry.hasAttribute('dynamics') ? velocity(Number(entry.getAttribute('dynamics'))) : undefined,
            });
            break;
          }
        }
      });
      fallbackStart = start + extent;
    });
    expressions.sort((a, b) => a.beat - b.beat || a.order - b.order);
    const wedgeSpans: { start: number; end: number; staff?: string; voice?: string }[] = [];
    const openWedges = new Map<string, typeof wedgeMarks[number]>();
    for (const mark of wedgeMarks.sort((a, b) => a.beat - b.beat)) {
      const key = JSON.stringify([mark.number, mark.staff, mark.voice]);
      if (mark.type === 'crescendo' || mark.type === 'diminuendo') openWedges.set(key, mark);
      else if (mark.type === 'stop') {
        const open = openWedges.get(key);
        if (open) { wedgeSpans.push({ start: open.beat, end: mark.beat, staff: open.staff, voice: open.voice }); openWedges.delete(key); }
      }
    }
    for (const open of openWedges.values()) wedgeSpans.push({ start: open.beat, end: Infinity, staff: open.staff, voice: open.voice });
    for (const note of notes) {
      let value = 0.75;
      for (const expression of expressions) {
        if (expression.beat > note.beat + 1e-8) break;
        if ((!expression.staff || expression.staff === note.staffId) && (!expression.voice || expression.voice === note.voiceId)) value = expression.value;
      }
      note.velocity = note.ownVelocity ?? value;
      const wedge = wedgeSpans.some(span => (!span.staff || span.staff === note.staffId) && (!span.voice || span.voice === note.voiceId) && note.beat < span.end && note.beat + note.durationBeats > span.start) ? id : '';
      note.expressionKey = `${note.expressionKey}:${wedge}:${note.velocity}:${note.tieStart ? 'tie-start' : ''}:${note.tieStop ? 'tie-stop' : ''}`;
    }
    // Ties join a voice's adjacent equal pitches. Slurs never suppress an attack.
    const merged: NoteEvent[] = [];
    const chains = new Map<string, NoteEvent>();
    for (const note of notes.sort((a, b) => a.beat - b.beat)) {
      const key = JSON.stringify([note.staffId, note.voiceId, note.instrument, note.pitch]);
      const previous = chains.get(key);
      if (note.tieStop && previous && Math.abs(previous.beat + previous.durationBeats - note.beat) < 1e-8) {
        previous.durationBeats += note.durationBeats;
        previous.duration = beatToSeconds(previous.beat + previous.durationBeats, tempos) - previous.time;
        previous.expressionKey = `${previous.expressionKey}|tied:${note.velocity}`;
        if (!note.tieStart) chains.delete(key);
      } else {
        const { tieStart: _start, tieStop: _stop, ownVelocity: _own, ...event } = note;
        merged.push(event);
        if (note.tieStart) chains.set(key, event); else chains.delete(key);
      }
    }
    return { id, name, soundfontInstrument, volume: firstProgram?.volume, pan: firstProgram?.pan, notes: merged };
  });
}
