export type MetronomeSubdivision = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';
export interface MetronomeMeasure {
  measureNumber: number;
  startBeat: number;
  endBeat: number;
  numerator: number;
  denominator: number;
}
export interface MetronomeEvent {
  beat: number;
  beatNumber: number;
  downbeat: boolean;
  subdivision: number;
}

/** Score positions always use quarter notes. Compound metres count dotted beats. */
export function pulseQuarterNotes(numerator: number, denominator: number): number {
  const denominatorBeat = 4 / Math.max(1, denominator);
  return numerator > 3 && numerator % 3 === 0 && denominator >= 8 ? denominatorBeat * 3 : denominatorBeat;
}
export function countInPulses(numerator: number, denominator: number): number {
  return Math.max(1, Math.round((numerator * 4 / denominator) / pulseQuarterNotes(numerator, denominator)));
}
export function meterAtBeat(measures: readonly MetronomeMeasure[], beat: number,
  fallback: { numerator: number; denominator: number } = { numerator: 4, denominator: 4 }) {
  return measures.find(m => beat >= m.startBeat - 1e-7 && beat < m.endBeat - 1e-7) ?? fallback;
}

/** Schedule all subdivisions even when muted, so unmuting restores the selected pattern. */
export function metronomeEvents(measures: readonly MetronomeMeasure[], fromBeat: number,
  toBeat: number, subdivision: MetronomeSubdivision, ladderLevel = 4): MetronomeEvent[] {
  const divisions = ladderLevel === 5 ? 4 : { quarter: 1, eighth: 2, triplet: 3, sixteenth: 4 }[subdivision];
  const result: MetronomeEvent[] = [];
  measures.forEach((m, barIndex) => {
    if (m.endBeat <= fromBeat || m.startBeat >= toBeat || ladderLevel === 0) return;
    const pulse = pulseQuarterNotes(m.numerator, m.denominator);
    const pulseCount = Math.ceil((m.endBeat - m.startBeat) / pulse - 1e-7);
    for (let p = 0; p < pulseCount; p++) {
      const enabled = ladderLevel === 1 ? barIndex % 2 === 0 && (p === 0 || p === 2)
        : ladderLevel === 2 ? p === 0 : ladderLevel === 3 ? barIndex % 4 < 2 : true;
      if (!enabled) continue;
      for (let sub = 0; sub < divisions; sub++) {
        const beat = m.startBeat + (p + sub / divisions) * pulse;
        if (beat < fromBeat - 1e-7 || beat >= Math.min(m.endBeat, toBeat) - 1e-7) continue;
        result.push({ beat, beatNumber: p + 1, downbeat: p === 0 && sub === 0, subdivision: sub });
      }
    }
  });
  return result;
}

/** MusicXML metronome marks are converted to the engine's quarter-note BPM. */
export function metronomeMarkQuarterBpm(perMinute: number, beatUnit: string, dots = 0): number {
  const units: Record<string, number> = { whole: 4, half: 2, quarter: 1, eighth: .5, '16th': .25, '32nd': .125 };
  const dotMultiplier = 2 - Math.pow(.5, Math.max(0, dots));
  return perMinute * (units[beatUnit] ?? 1) * dotMultiplier;
}
