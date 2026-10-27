import type { KnowledgeDomain, GenericKnowledgeRecord } from '../types/knowledge';
import { RHYTHMIC_CAPACITIES } from '../../strategies/classifications/rhythm/types/capacities';
import { DiagnosticInterventionRegistry } from '../../strategies/classifications/rhythm/registry/DiagnosticInterventionRegistry';

export class DomainRegistry {
  private static domains: Map<string, KnowledgeDomain> = new Map();
  private static recordCache: Map<string, GenericKnowledgeRecord> = new Map();

  static {
    this.initializeDomains();
  }

  private static initializeDomains(): void {
    // 1. RHYTHM DOMAIN (Fully Implemented from AIPC Rhythm Spec)
    const rhythmCapacities = Object.keys(RHYTHMIC_CAPACITIES);
    const rhythmInterventions = DiagnosticInterventionRegistry.getAll().map(i => i.id);

    const rhythmDomain: KnowledgeDomain = {
      id: 'rhythm',
      name: 'Rhythm & Metric Organisation',
      status: 'implemented',
      description: 'Endogenous pulse, subdivisions, metrical structures, tempo stability, and motor synchronization.',
      knowledgebaseVersion: '1.0.0',
      problemSignatureIds: [
        'PS-RUSH-01',
        'PS-UNEVEN-01',
        'PS-DRIFT-01',
        'PS-SYNC-TIE-01',
      ],
      capacityIds: rhythmCapacities,
      diagnosticInterventionIds: rhythmInterventions,
      strategyIds: [
        'S-REF-SHADOW',
        'S-SLOW-CLICK',
        'S-GAP-CLICK',
        'S-XRAY-RHYTHM',
        'S-TRANSITION-ISOLATION',
        'S-ARTIC-REDUCTION',
        'S-EXPLICIT-SUBDIV',
        'S-BURST-PRACTICE',
        'S-TEMPO-LADDER',
        'S-CLICK-DROPOUT',
        'S-CROSS-RHYTHM',
      ],
      assetIds: [
        'ASSET-MUSICXML-SCORE',
        'ASSET-TONEJS-TRANSPORT',
        'ASSET-METRONOME-CLICK',
        'ASSET-ACOUSTIC-MIC-INPUT',
        'ASSET-TAP-PAD-INPUT',
        'ASSET-VISUAL-COUNT-IN',
        'ASSET-OSMD-SCORE-HIGHLIGHT',
        'ASSET-REFERENCE-AUDIO',
      ],
      responseRuleIds: [
        'RULE-RESP-A-SHADOW-IMPROVED',
        'RULE-RESP-B-SLOW-TEMPO-IMPROVED',
        'RULE-RESP-C-COMPLEX-RHYTHM-REMAINS',
        'RULE-RESP-D-PERSISTENT-LOCAL-NOTES',
        'RULE-RESP-E-SPARSE-CLICK-UNSTABLE',
      ],
      progressionRuleIds: [
        'RULE-PROG-G1-SOMATIC-DECOUPLING',
        'RULE-PROG-G2-AUDITORY-TEMPLATE-PRIMING',
        'RULE-PROG-G3-TEMPO-RECALIBRATION',
        'RULE-PROG-G4-3TIER-TEMPO-DESCENT',
        'RULE-PROG-G5-SCAFFOLD-AGENCY',
        'RULE-PROG-G7-SYSTEMATIC-ASCENT-LADDER',
        'RULE-PROG-G8-2STRIKE-PLATEAU-CUSHION',
        'RULE-PROG-TEMPO-LADDER-UP-5BPM',
        'RULE-PROG-TEMPO-LADDER-UP-3BPM',
        'RULE-PROG-TEMPO-LADDER-UP-10BPM',
        'RULE-PROG-TEMPO-LADDER-DOWN-5BPM',
        'RULE-PROG-SUPPORT-FADE-UNASSISTED',
      ],
      referralRuleIds: [
        'RULE-REF-G6-ANTI-FRUSTRATION-BOUNDED-EXIT',
        'RULE-REF-ATTEMPT-LIMIT-3',
        'RULE-REF-PHYSICAL-DISTRESS',
        'RULE-REF-EMBOUCHURE-REGISTER-WALL',
        'RULE-REF-UNRESOLVED-CONTRADICTION',
      ],
    };

    // 2. PLACEHOLDER DOMAINS (Strict schema compliance, zero invented content)
    const toneDomain: KnowledgeDomain = {
      id: 'tone',
      name: 'Tone Production & Timbre',
      status: 'placeholder',
      description: 'Tone quality, resonance, core center, and timbre consistency across dynamics and registers.',
      problemSignatureIds: [],
      capacityIds: [],
      diagnosticInterventionIds: [],
      strategyIds: [],
      assetIds: [],
      responseRuleIds: [],
      progressionRuleIds: [],
      referralRuleIds: [],
    };

    const pitchDomain: KnowledgeDomain = {
      id: 'pitch_intonation',
      name: 'Pitch & Intonation',
      status: 'placeholder',
      description: 'Cent accuracy, harmonic intonation, pitch tracking, and interval tuning stability.',
      problemSignatureIds: [],
      capacityIds: [],
      diagnosticInterventionIds: [],
      strategyIds: [],
      assetIds: [],
      responseRuleIds: [],
      progressionRuleIds: [],
      referralRuleIds: [],
    };

    const articulationDomain: KnowledgeDomain = {
      id: 'articulation',
      name: 'Articulation & Tongue Attack',
      status: 'placeholder',
      description: 'Tongue placement, attack clarity, release profile, and multi-tonguing coordination.',
      problemSignatureIds: [],
      capacityIds: [],
      diagnosticInterventionIds: [],
      strategyIds: [],
      assetIds: [],
      responseRuleIds: [],
      progressionRuleIds: [],
      referralRuleIds: [],
    };

    const techniqueDomain: KnowledgeDomain = {
      id: 'technique_coordination',
      name: 'Technique & Motor Coordination',
      status: 'placeholder',
      description: 'Finger mechanics, valve/slide transitions, large interval leaps, and manual dexterity.',
      problemSignatureIds: [],
      capacityIds: [],
      diagnosticInterventionIds: [],
      strategyIds: [],
      assetIds: [],
      responseRuleIds: [],
      progressionRuleIds: [],
      referralRuleIds: [],
    };

    const breathingDomain: KnowledgeDomain = {
      id: 'breathing_air_support',
      name: 'Breathing & Air Support',
      status: 'placeholder',
      description: 'Inhalation mechanics, sustained air speed, subglottal support, and phrasing stamina.',
      problemSignatureIds: [],
      capacityIds: [],
      diagnosticInterventionIds: [],
      strategyIds: [],
      assetIds: [],
      responseRuleIds: [],
      progressionRuleIds: [],
      referralRuleIds: [],
    };

    const expressionDomain: KnowledgeDomain = {
      id: 'expression_style',
      name: 'Expression & Musical Style',
      status: 'placeholder',
      description: 'Dynamic shaping, agogic nuance, vibrato control, rubato, and stylistic idiomatic inflection.',
      problemSignatureIds: [],
      capacityIds: [],
      diagnosticInterventionIds: [],
      strategyIds: [],
      assetIds: [],
      responseRuleIds: [],
      progressionRuleIds: [],
      referralRuleIds: [],
    };

    [
      rhythmDomain,
      toneDomain,
      pitchDomain,
      articulationDomain,
      techniqueDomain,
      breathingDomain,
      expressionDomain,
    ].forEach(d => this.domains.set(d.id, d));

    this.buildRecordIndex();
  }

