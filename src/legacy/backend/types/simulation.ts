import type { AIPCLayer, KnowledgeReference } from './knowledge';
import type {
  DiagnosticProfile,
  InterventionResponse,
  DecisionResult,
  TeacherHandoffRecord
} from '../../strategies/classifications/rhythm/types/diagnosticProfile';

export type ReasoningNodeStatus =
  | 'observed'
  | 'provisional'
  | 'selected'
  | 'completed'
  | 'updated'
  | 'referred';

export interface EvidenceReference {
  id: string;
  source: string;
  capacityId: string;
  direction: 'strengthens' | 'weakens' | 'neutral' | 'uncertain';
  weight: number;
  observation: string;
}

export interface ReasoningNode {
  id: string;
  sequence: number;
  layer: AIPCLayer;
  title: string;
  simpleExplanation: string;
  status: ReasoningNodeStatus;
  knowledgeReferences: KnowledgeReference[];
  evidenceUsed: EvidenceReference[];
  ruleReferences: string[];
  technicalDetails?: Record<string, unknown>;
  result?: Record<string, unknown>;
  timestamp: string;
}

export interface SimulationState {
  id: string;
  domainId: string;
  problemSignatureId: string;
  scenarioId?: string;
  status: 'active' | 'completed' | 'referred';
  currentStep: number;
  diagnosticProfile: DiagnosticProfile;
  activeInterventionId?: string;
  interventionHistory: Array<{
    interventionId: string;
    interventionName: string;
    attempts: number;
    response: InterventionResponse;
    timestamp: string;
  }>;
  nodes: ReasoningNode[];
  finalDecision?: DecisionResult;
  teacherHandoffRecord?: TeacherHandoffRecord;
  createdAt: string;
  updatedAt: string;
}

export interface StartSimulationRequest {
  domainId: string;
  problemSignatureId: string;
  scenarioId?: string;
  customContext?: Record<string, unknown>;
}

export interface ApplyInterventionRequest {
  interventionId: string;
  learnerChoice?: string;
  rationale?: string;
}

export interface RecordResponseRequest {
  responsePattern:
    | 'response_a_shadow_improved'
    | 'response_b_slow_tempo_improved'
    | 'response_c_complex_rhythm_remains'
    | 'response_d_persistent_local_notes'
    | 'response_e_sparse_click_unstable';
  accuracyPercent?: number;
  learnerSelfReport?: string;
  attemptCount?: number;
}

export interface CodingAgentInstructions {
  title: string;
  generatedAt: string;
  problemSignatureId: string;
  domainId: string;
  summary: string;
  diagnosticContext: {
    leadingHypotheses: string[];
    evidenceSummary: string[];
  };
  reasoningTraceSteps: Array<{
    layer: AIPCLayer;
    title: string;
    explanation: string;
    rulesUsed: string[];
  }>;
  developerNotes: string[];
  instructionsMarkdown: string;
}
