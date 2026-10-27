import { AssistanceLevel, FadingEvaluationResult } from '../types/fading';
import { 
  PerformanceAttemptMetrics, 
  ScaffoldDimension, 
  ProgressionMode, 
  StrategyScaffoldDescriptor 
} from '../types/strategy';

export interface ScaffoldControllerPolicy {
  consecutiveSuccessesToAdvance: number; // default: 2
  consecutiveFailuresToRegress: number;  // default: 2
  maxAttemptsPerLevel: number;           // default: 4
}

export const DEFAULT_CONTROLLER_POLICY: ScaffoldControllerPolicy = {
  consecutiveSuccessesToAdvance: 2,
  consecutiveFailuresToRegress: 2,
  maxAttemptsPerLevel: 4,
};

export interface ScaffoldTransitionResult<TState> {
  newState: TState;
  isComplete: boolean;
  message: string;
}

export interface ScaffoldRegressionResult<TState> {
  newState: TState;
  canRegress: boolean;
  message: string;
}

export interface StrategyScaffoldControllerConfig<TState> {
  scaffoldDimension: ScaffoldDimension;
  progressionMode: ProgressionMode;
  initialState: TState;
  progressActionDescription: string;
  regressActionDescription: string;
  completionCondition: string;
  onProgress: (state: TState, metrics: PerformanceAttemptMetrics) => ScaffoldTransitionResult<TState>;
  onRegress: (state: TState, metrics: PerformanceAttemptMetrics) => ScaffoldRegressionResult<TState>;
  mapStateToSupportLevel: (state: TState) => AssistanceLevel;
  isOriginalContextRetest?: (state: TState) => boolean;
  policy?: Partial<ScaffoldControllerPolicy>;
}

/**
 * StrategyScaffoldController implements the strategy-specific scaffolding controller specified in AIPC v0.3.
 * 
 * Outer decision loop:
 *   attempt -> evaluate -> progress | repeat | regress | switch_strategy | refer_to_teacher
 * 
 * Scaffolding and fade-off are owned strictly by the strategy (e.g. BPM, gap duration, model availability,
 * context span, or grid density), while maintaining a mapped numeric support level for UI/telemetry compatibility.
 */
export class StrategyScaffoldController<TState = any> {
  public readonly scaffoldDimension: ScaffoldDimension;
  public readonly progressionMode: ProgressionMode;
  public readonly progressActionDescription: string;
  public readonly regressActionDescription: string;
  public readonly completionCondition: string;

  private state: TState;
  private onProgressHandler: (state: TState, metrics: PerformanceAttemptMetrics) => ScaffoldTransitionResult<TState>;
  private onRegressHandler: (state: TState, metrics: PerformanceAttemptMetrics) => ScaffoldRegressionResult<TState>;
  private supportLevelMapper: (state: TState) => AssistanceLevel;
  private isRetestChecker: (state: TState) => boolean;
  private policy: ScaffoldControllerPolicy;

  constructor(config: StrategyScaffoldControllerConfig<TState>) {
    this.scaffoldDimension = config.scaffoldDimension;
    this.progressionMode = config.progressionMode;
    this.state = JSON.parse(JSON.stringify(config.initialState));
    this.progressActionDescription = config.progressActionDescription;
    this.regressActionDescription = config.regressActionDescription;
    this.completionCondition = config.completionCondition;
    this.onProgressHandler = config.onProgress;
    this.onRegressHandler = config.onRegress;
    this.supportLevelMapper = config.mapStateToSupportLevel;
    this.isRetestChecker = config.isOriginalContextRetest || ((s: TState) => this.supportLevelMapper(s) === 0);
    this.policy = { ...DEFAULT_CONTROLLER_POLICY, ...config.policy };
  }

  public getState(): Readonly<TState> {
    return this.state;
  }

  public setState(newState: TState): void {
    this.state = JSON.parse(JSON.stringify(newState));
  }

  public getDescriptor(): StrategyScaffoldDescriptor<TState> {
    return {
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      currentState: this.getState(),
      progressAction: this.progressActionDescription,
      regressAction: this.regressActionDescription,
      completionCondition: this.completionCondition,
    };
  }

  public getCurrentSupportLevel(): AssistanceLevel {
    return this.supportLevelMapper(this.state);
  }

  public isRetest(): boolean {
    return this.isRetestChecker(this.state);
  }

