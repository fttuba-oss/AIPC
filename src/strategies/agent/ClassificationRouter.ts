import { ProblemClassificationId, GenericProblemSignature } from '../core/types/strategy';
import { BaseClassificationAgent } from '../core/base/BaseClassificationAgent';

export class ClassificationRouter {
  private handlers: Map<ProblemClassificationId, BaseClassificationAgent> = new Map();

  public registerClassification(agent: BaseClassificationAgent): void {
    this.handlers.set(agent.classification, agent);
  }

  public getAgentForSignature(signature: GenericProblemSignature): BaseClassificationAgent {
    const handler = this.handlers.get(signature.classification);
    if (!handler) {
      throw new Error(
        `No strategy agent registered for problem classification '${signature.classification}'. ` +
        `Available classifications: ${Array.from(this.handlers.keys()).join(', ')}`
      );
    }
    return handler;
  }

  public hasClassification(classification: ProblemClassificationId): boolean {
    return this.handlers.has(classification);
  }
}
