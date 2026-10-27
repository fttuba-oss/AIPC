/**
 * Rhythm Diagnostic Layer - Diagnostic Engine
 * Cleanly decoupled module that matches detected student onsets against score notes,
 * identifies micro (notehead) and macro (measure) timing issues,
 * and formulates pedagogical feedback.
 */

import { NoteEvent, TempoChange, beatToSeconds } from '../modules/score/engine/scorePlaybackParser';
import {
  RhythmOnset,
  NoteRhythmEvaluation,
  MeasureRhythmDiagnosis,
  RhythmDiagnosisResult,
  RhythmAccuracyRating,
  RhythmDiagnosticConfig,
  MeasureRhythmIssueType,
  DisambiguationResult
} from './types';

export class RhythmDiagnosticEngine {
  private config: Required<RhythmDiagnosticConfig>;

  constructor(config?: RhythmDiagnosticConfig) {
    this.config = {
      perfectWindowMs: config?.perfectWindowMs ?? 55,
      goodWindowMs: config?.goodWindowMs ?? 125,
      maxWindowMs: config?.maxWindowMs ?? 260,
    };
  }

  /**
   * Evaluates student onsets against expected score notes.
   */
  evaluate(params: {
    expectedNotes: NoteEvent[];
    onsets: RhythmOnset[];
    tempos?: TempoChange[];
    startBeat?: number;
    endBeat?: number;
    startMeasure?: number;
    endMeasure?: number;
    currentBpm: number;
    intendedBpm?: number;
  }): RhythmDiagnosisResult {
    const {
      expectedNotes,
      onsets,
      tempos = [],
      startBeat: paramStartBeat,
      endBeat: paramEndBeat,
      startMeasure,
      endMeasure,
      currentBpm,
      intendedBpm = 120,
    } = params;

    const speedMultiplier = currentBpm / intendedBpm;

    // Filter score notes in active playback range (by measureNumber first, or by beat)
    let targetNotes = expectedNotes.filter(n => {
      if (startMeasure !== undefined && endMeasure !== undefined) {
        return n.measureNumber >= startMeasure && n.measureNumber <= endMeasure;
      }
      const sBeat = paramStartBeat ?? 0;
      const eBeat = paramEndBeat ?? Infinity;
      return n.beat >= sBeat - 0.05 && n.beat < eBeat + 0.05;
    });

    // If expectedNotes was already targeted and filtering reduced it to 0, use expectedNotes
    if (targetNotes.length === 0 && expectedNotes.length > 0) {
      targetNotes = expectedNotes;
    }

    const startBeat = paramStartBeat !== undefined ? paramStartBeat : (targetNotes.length > 0 ? targetNotes[0].beat : 0);

    // Calculate real playback expected seconds for each note relative to section start beat
    const getBeatRealSeconds = (beat: number): number => {
      if (tempos && tempos.length > 0) {
        const trueSec = beatToSeconds(beat, tempos);
        const startSec = beatToSeconds(startBeat, tempos);
        return Math.max(0, (trueSec - startSec) / speedMultiplier);
      }
      return (beat - startBeat) * (60 / currentBpm);
    };

    // Sequential Onset-to-Note Queue Matching:
    // Expected notes are consumed chronologically. Each onset binds to the current expected note.
    // Early taps bind immediately as 'Early' (rushing). Excess taps beyond total notes are discarded.
    // Notes elapsed without an attack are marked 'Miss'.
    const noteEvaluations: NoteRhythmEvaluation[] = [];
    const evaluationsMap: Record<number, RhythmAccuracyRating> = {};

    const maxLateSec = this.config.maxWindowMs / 1000;
    const sortedOnsets = [...onsets].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

    let notePointer = 0;
    const totalNotesCount = targetNotes.length;

    for (const onset of sortedOnsets) {
      if (notePointer >= totalNotesCount) {
        // Discard extra onsets beyond score notes (e.g. 6th tap on 5-note measure)
        break;
      }

      const onsetSec = onset.timestampSeconds;

      // Check if any expected notes before this onset have completely elapsed
      while (notePointer < totalNotesCount) {
        const expectedSec = getBeatRealSeconds(targetNotes[notePointer].beat);
        if (onsetSec > expectedSec + maxLateSec) {
          // This note elapsed without an attack before the current onset arrived -> Miss
          const note = targetNotes[notePointer];
          evaluationsMap[notePointer] = 'Miss';
          noteEvaluations.push({
            noteIndex: notePointer,
            pitch: note.pitch,
            expectedBeat: note.beat,
            expectedTimeSeconds: expectedSec,
            measureNumber: note.measureNumber,
            rating: 'Miss',
            offsetMs: 0,
          });
          notePointer++;
        } else {
          break;
        }
      }

      if (notePointer >= totalNotesCount) {
        break;
      }

      // Bind current onset to targetNotes[notePointer]
      const currentNote = targetNotes[notePointer];
      const currentExpectedSec = getBeatRealSeconds(currentNote.beat);
      const diffMs = (onsetSec - currentExpectedSec) * 1000;
      const offsetMs = Math.round(diffMs);
      const absDiff = Math.abs(offsetMs);

      let rating: RhythmAccuracyRating = 'Good';
      if (absDiff <= this.config.perfectWindowMs) {
        rating = 'Perfect';
      } else if (absDiff <= this.config.goodWindowMs) {
        rating = 'Good';
      } else if (offsetMs < 0) {
        rating = 'Early'; // Immediately register early onset as rushing
      } else {
        rating = 'Late';
      }

      evaluationsMap[notePointer] = rating;
      noteEvaluations.push({
        noteIndex: notePointer,
        pitch: currentNote.pitch,
        expectedBeat: currentNote.beat,
        expectedTimeSeconds: currentExpectedSec,
        measureNumber: currentNote.measureNumber,
        rating,
        offsetMs,
        matchedOnset: onset,
      });

      notePointer++;
    }

    // Any remaining expected notes that were never reached by onsets are Missed
    while (notePointer < totalNotesCount) {
      const note = targetNotes[notePointer];
      const expectedSec = getBeatRealSeconds(note.beat);
      evaluationsMap[notePointer] = 'Miss';
      noteEvaluations.push({
        noteIndex: notePointer,
        pitch: note.pitch,
        expectedBeat: note.beat,
        expectedTimeSeconds: expectedSec,
        measureNumber: note.measureNumber,
        rating: 'Miss',
        offsetMs: 0,
      });
      notePointer++;
    }

    // 2. Measure-level grouping and diagnostics
    const measureGroups = new Map<number, NoteRhythmEvaluation[]>();
    noteEvaluations.forEach((evalNote) => {
      const m = evalNote.measureNumber;
      if (!measureGroups.has(m)) {
        measureGroups.set(m, []);
      }
      measureGroups.get(m)!.push(evalNote);
    });

    const measureDiagnoses: Record<number, MeasureRhythmDiagnosis> = {};
    const problemMeasures: number[] = [];

    measureGroups.forEach((mNotes, mNum) => {
      const totalNotes = mNotes.length;
      const perfectCount = mNotes.filter(n => n.rating === 'Perfect').length;
      const goodCount = mNotes.filter(n => n.rating === 'Good').length;
      const earlyCount = mNotes.filter(n => n.rating === 'Early').length;
      const lateCount = mNotes.filter(n => n.rating === 'Late').length;
      const missCount = mNotes.filter(n => n.rating === 'Miss').length;

      const hitNotes = mNotes.filter(n => n.rating !== 'Miss');
      const averageOffsetMs = hitNotes.length > 0
        ? Math.round(hitNotes.reduce((acc, n) => acc + n.offsetMs, 0) / hitNotes.length)
        : 0;

      let primaryIssue: MeasureRhythmIssueType = 'accurate';
      let explanation = `Bar ${mNum}: Rhythm locked in cleanly.`;

      if (earlyCount >= 1 && (earlyCount >= lateCount || averageOffsetMs < 0)) {
        primaryIssue = 'rushing';
        const msStr = averageOffsetMs !== 0 ? ` by ~${Math.abs(averageOffsetMs)}ms` : '';
        explanation = `Bar ${mNum}: Rushing ahead of the beat${msStr} (${earlyCount} early attack${earlyCount > 1 ? 's' : ''}).`;
        problemMeasures.push(mNum);
      } else if (lateCount >= 1 && (lateCount > earlyCount || averageOffsetMs > 0)) {
        primaryIssue = 'dragging';
        const msStr = averageOffsetMs !== 0 ? ` by ~${averageOffsetMs}ms` : '';
        explanation = `Bar ${mNum}: Dragging behind the beat${msStr} (${lateCount} late attack${lateCount > 1 ? 's' : ''}).`;
        problemMeasures.push(mNum);
      } else if (earlyCount >= 1 && lateCount >= 1) {
        primaryIssue = 'uneven';
        explanation = `Bar ${mNum}: Uneven pulse across the measure.`;
        problemMeasures.push(mNum);
      } else if (missCount >= 1) {
        primaryIssue = 'missed_notes';
        explanation = `Bar ${mNum}: Missed ${missCount} note attack${missCount > 1 ? 's' : ''} or dropped rhythm.`;
        problemMeasures.push(mNum);
      }

      measureDiagnoses[mNum] = {
        measureNumber: mNum,
        totalNotes,
        perfectCount,
        goodCount,
        earlyCount,
        lateCount,
        missCount,
        averageOffsetMs,
        primaryIssue,
        explanation,
        suggestedTempoBpm: primaryIssue !== 'accurate' ? Math.max(40, currentBpm - 15) : undefined,
      };
    });

    // 3. Overall performance scoring and summary
    const totalAssessed = noteEvaluations.length;
    const successfulHits = noteEvaluations.filter(
      n => n.rating === 'Perfect' || n.rating === 'Good'
    ).length;
    const overallAccuracyPercent = totalAssessed > 0
      ? Math.round((successfulHits / totalAssessed) * 100)
      : 0;

    let summaryText = '';
    const remedyActions: RhythmDiagnosisResult['remedyActions'] = [];

    if (totalAssessed === 0) {
      summaryText = `⚠️ No playable notes found in Bars ${startMeasure ?? 1}–${endMeasure ?? 1} to evaluate.`;
      remedyActions.push({
        label: 'Try Section Again',
        actionKey: 'ready_to_play',
        icon: '▶️',
        variant: 'primary',
      });
    } else if (onsets.length === 0) {
      summaryText = "⚠️ No note attacks detected in this run (0% accuracy). Check that your microphone is unmuted and allowed, and play clearly into the mic.";
      remedyActions.push({
        label: 'Try Again',
        actionKey: 'ready_to_play',
        icon: '▶️',
        variant: 'primary',
      });
      if (problemMeasures.length > 0) {
        const inRangeProblem = problemMeasures.find(m => (startMeasure !== undefined && endMeasure !== undefined) ? (m >= startMeasure && m <= endMeasure) : true);
        const targetMeasure = inRangeProblem ?? (startMeasure ?? problemMeasures[0]);
        remedyActions.push({
          label: `Focus on Bar ${targetMeasure}`,
          actionKey: `focus_bar_${targetMeasure}`,
          icon: '🎯',
          variant: 'secondary',
        });
      }
    } else if (problemMeasures.length === 0 && overallAccuracyPercent >= 85) {
      summaryText = `Solid timing! ${overallAccuracyPercent}% accuracy. Rhythm stayed locked in with the pulse.`;
      remedyActions.push({
        label: 'Ready for Next Section',
        actionKey: 'next_challenge',
        icon: '🚀',
        variant: 'success'
      });
    } else {
      const topMeasureNum = problemMeasures[0] ?? (startMeasure ?? 1);
      const topProblem: MeasureRhythmDiagnosis | undefined = measureDiagnoses[topMeasureNum] || (problemMeasures[0] !== undefined ? measureDiagnoses[problemMeasures[0]] : undefined);
      const explanation = topProblem
        ? topProblem.explanation
        : `Timing accuracy was ${overallAccuracyPercent}%. Some notes were early or late.`;
      summaryText = `Rhythm check (${overallAccuracyPercent}% accuracy): ${explanation}${problemMeasures.length > 0 ? ` Notice the highlighted notes in Bar ${problemMeasures.join(', ')}.` : ''}`;

      // Pedagogical Practice Strategy Action
      let strategyLabel = 'Guided Strategy: Gap-Click (5 Levels)';
      let strategyScenario = 'rushing';
      if (topProblem?.primaryIssue === 'dragging') {
        strategyLabel = 'Guided Strategy: Tempo Ladder (5 Levels)';
        strategyScenario = 'execution';
      } else if (topProblem?.primaryIssue === 'uneven') {
        strategyLabel = 'Guided Strategy: Subdivision Grid (5 Levels)';
        strategyScenario = 'subdivision';
      } else if (topProblem?.primaryIssue === 'missed_notes') {
        strategyLabel = 'Guided Strategy: Ghost Beat / Ties (5 Levels)';
        strategyScenario = 'syncopation';
      } else {
        strategyLabel = 'Guided Strategy: Gap-Click (5 Levels)';
        strategyScenario = 'rushing';
      }

      // Disambiguation Sieve: Is it cognitive speed load, mechanical note bottleneck, or genuine rhythm deficit?
      const disambiguation = this.disambiguatePitchVsRhythm({
        noteEvaluations,
        overallAccuracyPercent,
        currentBpm,
        intendedBpm,
        problemMeasures,
      });

      const reducedBpm = Math.max(40, currentBpm - Math.min(20, Math.round(currentBpm * 0.2)));

      if (disambiguation.likelyCause === 'cognitive_speed_load') {
        summaryText = `🎯 Solid timing recovery (${overallAccuracyPercent}%) at ${currentBpm} BPM! Your pulse is steady; the previous error was just tempo load. No need to isolate rhythm!`;
        remedyActions.push({
          label: `Keep Playing in Repertoire (+5 BPM)`,
          actionKey: `tempo_${Math.min(intendedBpm, currentBpm + 5)}`,
          icon: '🚀',
          variant: 'success'
        });
        remedyActions.push({
          label: 'Try Target Tempo Again',
          actionKey: `tempo_${intendedBpm}`,
          icon: '⚡',
          variant: 'primary'
        });
      } else if (disambiguation.likelyCause === 'mechanical_note_bottleneck') {
        summaryText = `🎹 Note Transition Check (${overallAccuracyPercent}%): Timing delays cluster at wide intervals or tricky finger shifts in Bar ${problemMeasures.join(', ')}. Your rhythm sense is fine; let's give your fingers space!`;
        remedyActions.push({
          label: 'Option A: Shadow Fingering on Score',
          actionKey: 'repertoire_shadow_fingering',
          icon: '🎧',
          variant: 'primary'
        });
        remedyActions.push({
          label: `Option B: Slower Tempo (${reducedBpm} BPM, Real Notes)`,
          actionKey: 'repertoire_slow_tempo',
          icon: '🐢',
          variant: 'secondary'
        });
        remedyActions.push({
          label: `Focus on Bar ${topMeasureNum}`,
          actionKey: `focus_bar_${topMeasureNum}`,
          icon: '🎯',
          variant: 'amber'
        });
      } else if (disambiguation.likelyCause === 'genuine_rhythm_deficit') {
        summaryText = `⚠️ Confirmed Rhythm Deficit: Even at reduced tempo (${currentBpm} BPM), pulse drift was detected in Bar ${problemMeasures.join(', ')}. Step into the Rhythm Gym to lock in the groove with notes simplified!`;
        remedyActions.push({
          label: 'Enter Rhythm Gym (60s Pulse Pit Stop)',
          actionKey: `start_strategy_${strategyScenario}_${topMeasureNum}`,
          icon: '🛠️',
          variant: 'primary'
        });
        remedyActions.push({
          label: 'Listen Demo in Repertoire',
          actionKey: 'listen_demo',
          icon: '🎧',
          variant: 'secondary'
        });
        remedyActions.push({
          label: `Focus on Bar ${topMeasureNum}`,
          actionKey: `focus_bar_${topMeasureNum}`,
          icon: '🎯',
          variant: 'amber'
        });
      } else {
        // Initial Front Door on Repertoire: strictly stay on repertoire until isolated as rhythm deficit
        remedyActions.push({
          label: 'Option A: Shadow Fingering on Score',
          actionKey: 'repertoire_shadow_fingering',
          icon: '🎧',
          variant: 'primary'
        });
        remedyActions.push({
          label: `Option B: Slower Tempo (${reducedBpm} BPM, Real Notes)`,
          actionKey: 'repertoire_slow_tempo',
          icon: '🐢',
          variant: 'secondary'
        });
        remedyActions.push({
          label: `Focus on Bar ${topMeasureNum}`,
          actionKey: `focus_bar_${topMeasureNum}`,
          icon: '🎯',
          variant: 'amber'
        });
      }
    }

    const disambiguation = this.disambiguatePitchVsRhythm({
      noteEvaluations,
      overallAccuracyPercent,
      currentBpm,
      intendedBpm,
      problemMeasures,
    });

    return {
      evaluations: evaluationsMap,
      detailedNotes: noteEvaluations,
      measureDiagnoses,
      problemMeasureNumbers: problemMeasures,
      overallAccuracyPercent,
      summaryText,
      disambiguation,
      remedyActions
    };
  }

