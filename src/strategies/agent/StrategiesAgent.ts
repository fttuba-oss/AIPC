import { ClassificationRouter } from './ClassificationRouter';
import { 
  GenericProblemSignature, 
  GenericHypothesis, 
  StrategySessionState 
} from '../core/types/strategy';
import { MusicalScoreContext } from '../core/base/BaseStrategy';

/**
 * Top-Level AIPC Strategies Agent.
 * Receives diagnosed problems, hypotheses, and musical context from the AIPC workflow,
 * delegates to the appropriate domain classification agent (e.g. Rhythm, Intonation),
 * and creates stateful practice sessions.
 */
export class StrategiesAgent {
  private router: ClassificationRouter;

  constructor(router?: ClassificationRouter) {
    this.router = router || new ClassificationRouter();
  }

  public getRouter(): ClassificationRouter {
    return this.router;
  }

  public initiateStrategySession(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    musicalContext: MusicalScoreContext
  ): StrategySessionState {
    const classificationAgent = this.router.getAgentForSignature(signature);
    return classificationAgent.createSession(signature, hypothesis, musicalContext);
  }
}
