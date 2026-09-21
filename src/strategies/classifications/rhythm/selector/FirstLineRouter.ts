/**
 * FirstLineRouter: Evaluates whether a student should be routed to a Targeted Bypass
 * or to the General Front Door Learner Choice (Option A: Shadow Fingering vs Option B: -20 BPM Strong Click).
 *
 * Implements AIPC Rhythm Diagnostic & Intervention Refactor Spec v1.0, Section 4.1.
 */

import { DiagnosticProfile } from '../types/diagnosticProfile';

export interface FirstLineRecommendation {
  routeType: 'targeted_bypass' | 'general_choice' | 'system_recommended';
  primaryStrategyId: string;
  alternativeStrategyId?: string; // For general_choice
  rationale: string;
  recommendedChoice?: string;     // If general_choice, which option AIPC nudges toward
  confidence: number;
}

export interface ScoreFeatureContext {
  xmlContent?: string;
  measureRange?: [number, number];
  tempoBpm?: number;
  hasTiesOrSyncopation?: boolean;
  hasCrossRhythm?: boolean;
  transitionBottleneck?: boolean;
}

export interface BaselineAttemptMetrics {
  accuracyRate?: number;
  driftSlope?: number;
  variabilityMs?: number;
  tiedNotesErrorRate?: number;
  transitionErrorRate?: number;
  speedRatio?: number; // e.g. target vs slow tempo error ratio
}

export interface TeacherConstraints {
  preferredFirstLine?: string;
  disallowBypass?: boolean;
  forcedStrategyId?: string;
}

export class FirstLineRouter {
  /**
   * Evaluates diagnostic triggers and performance metrics to determine the first-line routing.
   */
  public static evaluateRoute(
    signatureId: string,
    scoreContext?: ScoreFeatureContext,
    baselineMetrics?: BaselineAttemptMetrics,
    teacherConstraints?: TeacherConstraints,
    _existingProfile?: DiagnosticProfile
  ): FirstLineRecommendation {
    // 0. Check teacher override
    if (teacherConstraints?.forcedStrategyId) {
      return {
        routeType: 'system_recommended',
        primaryStrategyId: teacherConstraints.forcedStrategyId,
        rationale: `Teacher assigned strategy ${teacherConstraints.forcedStrategyId} as direct intervention.`,
        confidence: 1.0,
      };
    }

    const sig = (signatureId || '').toUpperCase();
    const tiesRate = baselineMetrics?.tiedNotesErrorRate ?? 0;
    const transRate = baselineMetrics?.transitionErrorRate ?? 0;
    const disallowBypass = teacherConstraints?.disallowBypass ?? false;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. TARGETED BYPASS RULES (Section 4.1)
    // ──────────────────────────────────────────────────────────────────────────
    if (!disallowBypass) {
      // Rule 1.1: Ties / Syncopation Failures
      // If onset error clusters >= 70% at tied/syncopated notes (or signature is PS-SYNCOP-01)
      if (sig.includes('SYNCOP') || tiesRate >= 0.70 || scoreContext?.hasTiesOrSyncopation && tiesRate >= 0.50) {
        return {
          routeType: 'targeted_bypass',
          primaryStrategyId: 'R20', // Ghost Beat / X-Ray Rhythm
          rationale: 'High concentration of timing errors clustered at tied notes and syncopated offbeats. Bypassing directly to Ghost Beat (R20) to reconstruct metrical downbeat hierarchy.',
          confidence: 0.90,
        };
      }

      // Rule 1.2: Local Transition Bottleneck Failures
      // If >= 80% of timing errors occur across a specific 2-note transition while rest of bar is stable
      if (transRate >= 0.80 || scoreContext?.transitionBottleneck) {
        return {
          routeType: 'targeted_bypass',
          primaryStrategyId: 'R16', // Transition Isolation & Chunking
          rationale: 'Errors are concentrated across a single technical or register transition bottleneck. Bypassing directly to Transition Isolation (R16).',
          confidence: 0.88,
        };
      }

      // Rule 1.3: Polyrhythmic Coupling / Cross-Rhythm
      if (sig.includes('CROSS') || scoreContext?.hasCrossRhythm) {
        return {
          routeType: 'targeted_bypass',
          primaryStrategyId: 'R37', // Polyrhythm Phase Wheel
          alternativeStrategyId: 'R33', // LCM Grid
          rationale: 'Polyrhythmic layers show motor assimilation. Bypassing directly to Polyrhythm Phase Wheel (R37) / Common Subdivision Grid (R33).',
          confidence: 0.92,
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. GENERAL FRONT DOOR (Learner Choice)
    // ──────────────────────────────────────────────────────────────────────────
    // For all other rhythm signatures (PS-RUSH-01, PS-DRAG-01, PS-SUBDIV-01, PS-EXEC-01)
    // Present Option A (DI-REF-SHADOW-01) vs Option B (DI-SLOW-CLICK-01) with AIPC nudge.

    let recommendedChoice = 'DI-REF-SHADOW-01';
    let rationale = '';

    const isVelocityOrDrift = 
      sig.includes('RUSH') || 
      sig.includes('DRAG') || 
      sig.includes('EXEC') || 
      (baselineMetrics?.driftSlope !== undefined && Math.abs(baselineMetrics.driftSlope) > 0.05);

    const isSyntaxOrSubdiv = 
      sig.includes('SUBDIV') || 
      (baselineMetrics?.variabilityMs !== undefined && baselineMetrics.variabilityMs > 35);

    if (isVelocityOrDrift && !isSyntaxOrSubdiv) {
      recommendedChoice = 'DI-SLOW-CLICK-01';
      rationale = 'Timing instability correlates with tempo rush/drag. AIPC suggests slowing down by 20 BPM with a strong click (Option B) to expand the neuromuscular timing window, but you may also choose Option A.';
    } else {
      recommendedChoice = 'DI-REF-SHADOW-01';
      rationale = 'Timing errors show rhythmic syntax or durational uncertainty. AIPC suggests listening to the reference audio while shadow-fingering silently (Option A) to reinforce perceptual mental imagery, but you may also choose Option B.';
    }

    // Check teacher preferred choice
    if (teacherConstraints?.preferredFirstLine) {
      recommendedChoice = teacherConstraints.preferredFirstLine;
      rationale += ` (Teacher preference: ${recommendedChoice})`;
    }

    return {
      routeType: 'general_choice',
      primaryStrategyId: 'DI-REF-SHADOW-01',
      alternativeStrategyId: 'DI-SLOW-CLICK-01',
      recommendedChoice,
      rationale,
      confidence: 0.75,
    };
  }
}