  /**
   * Disambiguates whether timing errors stem from cognitive speed overload,
   * mechanical note/fingering transitions, or genuine rhythm pulse instability.
   */
  private disambiguatePitchVsRhythm(params: {
    noteEvaluations: NoteRhythmEvaluation[];
    overallAccuracyPercent: number;
    currentBpm: number;
    intendedBpm: number;
    problemMeasures: number[];
  }): DisambiguationResult {
    const { noteEvaluations, overallAccuracyPercent, currentBpm, intendedBpm } = params;

    const isSlowTempo = currentBpm <= intendedBpm - 14;

    // Check transition error clustering (mechanical bottleneck)
    let transitionClusterCount = 0;
    let totalErrors = 0;
    for (let i = 1; i < noteEvaluations.length; i++) {
      const prev = noteEvaluations[i - 1];
      const curr = noteEvaluations[i];
      const isError = curr.rating === 'Early' || curr.rating === 'Late' || curr.rating === 'Miss';
      if (isError) {
        totalErrors++;
        const pitchDiff = Math.abs((curr.pitch || 60) - (prev.pitch || 60));
        if (pitchDiff >= 5) {
          // Large interval jump or register transition
          transitionClusterCount++;
        }
      }
    }

    const transitionRatio = totalErrors > 0 ? transitionClusterCount / totalErrors : 0;

    // Rule 1: Slower tempo resolved the issue
    if (isSlowTempo && overallAccuracyPercent >= 75) {
      return {
        likelyCause: 'cognitive_speed_load',
        reason: `Timing locked in at ${currentBpm} BPM! The pulse is steady; the earlier rushing was tempo pressure.`,
        recommendedPath: 'stay_in_repertoire',
        suggestedActionLabel: 'Step Tempo Back Up (+5 BPM)',
      };
    }

    // Rule 2: Errors cluster at wide interval jumps / awkward finger shifts
    if (transitionRatio >= 0.50 && totalErrors >= 2) {
      return {
        likelyCause: 'mechanical_note_bottleneck',
        reason: 'Timing delays cluster at large interval leaps and register shifts, while uniform rhythms remained steady.',
        recommendedPath: 'finger_technique_rehearsal',
        suggestedActionLabel: 'Isolate Finger Transitions (Keep Notes)',
        suggestedStrategyId: 'R16',
      };
    }

    // Rule 3: Persistent rushing/drift despite slower tempo or across uniform notes
    if (isSlowTempo && overallAccuracyPercent < 70) {
      return {
        likelyCause: 'genuine_rhythm_deficit',
        reason: 'Timing drift and offbeat instability persist even at reduced tempo. Pulse isolation in Rhythm Gym is recommended.',
        recommendedPath: 'isolate_rhythm_gym',
        suggestedActionLabel: 'Enter Rhythm Gym (60s Pulse Rebuilding)',
        suggestedStrategyId: 'rushing',
      };
    }

    // Default: Inconclusive on initial take
    return {
      likelyCause: 'inconclusive',
      reason: 'Initial timing irregularities detected. Try Repertoire Shadowing or Tempo Reduction to isolate notes from rhythm.',
      recommendedPath: 'stay_in_repertoire',
      suggestedActionLabel: 'Try Front Door on Repertoire',
    };
  }

