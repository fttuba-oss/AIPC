import { BaseStrategy, MusicalScoreContext } from '../../../core/base/BaseStrategy';
import { 
  GenericProblemSignature, 
  GenericHypothesis, 
  DiagnosticEvidence,
  StrategyExecutionRecord 
} from '../../../core/types/strategy';
import { RhythmStrategyRegistry } from '../registry/RhythmStrategyRegistry';
import { ReferenceAudioStrategy } from '../strategies/ReferenceAudioStrategy';
import { TempoLadderStrategy } from '../strategies/TempoLadderStrategy';
import { ExplicitSubdivisionStrategy } from '../strategies/ExplicitSubdivisionStrategy';
import { SinglePitchReductionStrategy } from '../strategies/SinglePitchReductionStrategy';
import { TransitionIsolationStrategy } from '../strategies/TransitionIsolationStrategy';
import { BurstPracticeStrategy } from '../strategies/BurstPracticeStrategy';
import { RhythmicVariationStrategy } from '../strategies/RhythmicVariationStrategy';
import { 
  FullMetronomeStrategy, 
  SparseMetronomeStrategy, 
  GapClickStrategy, 
  SynchronisationContinuationStrategy, 
  GhostBeatStrategy 
} from '../strategies/PulseStrategies';
import {
  CommonSubdivisionGridStrategy,
  CoincidenceAnchoringStrategy,
  LayerAlternationExchangeStrategy,
  BeatPlusCounterRhythmStrategy,
  PolyrhythmWheelStrategy,
  AsymmetricAdditiveStrategy
} from '../strategies/CrossRhythmStrategies';


export interface StrategySelectorContext {
  musicalContext?: MusicalScoreContext;
  diagnosticEvidence?: DiagnosticEvidence;
  targetTempoBpm?: number;
  stableTempoBpm?: number;
  previousInterventionResults?: StrategyExecutionRecord[];
}

export interface DetailedSelectionResult {
  selectedStrategy: BaseStrategy;
  reason: string;
  viableAlternatives: Array<{ strategyId: string; name: string; reason: string }>;
}

/**
 * RhythmStrategySelector implements multi-factor evidence-based strategy routing (AIPC v0.3).
 *
 * Replaces direct "problem signature -> fixed intervention" with:
 * "problem signature + diagnostic evidence + passage context -> hypothesis update -> selected strategy + alternatives"
 */
export class RhythmStrategySelector {
  public select(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    context?: StrategySelectorContext
  ): BaseStrategy {
    return this.selectDetailed(signature, hypothesis, context).selectedStrategy;
  }

