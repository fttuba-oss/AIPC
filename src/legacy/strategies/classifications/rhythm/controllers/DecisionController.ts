/**
 * DecisionController: Deterministically evaluates the next pedagogical action (Pass, Persist, Pivot, Refer)
 * based on response interpretation, attempt limits, and transfer test completion.
 *
 * Implements AIPC Rhythm Diagnostic & Intervention Refactor Spec v1.0, Section 4.3.
 */

import {
  DiagnosticProfile,
  InterventionResponse,
  DecisionResult,
  TeacherHandoffRecord
} from '../types/diagnosticProfile';

export interface DecisionInput {
  interventionId: string;
  currentLevel: number;
  attemptsAtCurrentStrategy: number;
  totalInterventionAttempts: number;
  strategiesAttemptedCount: number;
  isOriginalContextRetest: boolean;
  latestResponse: InterventionResponse;
  currentAccuracy: number;
  currentProfile: DiagnosticProfile;
  maxAttemptsPerStrategy?: number;
  previousInterventionsAttempted?: Array<{
    interventionId: string;
    interventionName: string;
    attempts: number;
    response: InterventionResponse;
  }>;
}

export class DecisionController {
  /**
   * Evaluates performance and diagnostic state to decide Pass, Persist, Pivot, or Refer.
   */
  public static evaluateDecision(input: DecisionInput): DecisionResult {
    const maxAttempts = input.maxAttemptsPerStrategy ?? 3;
    const {
      interventionId,
      attemptsAtCurrentStrategy,
      totalInterventionAttempts,
      strategiesAttemptedCount,
      isOriginalContextRetest,
      latestResponse,
      currentAccuracy,
      currentProfile,
    } = input;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. EVALUATE PASS (Transfer Gate)
    // ──────────────────────────────────────────────────────────────────────────
    // ONLY passes if this is an original-context retest (unsupported, level 5) and accuracy >= 85%
    if (isOriginalContextRetest && currentAccuracy >= 0.85) {
      return {
        decision: 'Pass',
        reason: '🌟 Outstanding! You mastered the original passage unassisted with rock-solid rhythm!',
        retestRequired: false,
      };
    }

    // If student achieved high accuracy during scaffolding, they MUST do original retest next
    if (!isOriginalContextRetest && (latestResponse === 'substantial_repeated_improvement' || currentAccuracy >= 0.90)) {
      return {
        decision: 'Persist',
        reason: '🎯 Brilliant! Now let\'s verify your timing on the original passage without assistance.',
        nextLevel: 5,
        retestRequired: true,
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. EVALUATE REFER (Teacher Handoff)
    // ──────────────────────────────────────────────────────────────────────────
    const shouldRefer = 
      strategiesAttemptedCount >= 2 && attemptsAtCurrentStrategy >= 2 ||
      totalInterventionAttempts >= 5 ||
      attemptsAtCurrentStrategy >= maxAttempts && strategiesAttemptedCount >= 2;

    if (shouldRefer) {
      const handoffRecord = this.generateTeacherHandoff(input);
      return {
        decision: 'Refer',
        reason: '🌱 Great effort! We have saved your practice insights for your teacher to guide you in your next lesson.',
        teacherHandoff: handoffRecord,
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. EVALUATE PIVOT
    // ──────────────────────────────────────────────────────────────────────────
    const isStalled = attemptsAtCurrentStrategy >= 2 && 
      (latestResponse === 'no_meaningful_change' || latestResponse === 'worsened');
    const isLocalStumble = latestResponse === 'persistent_local_note_error';

    if (isStalled || isLocalStumble) {
      const pivotTarget = this.determinePivotTarget(interventionId, latestResponse, currentProfile);
      return {
        decision: 'Pivot',
        nextInterventionId: pivotTarget.strategyId,
        reason: pivotTarget.learnerRationale,
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. EVALUATE PERSIST
    // ──────────────────────────────────────────────────────────────────────────
    return {
      decision: 'Persist',
      nextLevel: latestResponse === 'substantial_repeated_improvement' 
        ? Math.min(5, input.currentLevel + 1)
        : input.currentLevel,
      reason: latestResponse === 'substantial_repeated_improvement'
        ? '👏 Noticeable improvement! Let\'s do one more focused attempt to lock this in.'
        : '👍 Getting closer! Take a breath, feel the beat, and let\'s try one more rep.',
    };
  }

  /**
   * Chooses the optimal secondary pivot strategy based on failure signature.
   */
  private static determinePivotTarget(
    currentInterventionId: string,
    response: InterventionResponse,
    profile: DiagnosticProfile
  ): { strategyId: string; learnerRationale: string } {
    if (response === 'persistent_local_note_error') {
      return {
        strategyId: 'R16',
        learnerRationale: 'We noticed a specific note transition is causing a hiccup. Let\'s isolate just those two notes (Transition Isolation) to smooth it out!',
      };
    }

    if (currentInterventionId === 'DI-REF-SHADOW-01') {
      return {
        strategyId: 'DI-SLOW-CLICK-01',
        learnerRationale: 'Shadow fingering helped clarify the notes, but playing at full tempo feels tight. Let\'s slow it down by 20 BPM with a strong click to relax your timing!',
      };
    }

    if (currentInterventionId === 'DI-SLOW-CLICK-01') {
      return {
        strategyId: 'DI-REF-SHADOW-01',
        learnerRationale: 'Even at a slower tempo, the rhythm still feels tricky. Let\'s listen to the reference track and shadow-finger along with the cursor to hear the exact groove!',
      };
    }

    const topHypothesis = [...profile.hypotheses].sort((a, b) => b.evidenceScore - a.evidenceScore)[0];
    if (topHypothesis?.capacityId === 'RC06') {
      return {
        strategyId: 'R20',
        learnerRationale: 'Let\'s tap the ghost beats on the downbeats to keep your metric grid anchored across the ties!',
      };
    }

    return {
      strategyId: 'R07',
      learnerRationale: 'Let\'s turn on a clear subdivision click to guide every short note evenly!',
    };
  }

  /**
   * Compiles the immutable TeacherHandoffRecord.
   */
  private static generateTeacherHandoff(input: DecisionInput): TeacherHandoffRecord {
    const timestamp = new Date().toISOString();
    const prevAttempts = input.previousInterventionsAttempted || [];
    const allAttempts = [
      ...prevAttempts,
      {
        interventionId: input.interventionId,
        interventionName: input.interventionId,
        attempts: input.attemptsAtCurrentStrategy,
        response: input.latestResponse,
      }
    ];

    const leading = input.currentProfile.hypotheses
      .filter(h => h.status === 'leading' || h.evidenceScore >= 3.5);

    return {
      studentId: 'student-demo',
      passageId: input.currentProfile.problemSignatureId,
      problemSignatureId: input.currentProfile.problemSignatureId,
      problemName: 'Progressive Rushing / Rhythmic Instability',
      baselineSummary: `Student completed ${input.totalInterventionAttempts} focused attempts across ${input.strategiesAttemptedCount} interventions without passing the original-context transfer gate. Automated scaffolding paused to prevent fatigue.`,
      interventionsAttempted: allAttempts,
      persistentLocations: input.currentProfile.persistentLocations,
      leadingHypotheses: leading,
      reasonForReferral: `Automated scaffolding reached attempt threshold without satisfying transfer gate (latest accuracy: ${Math.round(input.currentAccuracy * 100)}%).`,
      suggestedTeacherCheck: [
        'Check physical hand/finger tension or posture during the passage.',
        'Have student speak/chant rhythm syllables (ta-ka-di-mi) away from the instrument.',
        'Observe breathing and preparatory gesture before phrase entries.',
      ],
      supportingAttemptIds: [],
      createdAt: timestamp,
    };
  }
}
