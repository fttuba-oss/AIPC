/**
 * ResponseInterpreter: Interprets learner attempts following an intervention.
 * Classifies the InterventionResponse, extracts DiagnosticEvidence, and updates
 * the multi-label DiagnosticProfile.
 *
 * Implements AIPC Rhythm Diagnostic & Intervention Refactor Spec v1.0, Section 4.2.
 */

import {
  DiagnosticProfile,
  InterventionResponse,
  DiagnosticEvidence,
  EvidenceDirection
} from '../types/diagnosticProfile';
import { DiagnosticInterventionRegistry } from '../registry/DiagnosticInterventionRegistry';

export interface PerformanceMetricsSnapshot {
  accuracyRate: number;
  variabilityMs?: number;
  driftSlope?: number;
  asynchronyMs?: number;
  tiedNotesErrorCount?: number;
  transitionErrorCount?: number;
  totalNotes?: number;
}

export interface InterpretedResponseResult {
  responseType: InterventionResponse;
  evidenceGenerated: DiagnosticEvidence[];
  updatedProfile: DiagnosticProfile;
  summary: string;
}

export class ResponseInterpreter {
  /**
   * Evaluates attempt metrics against baseline and reflection to interpret the diagnostic outcome.
   */
  public static interpret(
    interventionId: string,
    baseline: PerformanceMetricsSnapshot,
    attempt: PerformanceMetricsSnapshot,
    currentProfile: DiagnosticProfile,
    qualitativeReflection?: string
  ): InterpretedResponseResult {
    // 1. Classify Response
    const responseType = this.classifyResponse(baseline, attempt, qualitativeReflection);

    // 2. Query DiagnosticInterventionRegistry for matching rules
    const def = DiagnosticInterventionRegistry.get(interventionId);
    const matchingRule = def?.expectedResponses.find(r => r.responseType === responseType);

    // 3. Generate Diagnostic Evidence
    const evidenceGenerated: DiagnosticEvidence[] = [];
    const timestamp = new Date().toISOString();

    if (matchingRule) {
      for (const update of matchingRule.evidenceUpdates) {
        evidenceGenerated.push({
          id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          source: 'diagnostic_intervention',
          interventionId,
          capacityId: update.capacityId,
          direction: update.direction,
          weight: update.weight,
          observation: update.observation,
          metrics: {
            beforeValue: baseline.accuracyRate,
            afterValue: attempt.accuracyRate,
          },
          createdAt: timestamp,
        });
      }
    } else {
      // Fallback canonical evidence generation
      const defaultDirection: EvidenceDirection = 
        responseType === 'substantial_repeated_improvement' || responseType === 'partial_improvement'
          ? 'strengthens'
          : responseType === 'no_meaningful_change' || responseType === 'worsened'
          ? 'weakens'
          : 'neutral';

      const candidateCap = def?.candidateCapacities[0] || 'RC05';
      evidenceGenerated.push({
        id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        source: 'diagnostic_intervention',
        interventionId,
        capacityId: candidateCap,
        direction: defaultDirection,
        weight: 1.0,
        observation: `Intervention ${interventionId} yielded response: ${responseType} (${Math.round(attempt.accuracyRate * 100)}% accuracy vs baseline ${Math.round(baseline.accuracyRate * 100)}%).`,
        metrics: {
          beforeValue: baseline.accuracyRate,
          afterValue: attempt.accuracyRate,
        },
        createdAt: timestamp,
      });
    }

    // 4. Update Hypotheses in DiagnosticProfile
    const updatedProfile = this.applyEvidenceToProfile(currentProfile, evidenceGenerated);

    // 5. Generate human-readable summary
    const accDelta = Math.round((attempt.accuracyRate - baseline.accuracyRate) * 100);
    const summary = `Intervention [${interventionId}] result: ${responseType.replace(/_/g, ' ')} (${accDelta >= 0 ? '+' : ''}${accDelta}% accuracy). ${evidenceGenerated.map(e => e.observation).join(' ')}`;

    return {
      responseType,
      evidenceGenerated,
      updatedProfile,
      summary,
    };
  }

  /**
   * Compares metrics and reflection to determine response classification.
   */
  private static classifyResponse(
    baseline: PerformanceMetricsSnapshot,
    attempt: PerformanceMetricsSnapshot,
    reflection?: string
  ): InterventionResponse {
    const accDelta = attempt.accuracyRate - baseline.accuracyRate;
    const varDelta = (baseline.variabilityMs ?? 0) - (attempt.variabilityMs ?? 0); // positive is good
    const ref = (reflection || '').toLowerCase();

    // Check reflection cues first
    if (ref.includes('stumble') || ref.includes('stuck') || (attempt.transitionErrorCount ?? 0) > 0 && attempt.accuracyRate >= 0.75) {
      return 'persistent_local_note_error';
    }

    if (attempt.accuracyRate >= 0.90 || accDelta >= 0.25) {
      return 'substantial_repeated_improvement';
    }

    if (accDelta >= 0.08 || varDelta > 10) {
      return 'partial_improvement';
    }

    if (accDelta <= -0.15 || ref.includes('stiff')) {
      return 'worsened';
    }

    return 'no_meaningful_change';
  }

  /**
   * Updates hypotheses in DiagnosticProfile.
   */
  private static applyEvidenceToProfile(
    profile: DiagnosticProfile,
    newEvidence: DiagnosticEvidence[]
  ): DiagnosticProfile {
    const updatedHypotheses = profile.hypotheses.map(h => {
      let score = h.evidenceScore;
      const supIds = [...h.supportingEvidenceIds];
      const conIds = [...h.conflictingEvidenceIds];

      for (const ev of newEvidence) {
        if (ev.capacityId === h.capacityId) {
          if (ev.direction === 'strengthens') {
            score = Math.min(5.0, score + 0.8 * ev.weight);
            supIds.push(ev.id);
          } else if (ev.direction === 'weakens') {
            score = Math.max(0.0, score - 0.8 * ev.weight);
            conIds.push(ev.id);
          }
        }
      }

      let status = h.status;
      if (score >= 3.8) status = 'leading';
      else if (score <= 1.2) status = 'reduced';
      else status = 'possible';

      let confidence: 'low' | 'moderate' | 'high' = 'moderate';
      if (supIds.length + conIds.length >= 3) confidence = 'high';
      else if (supIds.length + conIds.length <= 1) confidence = 'low';

      return {
        ...h,
        evidenceScore: parseFloat(score.toFixed(2)),
        confidence,
        status,
        supportingEvidenceIds: supIds,
        conflictingEvidenceIds: conIds,
      };
    });

    return {
      ...profile,
      hypotheses: updatedHypotheses,
      evidence: [...profile.evidence, ...newEvidence],
      updatedAt: new Date().toISOString(),
    };
  }
}
