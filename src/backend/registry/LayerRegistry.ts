import type { AIPCLayer, AIPCLayerDefinition } from '../types/knowledge';

export class LayerRegistry {
  private static layers: Map<AIPCLayer, AIPCLayerDefinition> = new Map();

  static {
    this.initializeLayers();
  }

  private static initializeLayers(): void {
    // 1. DIAGNOSIS LAYER (2 subsets: Observe and Diagnosis Knowledgebases)
    this.layers.set('diagnosis', {
      id: 'diagnosis',
      sequence: 1,
      name: 'Diagnosis',
      subsetsLabel: '2 Subsets: Observe & Diagnosis Knowledgebases',
      description: 'Gathers factual performance telemetry and aligns attacks with the score (Observe subset), then maps problem signatures to multi-factor provisional hypotheses without forcing a single root cause (Diagnosis subset).',
      pedagogicalPurpose: 'Capture what actually happened musically without blame, and preserve multi-factor reality across internal clock, subdivision, reading, and physical motor faculties.',
      keyOutputs: [
        'Acoustic/Tap onset timestamps and alignment offsets',
        'Calculated tempo drift slope (ms/beat)',
        'Detected problem signatures (e.g. PS-RUSH-01)',
        'Provisional Diagnostic Profile with multi-factor evidence weights',
        'Candidate capacities (RC01–RC13) with confidence ratings',
      ],
      subsets: [
        {
          subsetId: 'observe',
          name: 'Observe Knowledgebase',
          description: 'Performance telemetry, acoustic note attacks, score structure, and quantitative problem signatures.',
          knowledgebases: [
            {
              type: 'problem_signature',
              label: 'Problem Signatures Knowledgebase',
              description: 'Formal definitions of performance anomalies, signature metrics, and trigger thresholds (e.g. Progressive Rushing, Syncopation Breakdown).',
            },
            {
              type: 'asset',
              label: 'Performance Telemetry & Score Assets',
              description: 'MusicXML score structure, note boundaries, and acoustic pitch/onset detectors.',
            },
          ],
        },
        {
          subsetId: 'diagnose',
          name: 'Diagnosis Knowledgebase',
          description: 'Controlled rhythmic/cognitive capacities (RC01–RC13), provisional multi-factor profiling, and cognitive vs. physical rules.',
          knowledgebases: [
            {
              type: 'capacity',
              label: 'Controlled Capacities Knowledgebase (RC01–RC13)',
              description: 'Operational definitions and failure modes for rhythmic, technical, and cognitive faculties.',
            },
            {
              type: 'diagnostic_intervention',
              label: 'Provisional Profiling & Diagnostic Rules',
              description: 'Rules distributing hypothesis weights across pulse, subdivision, and motor execution.',
            },
          ],
        },
      ],
      knowledgebasesUsed: [
        {
          type: 'problem_signature',
          label: 'Problem Signatures Knowledgebase',
          description: 'Formal definitions of performance anomalies, signature metrics, and trigger thresholds.',
        },
        {
          type: 'asset',
          label: 'Score & Alignment Telemetry Assets',
          description: 'MusicXML score structure, note boundaries, and acoustic pitch/onset detectors.',
        },
        {
          type: 'capacity',
          label: 'Controlled Capacities Knowledgebase (RC01–RC13)',
          description: 'Operational definitions and failure modes for rhythmic, technical, and cognitive faculties.',
        },
      ],
    });

    // 2. STRATEGY LAYER (Intervention Knowledgebase)
    this.layers.set('strategy', {
      id: 'strategy',
      sequence: 2,
      name: 'Strategy',
      subsetsLabel: 'Intervention Knowledgebase',
      description: 'Selects or offers an informative first-line intervention that immediately assists the learner while deliberately altering task variables to produce diagnostic evidence.',
      pedagogicalPurpose: 'Low-burden, high-utility strategy-as-probe. Offers learner choice (Option A vs Option B) while isolating single difficulty variables (blowing, speed, or subdivision).',
      keyOutputs: [
        'Selected diagnostic intervention (e.g. Shadow Fingering or Slower Tempo with Click)',
        'Learner choice state (Option A vs Option B) and SRL metadata',
        'Task modifications (isolated variables added, removed, or preserved)',
        'Bounded initial attempt limit (maximum 2–3 attempts)',
      ],
      subsets: [
        {
          subsetId: 'intervention',
          name: 'Intervention Knowledgebase',
          description: 'Diagnostic interventions catalog, repertoire choice router, and interactive practice scaffolds.',
          knowledgebases: [
            {
              type: 'diagnostic_intervention',
              label: 'Diagnostic Intervention Probes',
              description: 'Full definition of compound interventions, variables manipulated, and expected probe response patterns.',
            },
            {
              type: 'strategy',
              label: 'Practising Strategies Registry',
              description: 'Scaffold definitions (Gap Click, Tempo Ladder, X-ray Rhythm, Transition Isolation).',
            },
            {
              type: 'asset',
              label: 'Interactive Practice Scaffolds & Audio Assets',
              description: 'Tone.js metronome, click dropouts, backing audio, and visual score followers.',
            },
          ],
        },
      ],
      knowledgebasesUsed: [
        {
          type: 'diagnostic_intervention',
          label: 'Diagnostic Intervention Probes',
          description: 'Full definition of compound interventions, variables manipulated, and expected probe response patterns.',
        },
        {
          type: 'strategy',
          label: 'Practising Strategies Registry',
          description: 'Scaffold definitions (Gap Click, Tempo Ladder, X-ray Rhythm, Transition Isolation).',
        },
        {
          type: 'asset',
          label: 'Audio & Visual Scaffold Assets',
          description: 'Tone.js metronome, click dropouts, backing audio, and visual score followers.',
        },
      ],
    });

    // 3. GUIDE LAYER (Guide and Adapt Knowledgebase)
    this.layers.set('guide', {
      id: 'guide',
      sequence: 3,
      name: 'Guide',
      subsetsLabel: 'Guide and Adapt Knowledgebase',
      description: 'Evaluates learner response under scaffolds, updates diagnostic confidence weights, enforces attempt limits, and executes Pass, Persist, Pivot, or Refer decisions.',
      pedagogicalPurpose: 'Prevent mindless repetition by bounding practice to 2–3 attempts, smoothly fading support toward independent retest, or generating teacher handoff when assistance is needed.',
      keyOutputs: [
        'Response classification (Responses A through E)',
        'Updated Diagnostic Profile with weighted evidence',
        'Four-outcome pedagogical decision: Pass, Persist, Pivot, or Refer',
        'Support fading plan or Teacher Handoff Record',
      ],
      subsets: [
        {
          subsetId: 'guide_adapt',
          name: 'Guide and Adapt Knowledgebase',
          description: 'Response sieve rules, progression ladders, and teacher handoff triggers.',
          knowledgebases: [
            {
              type: 'response_rule',
              label: 'Response-Interpretation Rules (Responses A–E)',
              description: 'Deterministic rules mapping performance changes under scaffolds to hypothesis updates.',
            },
            {
              type: 'progression_rule',
              label: 'Progression & Fading Rules',
              description: 'Tempo ladder steps (+3, +5, +10 BPM), click dropout schedules, and unassisted retest gates.',
            },
            {
              type: 'referral_rule',
              label: 'Teacher Referral & Safety Rules',
              description: 'Attempt limits (2–3 attempts), physical distress safeguards, and teacher handoff generation.',
            },
          ],
        },
      ],
      knowledgebasesUsed: [
        {
          type: 'response_rule',
          label: 'Response-Interpretation Rules',
          description: 'Deterministic rules mapping performance changes under scaffolds to hypothesis updates.',
        },
        {
          type: 'progression_rule',
          label: 'Progression & Fading Rules',
          description: 'Tempo ladder steps (+3, +5, +10 BPM), click dropout schedules, and unassisted retest gates.',
        },
        {
          type: 'referral_rule',
          label: 'Referral & Safety Rules',
          description: 'Attempt limits (2–3 attempts), physical distress safeguards, and teacher handoff generation.',
        },
      ],
    });
  }

  public static getAllLayers(): AIPCLayerDefinition[] {
    return Array.from(this.layers.values()).sort((a, b) => a.sequence - b.sequence);
  }

  public static getLayer(id: AIPCLayer): AIPCLayerDefinition | undefined {
    // Direct match
    if (this.layers.has(id)) {
      return this.layers.get(id);
    }
    // Backward compatibility aliases
    if (id === 'observe' || id === 'diagnose') {
      return this.layers.get('diagnosis');
    }
    if (id === 'intervene') {
      return this.layers.get('strategy');
    }
    if (id === 'guide_evaluate_adapt') {
      return this.layers.get('guide');
    }
    return undefined;
  }
}
