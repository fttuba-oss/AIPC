import { BaseStrategy, MusicalScoreContext } from '../base/BaseStrategy';
import { FadingEvaluationResult } from '../types/fading';
import { 
  GenericProblemSignature, 
  GenericHypothesis, 
  PerformanceAttemptMetrics, 
  StrategyScaffoldPayload, 
  StrategySessionState,
  StrategyExecutionRecord 
} from '../types/strategy';
import { TeacherReferralPacket } from '../types/referral';
import { 
  transformToSinglePitch, 
  injectXRayGhostNotes, 
  extractMeasureSlice 
} from '../../classifications/rhythm/scaffolds/musicXmlTransforms';
import { RhythmAssistanceConfig } from '../../classifications/rhythm/types/rhythmStrategy';

/**
 * StrategySession represents an active pedagogical intervention session.
 * Supports strategy-specific scaffold controllers, original context retesting,
 * and strategy chaining (AIPC v0.3).
 */
export class StrategySession {
  private strategy: BaseStrategy;
  private musicalContext: MusicalScoreContext;
  private state: StrategySessionState;

  constructor(
    strategy: BaseStrategy,
    musicalContext: MusicalScoreContext,
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    initialReason: string = 'Initial evidence-based intervention'
  ) {
    this.strategy = strategy;
    this.musicalContext = musicalContext;

    const initialChainRecord: StrategyExecutionRecord = {
      strategyId: strategy.strategyId,
      strategyName: strategy.name,
      reason: initialReason,
      attemptsCount: 0,
      outcome: 'in_progress',
      startedAt: Date.now(),
    };

    const initialLevel = strategy.scaffoldController
      ? strategy.scaffoldController.getCurrentSupportLevel()
      : strategy.initialSupportLevel;

    this.state = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      classification: signature.classification,
      problemSignature: signature,
      leadingHypothesis: hypothesis,
      strategyId: strategy.strategyId,
      strategyName: strategy.name,
      currentLevel: initialLevel,
      attemptsAtCurrentLevel: 0,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      history: [],
      status: 'active',
      strategyChain: [initialChainRecord],
    };
  }

  public getState(): Readonly<StrategySessionState> {
    return { ...this.state };
  }

  public getStrategy(): BaseStrategy {
    return this.strategy;
  }

  /**
   * Chains a new strategy sequentially (e.g. Reference Audio -> Tempo Ladder).
   * Records outcome of previous strategy and transitions session state.
   */
  public chainStrategy(newStrategy: BaseStrategy, reason: string): void {
    const chain = this.state.strategyChain || [];
    if (chain.length > 0) {
      const current = chain[chain.length - 1];
      if (current.outcome === 'in_progress') {
        current.outcome = 'switched';
        current.completedAt = Date.now();
        current.finalState = this.strategy.getScaffoldDescriptor();
      }
    }

    const newRecord: StrategyExecutionRecord = {
      strategyId: newStrategy.strategyId,
      strategyName: newStrategy.name,
      reason,
      attemptsCount: 0,
      outcome: 'in_progress',
      startedAt: Date.now(),
    };
    chain.push(newRecord);

    this.strategy = newStrategy;
    this.state.strategyId = newStrategy.strategyId;
    this.state.strategyName = newStrategy.name;
    this.state.currentLevel = newStrategy.initialSupportLevel;
    this.state.attemptsAtCurrentLevel = 0;
    this.state.consecutiveSuccesses = 0;
    this.state.consecutiveFailures = 0;
    this.state.status = 'active';
    this.state.strategyChain = chain;
  }

  /**
   * Generates the scaffolded payload for the student view at the current fading level.
   */
  public getCurrentScaffold(): StrategyScaffoldPayload {
    const rawScaffold = this.strategy.generateScaffold(
      this.state.currentLevel,
      this.musicalContext
    );

    let finalXml = rawScaffold.scaffoldXml;

    // Apply musical score transforms if active
    if (finalXml && !rawScaffold.isRetest) {
      const rhythmConfig = rawScaffold.assistanceConfig as RhythmAssistanceConfig;

      if (rhythmConfig.singlePitchOnly) {
        finalXml = transformToSinglePitch(finalXml);
      }

      if (rhythmConfig.ghostNotesAudible) {
        finalXml = injectXRayGhostNotes(finalXml);
      }

      if (rhythmConfig.transitionLoopOnly) {
        finalXml = extractMeasureSlice(
          finalXml,
          rawScaffold.measureRange[0],
          rawScaffold.measureRange[1]
        );
      }
    }

    return {
      ...rawScaffold,
      scaffoldXml: finalXml,
      scaffoldDescriptor: this.strategy.getScaffoldDescriptor(),
    };
  }

  /**
   * Records a student performance attempt, updates the fading state machine,
   * and checks for advancement, regression, retest, resolution, or teacher referral.
   */
  public recordAttempt(metrics: PerformanceAttemptMetrics): FadingEvaluationResult {
    const evalResult = this.strategy.evaluateAttempt(
      this.state.currentLevel,
      metrics,
      this.state.consecutiveSuccesses,
      this.state.consecutiveFailures,
      this.state.attemptsAtCurrentLevel
    );

    // Update chain record count
    if (this.state.strategyChain && this.state.strategyChain.length > 0) {
      const current = this.state.strategyChain[this.state.strategyChain.length - 1];
      current.attemptsCount += 1;
    }

    // Record history
    this.state.history.push({
      attemptNumber: this.state.history.length + 1,
      level: this.state.currentLevel,
      metrics,
      result: evalResult,
      timestamp: Date.now(),
      scaffoldState: this.strategy.getScaffoldDescriptor(),
    });

    // Update level and tracking counters
    this.state.currentLevel = evalResult.newLevel;

    if (evalResult.action === 'advance' || evalResult.action === 'regress' || evalResult.action === 'retest') {
      this.state.attemptsAtCurrentLevel = 0;
      this.state.consecutiveSuccesses = 0;
      this.state.consecutiveFailures = 0;
    } else {
      this.state.attemptsAtCurrentLevel += 1;
      this.state.consecutiveSuccesses = evalResult.consecutiveSuccesses;
      this.state.consecutiveFailures = evalResult.consecutiveFailures;
    }

    // Handle session lifecycle outcomes
    if (evalResult.action === 'resolved') {
      this.state.status = 'resolved';
      if (this.state.strategyChain && this.state.strategyChain.length > 0) {
        const current = this.state.strategyChain[this.state.strategyChain.length - 1];
        current.outcome = 'resolved';
        current.completedAt = Date.now();
        current.finalState = this.strategy.getScaffoldDescriptor();
      }
    } else if (evalResult.action === 'retest') {
      this.state.status = 'retest';
    } else if (evalResult.action === 'refer_to_teacher') {
      this.state.status = 'referred_to_teacher';
      this.state.referralPacket = this.buildReferralPacket();
      if (this.state.strategyChain && this.state.strategyChain.length > 0) {
        const current = this.state.strategyChain[this.state.strategyChain.length - 1];
        current.outcome = 'failed';
        current.completedAt = Date.now();
        current.finalState = this.strategy.getScaffoldDescriptor();
      }
    }

    return evalResult;
  }

  /**
   * Constructs a structured Teacher Referral packet when intervention needs teacher escalation.
   */
  private buildReferralPacket(): TeacherReferralPacket {
    return {
      referralId: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      problemClassification: this.state.classification,
      problemSignatureId: this.state.problemSignature.id,
      problemLabel: this.state.problemSignature.label,
      leadingHypothesisId: this.state.leadingHypothesis.capacityId,
      leadingHypothesisName: this.state.leadingHypothesis.name,
      alternativeHypotheses: this.state.problemSignature.candidateCapacityIds.map((id) => ({
        capacityId: id,
        capacityName: id,
        confidence: 0.3,
      })),
      attemptedStrategyId: this.strategy.strategyId,
      attemptedStrategyName: this.strategy.name,
      totalAttempts: this.state.history.length,
      finalSupportLevel: this.state.currentLevel,
      reason: this.state.currentLevel === 5 ? 'transfer_deficit_on_retest' : 'repeated_failure_at_maximum_support',
      summaryForTeacher: `Student completed ${this.state.history.length} attempts with ${this.strategy.name}. ` +
        `Performance plateaued at Level ${this.state.currentLevel}. Recommended for 1-on-1 teacher review in next lesson.`,
      studentFriendlyExitMessage: `Great effort on this exercise! This pattern is tricky, so I've flagged it for your teacher ` +
        `so you can explore it together during your next lesson.`,
      measureRange: this.state.problemSignature.measureRange,
    };
  }
}