  private static buildRecordIndex(): void {
    this.recordCache.clear();

    // Index Capacities
    Object.entries(RHYTHMIC_CAPACITIES).forEach(([id, def]) => {
      this.recordCache.set(id, {
        id,
        domainId: 'rhythm',
        type: 'capacity',
        name: def.name,
        description: def.operationalDefinition,
        simpleExplanation: def.operationalDefinition,
        technicalDetails: {
          typicalFailure: def.typicalFailure,
        },
        tags: ['capacity', 'rhythm'],
      });
    });

    // Index Diagnostic Interventions
    DiagnosticInterventionRegistry.getAll().forEach(di => {
      this.recordCache.set(di.id, {
        id: di.id,
        domainId: 'rhythm',
        type: 'diagnostic_intervention',
        name: di.name,
        description: di.pedagogicalPurpose,
        simpleExplanation: di.diagnosticPurpose,
        technicalDetails: {
          applicableProblemSignatures: di.applicableProblemSignatures,
          candidateCapacities: di.candidateCapacities,
          variablesAdded: di.variablesAdded,
          variablesRemoved: di.variablesRemoved,
          maxInitialAttempts: di.maxInitialAttempts,
          continueRule: di.continueRule,
          pivotRule: di.pivotRule,
          referRule: di.referRule,
        },
        tags: ['diagnostic_intervention', 'strategy_as_probe'],
      });
    });

    // Index Problem Signatures
    const signatures: Array<{ id: string; name: string; explanation: string; technical: Record<string, unknown> }> = [
      {
        id: 'PS-RUSH-01',
        name: 'Progressive Rushing',
        explanation: 'The learner gradually speeds up across consecutive measures, getting progressively ahead of the underlying pulse.',
        technical: {
          detectionMetric: 'driftSlopeMsPerBeat',
          threshold: '> 3.5 ms/beat',
          typicalWindow: '4+ consecutive bars',
          primaryCandidateCapacities: ['RC03', 'RC04', 'RC05', 'RC08'],
        },
      },
      {
        id: 'PS-UNEVEN-01',
        name: 'Uneven Subdivision',
        explanation: 'Subdivisions within the beat fluctuate in length, resulting in a jerky or swinging irregularity.',
        technical: {
          detectionMetric: 'subdivisionRatioVariability',
          threshold: '> 25% deviation from nominal',
          primaryCandidateCapacities: ['RC04', 'RC08'],
        },
      },
      {
        id: 'PS-DRIFT-01',
        name: 'Drift After Click Removal',
        explanation: 'Timing remains solid with continuous metronome click, but immediately drifts when click drops out.',
        technical: {
          detectionMetric: 'postDropoutDriftMs',
          threshold: '> 60 ms over 2 bars',
          primaryCandidateCapacities: ['RC03'],
        },
      },
      {
        id: 'PS-SYNC-TIE-01',
        name: 'Beat Loss Over Syncopations & Ties',
        explanation: 'The internal metric anchor is lost across tied or silent downbeats, resulting in premature attack on offbeats.',
        technical: {
          detectionMetric: 'tiedReentryErrorMs',
          threshold: '> 75 ms early',
          primaryCandidateCapacities: ['RC05', 'RC06'],
        },
      },
    ];

    signatures.forEach(sig => {
      this.recordCache.set(sig.id, {
        id: sig.id,
        domainId: 'rhythm',
        type: 'problem_signature',
        name: sig.name,
        description: sig.explanation,
        simpleExplanation: sig.explanation,
        technicalDetails: sig.technical,
        tags: ['problem_signature', 'rhythm'],
      });
    });

    // Index Response Interpretation Rules
    const responseRules = [
      {
        id: 'RULE-RESP-A-SHADOW-IMPROVED',
        name: 'Response A: Improvement after Reference & Shadowing',
        explanation: 'Substantial repeated improvement occurs when tone and breath demands are removed. Strengthens hypothesis of rhythm familiarity, aural representation, or movement preparation.',
        technical: {
          condition: 'accuracy >= 80% on both shadow transfer attempts',
          effect: 'strengthens RC05 (Pattern Representation) and RC08 (Movement Preparation)',
          nextDecision: 'Persist with unassisted retest',
        },
      },
      {
        id: 'RULE-RESP-B-SLOW-TEMPO-IMPROVED',
        name: 'Response B: Rushing Disappears at Slower Tempo',
        explanation: 'Rushing and timing errors disappear when tempo is reduced by 20 BPM. Strengthens target-tempo cognitive/motor load hypothesis.',
        technical: {
          condition: 'accuracy >= 75% at target - 20 BPM',
          effect: 'strengthens cognitive speed load hypothesis; rules out fundamental rhythmic deficit',
          nextDecision: 'Persist with progressive tempo ladder (+3, +5, +10 BPM)',
        },
      },
      {
        id: 'RULE-RESP-C-COMPLEX-RHYTHM-REMAINS',
        name: 'Response C: Rushing Clears but Complex Rhythm Remains Wrong',
        explanation: 'Tempo stabilizes at reduced speed, but specific syncopations, ties, or tuplets continue to fail. Strengthens subdivision or pattern syntax hypothesis.',
        technical: {
          condition: 'global drift < 2ms/beat but pattern error rate > 30%',
          effect: 'strengthens RC04 (Subdivision) and RC05 (Pattern Representation)',
          nextDecision: 'Pivot to targeted rhythm probe (DI-XRAY-RHYTHM-01 or DI-SUBDIV-EXPLICIT-01)',
        },
      },
      {
        id: 'RULE-RESP-D-PERSISTENT-LOCAL-NOTES',
        name: 'Response D: Persistent Local Note Bottleneck',
        explanation: 'Errors localize to the exact same 1-2 notes or difficult finger interval regardless of tempo.',
        technical: {
          condition: 'errors concentrated on <= 2 specific pitches or transition index',
          effect: 'strengthens mechanical fingering bottleneck; weakens general rhythm deficit',
          nextDecision: 'Pivot to Transition Isolation (max 2-3 attempts), then Refer if unresolved',
        },
      },
      {
        id: 'RULE-RESP-E-SPARSE-CLICK-UNSTABLE',
        name: 'Response E: Stable with Click, Unstable when Reduced',
        explanation: 'Passage locks in solidly with continuous click, but rushing returns immediately when click density reduces.',
        technical: {
          condition: 'click dropout error > 50ms',
          effect: 'confirms RC03 (Internal Pulse) endogenous deficiency',
          nextDecision: 'Pivot to Gap Click (DI-GAP-CLICK-01) with support fading',
        },
      },
    ];

    responseRules.forEach(rule => {
      this.recordCache.set(rule.id, {
        id: rule.id,
        domainId: 'rhythm',
        type: 'response_rule',
        name: rule.name,
        description: rule.explanation,
        simpleExplanation: rule.explanation,
        technicalDetails: rule.technical,
        tags: ['response_rule', 'diagnostic_sieve'],
      });
    });

    // Index Progression and Referral Rules
    this.recordCache.set('RULE-REF-ATTEMPT-LIMIT-3', {
      id: 'RULE-REF-ATTEMPT-LIMIT-3',
      domainId: 'rhythm',
      type: 'referral_rule',
      name: '2-to-3 Attempt Referral Limit',
      description: 'When the same targeted intervention or transition bottleneck fails after 2-3 focused attempts, stop automated loops and refer to the teacher.',
      simpleExplanation: 'Prevents learner frustration and automated loops by creating an explicit Teacher Handoff record.',
      technicalDetails: {
        maxAttempts: 3,
        actionOnBreach: 'generate_teacher_handoff_record',
      },
      tags: ['referral_rule', 'guardrail'],
    });
  }

  public static getAllDomains(): KnowledgeDomain[] {
    return Array.from(this.domains.values());
  }

  public static getDomain(id: string): KnowledgeDomain | undefined {
    return this.domains.get(id);
  }

  public static isImplemented(domainId: string): boolean {
    const domain = this.domains.get(domainId);
    return domain?.status === 'implemented';
  }

  public static getRecord(recordId: string): GenericKnowledgeRecord | undefined {
    return this.recordCache.get(recordId);
  }

  public static getAllRecords(): GenericKnowledgeRecord[] {
    return Array.from(this.recordCache.values());
  }

  public static getRecordsByDomain(domainId: string): GenericKnowledgeRecord[] {
    return Array.from(this.recordCache.values()).filter(r => r.domainId === domainId);
  }
}