  public selectDetailed(
    signature: GenericProblemSignature,
    hypothesis: GenericHypothesis,
    context?: StrategySelectorContext
  ): DetailedSelectionResult {
    const signatureId = (signature.id || (signature as any).signatureId || '').toLowerCase();
    const signatureLabel = (signature.label || (signature as any).name || '').toLowerCase();
    const capacityId = (hypothesis.capacityId || '').toUpperCase();
    const evidence = context?.diagnosticEvidence || {};
    const targetBpm = context?.targetTempoBpm || context?.musicalContext?.tempoBpm || 120;
    const stableBpm = context?.stableTempoBpm;
    const prevResults = context?.previousInterventionResults || [];

    // Check previous intervention chaining
    const prevStrategyIds = prevResults.map(r => r.strategyId);

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 1: Instrument-Only Breakdown / Instrumental Execution Load (RC08)
    // Differentiates based on evidence contrast:
    // A. Specific transition fails even slowly -> Transition Isolation
    // B. Passage succeeds slowly but fails near target tempo -> Tempo Ladder
    // C. Single pitch succeeds, melody fails -> Single-Pitch Reduction
    // D. Short bursts succeed at tempo, long span fails -> Burst Practice
    // ──────────────────────────────────────────────────────────────────────────
    if (capacityId === 'RC08' || signatureId.includes('exec') || signatureLabel.includes('instrument')) {
      // Case A: Specific transition failure
      if (evidence.isTransitionSpecific || (evidence.transitionSpecificFailures && evidence.transitionSpecificFailures.length > 0)) {
        return {
          selectedStrategy: new TransitionIsolationStrategy(),
          reason: 'Diagnostic evidence isolates errors to a specific fingering/register transition bottleneck.',
          viableAlternatives: [
            { strategyId: 'R03', name: 'Single-Pitch Reduction', reason: 'If fingering isolation alone does not resolve tension.' },
            { strategyId: 'R22', name: 'Tempo Ladder', reason: 'Rebuild tempo once transition loop is automated.' },
          ],
        };
      }

      // Case B: Tempo-dependent execution collapse (stable slowly, fails at speed)
      if (evidence.isTempoDependent || (evidence.timingVariabilitySlowVsTarget && evidence.timingVariabilitySlowVsTarget.targetMs > evidence.timingVariabilitySlowVsTarget.slowMs * 1.5)) {
        const initialStable = stableBpm || (evidence.timingVariabilitySlowVsTarget ? 88 : Math.round(targetBpm * 0.70));
        return {
          selectedStrategy: new TempoLadderStrategy({ targetBpm, initialStableBpm: initialStable }),
          reason: 'Passage is stable at lower tempos but breaks down near target tempo; systematically rebuild tempo demand.',
          viableAlternatives: [
            { strategyId: 'R23', name: 'Burst Practice', reason: 'High-speed motor training in short isolated bursts.' },
            { strategyId: 'R16', name: 'Transition Isolation', reason: 'If a hidden transition bottleneck is identified during ladder progression.' },
          ],
        };
      }

      // Case C: Single pitch works, melody fails
      if (evidence.singlePitchVsMelody && evidence.singlePitchVsMelody.singlePitchAcc > 0.85 && evidence.singlePitchVsMelody.melodyAcc < 0.65) {
        return {
          selectedStrategy: new SinglePitchReductionStrategy(),
          reason: 'Student claps and plays rhythm accurately on a single pitch, but melodic intervals cause coordination load.',
          viableAlternatives: [
            { strategyId: 'R16', name: 'Transition Isolation', reason: 'Isolate specific melodic shifts.' },
            { strategyId: 'R22', name: 'Tempo Ladder', reason: 'Reintegrate pitches at reduced tempo.' },
          ],
        };
      }

      // Case D: Short cells succeed at speed, long continuous span fails
      if (evidence.measurements?.burstAccuracy && Number(evidence.measurements.burstAccuracy) > 0.85) {
        return {
          selectedStrategy: new BurstPracticeStrategy(),
          reason: 'Short cells succeed at target speed, but continuous phrase execution triggers fatigue or tension.',
          viableAlternatives: [
            { strategyId: 'R22', name: 'Tempo Ladder', reason: 'Whole-phrase practice starting slower.' },
          ],
        };
      }

      // Default RC08 fallback: Single-Pitch Reduction or Tempo Ladder
      if (prevStrategyIds.includes('R18') || prevStrategyIds.includes('R03')) {
        return {
          selectedStrategy: new TempoLadderStrategy({ targetBpm, initialStableBpm: stableBpm || Math.round(targetBpm * 0.75) }),
          reason: 'Representation/pitch reduction verified; advancing to tempo ladder integration.',
          viableAlternatives: [
            { strategyId: 'R16', name: 'Transition Isolation', reason: 'If bottlenecks persist.' },
          ],
        };
      }

      return {
        selectedStrategy: new SinglePitchReductionStrategy(),
        reason: 'Instrumental coordination load identified; remove pitch complexity before rebuilding melody.',
        viableAlternatives: [
          { strategyId: 'R16', name: 'Transition Isolation', reason: 'Focus on localized transition shifts.' },
          { strategyId: 'R22', name: 'Tempo Ladder', reason: 'Slow practice ladder with full melody.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 2: Uneven Subdivision (RC04, RC05)
    // A. Representation weak (echo inaccurate) -> Reference Audio / Listen-Echo
    // B. Temporal grid weak (echo accurate, grid unstable) -> Explicit Subdivision
    // C. Speed-dependent -> Tempo Ladder
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('subdiv') || signatureLabel.includes('subdivision')) {
      if (evidence.representationEchoAccurate === false) {
        return {
          selectedStrategy: new ReferenceAudioStrategy('listen_echo', 'intervention'),
          reason: 'Learner cannot accurately echo or audiate the subdivision pattern; establish auditory mental model first.',
          viableAlternatives: [
            { strategyId: 'R07', name: 'Explicit Subdivision', reason: 'Layer audible micro-grid once pattern is heard.' },
          ],
        };
      }

      if (evidence.isTempoDependent) {
        return {
          selectedStrategy: new TempoLadderStrategy({ targetBpm, initialStableBpm: stableBpm || Math.round(targetBpm * 0.70) }),
          reason: 'Subdivision evenness degrades specifically at high velocity; rebuild tempo demand.',
          viableAlternatives: [
            { strategyId: 'R07', name: 'Explicit Subdivision', reason: 'Retain subdivision click at higher tempos.' },
          ],
        };
      }

      // Default RC04: Explicit Subdivision
      return {
        selectedStrategy: new ExplicitSubdivisionStrategy(),
        reason: 'Internal subdivision grid is uneven; provide explicit acoustic micro-grid and progressively fade support.',
        viableAlternatives: [
          { strategyId: 'R18', name: 'Reference Audio / Listen-Echo', reason: 'If aural model is needed.' },
          { strategyId: 'R24', name: 'Rhythmic Variation', reason: 'Dotted practice to stabilize finger landing.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 3: Drift After Click Removal (RC03, RC02)
    // Stable with click, drifts in silence -> Gap Click (or Sync-Continuation)
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('drift') || signatureId.includes('gap') || signatureLabel.includes('drift')) {
      if (evidence.measurements?.preferContinuation) {
        return {
          selectedStrategy: new SynchronisationContinuationStrategy(),
          reason: 'Evaluate and train endogenous pacemaker continuation over extended unassisted phrases.',
          viableAlternatives: [
            { strategyId: 'R12', name: 'Gap-Click Practice', reason: 'Periodic click re-entry check.' },
          ],
        };
      }

      return {
        selectedStrategy: new GapClickStrategy(),
        reason: 'Student relies on continuous external click; progressively lengthen silent intervals to train internal timekeeper.',
        viableAlternatives: [
          { strategyId: 'R11', name: 'Sparse Metronome', reason: 'Downbeat-only anchor before full silence.' },
          { strategyId: 'R13', name: 'Synchronisation-Continuation', reason: 'Long unassisted continuation trials.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 4: Beat Loss Across Syncopation / Ties (RC06, RC04)
    // A. Aural representation missing -> Reference Audio
    // B. Default -> Ghost Beat / X-Ray Rhythm
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('syncop') || signatureId.includes('tie') || capacityId === 'RC06' || signatureLabel.includes('syncopation')) {
      if (evidence.representationEchoAccurate === false) {
        return {
          selectedStrategy: new ReferenceAudioStrategy('reference_model', 'intervention'),
          reason: 'Syncopated contour is unfamiliar to learner; demonstrate auditory reference before metric scaffolding.',
          viableAlternatives: [
            { strategyId: 'R20', name: 'Ghost Beat / X-Ray Rhythm', reason: 'Sound hidden beats inside tied durations.' },
          ],
        };
      }

      return {
        selectedStrategy: new GhostBeatStrategy(),
        reason: 'Errors cluster after tied downbeats; make latent metric lattice audible with ghost beats, then progressively fade.',
        viableAlternatives: [
          { strategyId: 'R11', name: 'Sparse Metronome', reason: 'Downbeat anchor clicks.' },
          { strategyId: 'R07', name: 'Explicit Subdivision', reason: 'Subdivision grid through the tie.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 5: Progressive Rushing (RC03, RC08)
    // If RC08 evidence -> Single-Pitch or Tempo Ladder
    // If RC03 evidence -> Gap Click, Sparse Metronome, or Full Metronome
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('rush') || signatureLabel.includes('rushing')) {
      if (evidence.singlePitchVsMelody && evidence.singlePitchVsMelody.singlePitchAcc > 0.85 && evidence.singlePitchVsMelody.melodyAcc < 0.65) {
        return {
          selectedStrategy: new SinglePitchReductionStrategy(),
          reason: 'Rushing disappears on a single pitch; timing collapse is caused by instrumental fingering tension.',
          viableAlternatives: [
            { strategyId: 'R22', name: 'Tempo Ladder', reason: 'Rebuild tempo with relaxed technique.' },
            { strategyId: 'R12', name: 'Gap-Click Practice', reason: 'Internal pulse stabilization.' },
          ],
        };
      }

      // Default RC03: Pulse stabilization via Gap Click or Sparse Metronome
      return {
        selectedStrategy: new GapClickStrategy(),
        reason: 'Progressive rushing is driven by internal pulse instability (RC03); train autonomous pacemaker via silent gaps.',
        viableAlternatives: [
          { strategyId: 'R11', name: 'Sparse Metronome', reason: 'Downbeat-only anchor clicks.' },
          { strategyId: 'R10', name: 'Full Metronome', reason: 'Continuous click grounding.' },
          { strategyId: 'R03', name: 'Single-Pitch Reduction', reason: 'If instrumental load contributes to rushing.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 6: Polyrhythmic Motor Assimilation (PS-POLY-ASSIM-01, RC11)
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('assim') || signatureId.includes('poly') || signatureLabel.includes('polyrhythm') || signatureLabel.includes('assimilation')) {
      return {
        selectedStrategy: new CommonSubdivisionGridStrategy([3, 2]),
        reason: 'Non-coincident attacks in coprime ratio pull toward false synchrony (motor coupling); anchor attacks onto shared LCM subdivision lattice.',
        viableAlternatives: [
          { strategyId: 'R34', name: 'Coincidence Anchoring', reason: 'Emphasize downbeat anchor before rotating phase.' },
          { strategyId: 'R37', name: 'Phase Wheel Visualization', reason: 'Visual spatialization of concentric periodic cycles.' },
          { strategyId: 'R35', name: 'Layer Alternation', reason: 'If motor coupling prevents simultaneous execution.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 7: Cross-Rhythm Attentional Capture / Reference Beat Loss (PS-CROSS-CAP-01, RC12)
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('cross') || signatureId.includes('capture') || signatureLabel.includes('capture') || signatureLabel.includes('cross-rhythm')) {
      return {
        selectedStrategy: new BeatPlusCounterRhythmStrategy(),
        reason: 'Counter-rhythm usurps the listener/performer pulse; anchor primary metre through embodied gross motor stepping while isolating counter-rhythm.',
        viableAlternatives: [
          { strategyId: 'R35', name: 'Layer Alternation', reason: 'Alternating cycles between reference and counter stream.' },
          { strategyId: 'R10', name: 'Full Metronome', reason: 'External acoustic beat grounding.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 8: Polyrhythmic Stream Disintegration / Shuffle Collapse (PS-POLY-SHUF-01)
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('shuf') || signatureLabel.includes('shuffle')) {
      return {
        selectedStrategy: new LayerAlternationExchangeStrategy(),
        reason: 'Combined streams collapse into an uneven single-voice shuffle; practice layer alternation and limb exchange to build independent motor programs.',
        viableAlternatives: [
          { strategyId: 'R33', name: 'Common Subdivision Grid', reason: 'Reconstruct exact mathematical spacing on LCM grid.' },
          { strategyId: 'R37', name: 'Phase Wheel Visualization', reason: 'Visual verification of continuous stream rotation.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 9: Hemiola Metric Fluctuation (PS-HEMIOLA-DISP-01)
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('hemiola') || signatureLabel.includes('hemiola')) {
      return {
        selectedStrategy: new BeatPlusCounterRhythmStrategy(),
        reason: 'Pulse fluctuates during 3:2 hemiola re-grouping across measure boundaries; ground the underlying macro-metre while conducting 3-pulse phrasing.',
        viableAlternatives: [
          { strategyId: 'R34', name: 'Coincidence Anchoring', reason: 'Anchor cadential arrival notes.' },
          { strategyId: 'R20', name: 'Ghost Beat', reason: 'Keep hidden quarter-beat lattice audible across ties.' },
        ],
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ROUTE 10: Asymmetric Additive Grouping Smoothing (PS-ADD-REG-01, RC13)
    // ──────────────────────────────────────────────────────────────────────────
    if (signatureId.includes('add') || signatureId.includes('asym') || signatureLabel.includes('additive') || signatureLabel.includes('asymmetric')) {
      return {
        selectedStrategy: new AsymmetricAdditiveStrategy([3, 2]),
        reason: 'Asymmetric macro-beats (3+2, 2+3, 2+2+3) are smoothed into equal subdivisions; chant syllables (Ta-ki-ta/Ta-ka) and fade equal ticks to asymmetric accents.',
        viableAlternatives: [
          { strategyId: 'R07', name: 'Explicit Subdivision', reason: 'Equal eighth-note lattice verification.' },
          { strategyId: 'R22', name: 'Tempo Ladder', reason: 'Slowly ramp tempo of asymmetric lilt.' },
        ],
      };
    }

    // Capacity-driven fallback
    switch (capacityId) {
      case 'RC03':
        return {
          selectedStrategy: new GapClickStrategy(),
          reason: 'Internal pulse capacity target.',
          viableAlternatives: [{ strategyId: 'R11', name: 'Sparse Metronome', reason: 'Anchor pacing.' }],
        };
      case 'RC04':
        return {
          selectedStrategy: new ExplicitSubdivisionStrategy(),
          reason: 'Subdivision grid capacity target.',
          viableAlternatives: [{ strategyId: 'R18', name: 'Reference Audio', reason: 'Aural modeling.' }],
        };
      case 'RC05':
        return {
          selectedStrategy: new ReferenceAudioStrategy('listen_echo', 'intervention'),
          reason: 'Pattern representation capacity target.',
          viableAlternatives: [{ strategyId: 'R03', name: 'Single-Pitch Reduction', reason: 'Motor reduction.' }],
        };
      case 'RC06':
        return {
          selectedStrategy: new GhostBeatStrategy(),
          reason: 'Metrical organization capacity target.',
          viableAlternatives: [{ strategyId: 'R11', name: 'Sparse Metronome', reason: 'Barline anchors.' }],
        };
      case 'RC08':
        return {
          selectedStrategy: new SinglePitchReductionStrategy(),
          reason: 'Instrumental execution capacity target.',
          viableAlternatives: [{ strategyId: 'R22', name: 'Tempo Ladder', reason: 'Gradual speed building.' }],
        };
      case 'RC11':
        return {
          selectedStrategy: new CommonSubdivisionGridStrategy([3, 2]),
          reason: 'Dual-stream phase independence target.',
          viableAlternatives: [{ strategyId: 'R35', name: 'Layer Alternation', reason: 'Limb exchange.' }],
        };
      case 'RC12':
        return {
          selectedStrategy: new BeatPlusCounterRhythmStrategy(),
          reason: 'Metrical anchor stability under counter-periodicity target.',
          viableAlternatives: [{ strategyId: 'R10', name: 'Full Metronome', reason: 'Pulse grounding.' }],
        };
      case 'RC13':
        return {
          selectedStrategy: new AsymmetricAdditiveStrategy([3, 2]),
          reason: 'Asymmetric additive chunking capacity target.',
          viableAlternatives: [{ strategyId: 'R07', name: 'Explicit Subdivision', reason: 'Micro-subdivision grid.' }],
        };
      default:
        return {
          selectedStrategy: new GapClickStrategy(),
          reason: 'General rhythm pulse stabilization.',
          viableAlternatives: [],
        };
    }
  }
}