  /**
   * Evaluates a single live attack against expected notes in real time.
   * Returns the matched note index and its accuracy rating if matched within window.
   */
  evaluateLiveOnset(params: {
    onsetSeconds: number;
    expectedNotes: NoteEvent[];
    tempos?: TempoChange[];
    startBeat: number;
    currentBpm: number;
    intendedBpm?: number;
    alreadyEvaluatedIndices: Set<number>;
    liveEvaluations?: Record<number, RhythmAccuracyRating>;
  }): { noteIndex: number; rating: RhythmAccuracyRating; offsetMs: number } | null {
    const {
      onsetSeconds,
      expectedNotes,
      tempos = [],
      startBeat,
      currentBpm,
      intendedBpm = 120,
      alreadyEvaluatedIndices,
      liveEvaluations = {},
    } = params;

    const speedMultiplier = currentBpm / intendedBpm;
    const getBeatRealSeconds = (beat: number): number => {
      if (tempos && tempos.length > 0) {
        const trueSec = beatToSeconds(beat, tempos);
        const startSec = beatToSeconds(startBeat, tempos);
        return Math.max(0, (trueSec - startSec) / speedMultiplier);
      }
      return (beat - startBeat) * (60 / currentBpm);
    };

    // Sequential Live Onset Evaluation:
    // Sequentially consumes the next available un-evaluated expected note.
    // Early attacks bind immediately to the upcoming note as Early/Rushing.
    // Elapsed notes without attacks are skipped as Misses.
    const maxLateSec = this.config.maxWindowMs / 1000;
    const totalNotes = expectedNotes.length;

    let targetIdx = -1;
    for (let i = 0; i < totalNotes; i++) {
      if (alreadyEvaluatedIndices.has(i)) continue;
      const expectedSec = getBeatRealSeconds(expectedNotes[i].beat);
      if (onsetSeconds > expectedSec + maxLateSec) {
        // This note has elapsed before the attack arrived -> mark Missed
        alreadyEvaluatedIndices.add(i);
        continue;
      }
      targetIdx = i;
      break;
    }

    if (targetIdx === -1) {
      // All notes in active range already evaluated; extra attacks are discarded
      return null;
    }

    const currentNote = expectedNotes[targetIdx];
    const expectedSec = getBeatRealSeconds(currentNote.beat);
    const diffMs = (onsetSeconds - expectedSec) * 1000;
    const offsetMs = Math.round(diffMs);
    const absDiff = Math.abs(offsetMs);

    let rating: RhythmAccuracyRating = 'Good';
    if (absDiff <= this.config.perfectWindowMs) {
      rating = 'Perfect';
    } else if (absDiff <= this.config.goodWindowMs) {
      rating = 'Good';
    } else if (offsetMs < 0) {
      rating = 'Early'; // Immediately register ahead-of-time attack as Early/Rushing
    } else {
      rating = 'Late';
    }

    return { noteIndex: targetIdx, rating, offsetMs };
  }

