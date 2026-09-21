import { BaseStrategy, MusicalScoreContext } from './BaseStrategy';
import { 
  ProblemClassificationId, 
  GenericProblemSignature, 
  GenericHypothesis,
  StrategySessionState 
} from '../types/strategy';

export abstract class BaseClassificationAgent {
  abstract readonly classification: ProblemClassificationId;

  /**
   * Selects and parameterizes the optimal strategy for the diagnosed problem and hypothesis
   */
  abstract selectStrategy(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    musicalContext: MusicalScoreContext
  ): BaseStrategy;

  /**
   * Initializes a stateful practice session for this classification
   */
  abstract createSession(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    musicalContext: MusicalScoreContext
  ): StrategySessionState;
}
