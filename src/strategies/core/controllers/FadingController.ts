import { AssistanceLevel, FadingEvaluationResult } from '../types/fading';
import { PerformanceAttemptMetrics } from '../types/strategy';

export interface FadingPolicy {
  consecutiveSuccessesToAdvance: number; // default: 2
  consecutiveFailuresToRegress: number;  // default: 2
  maxAttemptsPerLevel: number;           // default: 4
}

export const DEFAULT_FADING_POLICY: FadingPolicy = {
  consecutiveSuccessesToAdvance: 2,
  consecutiveFailuresToRegress: 2,
  maxAttemptsPerLevel: 4,
};

/**
 * FadingController manages the 5-to-0 Assistance Scale state machine.
 * Enforces evidence-based progression:
 * - Advance only when control is demonstrated across at least 2 consecutive successful trials.
 * - Regress when errors persist across 2 consecutive attempts.
 * - Level 0 is the Exit Gate (Original Context Retest).
 * - Triggers referral when repeated interventions fail or attempts at base level are exhausted.
 */
export class FadingController {
  private policy: FadingPolicy;

  constructor(policy: FadingPolicy = DEFAULT_FADING_POLICY) {
    this.policy = policy;
  }

  public evaluateAttempt(
    currentLevel: AssistanceLevel,
    metrics: PerformanceAttemptMetrics,
    consecutiveSuccesses: number,
    consecutiveFailures: number,
    attemptsAtLevel: number
  ): FadingEvaluationResult {
    const isSuccess = metrics.passed;
    const newSuccesses = isSuccess ? consecutiveSuccesses + 1 : 0;
    const newFailures = !isSuccess ? consecutiveFailures + 1 : 0;
    const newAttemptCount = attemptsAtLevel + 1;

    // 1. Check Level 5 (Retest Gate)
    if (currentLevel === 5) {
      if (isSuccess) {
        return {
          action: 'resolved',
          previousLevel: 5,
          newLevel: 5,
          consecutiveSuccesses: newSuccesses,
          consecutiveFailures: 0,
          message: 'Retest successful! Performance verified in original context without assistance.',
          isRetest: true,
        };
      } else {
        return {
          action: 'refer_to_teacher',
          previousLevel: 5,
          newLevel: 5,
          consecutiveSuccesses: 0,
          consecutiveFailures: newFailures,
          message: 'Retest failed in original context. Transfer deficit detected. Escalating to teacher referral.',
          isRetest: true,
        };
      }
    }

    // 2. Check if consecutive successes warrant advancement (lower assistance / higher level number)
    if (newSuccesses >= this.policy.consecutiveSuccessesToAdvance) {
      const nextLevel = (currentLevel + 1) as AssistanceLevel;
      const isRetest = nextLevel === 5;

      return {
        action: isRetest ? 'retest' : 'advance',
        previousLevel: currentLevel,
        newLevel: nextLevel,
        consecutiveSuccesses: 0,
        consecutiveFailures: 0,
        message: isRetest 
          ? 'Scaffolding mastered! Ready for unassisted Level 5 Retest in original musical context.'
          : `Advancing from Level ${currentLevel} to Level ${nextLevel} (support reduced).`,
        isRetest,
      };
    }

    // 3. Check if consecutive failures warrant regression (higher assistance / lower level number)
    if (newFailures >= this.policy.consecutiveFailuresToRegress) {
      if (currentLevel > 0) {
        const nextLevel = (currentLevel - 1) as AssistanceLevel;
        return {
          action: 'regress',
          previousLevel: currentLevel,
          newLevel: nextLevel,
          consecutiveSuccesses: 0,
          consecutiveFailures: 0,
          message: `Two consecutive attempts missed tolerance. Stepping back to Level ${nextLevel} for additional scaffolding.`,
          isRetest: false,
        };
      } else {
        // Already at maximum assistance (Level 0) and failing repeatedly
        return {
          action: 'refer_to_teacher',
          previousLevel: 0,
          newLevel: 0,
          consecutiveSuccesses: 0,
          consecutiveFailures: newFailures,
          message: 'Repeated breakdown despite maximum scaffolding. Escalating to teacher review.',
          isRetest: false,
        };
      }
    }

    // 4. Check if max attempts reached without passing
    if (newAttemptCount >= this.policy.maxAttemptsPerLevel && !isSuccess) {
      return {
        action: 'refer_to_teacher',
        previousLevel: currentLevel,
        newLevel: currentLevel,
        consecutiveSuccesses: 0,
        consecutiveFailures: newFailures,
        message: `Maximum attempts (${this.policy.maxAttemptsPerLevel}) reached at Level ${currentLevel}. Escalating to teacher.`,
        isRetest: false,
      };
    }

    // 5. Normal attempt - repeat current level
    return {
      action: 'repeat',
      previousLevel: currentLevel,
      newLevel: currentLevel,
      consecutiveSuccesses: newSuccesses,
      consecutiveFailures: newFailures,
      message: isSuccess
        ? 'Good attempt! Hit one more successful trial inside tolerance to advance.'
        : 'Keep going! Focus on the auditory anchor.',
      isRetest: false,
    };
  }
}
