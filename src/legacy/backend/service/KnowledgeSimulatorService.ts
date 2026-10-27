import { DomainRegistry } from '../registry/DomainRegistry';
import { LayerRegistry } from '../registry/LayerRegistry';
import { ReasoningSimulatorEngine } from '../simulation/ReasoningSimulatorEngine';
import { KnowledgeValidator, type ValidationResult } from '../validation/KnowledgeValidator';
import type {
  KnowledgeDomain,
  AIPCLayer,
  AIPCLayerDefinition,
  GenericKnowledgeRecord,
  KnowledgeNote
} from '../types/knowledge';
import type {
  SimulationState,
  StartSimulationRequest,
  ApplyInterventionRequest,
  RecordResponseRequest,
  CodingAgentInstructions
} from '../types/simulation';

export class KnowledgeSimulatorService {
  /**
   * GET /knowledge/domains
   */
  public static getDomains(): KnowledgeDomain[] {
    return DomainRegistry.getAllDomains();
  }

  public static listDomains(): KnowledgeDomain[] {
    return this.getDomains();
  }

  /**
   * GET /knowledge/domains/:domainId
   */
  public static getDomain(domainId: string): KnowledgeDomain | undefined {
    return DomainRegistry.getDomain(domainId);
  }

  public static getRecordsByDomain(domainId: string): GenericKnowledgeRecord[] {
    return DomainRegistry.getRecordsByDomain(domainId);
  }

  /**
   * GET /knowledge/layers
   */
  public static getLayers(): AIPCLayerDefinition[] {
    return LayerRegistry.getAllLayers();
  }

  public static listLayers(): AIPCLayerDefinition[] {
    return this.getLayers();
  }

  /**
   * GET /knowledge/layers/:layerId
   */
  public static getLayer(layerId: AIPCLayer): AIPCLayerDefinition | undefined {
    return LayerRegistry.getLayer(layerId);
  }

  /**
   * GET /knowledge/records/:recordId
   */
  public static getRecord(recordId: string): GenericKnowledgeRecord | undefined {
    return DomainRegistry.getRecord(recordId);
  }

  /**
   * GET /simulations/problem-signatures
   */
  public static getProblemSignatures(domainId?: string): GenericKnowledgeRecord[] {
    const all = DomainRegistry.getAllRecords();
    return all.filter(r => r.type === 'problem_signature' && (!domainId || r.domainId === domainId));
  }

  /**
   * POST /simulations/start
   */
  public static startSimulation(request: StartSimulationRequest): SimulationState {
    return ReasoningSimulatorEngine.startSimulation(request);
  }

  /**
   * POST /simulations/:simulationId/apply-intervention
   */
  public static applyIntervention(
    simulationId: string,
    request: ApplyInterventionRequest
  ): SimulationState {
    return ReasoningSimulatorEngine.applyIntervention(simulationId, request);
  }

  /**
   * POST /simulations/:simulationId/record-response
   */
  public static recordResponse(
    simulationId: string,
    request: RecordResponseRequest
  ): SimulationState {
    return ReasoningSimulatorEngine.recordResponse(simulationId, request);
  }

  /**
   * GET /simulations/:simulationId/trace
   */
  public static getSimulationTrace(simulationId: string): SimulationState | undefined {
    return ReasoningSimulatorEngine.getSimulationTrace(simulationId);
  }

  /**
   * Notes & Annotations
   */
  public static saveNote(
    targetId: string,
    author: string,
    noteText: string,
    tags?: string[]
  ): KnowledgeNote {
    return ReasoningSimulatorEngine.saveNote(targetId, author, noteText, tags);
  }

  public static getNotes(targetId?: string): KnowledgeNote[] {
    return ReasoningSimulatorEngine.getNotes(targetId);
  }

  /**
   * Formats structured instructions for AI coding agents
   */
  public static generateCodingInstructions(simulationId: string): CodingAgentInstructions {
    return ReasoningSimulatorEngine.generateCodingInstructions(simulationId);
  }

  /**
   * Validates knowledge integrity and references
   */
  public static validate(): ValidationResult {
    return KnowledgeValidator.validateAll();
  }

  public static validateKnowledgebase(): ValidationResult {
    return this.validate();
  }
}
