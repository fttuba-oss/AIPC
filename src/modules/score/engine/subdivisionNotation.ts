import type { MetronomeSubdivision } from './metronome';
export interface SubdivisionNotation {
  count: number;
  flags: number;
  dotted: boolean;
  openHead: boolean;
  whole: boolean;
  tuplet: boolean;
  label: string;
}
/** Each icon represents one complete pulse, with note values matching the audible spacing. */
export function subdivisionNotation(pulse: number, subdivision: MetronomeSubdivision): SubdivisionNotation {
  const count = { quarter: 1, eighth: 2, triplet: 3, sixteenth: 4 }[subdivision];
  const duration = pulse / count;
  const values = [4, 2, 1, .5, .25, .125, .0625];
  let value = values.find(v => Math.abs(v - duration) < 1e-6);
  let dotted = false;
  let tuplet = false;
  if (value === undefined) {
    value = values.find(v => Math.abs(v * 1.5 - duration) < 1e-6);
    dotted = value !== undefined;
  }
  if (value === undefined) { value = pulse / 2; tuplet = count === 3; }
  const flags = Math.max(0, Math.round(-Math.log2(value)));
  const name = value >= 4 ? 'Semibreve' : value >= 2 ? 'Minim' : value >= 1 ? 'Crotchet'
    : value >= .5 ? 'Quaver' : value >= .25 ? 'Semiquaver' : value >= .125 ? 'Demisemiquaver' : 'Hemidemisemiquaver';
  const label = `${dotted ? 'Dotted ' + name.toLowerCase() : name}${count > 1 ? (tuplet ? ' triplets' : `s (${count} per beat)`) : ''}`;
  return { count, flags, dotted, openHead: value >= 2, whole: value >= 4, tuplet, label };
}
