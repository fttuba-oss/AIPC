import { AssistanceLevel, FadingEvaluationResult } from '../types/fading';
import { 
  PerformanceAttemptMetrics, 
  StrategyScaffoldPayload, 
  GenericProblemSignature, 
  GenericHypothesis,
  ScaffoldDimension,
  ProgressionMode,
  StrategyScaffoldDescriptor
} from '../types/strategy';
import { StrategyScaffoldController } from '../controllers/StrategyScaffoldController';

export interface MusicalScoreContext {
  xmlContent: string;
  startMeasure: number;
  endMeasure: number;
  tempoBpm: number;
  timeSignature: { beats: number; beatType: number };
}

export abstract class BaseStrategy {
  abstract readonly strategyId: string;
  abstract readonly name: string;
  abstract readonly classification: string;
  abstract readonly initialSupportLevel: AssistanceLevel;

  /**
   * Strategy-specific scaffolding controller specified in AIPC v0.3
   */
  abstract readonly scaffoldDimension: ScaffoldDimension;
  abstract readonly progressionMode: ProgressionMode;

  /**
   * Optional reference to the underlying controller if this strategy uses one
   */
  public scaffoldController?: StrategyScaffoldController<any>;

  /**
   * Returns metadata and current scaffold state for this strategy
   */
  public getScaffoldDescriptor(): StrategyScaffoldDescriptor {
    if (this.scaffoldController) {
      return this.scaffoldController.getDescriptor();
    }
    return {
      scaffoldDimension: this.scaffoldDimension,
      progressionMode: this.progressionMode,
      currentState: { level: this.initialSupportLevel },
      progressAction: 'decrease_external_support',
      regressAction: 'increase_external_support',
      completionCondition: 'original_passage_mastered',
    };
  }

  /**
   * Generates the concrete exercise scaffold (score & audio configuration) for the given support level
   */
  abstract generateScaffold(
    level: AssistanceLevel,
    musicalContext: MusicalScoreContext
  ): StrategyScaffoldPayload;

  /**
   * Evaluates an attempt at the current support level to decide progression, regression, or referral
   */
  abstract evaluateAttempt(
    level: AssistanceLevel,
    metrics: PerformanceAttemptMetrics,
    consecutiveSuccesses: number,
    consecutiveFailures: number,
    attemptsAtLevel: number
  ): FadingEvaluationResult;

  /**
   * Explains why this strategy was chosen for the diagnosed problem and hypothesis
   */
  abstract getMechanismRationale(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis
  ): string;
}