  public evaluateAttempt(
    metrics: PerformanceAttemptMetrics,
    consecutiveSuccesses: number,
    consecutiveFailures: number,
    attemptsAtLevel: number
  ): FadingEvaluationResult & { scaffoldDescriptor: StrategyScaffoldDescriptor<TState> } {
    const isSuccess = metrics.passed;
    const newSuccesses = isSuccess ? consecutiveSuccesses + 1 : 0;
    const newFailures = !isSuccess ? consecutiveFailures + 1 : 0;
    const newAttemptCount = attemptsAtLevel + 1;
    const currentLevel = this.getCurrentSupportLevel();

    // 1. Original Context Retest Gate
    if (this.isRetest()) {
      if (isSuccess) {
        return {
          action: 'resolved',
          previousLevel: currentLevel,
          newLevel: currentLevel,
          consecutiveSuccesses: newSuccesses,
          consecutiveFailures: 0,
          message: 'Retest successful! Mastered in original musical context without scaffolding.',
          isRetest: true,
          scaffoldDescriptor: this.getDescriptor(),
        };
      } else {
        return {
          action: 'refer_to_teacher',
          previousLevel: currentLevel,
          newLevel: currentLevel,
          consecutiveSuccesses: 0,
          consecutiveFailures: newFailures,
          message: 'Retest failed in original context. Transfer deficit detected. Escalating to teacher.',
          isRetest: true,
          scaffoldDescriptor: this.getDescriptor(),
        };
      }
    }

    // 2. Success Threshold -> Progress along strategy scaffold dimension
    if (newSuccesses >= this.policy.consecutiveSuccessesToAdvance) {
      const progressResult = this.onProgressHandler(this.state, metrics);
      const previousLevel = currentLevel;
      this.state = progressResult.newState;
      const newLevel = this.getCurrentSupportLevel();
      const readyForRetest = progressResult.isComplete || this.isRetest();

      return {
        action: readyForRetest ? 'retest' : 'advance',
        previousLevel,
        newLevel,
        consecutiveSuccesses: 0,
        consecutiveFailures: 0,
        message: readyForRetest
          ? `Scaffold mastered! Ready for unassisted original-context retest (${this.completionCondition}).`
          : progressResult.message || `Progressing along ${this.scaffoldDimension}: ${this.progressActionDescription}.`,
        isRetest: readyForRetest,
        scaffoldDescriptor: this.getDescriptor(),
      };
    }

    // 3. Failure Threshold -> Regress along strategy scaffold dimension
    if (newFailures >= this.policy.consecutiveFailuresToRegress) {
      const regressResult = this.onRegressHandler(this.state, metrics);
      if (regressResult.canRegress) {
        const previousLevel = currentLevel;
        this.state = regressResult.newState;
        const newLevel = this.getCurrentSupportLevel();

        return {
          action: 'regress',
          previousLevel,
          newLevel,
          consecutiveSuccesses: 0,
          consecutiveFailures: 0,
          message: regressResult.message || `Stepping back along ${this.scaffoldDimension}: ${this.regressActionDescription}.`,
          isRetest: false,
          scaffoldDescriptor: this.getDescriptor(),
        };
      } else {
        // Cannot regress further (e.g. already at maximum assistance or lowest safe tempo)
        return {
          action: 'refer_to_teacher',
          previousLevel: currentLevel,
          newLevel: currentLevel,
          consecutiveSuccesses: 0,
          consecutiveFailures: newFailures,
          message: `Repeated breakdown at baseline along ${this.scaffoldDimension}. Escalating to teacher review.`,
          isRetest: false,
          scaffoldDescriptor: this.getDescriptor(),
        };
      }
    }

    // 4. Max attempts reached without meeting criteria
    if (newAttemptCount >= this.policy.maxAttemptsPerLevel && !isSuccess) {
      return {
        action: 'refer_to_teacher',
        previousLevel: currentLevel,
        newLevel: currentLevel,
        consecutiveSuccesses: 0,
        consecutiveFailures: newFailures,
        message: `Maximum attempts (${this.policy.maxAttemptsPerLevel}) reached for current ${this.scaffoldDimension} state. Escalating to teacher.`,
        isRetest: false,
        scaffoldDescriptor: this.getDescriptor(),
      };
    }

    // 5. Normal attempt - repeat current state
    return {
      action: 'repeat',
      previousLevel: currentLevel,
      newLevel: currentLevel,
      consecutiveSuccesses: newSuccesses,
      consecutiveFailures: newFailures,
      message: isSuccess
        ? 'Good attempt! Repeat one more time cleanly to progress.'
        : `Keep going! Focus on ${this.scaffoldDimension}.`,
      isRetest: false,
      scaffoldDescriptor: this.getDescriptor(),
    };
  }
}
