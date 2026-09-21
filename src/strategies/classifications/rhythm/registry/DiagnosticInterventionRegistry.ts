import type {
  EvidenceDirection,
  InterventionResponse
} from '../types/diagnosticProfile';

export interface EvidenceUpdateRule {
  capacityId: string;
  direction: EvidenceDirection;
  weight: number;
  observation: string;
}

export interface ExpectedResponseRule {
  id: string;
  conditionDescription: string;
  responseType: InterventionResponse;
  evidenceUpdates: EvidenceUpdateRule[];
  recommendedNextActions: string[];
}

export interface DiagnosticInterventionDefinition {
  id: string;
  strategyIds: string[];
  name: string;
  applicableProblemSignatures: string[];
  candidateCapacities: string[];
  variablesAdded: string[];
  variablesRemoved: string[];
  variablesPreserved: string[];
  pedagogicalPurpose: string;
  diagnosticPurpose: string;
  expectedResponses: ExpectedResponseRule[];
  maxInitialAttempts: number;
  continueRule: string;
  pivotRule: string;
  referRule: string;
  supportFadePlan?: string;
  originalContextRetestRequired: boolean;
}

export class DiagnosticInterventionRegistry {
  private static interventions: Map<string, DiagnosticInterventionDefinition> = new Map();

  static {
    this.registerDefaults();
  }

  public static register(definition: DiagnosticInterventionDefinition): void {
    this.interventions.set(definition.id, definition);
  }

  public static get(id: string): DiagnosticInterventionDefinition | undefined {
    return this.interventions.get(id);
  }

  public static getAll(): DiagnosticInterventionDefinition[] {
    return Array.from(this.interventions.values());
  }

  public static getForProblem(problemSignatureId: string): DiagnosticInterventionDefinition[] {
    return this.getAll().filter(item =>
      item.applicableProblemSignatures.includes(problemSignatureId) ||
      item.applicableProblemSignatures.includes('*')
    );
  }

