import { BaseClassificationAgent } from '../../../core/base/BaseClassificationAgent';
import { BaseStrategy, MusicalScoreContext } from '../../../core/base/BaseStrategy';
import { 
  ProblemClassificationId, 
  GenericProblemSignature, 
  GenericHypothesis, 
  StrategySessionState 
} from '../../../core/types/strategy';
import { RhythmStrategySelector } from '../selector/RhythmStrategySelector';

export class RhythmStrategiesAgent extends BaseClassificationAgent {
  readonly classification: ProblemClassificationId = 'rhythm';
  private selector = new RhythmStrategySelector();

  selectStrategy(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    _musicalContext: MusicalScoreContext
  ): BaseStrategy {
    return this.selector.select(signature, hypothesis);
  }

  createSession(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    musicalContext: MusicalScoreContext
  ): StrategySessionState {
    const strategy = this.selectStrategy(signature, hypothesis, musicalContext);
    const initialLevel = strategy.initialSupportLevel;

    return {
      sessionId: `sess_rhythm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      classification: this.classification,
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
    };
  }
}
