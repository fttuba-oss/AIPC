/**
 * Strategy Bridge
 * Connects the Rhythm Diagnostic Engine results from student takes
 * directly into the AIPC Pedagogical Strategy Selector and 5-Level Fading Ladder.
 */

import type { RhythmDiagnosisResult } from '../diagnostics/types';

export interface StrategyInterventionProposal {
  scenarioId: 'rushing' | 'syncopation' | 'subdivision' | 'execution';
  strategyId: string; // e.g. 'R12' (Gap-Click), 'R07' (Subdivision), 'R20' (Ghost Beat), 'R22' (Tempo Ladder)
  strategyName: string;
  capacityDeficit: string;
  rationale: string;
  targetMeasures: [number, number];
  targetTempoBpm: number;
}

/**
 * Maps a diagnostic evaluation result into the most effective pedagogical intervention.
 */
export function mapDiagnosisToStrategyScenario(
  diagnosis: RhythmDiagnosisResult,
  defaultTempoBpm: number = 112,
  fallbackRange: [number, number] = [6, 10]
): StrategyInterventionProposal | null {
  if (!diagnosis.problemMeasureNumbers || diagnosis.problemMeasureNumbers.length === 0) {
    return null;
  }

  const topMeasureNum = diagnosis.problemMeasureNumbers[0];
  const endMeasureNum = diagnosis.problemMeasureNumbers[diagnosis.problemMeasureNumbers.length - 1];
  // Target a tight pedagogical chunk (1 to 3 bars) centered on the primary issue
  const startM = topMeasureNum;
  const endM = Math.min(topMeasureNum + 2, endMeasureNum);
  const measureDiag = diagnosis.measureDiagnoses[topMeasureNum];

  const primaryIssue = measureDiag?.primaryIssue || 'rushing';

  switch (primaryIssue) {
    case 'rushing':
      return {
        scenarioId: 'rushing',
        strategyId: 'R12',
        strategyName: 'Gap-Click Practice',
        capacityDeficit: 'RC03: Internal Pulse Instability',
        rationale: 'Onsets accelerate across the phrase. Progressively lengthen silent gaps between metronome clicks to train autonomous internal timing.',
        targetMeasures: [startM, endM],
        targetTempoBpm: measureDiag?.suggestedTempoBpm || defaultTempoBpm,
      };

    case 'dragging':
      return {
        scenarioId: 'execution',
        strategyId: 'R22',
        strategyName: 'Tempo Ladder Practice',
        capacityDeficit: 'RC08: Instrumental Execution Load',
        rationale: 'Timing stumbles or drags behind the pulse on rapid notes. Rebuild fluid finger coordination starting from 60% tempo.',
        targetMeasures: [startM, endM],
        targetTempoBpm: measureDiag?.suggestedTempoBpm || defaultTempoBpm,
      };

    case 'uneven':
      return {
        scenarioId: 'subdivision',
        strategyId: 'R07',
        strategyName: 'Explicit Subdivision Grid',
        capacityDeficit: 'RC04: Subdivision Lattice Deficit',
        rationale: 'High timing variability between equal subdivisions. Add an audible sixteenth subdivision grid to anchor note attacks.',
        targetMeasures: [startM, endM],
        targetTempoBpm: measureDiag?.suggestedTempoBpm || defaultTempoBpm,
      };

    case 'missed_notes':
      return {
        scenarioId: 'syncopation',
        strategyId: 'R20',
        strategyName: 'Ghost Beat / X-Ray Rhythm',
        capacityDeficit: 'RC06: Metrical Organisation Collapse',
        rationale: 'Attacks drop or misalign across ties and off-beats. Sound hidden metric pulses inside held notes to preserve timekeeping.',
        targetMeasures: [startM, endM],
        targetTempoBpm: measureDiag?.suggestedTempoBpm || defaultTempoBpm,
      };

    default:
      return {
        scenarioId: 'rushing',
        strategyId: 'R12',
        strategyName: 'Gap-Click Practice',
        capacityDeficit: 'RC03: Pulse Stabilization',
        rationale: 'Targeted rhythmic coaching to stabilize tempo and internal pulse.',
        targetMeasures: [startM, endM],
        targetTempoBpm: defaultTempoBpm,
      };
  }
}
