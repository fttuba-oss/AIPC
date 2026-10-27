import { DomainRegistry } from '../registry/DomainRegistry';
import { LayerRegistry } from '../registry/LayerRegistry';
import type { SimulationState } from '../types/simulation';

export interface ValidationResult {
  isValid: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedDomainsCount: number;
  checkedRecordsCount: number;
}

export class KnowledgeValidator {
  /**
   * Performs full static validation of the AIPC Knowledgebase.
   */
  public static validateAll(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const domains = DomainRegistry.getAllDomains();
    const records = DomainRegistry.getAllRecords();
    const recordIds = new Set(records.map(r => r.id));

    // 1. Validate Implemented vs Placeholder Domains
    domains.forEach(domain => {
      if (domain.status === 'placeholder') {
        // Placeholder domains must contain no fabricated records
        if (domain.problemSignatureIds.length > 0) {
          errors.push(`Placeholder domain '${domain.id}' contains fabricated problemSignatureIds.`);
        }
        if (domain.capacityIds.length > 0) {
          errors.push(`Placeholder domain '${domain.id}' contains fabricated capacityIds.`);
        }
        if (domain.diagnosticInterventionIds.length > 0) {
          errors.push(`Placeholder domain '${domain.id}' contains fabricated diagnosticInterventionIds.`);
        }
      } else if (domain.status === 'implemented') {
        // Implemented domain must have valid non-empty collections
        if (domain.problemSignatureIds.length === 0) {
          errors.push(`Implemented domain '${domain.id}' is missing problem signatures.`);
        }
        if (domain.capacityIds.length === 0) {
          errors.push(`Implemented domain '${domain.id}' is missing capacity definitions.`);
        }
        if (domain.diagnosticInterventionIds.length === 0) {
          errors.push(`Implemented domain '${domain.id}' is missing diagnostic interventions.`);
        }
        if (domain.responseRuleIds.length === 0) {
          errors.push(`Implemented domain '${domain.id}' is missing response rules.`);
        }
        if (domain.referralRuleIds.length === 0) {
          errors.push(`Implemented domain '${domain.id}' is missing referral rules.`);
        }

        // Check that referenced IDs exist in the record index
        domain.problemSignatureIds.forEach(id => {
          if (!recordIds.has(id)) {
            errors.push(`Problem signature ID '${id}' referenced in domain '${domain.id}' not found in record index.`);
          }
        });

        domain.capacityIds.forEach(id => {
          if (!recordIds.has(id)) {
            errors.push(`Capacity ID '${id}' referenced in domain '${domain.id}' not found in record index.`);
          }
        });

        domain.diagnosticInterventionIds.forEach(id => {
          if (!recordIds.has(id)) {
            errors.push(`Diagnostic intervention ID '${id}' referenced in domain '${domain.id}' not found in record index.`);
          }
        });
      }
    });

    // 2. Validate Layer Definitions (Diagnosis, Strategy, Guide)
    const layers = LayerRegistry.getAllLayers();
    if (layers.length !== 3) {
      errors.push(`Expected exactly 3 AIPC layers (Diagnosis, Strategy, Guide), found ${layers.length}.`);
    }

    // 3. Validate Referral Rules have attempt limits
    const referralRule = DomainRegistry.getRecord('RULE-REF-ATTEMPT-LIMIT-3');
    if (!referralRule) {
      errors.push(`Mandatory referral rule 'RULE-REF-ATTEMPT-LIMIT-3' not found in registry.`);
    } else {
      const maxAtt = (referralRule.technicalDetails as any)?.maxAttempts;
      if (!maxAtt || maxAtt > 3) {
        errors.push(`Referral rule 'RULE-REF-ATTEMPT-LIMIT-3' must enforce maximum 2-3 attempt limit. Found: ${maxAtt}`);
      }
    }

    return {
      isValid: errors.length === 0,
      valid: errors.length === 0,
      errors,
      warnings,
      checkedDomainsCount: domains.length,
      checkedRecordsCount: records.length,
    };
  }

  /**
   * Validates an active simulation trace to ensure pedagogical compliance.
   */
  public static validateSimulationTrace(sim: SimulationState): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check that simulation domain is not a placeholder
    const domain = DomainRegistry.getDomain(sim.domainId);
    if (domain?.status === 'placeholder') {
      errors.push(`Simulation executed on placeholder domain '${sim.domainId}'. Placeholders must not execute live decisions.`);
    }

    // Check reasoning nodes
    sim.nodes.forEach((node, idx) => {
      // Must have knowledge or rule reference
      const hasKnowledgeRef = node.knowledgeReferences && node.knowledgeReferences.length > 0;
      const hasRuleRef = node.ruleReferences && node.ruleReferences.length > 0;

      if (!hasKnowledgeRef && !hasRuleRef) {
        errors.push(`Reasoning Node ${idx + 1} ('${node.title}') lacks both knowledge references and rule references.`);
      }

      // Layer check
      if (!['observe', 'diagnose', 'intervene', 'guide_evaluate_adapt'].includes(node.layer)) {
        errors.push(`Reasoning Node ${idx + 1} has invalid layer '${node.layer}'.`);
      }
    });

    return {
      isValid: errors.length === 0,
      valid: errors.length === 0,
      errors,
      warnings,
      checkedDomainsCount: 1,
      checkedRecordsCount: sim.nodes.length,
    };
  }
}