  /**
   * Identifies notes whose attack window has completely elapsed without any attack.
   */
  findMissedNotes(params: {
    currentElapsedSeconds: number;
    expectedNotes: NoteEvent[];
    tempos?: TempoChange[];
    startBeat: number;
    currentBpm: number;
    intendedBpm?: number;
    alreadyEvaluatedIndices: Set<number>;
  }): number[] {
    const {
      currentElapsedSeconds,
      expectedNotes,
      tempos = [],
      startBeat,
      currentBpm,
      intendedBpm = 120,
      alreadyEvaluatedIndices,
    } = params;

    const speedMultiplier = currentBpm / intendedBpm;
    const getBeatRealSeconds = (beat: number): number => {
      if (tempos && tempos.length > 0) {
        const trueSec = beatToSeconds(beat, tempos);
        const startSec = beatToSeconds(startBeat, tempos);
        return Math.max(0, (trueSec - startSec) / speedMultiplier);
      }
      return (beat - startBeat) * (60 / currentBpm);
    };

    const missed: number[] = [];
    expectedNotes.forEach((note, idx) => {
      if (alreadyEvaluatedIndices.has(idx)) return;
      const noteExpectedSec = getBeatRealSeconds(note.beat);
      if (currentElapsedSeconds > noteExpectedSec + (this.config.maxWindowMs / 1000)) {
        missed.push(idx);
      }
    });

    return missed;
  }
}
