import type {
  SimulationState,
  ReasoningNode,
  StartSimulationRequest,
  ApplyInterventionRequest,
  RecordResponseRequest,
  CodingAgentInstructions,
} from '../types/simulation';
import type { KnowledgeNote } from '../types/knowledge';
import { DomainRegistry } from '../registry/DomainRegistry';
import { DiagnosticInterventionRegistry } from '../../strategies/classifications/rhythm/registry/DiagnosticInterventionRegistry';
import type {
  DiagnosticProfile,
  CapacityHypothesis,
  DiagnosticEvidence,
  DecisionResult,
  TeacherHandoffRecord
} from '../../strategies/classifications/rhythm/types/diagnosticProfile';

export class ReasoningSimulatorEngine {
  private static activeSimulations: Map<string, SimulationState> = new Map();
  private static notesStore: Map<string, KnowledgeNote[]> = new Map();

  /**
   * Starts a new pedagogical reasoning simulation.
   */
  public static startSimulation(request: StartSimulationRequest): SimulationState {
    const simId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const domain = DomainRegistry.getDomain(request.domainId);

    if (!domain) {
      throw new Error(`Domain '${request.domainId}' does not exist.`);
    }

    if (domain.status === 'placeholder') {
      throw new Error(`Domain '${domain.name}' is a placeholder and cannot execute live simulations.`);
    }

    if (request.problemSignatureId !== 'PS-RUSH-01') {
      throw new Error(`Currently, full simulation is grounded in 'PS-RUSH-01' (Progressive Rushing).`);
    }

    const initialNodes: ReasoningNode[] = [];

    // NODE 1: OBSERVE LAYER
    const observeNode: ReasoningNode = {
      id: `${simId}_node_1_observe`,
      sequence: 1,
      layer: 'observe',
      title: 'Observed Telemetry & Problem Signature Trigger',
      simpleExplanation: 'Microphone onset timestamps reveal progressive rushing across Bars 12–15: attacks arrive increasingly ahead of the metronome click, exceeding the 3.5ms/beat drift threshold.',
      status: 'observed',
      knowledgeReferences: [
        {
          domainId: 'rhythm',
          knowledgebaseType: 'problem_signature',
          recordId: 'PS-RUSH-01',
          label: 'PS-RUSH-01: Progressive Rushing',
          summary: 'Forward timing drift across consecutive measures exceeding threshold.',
        },
        {
          domainId: 'rhythm',
          knowledgebaseType: 'asset',
          recordId: 'ASSET-ACOUSTIC-MIC-INPUT',
          label: 'Acoustic Onset Telemetry',
          summary: 'Audio buffer onset energy peaks matched to score beat intervals.',
        },
      ],
      evidenceUsed: [
        {
          id: 'ev_obs_1',
          source: 'baseline_performance',
          capacityId: 'RC03',
          direction: 'strengthens',
          weight: 0.85,
          observation: 'Drift slope measured at +4.2 ms/beat across measures 12–15 at 120 BPM.',
        },
      ],
      ruleReferences: ['PS-RUSH-01-TRIGGER-THRESHOLD-3.5MS'],
      technicalDetails: {
        measures: [12, 13, 14, 15],
        targetTempoBpm: 120,
        detectedDriftSlopeMsPerBeat: 4.2,
        meanOffsetMs: -68,
        timingVariabilityMs: 44,
        confidence: 0.92,
      },
      timestamp: new Date().toISOString(),
    };
    initialNodes.push(observeNode);

    // NODE 2: DIAGNOSE LAYER (Multi-Factor Provisional Hypotheses)
    const initialHypotheses: CapacityHypothesis[] = [
      {
        capacityId: 'RC03',
        label: 'Internal Pulse',
        evidenceScore: 0.65,
        confidence: 'moderate',
        status: 'leading',
        supportingEvidenceIds: ['ev_obs_1'],
        conflictingEvidenceIds: [],
      },
      {
        capacityId: 'RC04',
        label: 'Subdivision & Metric Chunking',
        evidenceScore: 0.50,
        confidence: 'low',
        status: 'possible',
        supportingEvidenceIds: ['ev_obs_1'],
        conflictingEvidenceIds: [],
      },
      {
        capacityId: 'RC05',
        label: 'Pattern & Note Representation',
        evidenceScore: 0.45,
        confidence: 'low',
        status: 'possible',
        supportingEvidenceIds: [],
        conflictingEvidenceIds: [],
      },
      {
        capacityId: 'RC08',
        label: 'Instrumental Motor Coordination',
        evidenceScore: 0.55,
        confidence: 'moderate',
        status: 'leading',
        supportingEvidenceIds: ['ev_obs_1'],
        conflictingEvidenceIds: [],
      },
    ];

    const initialEvidence: DiagnosticEvidence[] = [
      {
        id: 'ev_obs_1',
        source: 'baseline_performance',
        capacityId: 'RC03',
        direction: 'strengthens',
        weight: 0.85,
        observation: 'Progressive rushing detected (+4.2 ms/beat). Could be endogenous pulse drift, speed overload, or fingering tension.',
        metrics: { driftSlope: 4.2 },
        createdAt: new Date().toISOString(),
      },
    ];

    const initialProfile: DiagnosticProfile = {
      problemSignatureId: 'PS-RUSH-01',
      hypotheses: initialHypotheses,
      evidence: initialEvidence,
      persistentLocations: [
        { measureNumber: 12, beatPosition: 1 },
        { measureNumber: 13, beatPosition: 3 },
      ],
      unresolvedQuestions: [
        'Does rushing persist when tone/breath demands are removed?',
        'Does slowing tempo by 20 BPM stabilize timing?',
        'Is timing stable with click but unstable without click?',
      ],
      updatedAt: new Date().toISOString(),
    };

    const diagnoseNode: ReasoningNode = {
      id: `${simId}_node_2_diagnose`,
      sequence: 2,
      layer: 'diagnose',
      title: 'Provisional Multi-Factor Diagnostic Profile',
      simpleExplanation: 'Progressive rushing can stem from internal pulse instability, tempo overload, unfamiliar note syntax, or finger coordination demand. Several causes remain provisional—no single root cause is forced.',
      status: 'provisional',
      knowledgeReferences: [
        {
          domainId: 'rhythm',
          knowledgebaseType: 'capacity',
          recordId: 'RC03',
          label: 'RC03: Internal Pulse',
          summary: 'Endogenous timekeeping ability to sustain a steady tempo.',
        },
        {
          domainId: 'rhythm',
          knowledgebaseType: 'capacity',
          recordId: 'RC08',
          label: 'RC08: Instrumental Rhythmic Execution',
          summary: 'Motor and finger coordination required to execute rhythm on the instrument.',
        },
        {
          domainId: 'rhythm',
          knowledgebaseType: 'capacity',
          recordId: 'RC04',
          label: 'RC04: Subdivision',
          summary: 'Mental subdivision of the beat into micro-intervals.',
        },
        {
          domainId: 'rhythm',
          knowledgebaseType: 'capacity',
          recordId: 'RC05',
          label: 'RC05: Pattern Representation',
          summary: 'Cognitive encoding of rhythm syntax and note values.',
        },
      ],
      evidenceUsed: [
        {
          id: 'ev_obs_1',
          source: 'baseline_performance',
          capacityId: 'RC03',
          direction: 'strengthens',
          weight: 0.85,
          observation: 'Baseline drift slope +4.2 ms/beat.',
        },
      ],
      ruleReferences: ['RULE-PROVISIONAL-MULTI-FACTOR-SYNTHESIS'],
      technicalDetails: {
        hypothesesCount: initialHypotheses.length,
        leadingHypotheses: ['RC03', 'RC08'],
        isSingleCauseForced: false,
      },
      result: {
        diagnosticProfile: initialProfile,
      },
      timestamp: new Date().toISOString(),
    };
    initialNodes.push(diagnoseNode);

    // NODE 3: INTERVENE LAYER (First-Line Routing & Learner Choice)
    const interveneNode: ReasoningNode = {
      id: `${simId}_node_3_intervene`,
      sequence: 3,
      layer: 'intervene',
      title: 'First-Line Strategy Selection (General Front Door)',
      simpleExplanation: 'Because multiple hypotheses are plausible, AIPC opens the Repertoire Front Door offering learner choice between Option A (Reference Listening with Shadow Fingering at target tempo) and Option B (Slower Tempo by 20 BPM with Strong Click).',
      status: 'selected',
      knowledgeReferences: [
        {
          domainId: 'rhythm',
          knowledgebaseType: 'diagnostic_intervention',
          recordId: 'DI-REF-SHADOW-01',
          label: 'Option A: Reference Listening with Shadow Fingering',
          summary: 'Tests familiarity and movement preparation without tone/breath demand.',
        },
        {
          domainId: 'rhythm',
          knowledgebaseType: 'diagnostic_intervention',
          recordId: 'DI-SLOW-CLICK-01',
          label: 'Option B: Tempo Reduction by 20 BPM with Strong Click',
          summary: 'Tests cognitive speed load vs fundamental rhythm deficit.',
        },
      ],
      evidenceUsed: [],
      ruleReferences: ['RULE-FIRST-LINE-GENERAL-CHOICE-ROUTER'],
      technicalDetails: {
        routeType: 'general_choice',
        availableOptions: ['DI-REF-SHADOW-01', 'DI-SLOW-CLICK-01'],
        recommendedOption: 'DI-REF-SHADOW-01',
        recommendationRationale: 'Dense 16th note movement in Bar 13 suggests finger preparation or note familiarity is a high-value probe.',
        maxInitialAttempts: 3,
      },
      result: {
        offeredOptions: [
          {
            id: 'DI-REF-SHADOW-01',
            label: 'Option A: Shadow Fingering with Reference Audio',
            targetBpm: 120,
            variablesRemoved: ['tone_production', 'breath_coordination'],
          },
          {
            id: 'DI-SLOW-CLICK-01',
            label: 'Option B: Slower Tempo (-20 BPM = 100 BPM)',
            targetBpm: 100,
            variablesRemoved: ['target_tempo_speed_load'],
          },
        ],
      },
      timestamp: new Date().toISOString(),
    };
    initialNodes.push(interveneNode);

    const simulationState: SimulationState = {
      id: simId,
      domainId: request.domainId,
      problemSignatureId: request.problemSignatureId,
      scenarioId: request.scenarioId,
      status: 'active',
      currentStep: 3,
      diagnosticProfile: initialProfile,
      activeInterventionId: 'DI-REF-SHADOW-01',
      interventionHistory: [],
      nodes: initialNodes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.activeSimulations.set(simId, simulationState);
    return simulationState;
  }

  /**
   * Applies an intervention choice (Option A or Option B).
   */
  public static applyIntervention(
    simulationId: string,
    request: ApplyInterventionRequest
  ): SimulationState {
    const sim = this.activeSimulations.get(simulationId);
    if (!sim) {
      throw new Error(`Simulation '${simulationId}' not found.`);
    }

    const intervention = DiagnosticInterventionRegistry.get(request.interventionId);
    if (!intervention) {
      throw new Error(`Diagnostic intervention '${request.interventionId}' not registered.`);
    }

    sim.activeInterventionId = intervention.id;
    sim.currentStep++;

    const applyNode: ReasoningNode = {
      id: `${sim.id}_node_${sim.currentStep}_applied`,
      sequence: sim.currentStep,
      layer: 'intervene',
      title: `Intervention Launched: ${intervention.name}`,
      simpleExplanation: `Selected ${intervention.name}. Task modified: ${intervention.variablesRemoved.join(', ')} removed; ${intervention.variablesAdded.join(', ')} added. Max initial attempts: ${intervention.maxInitialAttempts}.`,
      status: 'selected',
      knowledgeReferences: [
        {
          domainId: 'rhythm',
          knowledgebaseType: 'diagnostic_intervention',
          recordId: intervention.id,
          label: intervention.name,
          summary: intervention.diagnosticPurpose,
        },
      ],
      evidenceUsed: [],
      ruleReferences: ['RULE-INTERVENTION-INITIAL-ATTEMPT-BOUND-MAX-3'],
      technicalDetails: {
        interventionId: intervention.id,
        learnerChoice: request.learnerChoice,
        rationale: request.rationale || intervention.pedagogicalPurpose,
        maxAttempts: intervention.maxInitialAttempts,
        variablesAdded: intervention.variablesAdded,
        variablesRemoved: intervention.variablesRemoved,
      },
      timestamp: new Date().toISOString(),
    };

    sim.nodes.push(applyNode);
    sim.updatedAt = new Date().toISOString();
    return sim;
  }

  /**
   * Simulates a canonical response pattern (Response A, B, C, D, or E) and generates Guide/Evaluate/Adapt reasoning.
   */
  public static recordResponse(
    simulationId: string,
    request: RecordResponseRequest
  ): SimulationState {
    const sim = this.activeSimulations.get(simulationId);
    if (!sim) {
      throw new Error(`Simulation '${simulationId}' not found.`);
    }

    sim.currentStep++;
    const stepNum = sim.currentStep;

    const pattern = request.responsePattern;
    const activeIntervention = sim.activeInterventionId || 'DI-REF-SHADOW-01';

    let responseTitle = '';
    let responseExplanation = '';
    let decisionOutcome: DecisionResult;
    let ruleRef = '';
    let updatedHypotheses: CapacityHypothesis[] = [...sim.diagnosticProfile.hypotheses];
    let newEvidence: DiagnosticEvidence;

    switch (pattern) {
      // ──────────────────────────────────────────────────────────────────────────
      // RESPONSE A: Improvement after Listening & Shadow Fingering
      // ──────────────────────────────────────────────────────────────────────────
      case 'response_a_shadow_improved': {
        responseTitle = 'Response A: Substantial Repeated Improvement after Shadow Fingering';
        responseExplanation = 'Performance accuracy reached 88% at target tempo after reference shadow rehearsal. Evidence strengthens for rhythm familiarity, aural representation, or movement preparation as the primary bottleneck.';
        ruleRef = 'RULE-RESP-A-SHADOW-IMPROVED';

        newEvidence = {
          id: `ev_resp_a_${Date.now()}`,
          source: 'diagnostic_intervention',
          interventionId: activeIntervention,
          capacityId: 'RC05',
          direction: 'strengthens',
          weight: 0.78,
          observation: 'Active transfer attempt showed 88% timing accuracy at 120 BPM after silent shadow rehearsal.',
          metrics: { accuracy: 0.88, attempts: 2 },
          createdAt: new Date().toISOString(),
        };

        updatedHypotheses = updatedHypotheses.map(h => {
          if (h.capacityId === 'RC05' || h.capacityId === 'RC08') {
            return {
              ...h,
              evidenceScore: Math.min(1.0, h.evidenceScore + 0.25),
              status: 'leading' as const,
              confidence: 'moderate' as const,
            };
          }
          if (h.capacityId === 'RC03') {
            return {
              ...h,
              evidenceScore: Math.max(0.1, h.evidenceScore - 0.2),
              status: 'reduced' as const,
            };
          }
          return h;
        });

        decisionOutcome = {
          decision: 'Persist',
          reason: 'Improvement repeated across transfer runs. Retest unassisted once to verify stable internalisation without reference scaffolding.',
          retestRequired: true,
          fadingSteps: ['Remove reference audio', 'Play unassisted at 120 BPM'],
        };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // RESPONSE B: Rushing Disappears at Slower Tempo (-20 BPM)
      // ──────────────────────────────────────────────────────────────────────────
      case 'response_b_slow_tempo_improved': {
        responseTitle = 'Response B: Rushing Disappears at -20 BPM';
        responseExplanation = 'At 100 BPM (-20 BPM), rushing slope dropped to +0.8 ms/beat and timing stabilized (85% accuracy). This confirms cognitive/motor speed load rather than a fundamental rhythmic deficit.';
        ruleRef = 'RULE-RESP-B-SLOW-TEMPO-IMPROVED';

        newEvidence = {
          id: `ev_resp_b_${Date.now()}`,
          source: 'diagnostic_intervention',
          interventionId: 'DI-SLOW-CLICK-01',
          capacityId: 'RC08',
          direction: 'weakens',
          weight: 0.82,
          observation: 'Rushing eliminated at 100 BPM (+0.8 ms/beat, 85% accuracy). Pulse and motor execution are sound; speed load was the bottleneck.',
          metrics: { driftSlope: 0.8, accuracy: 0.85 },
          createdAt: new Date().toISOString(),
        };

        updatedHypotheses = updatedHypotheses.map(h => {
          if (h.capacityId === 'RC03') {
            return {
              ...h,
              evidenceScore: 0.20,
              status: 'reduced' as const,
            };
          }
          return h;
        });

        decisionOutcome = {
          decision: 'Persist',
          reason: 'Solid control established at -20 BPM. Begin progressive tempo ladder (+3, +5, or +10 BPM) up toward target speed.',
          retestRequired: false,
          fadingSteps: ['Step up to 105 BPM', 'Step up to 110 BPM', 'Step up to 120 BPM'],
        };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // RESPONSE C: Slower Tempo Cleared Rushing, but Complex Rhythm Stays Wrong
      // ──────────────────────────────────────────────────────────────────────────
      case 'response_c_complex_rhythm_remains': {
        responseTitle = 'Response C: Rushing Cleared, Complex Rhythm Remains Inaccurate';
        responseExplanation = 'At 100 BPM, overall drift resolved, but the tied syncopation in Bar 13 continues to fail (early attack by 82ms). Hypothesis of subdivision or pattern syntax representation strengthens.';
        ruleRef = 'RULE-RESP-C-COMPLEX-RHYTHM-REMAINS';

        newEvidence = {
          id: `ev_resp_c_${Date.now()}`,
          source: 'diagnostic_intervention',
          interventionId: 'DI-SLOW-CLICK-01',
          capacityId: 'RC04',
          direction: 'strengthens',
          weight: 0.88,
          observation: 'Tied syncopation in Bar 13 failed consistently across 3 attempts at 100 BPM (-82ms offbeat error).',
          metrics: { tiedErrorMs: -82, driftResolved: true },
          createdAt: new Date().toISOString(),
        };

        updatedHypotheses = updatedHypotheses.map(h => {
          if (h.capacityId === 'RC04' || h.capacityId === 'RC05') {
            return {
              ...h,
              evidenceScore: 0.85,
              status: 'leading' as const,
              confidence: 'high' as const,
            };
          }
          return h;
        });

        decisionOutcome = {
          decision: 'Pivot',
          reason: 'Tempo reduction alone cannot solve the syncopation/tie syntax. Pivot to targeted rhythm intervention: X-ray Rhythm (DI-XRAY-RHYTHM-01) or Explicit Subdivision.',
          recommendedStrategyId: 'DI-XRAY-RHYTHM-01',
          retestRequired: false,
        };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // RESPONSE D: Same 1-2 Notes Continue to Fail (Local Fingering Bottleneck)
      // ──────────────────────────────────────────────────────────────────────────
      case 'response_d_persistent_local_notes': {
        responseTitle = 'Response D: Persistent Local 1-2 Note Bottleneck';
        responseExplanation = 'Errors cluster strictly at the high G to Eb interval in Bar 13 across all tempos and attempts. The problem has become localized to a mechanical finger/register bottleneck, not general rhythm.';
        ruleRef = 'RULE-RESP-D-PERSISTENT-LOCAL-NOTES';

        newEvidence = {
          id: `ev_resp_d_${Date.now()}`,
          source: 'diagnostic_intervention',
          interventionId: activeIntervention,
          capacityId: 'RC08',
          direction: 'strengthens',
          weight: 0.90,
          observation: 'All errors localized to Bar 13, note index 4->5 (G to Eb leap). Zero errors across remaining bars.',
          metrics: { localizedNoteCount: 2, measure: 13 },
          createdAt: new Date().toISOString(),
        };

        const attemptCount = request.attemptCount || 3;
        const reachedAttemptLimit = attemptCount >= 3;

        if (reachedAttemptLimit) {
          // Enforce 2-3 attempt referral limit
          const handoff: TeacherHandoffRecord = {
            studentId: 'simulated_student_01',
            passageId: 'Neruda Excerpt Bars 12-15',
            problemSignatureId: 'PS-RUSH-01',
            problemName: 'Progressive Rushing',
            baselineSummary: 'Progressive rushing triggered by high G-to-Eb finger bottleneck in Bar 13.',
            interventionsAttempted: [
              { interventionId: 'DI-REF-SHADOW-01', interventionName: 'Option A: Reference Listening with Shadow Fingering', attempts: 2, response: 'persistent_local_note_error' },
              { interventionId: 'DI-TRANSITION-01', interventionName: 'Isolate 2-Note Transition', attempts: 2, response: 'persistent_local_note_error' },
            ],
            persistentLocations: [{ measureNumber: 13, beatPosition: 2.5, pitch: 'G5->Eb5' }],
            leadingHypotheses: updatedHypotheses.filter(h => h.status === 'leading'),
            reasonForReferral: 'Persistent localized mechanical interval bottleneck in Bar 13 reached 3-attempt limit without resolution.',
            suggestedTeacherCheck: [
              'Check right hand valve hand position on 1st-to-2nd valve transition',
              'Check embouchure support when dropping from upper register G5 to Eb5',
            ],
            supportingAttemptIds: ['sim_att_1', 'sim_att_2', 'sim_att_3'],
            createdAt: new Date().toISOString(),
          };

          sim.teacherHandoffRecord = handoff;

          decisionOutcome = {
            decision: 'Refer',
            reason: 'The localized interval leap in Bar 13 has persisted across 3 focused attempts. Bounded limit reached: referred to teacher for embouchure/valve check.',
            retestRequired: false,
            teacherHandoff: handoff,
          };
        } else {
          decisionOutcome = {
            decision: 'Pivot',
            reason: 'Isolate the 2-note transition (DI-TRANSITION-01) for a maximum of 2-3 focused attempts.',
            recommendedStrategyId: 'DI-TRANSITION-01',
            retestRequired: false,
          };
        }
        break;
      }

      // ──────────────────────────────────────────────────────────────────────────
      // RESPONSE E: Stable with Strong Click, Unstable when Click Drops Out
      // ──────────────────────────────────────────────────────────────────────────
      case 'response_e_sparse_click_unstable': {
        responseTitle = 'Response E: Stable with Click, Drifts when Click Drops';
        responseExplanation = 'Passage is 92% accurate with a continuous metronome click, but rushes (+5.5 ms/beat) as soon as the click drops out. Confirms weak endogenous internal pulse (RC03).';
        ruleRef = 'RULE-RESP-E-SPARSE-CLICK-UNSTABLE';

        newEvidence = {
          id: `ev_resp_e_${Date.now()}`,
          source: 'diagnostic_intervention',
          interventionId: 'DI-SLOW-CLICK-01',
          capacityId: 'RC03',
          direction: 'strengthens',
          weight: 0.94,
          observation: 'Timing collapses under click dropout (+5.5 ms/beat drift during silent bars). Confirms internal pulse deficit.',
          metrics: { dropoutDriftMsPerBeat: 5.5 },
          createdAt: new Date().toISOString(),
        };

        updatedHypotheses = updatedHypotheses.map(h => {
          if (h.capacityId === 'RC03') {
            return {
              ...h,
              evidenceScore: 0.92,
              status: 'leading' as const,
              confidence: 'high' as const,
            };
          }
          return h;
        });

        decisionOutcome = {
          decision: 'Pivot',
          reason: 'Endogenous internal pulse deficit confirmed. Pivot to Gap Click (DI-GAP-CLICK-01) with progressive fading (levels 5 -> 1).',
          recommendedStrategyId: 'DI-GAP-CLICK-01',
          retestRequired: false,
          fadingSteps: ['Level 5: Continuous click', 'Level 3: 2 bars on / 2 bars off', 'Level 0: Unassisted retest'],
        };
        break;
      }
    }

    sim.diagnosticProfile.hypotheses = updatedHypotheses;
    sim.diagnosticProfile.evidence.push(newEvidence);
    sim.diagnosticProfile.updatedAt = new Date().toISOString();
    sim.finalDecision = decisionOutcome;

    if (decisionOutcome.decision === 'Refer') {
      sim.status = 'referred';
    } else if (decisionOutcome.decision === 'Pass') {
      sim.status = 'completed';
    }

    // Append GUIDE, EVALUATE & ADAPT Node
    const guideNode: ReasoningNode = {
      id: `${sim.id}_node_${stepNum}_guide_adapt`,
      sequence: stepNum,
      layer: 'guide_evaluate_adapt',
      title: responseTitle,
      simpleExplanation: `${responseExplanation} Next Decision: ${decisionOutcome.decision}. ${decisionOutcome.reason}`,
      status: decisionOutcome.decision === 'Refer' ? 'referred' : 'updated',
      knowledgeReferences: [
        {
          domainId: 'rhythm',
          knowledgebaseType: 'response_rule',
          recordId: ruleRef,
          label: responseTitle,
        },
        {
          domainId: 'rhythm',
          knowledgebaseType: 'referral_rule',
          recordId: 'RULE-REF-ATTEMPT-LIMIT-3',
          label: '2-to-3 Attempt Limit Rule',
        },
      ],
      evidenceUsed: [
        {
          id: newEvidence.id,
          source: newEvidence.source,
          capacityId: newEvidence.capacityId,
          direction: newEvidence.direction,
          weight: newEvidence.weight,
          observation: newEvidence.observation,
        },
      ],
      ruleReferences: [ruleRef, 'RULE-DECISION-FOUR-OUTCOME-CONTROLLER'],
      technicalDetails: {
        responsePattern: pattern,
        decision: decisionOutcome.decision,
        reason: decisionOutcome.reason,
        retestRequired: decisionOutcome.retestRequired,
        fadingSteps: decisionOutcome.fadingSteps,
        teacherHandoffGenerated: !!sim.teacherHandoffRecord,
      },
      result: {
        decision: decisionOutcome,
        updatedProfile: sim.diagnosticProfile,
      },
      timestamp: new Date().toISOString(),
    };

    sim.nodes.push(guideNode);
    sim.interventionHistory.push({
      interventionId: activeIntervention,
      interventionName: activeIntervention,
      attempts: request.attemptCount || 1,
      response: pattern as any,
      timestamp: new Date().toISOString(),
    });

    sim.updatedAt = new Date().toISOString();
    return sim;
  }

  /**
   * Retrieves simulation state and complete ordered reasoning trace.
   */
  public static getSimulationTrace(simulationId: string): SimulationState | undefined {
    return this.activeSimulations.get(simulationId);
  }

  /**
   * Saves a developer/pedagogy note on a knowledge record, domain, or simulation node.
   */
  public static saveNote(
    targetId: string,
    author: string,
    noteText: string,
    tags?: string[]
  ): KnowledgeNote {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newNote: KnowledgeNote = {
      id: noteId,
      targetRecordId: targetId,
      author: author || 'Pedagogical Designer',
      noteText,
      tags: tags || ['refinement'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existing = this.notesStore.get(targetId) || [];
    existing.push(newNote);
    this.notesStore.set(targetId, existing);
    return newNote;
  }

  /**
   * Retrieves all notes for a specific target ID or across the entire system.
   */
  public static getNotes(targetId?: string): KnowledgeNote[] {
    if (targetId) {
      return this.notesStore.get(targetId) || [];
    }
    const all: KnowledgeNote[] = [];
    this.notesStore.forEach(list => all.push(...list));
    return all;
  }

  /**
   * Generates a structured prompt formatted specifically for AI coding agents.
   */
  public static generateCodingInstructions(simulationId: string): CodingAgentInstructions {
    const sim = this.activeSimulations.get(simulationId);
    if (!sim) {
      throw new Error(`Simulation '${simulationId}' not found.`);
    }

    const notes = this.getNotes();
    const leadingHypotheses = sim.diagnosticProfile.hypotheses
      .filter(h => h.status === 'leading')
      .map(h => `${h.capacityId} (${h.label}, score: ${h.evidenceScore.toFixed(2)})`);

    const evidenceSummary = sim.diagnosticProfile.evidence.map(
      e => `[${e.source}] ${e.direction.toUpperCase()} ${e.capacityId}: ${e.observation}`
    );

    const steps = sim.nodes.map(n => ({
      layer: n.layer,
      title: n.title,
      explanation: n.simpleExplanation,
      rulesUsed: n.ruleReferences,
    }));

    const markdown = `# AIPC Pedagogical Refinement Instruction

**Target Domain:** \`${sim.domainId}\`  
**Problem Signature:** \`${sim.problemSignatureId}\`  
**Simulation Instance:** \`${sim.id}\`  
**Timestamp:** ${new Date().toISOString()}

---

## 1. Context & Diagnostic Profile
The pedagogical reasoning sequence moved through the four AIPC layers.
- **Leading Hypotheses:**
${leadingHypotheses.map(h => `  - ${h}`).join('\n')}
- **Cumulative Evidence:**
${evidenceSummary.map(e => `  - ${e}`).join('\n')}

---

## 2. Reasoning Trace Steps
${steps.map((s, idx) => `### Step ${idx + 1}: ${s.title} (Layer: \`${s.layer}\`)
* **Simple Explanation:** ${s.explanation}
* **Rules Applied:** ${s.rulesUsed.join(', ') || 'N/A'}`).join('\n\n')}

---

## 3. Decision Outcome
* **Final Pedagogical Action:** \`${sim.finalDecision?.decision || 'In Progress'}\`
* **Rationale:** ${sim.finalDecision?.reason || 'N/A'}
${sim.teacherHandoffRecord ? `* **Teacher Handoff Generated:** Reason: ${sim.teacherHandoffRecord.reasonForReferral}` : ''}

---

## 4. Designer & Developer Notes
${notes.length > 0 ? notes.map(n => `- **[${n.author}]** (${n.createdAt.substring(0, 10)}): ${n.noteText}`).join('\n') : '_No custom notes recorded._'}

---

## 5. Instructions for Coding Agent
Please refine the knowledgebase or strategy implementation following the rationale above:
1. Ensure the response interpretation strictly preserves multi-factor uncertainty.
2. Verify that the 2-to-3 attempt limit is strictly bounded before triggering referral.
3. Validate that scaffold fading gates require an unassisted transfer retest.
`;

    return {
      title: `Refinement Instructions: ${sim.problemSignatureId}`,
      generatedAt: new Date().toISOString(),
      problemSignatureId: sim.problemSignatureId,
      domainId: sim.domainId,
      summary: `Simulation of ${sim.problemSignatureId} with decision ${sim.finalDecision?.decision || 'active'}`,
      diagnosticContext: {
        leadingHypotheses,
        evidenceSummary,
      },
      reasoningTraceSteps: steps,
      developerNotes: notes.map(n => n.noteText),
      instructionsMarkdown: markdown,
    };
  }
}
