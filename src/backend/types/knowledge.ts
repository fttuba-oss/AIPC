/**
 * AIPC Knowledgebase Types
 * Conforms to AIPC Pedagogical Diagnostic & Intervention Specification.
 */

export type AIPCLayer =
  | 'diagnosis'
  | 'strategy'
  | 'guide'
  | 'observe'
  | 'diagnose'
  | 'intervene'
  | 'guide_evaluate_adapt';

export type KnowledgeDomainStatus = 'implemented' | 'placeholder' | 'in-development';

export interface KnowledgeDomain {
  id: string;
  name: string;
  status: KnowledgeDomainStatus;
  description: string;
  knowledgebaseVersion?: string;
  problemSignatureIds: string[];
  capacityIds: string[];
  diagnosticInterventionIds: string[];
  strategyIds: string[];
  assetIds: string[];
  responseRuleIds: string[];
  progressionRuleIds: string[];
  referralRuleIds: string[];
}

export type KnowledgebaseType =
  | 'problem_signature'
  | 'capacity'
  | 'diagnostic_intervention'
  | 'strategy'
  | 'asset'
  | 'response_rule'
  | 'progression_rule'
  | 'referral_rule';

export interface KnowledgeReference {
  domainId: string;
  knowledgebaseType: KnowledgebaseType;
  recordId: string;
  label: string;
  summary?: string;
}

export interface AIPCLayerSubset {
  subsetId: string;
  name: string;
  description: string;
  knowledgebases: {
    type: KnowledgebaseType;
    label: string;
    description: string;
  }[];
}

export interface AIPCLayerDefinition {
  id: AIPCLayer;
  sequence: number;
  name: string;
  subsetsLabel?: string;
  description: string;
  pedagogicalPurpose: string;
  keyOutputs: string[];
  subsets?: AIPCLayerSubset[];
  knowledgebasesUsed: {
    type: KnowledgebaseType;
    label: string;
    description: string;
  }[];
}

export interface GenericKnowledgeRecord {
  id: string;
  domainId: string;
  type: KnowledgebaseType;
  name: string;
  description: string;
  simpleExplanation: string;
  technicalDetails?: Record<string, unknown>;
  tags?: string[];
}

export interface KnowledgeNote {
  id: string;
  targetRecordId?: string;
  targetDomainId?: string;
  targetLayerId?: AIPCLayer;
  simulationId?: string;
  author: string;
  noteText: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