  private static registerDefaults(): void {
    // 1. DI-REF-SHADOW-01: Reference Listening with Shadow Fingering
    this.register({
      id: 'DI-REF-SHADOW-01',
      strategyIds: ['DI-REF-SHADOW-01', 'R24'],
      name: 'Reference Listening with Shadow Fingering',
      applicableProblemSignatures: ['PS-RUSH-01', 'PS-SUBDIV-01', 'PS-EXEC-01'],
      candidateCapacities: ['RC05', 'RC08', 'RC01'],
      variablesAdded: ['auditory_reference_model', 'visual_tracking_cursor'],
      variablesRemoved: ['tone_production', 'breath_support', 'embouchure_pressure'],
      variablesPreserved: ['target_tempo', 'written_pitches', 'fingering_movements'],
      pedagogicalPurpose: 'Allows mental rehearsal of pitch/fingering coordination at full tempo without tone production load.',
      diagnosticPurpose: 'Distinguishes melodic/fingering unfamiliarity (RC05) from instrumental acoustic execution (RC08).',
      maxInitialAttempts: 2,
      continueRule: 'Subsequent playing attempt improves substantially across two consecutive cycles.',
      pivotRule: 'No meaningful change across two transfer attempts -> Pivot to DI-SLOW-CLICK-01.',
      referRule: 'Learner repeatedly loses fingering sequence at the exact same note/transition after 3 focused attempts.',
      originalContextRetestRequired: true,
      expectedResponses: [
        {
          id: 'ref-resp-improved',
          conditionDescription: 'Subsequent active performance improves drift slope and accuracy by >= 25%',
          responseType: 'substantial_repeated_improvement',
          evidenceUpdates: [
            { capacityId: 'RC05', direction: 'strengthens', weight: 1.5, observation: 'Auditory reference & shadow fingering resolved timing acceleration.' },
            { capacityId: 'RC08', direction: 'weakens', weight: 1.0, observation: 'Movement sequence execution is sound once heard clearly.' }
          ],
          recommendedNextActions: ['retest_original', 'pass']
        },
        {
          id: 'ref-resp-finger-stumble',
          conditionDescription: 'Learner reports or shows consistent stumble at specific note transition during shadow fingering',
          responseType: 'persistent_local_note_error',
          evidenceUpdates: [
            { capacityId: 'RC08', direction: 'strengthens', weight: 2.0, observation: 'Physical finger coordination bottleneck at specific transition.' },
            { capacityId: 'RC03', direction: 'weakens', weight: 1.0, observation: 'Rushing is local symptom of fingering hurdle, not global pacemaker.' }
          ],
          recommendedNextActions: ['pivot_transition_isolation']
        },
        {
          id: 'ref-resp-secure-but-rushes',
          conditionDescription: 'Shadow fingering is smooth, but active sounding attempt continues to rush',
          responseType: 'no_meaningful_change',
          evidenceUpdates: [
            { capacityId: 'RC03', direction: 'strengthens', weight: 1.5, observation: 'Pulse acceleration persists despite clear representation.' },
            { capacityId: 'RC08', direction: 'strengthens', weight: 1.2, observation: 'Acoustic blow/articulation load drives tension.' }
          ],
          recommendedNextActions: ['pivot_tempo_reduction']
        }
      ]
    });

    // 2. DI-SLOW-CLICK-01: Tempo Reduction with Strong Click
    this.register({
      id: 'DI-SLOW-CLICK-01',
      strategyIds: ['DI-SLOW-CLICK-01', 'R22', 'R10'],
      name: 'Tempo Reduction with Strong Click',
      applicableProblemSignatures: ['PS-RUSH-01', 'PS-DRAG-01', 'PS-EXEC-01'],
      candidateCapacities: ['RC08', 'RC03', 'RC04'],
      variablesAdded: ['strong_continuous_beat_click'],
      variablesRemoved: ['target_tempo_speed_demand'],
      variablesPreserved: ['original_pitches', 'original_rhythms', 'original_articulations'],
      pedagogicalPurpose: 'Drops tempo by 20 BPM (or proportional floor) with continuous click to expose what stabilizes vs what remains broken.',
      diagnosticPurpose: 'Distinguishes speed-demand execution breakdown (RC08) from pulse autonomy weakness (RC03) or localized bottlenecks.',
      maxInitialAttempts: 3,
      continueRule: 'Rushing and errors resolve cleanly at reduced tempo; proceed with tempo restoration ladder.',
      pivotRule: 'Rushing disappears with click but returns when click density reduces -> Pivot to Gap Click (R12) or Sparse Metronome (R11). Same 2 notes fail -> Pivot to Transition Isolation (R16).',
      referRule: 'Global instability persists even at reduced tempo with strong click after 3 attempts.',
      originalContextRetestRequired: true,
      expectedResponses: [
        {
          id: 'slow-resp-all-cleared',
          conditionDescription: 'Rushing and timing errors completely resolve at -20 BPM',
          responseType: 'substantial_repeated_improvement',
          evidenceUpdates: [
            { capacityId: 'RC08', direction: 'strengthens', weight: 1.8, observation: 'Errors were driven by target-tempo motor speed limit.' },
            { capacityId: 'RC05', direction: 'weakens', weight: 1.2, observation: 'Rhythmic structure is properly understood.' }
          ],
          recommendedNextActions: ['tempo_ladder_increment']
        },
        {
          id: 'slow-resp-persistent-local',
          conditionDescription: 'Phrase timing stabilizes, but exact same 1-2 notes stumble repeatedly at reduced tempo',
          responseType: 'persistent_local_note_error',
          evidenceUpdates: [
            { capacityId: 'RC08', direction: 'strengthens', weight: 2.0, observation: 'Isolated technical/finger hurdle at transition.' }
          ],
          recommendedNextActions: ['pivot_transition_isolation']
        },
        {
          id: 'slow-resp-click-dependent',
          conditionDescription: 'Stable with strong click, but accelerates immediately when click density is reduced',
          responseType: 'support_dependent_improvement',
          evidenceUpdates: [
            { capacityId: 'RC03', direction: 'strengthens', weight: 2.0, observation: 'Click dependency; internal pacemaker fails without external anchor.' }
          ],
          recommendedNextActions: ['pivot_gap_click', 'pivot_sparse_metronome']
        },
        {
          id: 'slow-resp-rhythm-broken',
          conditionDescription: 'Rushing stops, but complex rhythmic subdivision remains inaccurate',
          responseType: 'persistent_rhythm_error',
          evidenceUpdates: [
            { capacityId: 'RC04', direction: 'strengthens', weight: 1.8, observation: 'Mental subdivision grid distorted.' },
            { capacityId: 'RC05', direction: 'strengthens', weight: 1.5, observation: 'Duration representation error.' }
          ],
          recommendedNextActions: ['pivot_explicit_subdivision']
        }
      ]
    });

    // 3. R12: Gap-Click Practice
    this.register({
      id: 'R12',
      strategyIds: ['R12', 'R13'],
      name: 'Gap-Click Practice (Internal Pulse Autonomy)',
      applicableProblemSignatures: ['PS-RUSH-01', 'PS-GAP-01'],
      candidateCapacities: ['RC03'],
      variablesAdded: ['silent_metric_intervals'],
      variablesRemoved: ['continuous_auditory_crutch'],
      variablesPreserved: ['tempo', 'pitches', 'rhythm'],
      pedagogicalPurpose: 'Trains internal pacemaker maintenance by fading metronome support during silent bars.',
      diagnosticPurpose: 'Proves whether temporal drift is caused by internal pulse autonomy failure (RC03).',
      maxInitialAttempts: 3,
      continueRule: 'Re-entry offset lands within +/- 45ms after silent bars.',
      pivotRule: 'Student drifts > 150ms during silence consistently -> Re-anchor with R11 Sparse Metronome before retry.',
      referRule: 'Drift fails to improve after 3 gap-click cycles.',
      originalContextRetestRequired: true,
      expectedResponses: [
        {
          id: 'gap-resp-steady',
          conditionDescription: 'Landing within +/- 45ms on click return after 2 bars of silence',
          responseType: 'substantial_repeated_improvement',
          evidenceUpdates: [
            { capacityId: 'RC03', direction: 'strengthens', weight: 2.0, observation: 'Internal pacemaker autonomy verified across silent gaps.' }
          ],
          recommendedNextActions: ['advance_support_level', 'retest_original']
        }
      ]
    });

    // 4. R20: Ghost Beat / X-ray Rhythm (Syncopation & Ties)
    this.register({
      id: 'R20',
      strategyIds: ['R20', 'R08'],
      name: 'Ghost Beat Subdivisions through Ties & Rests',
      applicableProblemSignatures: ['PS-SYNCOP-01'],
      candidateCapacities: ['RC06', 'RC04'],
      variablesAdded: ['audible_metric_lattice_through_ties'],
      variablesRemoved: [],
      variablesPreserved: ['tempo', 'pitches'],
      pedagogicalPurpose: 'Fills silent tied and offbeat spaces with ghost subdivisions so pulse lattice remains intact.',
      diagnosticPurpose: 'Determines whether syncopation errors stem from metric disorientation across ties (RC06).',
      maxInitialAttempts: 3,
      continueRule: 'Offbeat landings stabilize within 40ms.',
      pivotRule: 'Unassisted offbeat still misses -> Add R07 Explicit Subdivision.',
      referRule: 'Repeated metric disorientation after 3 attempts.',
      originalContextRetestRequired: true,
      expectedResponses: []
    });

    // 5. R16: Transition Isolation
    this.register({
      id: 'R16',
      strategyIds: ['R16'],
      name: 'Transition Isolation (2-to-4 Note Seam)',
      applicableProblemSignatures: ['PS-TRANS-01'],
      candidateCapacities: ['RC08'],
      variablesAdded: ['looping_micro_context'],
      variablesRemoved: ['surrounding_musical_context'],
      variablesPreserved: ['target_transition_pitches'],
      pedagogicalPurpose: 'Isolates 2-note physical seam into a relaxed repetition loop before expanding context.',
      diagnosticPurpose: 'Confirms whether localized error is purely biomechanical transit friction (RC08).',
      maxInitialAttempts: 3,
      continueRule: 'Seam executes without localized delay for 3 consecutive loops.',
      pivotRule: 'Seam remains stuck -> Check register / articulation reduction (R02).',
      referRule: 'Biomechanical blockage remains after 3 focused attempts -> Refer to teacher for physical check.',
      originalContextRetestRequired: true,
      expectedResponses: []
    });

    // 6. R02: Articulation Reduction
    this.register({
      id: 'R02',
      strategyIds: ['R02'],
      name: 'Articulation Reduction (Slurred Simplification)',
      applicableProblemSignatures: ['PS-RUSH-01', 'PS-EXEC-01'],
      candidateCapacities: ['RC08'],
      variablesAdded: ['continuous_legato_slur'],
      variablesRemoved: ['tonguing_articulation_load'],
      variablesPreserved: ['tempo', 'pitches', 'rhythm'],
      pedagogicalPurpose: 'Removes tonguing/re-attack friction to test if fingering and pulse are sound.',
      diagnosticPurpose: 'Isolates tonguing/coordination load from finger technique.',
      maxInitialAttempts: 2,
      continueRule: 'Slurred version succeeds -> Re-introduce articulation gradually.',
      pivotRule: 'Slurred version fails equally -> Pivot to Transition Isolation or Tempo Reduction.',
      referRule: 'Articulation coordination remains stuck after 3 attempts.',
      originalContextRetestRequired: true,
      expectedResponses: []
    });

    // 7. R07: Explicit Subdivision
    this.register({
      id: 'R07',
      strategyIds: ['R07'],
      name: 'Explicit Subdivision Micro-Grid',
      applicableProblemSignatures: ['PS-SUBDIV-01'],
      candidateCapacities: ['RC04'],
      variablesAdded: ['audible_subdivision_clicks'],
      variablesRemoved: [],
      variablesPreserved: ['tempo', 'notes'],
      pedagogicalPurpose: 'Saturates auditory field with exact subdivision (triplet/semiquaver) clicks.',
      diagnosticPurpose: 'Proves whether unevenness is due to mental subdivision grid distortion (RC04).',
      maxInitialAttempts: 3,
      continueRule: 'Subdivision variability sigma drops below 25ms.',
      pivotRule: 'Subdivision remains lumpy with clicks -> Pivot to Listen-Echo or R23 Burst Practice.',
      referRule: 'Unevenness persists after 3 attempts.',
      originalContextRetestRequired: true,
      expectedResponses: []
    });

    // 8. R23: Burst Practice
    this.register({
      id: 'R23',
      strategyIds: ['R23'],
      name: 'Burst Practice (Short Cell Target Tempo)',
      applicableProblemSignatures: ['PS-EXEC-01', 'PS-RUSH-01'],
      candidateCapacities: ['RC08', 'RC05'],
      variablesAdded: ['pauses_between_bursts'],
      variablesRemoved: ['continuous_endurance_demand'],
      variablesPreserved: ['target_tempo_speed'],
      pedagogicalPurpose: 'Executes small 3-4 note cells at full target tempo, chaining cells gradually.',
      diagnosticPurpose: 'Identifies whether motor pattern can fire cleanly in short bursts vs endurance failure.',
      maxInitialAttempts: 3,
      continueRule: 'Single cell succeeds at full tempo -> Chain adjacent cells.',
      pivotRule: 'Cell cannot fire even once at tempo -> Pivot to Tempo Ladder (R22).',
      referRule: 'Motor firing fails repeatedly -> Refer.',
      originalContextRetestRequired: true,
      expectedResponses: []
    });
  }
}
