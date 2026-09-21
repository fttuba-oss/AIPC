import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  X, CheckCircle, XCircle, AlertTriangle, 
  Sparkles, Volume2, Play, RefreshCw, 
  Mic, MicOff, ChevronRight,
  Sliders, ArrowRight, Layers,
  Square, RotateCcw
} from 'lucide-react';
import { StrategySession } from './core/session/StrategySession';
import { RhythmStrategySelector } from './classifications/rhythm/selector/RhythmStrategySelector';
import { RhythmStrategyRegistry } from './classifications/rhythm/registry/RhythmStrategyRegistry';
import { extractProblematicMeasures } from './classifications/rhythm/scaffolds/measureExtractor';
import { VexFlowRenderer } from './classifications/rhythm/scaffolds/VexFlowRenderer';
import { RhythmEngine, type TapGrade, type Measure, type Note, type TimeSignature } from './classifications/rhythm/scaffolds/rhythmEngine';
import { flattenMeasures, analyzeEmbeddedSubdivisions, type EmbeddedSubdivisionAnalysis } from './classifications/rhythm/scaffolds/rhythmHelper';
import { globalAudioInput } from './classifications/rhythm/scaffolds/audioInputManager';
import { StudentChatCompanion, type ChatMessage } from './components/StudentChatCompanion';
import type { MascotMood } from './components/InstrumentMascot';
import type { AssistanceConfig } from './classifications/rhythm/types/aipcStrategy';
import type { MusicalScoreContext } from './core/base/BaseStrategy';
import type { GenericProblemSignature, GenericHypothesis } from './core/types/strategy';
import { PolyrhythmPhaseWheel } from '../components/crossRhythm/PolyrhythmPhaseWheel';
import { CommonSubdivisionGrid } from '../components/crossRhythm/CommonSubdivisionGrid';
import { FirstLineRouter, type FirstLineRecommendation } from './classifications/rhythm/selector/FirstLineRouter';
import { ResponseInterpreter } from './classifications/rhythm/controllers/ResponseInterpreter';
import { DecisionController } from './classifications/rhythm/controllers/DecisionController';
import { CrossRhythmPracticeLoopController } from './classifications/rhythm/controllers/CrossRhythmPracticeLoopController';
import type { DiagnosticProfile, TeacherHandoffRecord } from './classifications/rhythm/types/diagnosticProfile';
import { TeacherHandoffModal } from './components/TeacherHandoffModal';
import { LearnerChoiceView } from './components/LearnerChoiceView';

interface AipcStrategyCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlContent: string | null;
  pieceTitle: string;
  measureRange?: [number, number];
  tempoBpm?: number;
  initialStrategyId?: string;
  onResolved: (summary: string) => void;
}

const RHYTHM_SCENARIOS = [
  {
    id: 'rushing',
    label: 'Progressive Rushing (Bars 6–10)',
    signature: {
      id: 'PS_RUSH_01',
      classification: 'rhythm' as const,
      label: 'Progressive Rushing across phrase',
      observation: 'Onsets accelerate by -6.2ms/beat across sixteenth note figures in bars 6–10.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC03', 'RC08'],
    },
    hypothesis: {
      capacityId: 'RC03',
      name: 'Internal Pulse Instability',
      confidence: 0.88,
      operationalDefinition: 'Inability to sustain periodic pulse without external metrical scaffolding.',
    },
  },
  {
    id: 'syncopation',
    label: 'Syncopation & Tie Beat Loss (Bars 6–10)',
    signature: {
      id: 'PS_SYNCOP_01',
      classification: 'rhythm' as const,
      label: 'Beat Loss across Tied Notes',
      observation: 'Errors cluster immediately following tied primary downbeats.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC06', 'RC04'],
    },
    hypothesis: {
      capacityId: 'RC06',
      name: 'Metrical Organisation Collapse',
      confidence: 0.89,
      operationalDefinition: 'Loss of hierarchical metric pulse during tied notes and syncopations.',
    },
  },
  {
    id: 'subdivision',
    label: 'Uneven Sixteenth Subdivisions (Bars 6–10)',
    signature: {
      id: 'PS_SUBDIV_01',
      classification: 'rhythm' as const,
      label: 'Uneven Sixteenth Subdivisions',
      observation: 'Timing variability SD = 34.2ms among equal-position sixteenth subdivisions.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC04', 'RC05'] as any[],
    },
    hypothesis: {
      capacityId: 'RC04',
      name: 'Subdivision Lattice Deficit',
      confidence: 0.84,
      operationalDefinition: 'Failure to mentally partition the beat into equal micro-intervals.',
    },
  },
  {
    id: 'execution',
    label: 'Instrumental Coordination Load (Bars 6–10)',
    signature: {
      id: 'PS_EXEC_01',
      classification: 'rhythm' as const,
      label: 'Hesitation during rapid fingering transition',
      observation: 'Vocal imitation accurate (+1.2ms); instrument stumbles (+54ms) on sixteenths.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC08'],
    },
    hypothesis: {
      capacityId: 'RC08',
      name: 'Instrumental Execution Load',
      confidence: 0.92,
      operationalDefinition: 'Biomechanical fingering and coordination load causing timing collapse.',
    },
  },
  {
    id: 'polyrhythm',
    label: 'Polyrhythm 3:2 Motor Assimilation (Bars 6–10)',
    signature: {
      id: 'PS_POLY_ASSIM_01',
      classification: 'rhythm' as const,
      label: 'Polyrhythmic Motor Assimilation (3:2)',
      observation: 'Non-coincident attacks in 3:2 pull together into false synchrony; coupling ratio < 0.45.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC11', 'RC04'],
    },
    hypothesis: {
      capacityId: 'RC11',
      name: 'Dual-Stream Phase Independence',
      confidence: 0.91,
      operationalDefinition: 'Inability to sustain competing periodicities without involuntary motor assimilation.',
    },
  },
  {
    id: 'cross_rhythm',
    label: 'Cross-Rhythm Attentional Capture (Bars 6–10)',
    signature: {
      id: 'PS_CROSS_CAP_01',
      classification: 'rhythm' as const,
      label: 'Attentional Capture / Beat Loss',
      observation: 'Primary metrical reference is abandoned when counter-rhythm enters; reference phase error > 180ms.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC12', 'RC02'],
    },
    hypothesis: {
      capacityId: 'RC12',
      name: 'Metrical Anchor Stability',
      confidence: 0.89,
      operationalDefinition: 'Loss of reference metre downbeat orientation under competing periodicity.',
    },
  },
  {
    id: 'hemiola',
    label: 'Cadential Hemiola Metric Shift (Bars 6–10)',
    signature: {
      id: 'PS_HEMIOLA_DISP_01',
      classification: 'rhythm' as const,
      label: 'Hemiola Pulse Fluctuation',
      observation: 'Pulse tempo accelerates by 12% during 3:2 regrouping across measure boundary.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC06', 'RC12'],
    },
    hypothesis: {
      capacityId: 'RC06',
      name: 'Metrical Organisation',
      confidence: 0.87,
      operationalDefinition: 'Difficulty preserving underlying pulse tempo across phrase-level metric shifts.',
    },
  },
  {
    id: 'additive',
    label: 'Additive Grouping 5/8 (3+2) Smoothing (Bars 6–10)',
    signature: {
      id: 'PS_ADD_REG_01',
      classification: 'rhythm' as const,
      label: 'Additive Asymmetry Regularization',
      observation: 'Uneven 3+2 eighth groupings are smoothed into equal subdivisions; duration ratio -> 1.0.',
      measureRange: [6, 10] as [number, number],
      candidateCapacityIds: ['RC13', 'RC06'],
    },
    hypothesis: {
      capacityId: 'RC13',
      name: 'Asymmetric Additive Chunking',
      confidence: 0.93,
      operationalDefinition: 'Tendency to regularize asymmetrical macro-beats into equal symmetrical intervals.',
    },
  },
];


type Phase = 'ready' | 'countdown' | 'practicing' | 'result';

export const AipcStrategyCoachModal: React.FC<AipcStrategyCoachModalProps> = ({
  isOpen,
  onClose,
  xmlContent,
  pieceTitle,
  measureRange = [6, 10],
  tempoBpm = 112,
  initialStrategyId,
  onResolved,
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(initialStrategyId || 'rushing');
  const activeScenario = useMemo(
    () => RHYTHM_SCENARIOS.find(s => s.id === selectedScenarioId) || RHYTHM_SCENARIOS[0],
    [selectedScenarioId]
  );

  const musicalContext: MusicalScoreContext = useMemo(() => ({
    xmlContent: xmlContent || '',
    startMeasure: measureRange[0],
    endMeasure: measureRange[1],
    tempoBpm: tempoBpm || 112,
    timeSignature: { beats: 4, beatType: 4 },
  }), [xmlContent, measureRange, tempoBpm]);

  // ── Diagnostic Profile State (AIPC Multi-Label Capacities) ────────────────
  const [diagnosticProfile, setDiagnosticProfile] = useState<DiagnosticProfile>(() => ({
    problemSignatureId: 'PS_RUSH_01',
    hypotheses: [
      { capacityId: 'RC01', label: 'Beat Perception', evidenceScore: 2.5, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC02', label: 'Beat Synchronisation', evidenceScore: 2.5, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC03', label: 'Internal Pulse', evidenceScore: 3.0, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC04', label: 'Subdivision', evidenceScore: 2.5, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC05', label: 'Pattern Representation', evidenceScore: 3.0, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC06', label: 'Metrical Organisation', evidenceScore: 2.5, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC07', label: 'Temporal Adaptation', evidenceScore: 2.5, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC08', label: 'Rhythmic Execution', evidenceScore: 3.0, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC09', label: 'Self-Monitoring & Correction', evidenceScore: 2.5, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
      { capacityId: 'RC10', label: 'Expressive Timing Control', evidenceScore: 2.5, confidence: 'moderate', status: 'possible', supportingEvidenceIds: [], conflictingEvidenceIds: [] },
    ],
    evidence: [],
    persistentLocations: [],
    unresolvedQuestions: [],
    updatedAt: new Date().toISOString(),
  }));

  // FirstLineRouter: determines whether to present General Front Door choice or Targeted Bypass
  const [routeRecommendation, setRouteRecommendation] = useState<FirstLineRecommendation>(() => {
    return FirstLineRouter.evaluateRoute(
      'PS_RUSH_01',
      {
        xmlContent: xmlContent || '',
        tempoBpm,
        measureRange,
      }
    );
  });

  // We do not need the front door here because we only enter when confirmed as a rhythm problem
  const [showLearnerChoice, setShowLearnerChoice] = useState<boolean>(false);

  // Decision and Attempt Tracking
  const [strategyAttemptsCount, setStrategyAttemptsCount] = useState<number>(0);
  const [totalAttemptsCount, setTotalAttemptsCount] = useState<number>(0);
  const [attemptedStrategies, setAttemptedStrategies] = useState<string[]>([]);
  const [showReflectionPrompt, setShowReflectionPrompt] = useState<boolean>(false);
  const [teacherHandoffRecord, setTeacherHandoffRecord] = useState<TeacherHandoffRecord | null>(null);
  const [showHandoffModal, setShowHandoffModal] = useState<boolean>(false);
  const [pivotNotice, setPivotNotice] = useState<{ targetStrategyId: string; message: string } | null>(null);

  // Strategy Session (Fading ladder 5 to 0)
  const [session, setSession] = useState<StrategySession>(() => {
    if (initialStrategyId) {
      const reg = RhythmStrategyRegistry.get(initialStrategyId);
      if (reg) {
        const strat = RhythmStrategyRegistry.create(initialStrategyId, { targetBpm: tempoBpm });
        return new StrategySession(strat, musicalContext, {
          id: `PS_${initialStrategyId}`,
          classification: 'rhythm',
          label: strat.name,
          observation: reg.useConditions[0] || 'Targeted coaching.',
          measureRange,
          candidateCapacityIds: reg.applicableCapacities,
        }, {
          capacityId: reg.applicableCapacities[0] || 'RC01',
          name: strat.name,
          confidence: 1.0,
          operationalDefinition: reg.procedureSteps[0] || 'Targeted practice.',
        });
      }
    }
    const strategy = new RhythmStrategySelector().select(
      activeScenario.signature,
      activeScenario.hypothesis
    );
    return new StrategySession(strategy, musicalContext, activeScenario.signature, activeScenario.hypothesis);
  });


  const sessionState = session.getState();
  const currentScaffold = session.getCurrentScaffold();

  // Extract the problematic bar/s from XML or representative fallback
  const extracted = useMemo(() => {
    return extractProblematicMeasures(
      xmlContent,
      measureRange[0],
      measureRange[1],
      'Trumpet 1'
    );
  }, [xmlContent, measureRange]);

  const targetMeasures: Measure[] = extracted.measures;

  // 4-beat XML rhythm measure: repeating Beat 1's 6-slot LCM grid tuplet across the 4 beats of a 4/4 bar
  const gridTarget4BeatsMeasure: Measure[] = useMemo(() => {
    const notes: Note[] = [];
    for (let b = 0; b < 4; b++) {
      notes.push(
        { id: `grid_b${b}_n1`, duration: '8dt', isRest: false, pitch: 'C4' }, // Slot 1: Dotted 8th tuplet (12 ticks)
        { id: `grid_b${b}_n2`, duration: '16t', isRest: false, pitch: 'E4' },  // Slot 4: 16th tuplet (4 ticks)
        { id: `grid_b${b}_n3`, duration: '8t', isRest: false, pitch: 'G4' },   // Slot 5: 8th tuplet (8 ticks)
      );
    }
    return [
      {
        id: `grid_4beat_loop_${extracted.startMeasure}`,
        timeSignature: { beatsPerMeasure: 4, beatValue: 4 },
        notes,
      }
    ];
  }, [extracted.startMeasure]);

  // Rhythm Trainer Engine State
  const [phase, setPhase] = useState<Phase>('ready');
  const [currentBeatPos, setCurrentBeatPos] = useState<number>(-4);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  const [noteTapsRecord, setNoteTapsRecord] = useState<Record<number, TapGrade['rating']>>({});
  const [latestFeedback, setLatestFeedback] = useState<{ rating: TapGrade['rating']; deltaMs: number } | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const isDemoModeRef = useRef<boolean>(false);
  useEffect(() => {
    isDemoModeRef.current = isDemoMode;
  }, [isDemoMode]);

  const [padActive, setPadActive] = useState<boolean>(false);
  const [visualTab, setVisualTab] = useState<'score' | 'phase_wheel' | 'subdivision_grid'>('subdivision_grid');
  const [crossRhythmRatio, setCrossRhythmRatio] = useState<[number, number]>([3, 2]);
  const [crossRhythmSlotVol, setCrossRhythmSlotVol] = useState<number>(1.0);

  // Step-by-Step Guided Practice Workflow state
  const [guidedStep, setGuidedStep] = useState<1 | 2 | 3 | 4>(1);
  const [isGuidedModeActive, setIsGuidedModeActive] = useState<boolean>(true);

  // Specific visual representation callers based on problem & strategy (Item 1)
  const callsForPhaseWheel = useMemo(() => {
    return Boolean(
      selectedScenarioId === 'polyrhythm' ||
      ['R34', 'R35', 'R37'].includes(sessionState?.strategyId || '')
    );
  }, [selectedScenarioId, sessionState?.strategyId]);

  const callsForSubdivisionGrid = useMemo(() => {
    return Boolean(
      selectedScenarioId === 'tuplet_cross_rhythm' ||
      selectedScenarioId === 'R33' ||
      selectedScenarioId?.includes('additive') ||
      ['R33', 'R38'].includes(sessionState?.strategyId || '') ||
      isGuidedModeActive
    );
  }, [selectedScenarioId, sessionState?.strategyId, isGuidedModeActive]);

  const hasSpecializedVisualTab = callsForPhaseWheel || callsForSubdivisionGrid;

  // Active measures for engine playback & grading: switches to the 4-beat grid loop when in grid view
  const activePracticeMeasures: Measure[] = useMemo(() => {
    if (visualTab === 'subdivision_grid') {
      return gridTarget4BeatsMeasure;
    }
    return targetMeasures;
  }, [visualTab, gridTarget4BeatsMeasure, targetMeasures]);


  // Result metrics for the completed trial
  const [lastAttemptResult, setLastAttemptResult] = useState<{
    passed: boolean;
    accuracy: number;
    perfectCount: number;
    goodCount: number;
    earlyLateCount: number;
    missCount: number;
    totalNotes: number;
    driftSlope: number;
  } | null>(null);

  // Active tempo state
  const [activeTempoBpm, setActiveTempoBpm] = useState<number>(tempoBpm || 112);
  useEffect(() => {
    if (tempoBpm) setActiveTempoBpm(tempoBpm);
  }, [tempoBpm]);

  // Mascot & Chat Companion State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');

  // Microphone state
  const [inputMode, setInputMode] = useState<'tap' | 'mic'>('tap');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micSensitivity, setMicSensitivity] = useState<number>(65);
  const [enableNotchFilter, setEnableNotchFilter] = useState<boolean>(true);
  const [showMicSettings, setShowMicSettings] = useState<boolean>(false);
  const [lastClapFlash, setLastClapFlash] = useState<boolean>(false);

  const highlightTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const clapFlashTimerRef = useRef<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  // Cross-Rhythm Pedagogical Loop Controller (Rules G1 to G8)
  const crossRhythmLoopRef = useRef<CrossRhythmPracticeLoopController | null>(null);
  if (!crossRhythmLoopRef.current) {
    crossRhythmLoopRef.current = new CrossRhythmPracticeLoopController(
      tempoBpm || 112,
      'student_01',
      `Bar_${extracted.startMeasure}_Beat_1`
    );
  }

  // Active 30s brain break countdown timer (Rule G8)
  const [breakCountdown, setBreakCountdown] = useState<number | null>(null);
  const breakTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (breakCountdown === null) return;
    if (breakCountdown <= 0) {
      setBreakCountdown(null);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        {
          id: `break-done-${Date.now()}`,
          sender: 'mascot',
          text: `✨ 30-Second Brain Break complete! Neural fatigue cleared. Ready to lock into the Beat 1 cross-rhythm at ${activeTempoBpm} BPM!`,
          timestamp: timeStr,
          highlight: true,
          actionOptions: [
            { key: 'ready_to_play', label: `Start at ${activeTempoBpm} BPM`, icon: '▶️', variant: 'primary' },
            { key: 'listen_demo', label: `🎧 Listen at ${activeTempoBpm} BPM`, icon: '🎧', variant: 'secondary' },
          ]
        }
      ]);
      setMascotMood('coaching');
      return;
    }

    breakTimerRef.current = window.setTimeout(() => {
      setBreakCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (breakTimerRef.current) clearTimeout(breakTimerRef.current);
    };
  }, [breakCountdown, activeTempoBpm]);

  // RhythmEngine instance
  const engineRef = useRef<RhythmEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new RhythmEngine();
  }
  const engine = engineRef.current;

  // Analyze measures to detect embedded subdivisions (e.g. triplets in 4/4)
  const embeddedAnalysis: EmbeddedSubdivisionAnalysis = useMemo(() => {
    return analyzeEmbeddedSubdivisions(targetMeasures);
  }, [targetMeasures]);

  // Compute AssistanceConfig for current Fading Ladder level
  const currentAssistanceConfig: AssistanceConfig = useMemo(() => {
    const lvl = sessionState.currentLevel;
    const isRetest = lvl === 5;
    const scaffoldConfig = (currentScaffold.assistanceConfig as any) || {};

    const defaultRatio = embeddedAnalysis.hasTuplets
      ? embeddedAnalysis.dominantRatio
      : (lvl === 0 ? 4 : 2);

    return {
      ...scaffoldConfig,
      level: lvl as any,
      temporalSupport: scaffoldConfig.temporalSupport || (isRetest ? 'None' : lvl === 0 ? 'Maximum' : lvl === 1 ? 'High' : lvl === 2 ? 'Moderate' : 'Low'),
      description: scaffoldConfig.description || `Assistance Level ${lvl} (${embeddedAnalysis.summary})`,
      subdivisionClicks: scaffoldConfig.subdivisionClicks !== undefined ? scaffoldConfig.subdivisionClicks : (lvl <= 1),
      subdivisionRatio: scaffoldConfig.subdivisionRatio || defaultRatio,
      beatSubdivisions: scaffoldConfig.beatSubdivisions || embeddedAnalysis.beatSubdivisionMap,
      embeddedSubdivisionType: embeddedAnalysis.type,
      gapClick: scaffoldConfig.gapClick ?? (lvl === 2 ? { playBars: 2, silentBars: 2 } : undefined),
      sparseClicksEveryNBeats: scaffoldConfig.sparseClicksEveryNBeats ?? (lvl === 2 ? 2 : undefined),
      clicksOnlyOnDownbeat: scaffoldConfig.clicksOnlyOnDownbeat ?? (lvl === 3),
      singlePitchOnly: scaffoldConfig.singlePitchOnly,
      ghostNotesAudible: scaffoldConfig.ghostNotesAudible,
    };
  }, [sessionState.currentLevel, currentScaffold, embeddedAnalysis]);

  // Sync with initialStrategyId or measureRange when modal opens
  useEffect(() => {
    if (isOpen) {
      const targetId = initialStrategyId || selectedScenarioId || 'rushing';
      handleScenarioChange(targetId);
    }
  }, [isOpen, initialStrategyId, measureRange?.[0], measureRange?.[1], tempoBpm]);

  // Initialize companion messages when modal opens or strategy changes
  useEffect(() => {
    if (!isOpen) return;
    prevLevelRef.current = sessionState.currentLevel;
    prevStatusRef.current = sessionState.status;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tupletNotice = embeddedAnalysis.hasTuplets
      ? `\n\n💡 Note: Embedded ${embeddedAnalysis.type} figures detected! Subdivision grid calibrated to ${embeddedAnalysis.dominantRatio} ticks/beat.`
      : '';

    setChatMessages([
      {
        id: `init-1-${Date.now()}`,
        sender: 'mascot',
        text: `AIPC diagnosed a cross-rhythm timing problem specifically on Beat 1 of Bar ${extracted.startMeasure} in ${extracted.partName}. We are focusing on this beat ONLY!\n\nTo build solid muscle memory, AIPC built out a 4-beat practice loop repeating this exact cross-rhythm across all 4 beats. Use the LCM visualizer on top to help you visualize the rhythm!`,
        timestamp: timeStr,
      },
      {
        id: `init-2-${Date.now()}`,
        sender: 'mascot',
        text: `Level ${sessionState.currentLevel} of 5: "${currentScaffold.mascotInstruction}"${tupletNotice}\n\n👉 Step 1: Listen to the reference demo first. Watch each note turn green as the orchestral woodblock marks attack slots [1, 4, 5] across each beat!`,
        timestamp: timeStr,
        highlight: true,
        actionOptions: [
          { key: 'listen_demo', label: '🎧 Step 1: Listen to Demo', icon: '🎧', variant: 'primary' },
          { key: 'ready_to_play', label: "Skip to Practice", icon: '⚡', variant: 'secondary' },
        ]
      }
    ]);
    setMascotMood('coaching');
  }, [isOpen, sessionState.strategyId, extracted.startMeasure, extracted.endMeasure, embeddedAnalysis]);

  // Announce level changes when student progresses or regresses on the fading ladder
  useEffect(() => {
    if (!isOpen) return;
    // Skip if initial mount or if neither level nor status has changed
    if (prevLevelRef.current === null) {
      prevLevelRef.current = sessionState.currentLevel;
      prevStatusRef.current = sessionState.status;
      return;
    }
    if (prevLevelRef.current === sessionState.currentLevel && prevStatusRef.current === sessionState.status) {
      return;
    }

    prevLevelRef.current = sessionState.currentLevel;
    prevStatusRef.current = sessionState.status;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sessionState.status === 'resolved') {
      setChatMessages(prev => [
        ...prev,
        {
          id: `resolved-${Date.now()}`,
          sender: 'mascot',
          text: `🎉 INCREDIBLE! Level 5 Retest passed with 0 assistance in the original musical context! You've mastered this rhythm!`,
          timestamp: timeStr,
          highlight: true,
          actionOptions: [
            { key: 'return_to_portal', label: 'Return to Student Portal', icon: '✅', variant: 'success' },
            { key: 'ready_to_play', label: 'Practice Again', icon: '🔄', variant: 'secondary' },
          ]
        }
      ]);
      setMascotMood('celebrating');
    } else {
      setChatMessages(prev => [
        ...prev,
        {
          id: `lvl-${sessionState.currentLevel}-${Date.now()}`,
          sender: 'mascot',
          text: sessionState.currentLevel === 5
            ? `🎯 Final Test (Level 5): Original musical context with silent retest! You've got this!`
            : `Level ${sessionState.currentLevel} of 5: "${currentScaffold.mascotInstruction}"\n\n👉 Step 1: Listen to the reference rhythm or jump directly to practice!`,
          timestamp: timeStr,
          highlight: true,
          actionOptions: sessionState.currentLevel === 5 ? [
            { key: 'ready_to_play', label: 'Start Final Retest (Level 5)', icon: '🎯', variant: 'amber' },
            { key: 'listen_demo', label: 'Listen Once More', icon: '🎧', variant: 'secondary' },
          ] : [
            { key: 'listen_demo', label: '🎧 Step 1: Listen to Demo', icon: '🎧', variant: 'primary' },
            { key: 'ready_to_play', label: `Start Practice (Level ${sessionState.currentLevel})`, icon: '▶️', variant: 'secondary' },
          ]
        }
      ]);
      setMascotMood('coaching');
    }
  }, [sessionState.currentLevel, sessionState.status, isOpen]);

  // Handle Scenario or Strategy switch
  const handleScenarioChange = (id: string) => {
    setSelectedScenarioId(id);
    engine.stop();
    setPhase('ready');
    setNoteTapsRecord({});
    setActiveNoteIndex(null);
    setLastAttemptResult(null);

    // Auto-switch visual tab for cross-rhythm scenarios and strategies
    if (['polyrhythm', 'R34', 'R35', 'R37'].includes(id)) {
      setVisualTab('phase_wheel');
      setCrossRhythmRatio([3, 2]);
    } else if (['R33', 'additive', 'R38'].includes(id)) {
      setVisualTab('subdivision_grid');
      setCrossRhythmRatio([3, 2]);
    } else if (['cross_rhythm', 'R36', 'hemiola'].includes(id)) {
      setVisualTab('score');
    }

    const regEntry = RhythmStrategyRegistry.get(id);

    if (regEntry) {
      const strategy = RhythmStrategyRegistry.create(id, {
        targetTempo: activeTempoBpm,
        baselineTempo: Math.round(activeTempoBpm * 0.6),
        stepBpm: 8,
      });
      const sig: GenericProblemSignature = {
        id: `PS_${id}`,
        classification: 'rhythm',
        label: `${regEntry.family}: ${strategy.name}`,
        observation: regEntry.useConditions[0] || 'Targeted rhythmic coaching on real score.',
        measureRange: measureRange,
        candidateCapacityIds: regEntry.applicableCapacities,
      };
      const hyp: GenericHypothesis = {
        capacityId: regEntry.applicableCapacities[0] || 'RC01',
        name: strategy.name,
        confidence: 1.0,
        operationalDefinition: regEntry.procedureSteps[0] || 'Real music practice coaching.',
      };
      setSession(new StrategySession(strategy, musicalContext, sig, hyp));
    } else {
      const scenario = RHYTHM_SCENARIOS.find(s => s.id === id) || RHYTHM_SCENARIOS[0];
      const strategy = new RhythmStrategySelector().select(scenario.signature, scenario.hypothesis);
      setSession(new StrategySession(strategy, musicalContext, scenario.signature, scenario.hypothesis));
    }
  };

  // Learner Choice selection handler
  const handleSelectLearnerChoice = (chosenStrategyId: string) => {
    setShowLearnerChoice(false);
    handleScenarioChange(chosenStrategyId);
    setMascotMood('coaching');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [
      ...prev,
      {
        id: `choice-${Date.now()}`,
        sender: 'mascot',
        text: chosenStrategyId === 'DI-REF-SHADOW-01'
          ? `🎧 You chose Option A: Reference Audio + Shadow Fingering! Listen to the reference audio and shadow-finger along with the cursor. Then we'll do an active attempt on your instrument!`
          : `🐢 You chose Option B: Tempo Reduction + Strong Click! We slowed down to a comfortable pace with an accented beat. Let's lock in your timing!`,
        timestamp: timeStr,
        actionOptions: [
          { key: 'ready_to_play', label: 'Start Exercise', icon: '▶️', variant: 'primary' },
          { key: 'listen_demo', label: 'Listen to Demo First', icon: '🎧', variant: 'secondary' },
        ]
      }
    ]);
  };

  // Evaluation with Dual-Purpose Response Interpretation & Decision Controller
  const processAttemptWithReflection = (result: any, reflectionKey?: string) => {
    setShowReflectionPrompt(false);

    const currentStrategyId = sessionState.strategyId;
    const isRetest = sessionState.currentLevel === 5;
    const newStrategyAttempts = strategyAttemptsCount + 1;
    const newTotalAttempts = totalAttemptsCount + 1;
    const newAttemptedStrategies = attemptedStrategies.includes(currentStrategyId)
      ? attemptedStrategies
      : [...attemptedStrategies, currentStrategyId];

    setStrategyAttemptsCount(newStrategyAttempts);
    setTotalAttemptsCount(newTotalAttempts);
    setAttemptedStrategies(newAttemptedStrategies);

    const baseline = {
      accuracyRate: 0.60,
      variabilityMs: 40,
      driftSlope: -5.4,
    };

    const attemptMetrics = {
      accuracyRate: result.accuracy,
      variabilityMs: result.passed ? 22 : 45,
      driftSlope: result.driftSlope,
      totalNotes: result.totalNotes,
    };

    // 1. Response Interpreter: generate evidence & update multi-label profile
    const interpretation = ResponseInterpreter.interpret(
      currentStrategyId,
      baseline,
      attemptMetrics,
      diagnosticProfile,
      reflectionKey
    );
    setDiagnosticProfile(interpretation.updatedProfile);

    // 2. Decision Controller: 4-way deterministic branch (Pass, Persist, Pivot, Refer)
    const decision = DecisionController.evaluateDecision({
      interventionId: currentStrategyId,
      currentLevel: sessionState.currentLevel,
      attemptsAtCurrentStrategy: newStrategyAttempts,
      totalInterventionAttempts: newTotalAttempts,
      strategiesAttemptedCount: newAttemptedStrategies.length,
      isOriginalContextRetest: isRetest,
      latestResponse: interpretation.responseType,
      currentAccuracy: result.accuracy,
      currentProfile: interpretation.updatedProfile,
    });

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (decision.decision === 'Pass') {
      session.recordAttempt({
        passed: true,
        notesAttempted: result.totalNotes,
        missCount: result.missCount,
        accuracyRate: result.accuracy,
        driftSlope: result.driftSlope,
        reentryErrorMs: 14,
      });
      setSession(new Proxy(session, {}));
      setMascotMood('celebrating');
      setChatMessages(prev => [
        ...prev,
        {
          id: `eval-pass-${Date.now()}`,
          sender: 'mascot',
          text: `🌟 ${decision.reason} (Accuracy: ${Math.round(result.accuracy * 100)}%). Ready to return to your repertoire!`,
          timestamp: timeStr,
          actionOptions: [
            { key: 'return_to_portal', label: 'Complete & Return to Portal', icon: '🏆', variant: 'primary' },
          ]
        }
      ]);
    } else if (decision.decision === 'Refer') {
      if (decision.teacherHandoff) {
        setTeacherHandoffRecord(decision.teacherHandoff);
        try {
          const stored = localStorage.getItem('aipc_teacher_handoff_records');
          const records = stored ? JSON.parse(stored) : [];
          records.unshift(decision.teacherHandoff);
          localStorage.setItem('aipc_teacher_handoff_records', JSON.stringify(records.slice(0, 10)));
        } catch (e) {
          console.warn('Could not save handoff record', e);
        }
        setShowHandoffModal(true);
      }
      setMascotMood('coaching');
      setChatMessages(prev => [
        ...prev,
        {
          id: `eval-refer-${Date.now()}`,
          sender: 'mascot',
          text: `🌱 ${decision.reason}`,
          timestamp: timeStr,
          actionOptions: [
            { key: 'view_handoff', label: 'View Teacher Handoff Report', icon: '📋', variant: 'primary' },
            { key: 'return_to_portal', label: 'Return to Portal', icon: '🚪', variant: 'secondary' },
          ]
        }
      ]);
    } else if (decision.decision === 'Pivot' && decision.nextInterventionId) {
      setPivotNotice({ targetStrategyId: decision.nextInterventionId, message: decision.reason });
      setMascotMood('coaching');
      setChatMessages(prev => [
        ...prev,
        {
          id: `eval-pivot-${Date.now()}`,
          sender: 'mascot',
          text: `🔄 Strategy Pivot: ${decision.reason}`,
          timestamp: timeStr,
          actionOptions: [
            { key: 'ready_to_play', label: `Start New Strategy [${decision.nextInterventionId}]`, icon: '▶️', variant: 'primary' },
            { key: 'listen_demo', label: 'Listen to Demo', icon: '🎧', variant: 'secondary' },
          ]
        }
      ]);
      handleScenarioChange(decision.nextInterventionId);
      setStrategyAttemptsCount(0);
    } else {
      // Persist
      if (result.passed) {
        setMascotMood('celebrating');
        setChatMessages(prev => [
          ...prev,
          {
            id: `eval-persist-pass-${Date.now()}`,
            sender: 'mascot',
            text: `🎯 ${decision.reason} (Score: ${Math.round(result.accuracy * 100)}%). Advancing fading ladder!`,
            timestamp: timeStr,
            actionOptions: [
              { key: 'ready_to_play', label: 'Next Attempt', icon: '▶️', variant: 'primary' },
              { key: 'listen_demo', label: 'Listen to Demo', icon: '🎧', variant: 'secondary' },
            ]
          }
        ]);
      } else {
        setMascotMood('coaching');
        setChatMessages(prev => [
          ...prev,
          {
            id: `eval-persist-fail-${Date.now()}`,
            sender: 'mascot',
            text: `💪 ${decision.reason} (${result.earlyLateCount} early/late notes). Let's keep working!`,
            timestamp: timeStr,
            actionOptions: [
              { key: 'ready_to_play', label: `Try Level ${sessionState.currentLevel} Again`, icon: '🔄', variant: 'primary' },
              { key: 'slower_tempo', label: 'Slower Tempo (-10 BPM)', icon: '🐢', variant: 'secondary' },
            ]
          }
        ]);
      }

      session.recordAttempt({
        passed: result.passed,
        notesAttempted: result.totalNotes,
        missCount: result.missCount,
        accuracyRate: result.accuracy,
        driftSlope: result.driftSlope,
        reentryErrorMs: result.passed ? 14 : 72,
      });
      setSession(new Proxy(session, {}));
    }
  };

  // Fast manual simulator for coach mode (Developer Tool)
  const handleFastSimulateAttempt = (passed: boolean) => {
    engine.stop();
    const flatNotes = flattenMeasures(targetMeasures).filter(n => !n.isRest);
    const totalNotes = flatNotes.length || 16;
    const accuracy = passed ? 0.94 : 0.58;
    const missCount = passed ? 0 : 4;
    const driftSlope = passed ? -0.4 : -5.8;

    const result = {
      passed,
      accuracy,
      perfectCount: passed ? Math.round(totalNotes * 0.8) : 4,
      goodCount: passed ? Math.round(totalNotes * 0.2) : 2,
      earlyLateCount: passed ? 0 : 6,
      missCount,
      totalNotes,
      driftSlope,
    };

    // Visually illuminate notes on the score stave/grid
    const flat = flattenMeasures(activePracticeMeasures);
    const newRecord: Record<number, 'Perfect' | 'Great' | 'Good' | 'Early' | 'Late' | 'Miss'> = {};
    flat.forEach((item, idx) => {
      if (!item.isRest && !item.isTiedStop) {
        newRecord[idx] = passed ? 'Perfect' : (idx % 2 === 0 ? 'Early' : 'Miss');
      }
    });
    setNoteTapsRecord(newRecord);

    setLastAttemptResult(result);
    setPhase('result');
    setActiveNoteIndex(null);
    setShowReflectionPrompt(false);

    // Cross-Rhythm LCM Loop evaluation (Rules G1 to G8)
    const loopRes = crossRhythmLoopRef.current?.registerAttempt(passed, accuracy);
    if (loopRes) {
      if (loopRes.recommendedBpm && loopRes.recommendedBpm !== activeTempoBpm) {
        setActiveTempoBpm(loopRes.recommendedBpm);
      }
      if (loopRes.handoffRecord) {
        setTeacherHandoffRecord(loopRes.handoffRecord);
        try {
          const stored = localStorage.getItem('aipc_teacher_handoff_records');
          const records = stored ? JSON.parse(stored) : [];
          records.unshift(loopRes.handoffRecord);
          localStorage.setItem('aipc_teacher_handoff_records', JSON.stringify(records.slice(0, 10)));
        } catch (e) {}
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        {
          id: `eval-${Date.now()}`,
          sender: 'mascot',
          text: loopRes.tootsMessage,
          timestamp: timeStr,
          highlight: true,
          actionOptions: loopRes.actionOptions,
        }
      ]);
      setMascotMood(passed ? 'celebrating' : 'coaching');
      return;
    }

    // Directly evaluate and advance ladder/chatbot feedback
    processAttemptWithReflection(result, passed ? 'steady' : 'rushed');
  };

  // Calculate assessment results on finish
  const handleExerciseComplete = useCallback(() => {
    const allItems = flattenMeasures(activePracticeMeasures);
    // Only count playable onsets (exclude rests and tied continuation notes)
    const activeIndices = allItems
      .map((item, index) => (!item.isRest && !item.isTiedStop ? index : -1))
      .filter(idx => idx !== -1);
    const totalNotes = activeIndices.length;

    let perfectCount = 0;
    let goodCount = 0;
    let earlyLateCount = 0;
    let missCount = 0;

    activeIndices.forEach((globalIdx) => {
      const rating = noteTapsRecord[globalIdx];
      if (rating === 'Perfect') perfectCount++;
      else if (rating === 'Great' || rating === 'Good') goodCount++;
      else if (rating === 'Early' || rating === 'Late') earlyLateCount++;
      else missCount++;
    });

    const accuracy = totalNotes > 0 ? (perfectCount + goodCount) / totalNotes : 0;
    const passed = accuracy >= 0.70; // 70% threshold to pass trial
    const driftSlope = passed ? -0.5 : -5.4;

    const result = {
      passed,
      accuracy,
      perfectCount,
      goodCount,
      earlyLateCount,
      missCount,
      totalNotes,
      driftSlope,
    };

    setLastAttemptResult(result);
    setPhase('result');
    setActiveNoteIndex(null);
    setShowReflectionPrompt(false);

    // Cross-Rhythm LCM Loop evaluation (Rules G1 to G8)
    const loopRes = crossRhythmLoopRef.current?.registerAttempt(passed, accuracy);
    if (loopRes) {
      if (loopRes.recommendedBpm && loopRes.recommendedBpm !== activeTempoBpm) {
        setActiveTempoBpm(loopRes.recommendedBpm);
      }
      if (loopRes.handoffRecord) {
        setTeacherHandoffRecord(loopRes.handoffRecord);
        try {
          const stored = localStorage.getItem('aipc_teacher_handoff_records');
          const records = stored ? JSON.parse(stored) : [];
          records.unshift(loopRes.handoffRecord);
          localStorage.setItem('aipc_teacher_handoff_records', JSON.stringify(records.slice(0, 10)));
        } catch (e) {}
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [
        ...prev,
        {
          id: `eval-${Date.now()}`,
          sender: 'mascot',
          text: loopRes.tootsMessage,
          timestamp: timeStr,
          highlight: true,
          actionOptions: loopRes.actionOptions,
        }
      ]);
      setMascotMood(passed ? 'celebrating' : 'coaching');
      return;
    }

    // Chatbot handles all communication and user check-in directly (Item 2)
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [
      ...prev,
      {
        id: `checkin-${Date.now()}`,
        sender: 'mascot',
        text: `Attempt finished: ${Math.round(accuracy * 100)}% accuracy (${perfectCount} perfect, ${goodCount} good, ${earlyLateCount} early/late). Choose your next step:`,
        timestamp: timeStr,
        highlight: true,
        actionOptions: [
          { key: 'reflection_steady', label: '✅ Continue / Advance', variant: 'success' },
          { key: 'reflection_rushed', label: '🔁 Retry at this Tempo', variant: 'amber' },
          { key: 'reflection_slow', label: '🐢 Slower Tempo', variant: 'secondary' },
        ]
      }
    ]);
  }, [activePracticeMeasures, noteTapsRecord]);



  // Connect RhythmEngine event callbacks
  useEffect(() => {
    engine.setTimeUpdateCallback((_seconds, beat) => {
      setCurrentBeatPos(beat);
      if (beat >= 0 && phase === 'countdown') {
        setPhase('practicing');
      }
    });

    engine.setNoteMissedCallback((noteIndex) => {
      // During reference demo playback, user is listening to groundtruth; suppress misses
      if (isDemoModeRef.current) return;

      setNoteTapsRecord(prev => {
        if (prev[noteIndex]) return prev;
        return { ...prev, [noteIndex]: 'Miss' };
      });
    });

    engine.setNoteSoundCallback((noteIndex) => {
      setActiveNoteIndex(noteIndex);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => setActiveNoteIndex(null), 140);

      // In Reference Audio / Demo mode: proactively turn the note green since the reference is groundtruth!
      if (isDemoModeRef.current) {
        const flat = flattenMeasures(activePracticeMeasures);
        setNoteTapsRecord(prev => {
          const nextRecord = { ...prev, [noteIndex]: 'Perfect' as const };
          let curr = noteIndex;
          while (curr < flat.length - 1 && flat[curr].tied && !flat[curr + 1].isRest) {
            nextRecord[curr + 1] = 'Perfect';
            curr++;
          }
          return nextRecord;
        });
      }
    });

    engine.setExerciseCompleteCallback(() => {
      // If reference demo playback just finished, preserve green notes, transition to ready, and prompt to practice
      if (isDemoModeRef.current) {
        setPhase('ready');
        setActiveNoteIndex(null);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const loopDemoRes = crossRhythmLoopRef.current?.onDemoCompleted();
        if (loopDemoRes) {
          setChatMessages(prev => [
            ...prev,
            {
              id: `demo-complete-${Date.now()}`,
              sender: 'mascot',
              text: loopDemoRes.tootsMessage,
              timestamp: timeStr,
              highlight: true,
              actionOptions: loopDemoRes.actionOptions,
            }
          ]);
          setMascotMood('coaching');
          return;
        }

        setChatMessages(prev => [
          ...prev,
          {
            id: `demo-complete-${Date.now()}`,
            sender: 'mascot',
            text: `🎧 Reference MIDI complete! Notice how every note turned green right on the beat. Now it's your turn to play!`,
            timestamp: timeStr,
            actionOptions: [
              { key: 'ready_to_play', label: "I'm Ready to Play!", icon: '🎺', variant: 'primary' },
              { key: 'listen_demo', label: 'Listen to Demo Again', icon: '🔁', variant: 'secondary' },
            ]
          }
        ]);
        setMascotMood('coaching');
        return;
      }
      handleExerciseComplete();
    });
  }, [engine, phase, handleExerciseComplete]);

  // Handle student tap (via Spacebar, mouse tap pad, or mic onset)
  const handleTap = useCallback(() => {
    if (phase !== 'practicing' || isDemoMode) return;

    // Use original algorithm for timing window grading (Perfect <=45ms, Good <=90ms, Early/Late <=160ms, Miss >160ms)
    const grade = engine.registerStudentTap();
    if (grade) {
      const flat = flattenMeasures(activePracticeMeasures);
      setNoteTapsRecord(prev => {
        const nextRecord = { ...prev, [grade.noteIndex]: grade.rating };
        // If note is tied into subsequent note(s), mark those notes with the same rating!
        let curr = grade.noteIndex;
        while (curr < flat.length - 1 && flat[curr].tied && !flat[curr + 1].isRest) {
          nextRecord[curr + 1] = grade.rating;
          curr++;
        }
        return nextRecord;
      });
      setLatestFeedback({ rating: grade.rating, deltaMs: grade.deltaMs });
      setActiveNoteIndex(grade.noteIndex);

      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => setLatestFeedback(null), 1200);

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => setActiveNoteIndex(null), 140);
    }
  }, [phase, isDemoMode, engine, activePracticeMeasures]);

  // Start Practice Attempt
  const startPracticeAttempt = useCallback(async (isDemo: boolean = false) => {
    setIsDemoMode(isDemo);
    isDemoModeRef.current = isDemo;
    setNoteTapsRecord({});
    setActiveNoteIndex(null);
    setLatestFeedback(null);
    setLastAttemptResult(null);

    const timeSig: TimeSignature = activePracticeMeasures[0]?.timeSignature || { beatsPerMeasure: 4, beatValue: 4 };
    setCurrentBeatPos(-timeSig.beatsPerMeasure);
    setPhase('countdown');

    engine.setPlayRhythmNotes(isDemo);
    engine.setAssistanceConfig(currentAssistanceConfig);
    engine.setPattern(flattenMeasures(activePracticeMeasures), activeTempoBpm, timeSig, activePracticeMeasures);
    await engine.start();
  }, [activePracticeMeasures, activeTempoBpm, currentAssistanceConfig, engine]);

  // Stop exercise at any time
  const handleStopExercise = useCallback(() => {
    engine.stop();
    setPhase('ready');
    setIsDemoMode(false);
    isDemoModeRef.current = false;
    setActiveNoteIndex(null);
    setLatestFeedback(null);
    setCurrentBeatPos(0);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [
      ...prev,
      {
        id: `stop-${Date.now()}`,
        sender: 'mascot',
        text: '⏹️ Exercise stopped. Take your time! Tap "Start Practice" or "Listen to Demo" when you want to try again.',
        timestamp: timeStr,
        actionOptions: [
          { key: 'ready_to_play', label: 'Start Practice', icon: '▶️', variant: 'primary' },
          { key: 'listen_demo', label: 'Listen to Demo', icon: '🎧', variant: 'secondary' },
        ]
      }
    ]);
    setMascotMood('coaching');
  }, [engine]);

  // Restart exercise at any time
  const handleRestartExercise = useCallback((isDemo?: boolean) => {
    engine.stop();
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    const demo = isDemo !== undefined ? isDemo : isDemoModeRef.current;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [
      ...prev,
      {
        id: `restart-${Date.now()}`,
        sender: 'mascot',
        text: demo 
          ? `🔄 Restarting reference demo from the beginning...`
          : `🔄 Restarting exercise with fresh 4-beat count-in at ${activeTempoBpm} BPM!`,
        timestamp: timeStr,
      }
    ]);
    startPracticeAttempt(demo);
  }, [engine, activeTempoBpm, startPracticeAttempt]);

  // Keyboard controls: Space (tap/start), Escape (stop), R (restart)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (e.code === 'Space') {
        if (!isInput) {
          if (phase === 'practicing' && !isDemoMode) {
            e.preventDefault();
            handleTap();
          } else if (phase === 'ready' || phase === 'result') {
            e.preventDefault();
            startPracticeAttempt(false);
          }
        }
      } else if (e.code === 'Escape') {
        if (phase === 'countdown' || phase === 'practicing') {
          e.preventDefault();
          handleStopExercise();
        }
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        if (!isInput && (phase === 'countdown' || phase === 'practicing')) {
          e.preventDefault();
          handleRestartExercise();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap, phase, isDemoMode, startPracticeAttempt, handleStopExercise, handleRestartExercise]);

  // Exit back to student portal
  const handleFinishAndReturn = useCallback(() => {
    engine.stop();
    onResolved(`Mastered ${sessionState.strategyName} with Level 0 Retest passed! Scaffold successfully faded.`);
    onClose();
  }, [engine, onResolved, sessionState.strategyName, onClose]);

  // Companion quick action handler
  const handleChatQuickAction = useCallback((actionKey: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (actionKey === 'return_to_portal') {
      handleFinishAndReturn();
      return;
    }
    if (actionKey === 'stop_exercise') {
      handleStopExercise();
      return;
    }
    if (actionKey === 'restart_exercise') {
      handleRestartExercise(false);
      return;
    }
    if (actionKey === 'restart_demo') {
      handleRestartExercise(true);
      return;
    }
    if (actionKey === 'view_handoff') {
      setShowHandoffModal(true);
      return;
    }

    if (actionKey.startsWith('reflection_')) {
      const reflectionMap: Record<string, string | undefined> = {
        'reflection_steady': 'steady',
        'reflection_rushed': 'rushed',
        'reflection_stumbled': 'stumbled',
        'reflection_slow': 'stiff',
        'reflection_skip': undefined,
      };
      const reflectionVal = reflectionMap[actionKey];
      if (lastAttemptResult) {
        processAttemptWithReflection(lastAttemptResult, reflectionVal);
      }
      return;
    }

    if (actionKey === 'apply_bpm_drop_10') {
      const newBpm = Math.max(50, activeTempoBpm - 10);
      setActiveTempoBpm(newBpm);
      const res = crossRhythmLoopRef.current?.applyTempoChange(newBpm);
      if (res) {
        setChatMessages(prev => [
          ...prev,
          { id: `drop10-${Date.now()}`, sender: 'student', text: `Drop tempo to ${newBpm} BPM (-10)`, timestamp: timeStr },
          { id: `mascot-drop10-${Date.now()}`, sender: 'mascot', text: res.tootsMessage, timestamp: timeStr, actionOptions: res.actionOptions }
        ]);
      }
      return;
    }
    if (actionKey === 'apply_bpm_drop_20') {
      const newBpm = Math.max(50, activeTempoBpm - 20);
      setActiveTempoBpm(newBpm);
      const res = crossRhythmLoopRef.current?.applyTempoChange(newBpm);
      if (res) {
        setChatMessages(prev => [
          ...prev,
          { id: `drop20-${Date.now()}`, sender: 'student', text: `Drop tempo to ${newBpm} BPM (-20)`, timestamp: timeStr },
          { id: `mascot-drop20-${Date.now()}`, sender: 'mascot', text: res.tootsMessage, timestamp: timeStr, actionOptions: res.actionOptions }
        ]);
      }
      return;
    }
    if (actionKey === 'drop_10_initial') {
      const newBpm = Math.max(50, activeTempoBpm - 10);
      setActiveTempoBpm(newBpm);
      const res = crossRhythmLoopRef.current?.applyTempoChange(newBpm);
      if (res) {
        setChatMessages(prev => [
          ...prev,
          { id: `drop10init-${Date.now()}`, sender: 'student', text: `Start slower at ${newBpm} BPM`, timestamp: timeStr },
          { id: `mascot-drop10init-${Date.now()}`, sender: 'mascot', text: res.tootsMessage, timestamp: timeStr, actionOptions: res.actionOptions }
        ]);
      }
      return;
    }
    if (actionKey === 'apply_bpm_floor') {
      const newBpm = Math.max(48, activeTempoBpm - 10);
      setActiveTempoBpm(newBpm);
      const res = crossRhythmLoopRef.current?.applyTempoChange(newBpm);
      if (res) {
        setChatMessages(prev => [
          ...prev,
          { id: `floor-${Date.now()}`, sender: 'student', text: `Test floor at ${newBpm} BPM`, timestamp: timeStr },
          { id: `mascot-floor-${Date.now()}`, sender: 'mascot', text: res.tootsMessage, timestamp: timeStr, actionOptions: res.actionOptions }
        ]);
      }
      return;
    }
    if (actionKey === 'consolidate_rung') {
      const res = crossRhythmLoopRef.current?.consolidateRung();
      if (res) {
        setActiveTempoBpm(res.recommendedBpm);
        setChatMessages(prev => [
          ...prev,
          { id: `consolidate-${Date.now()}`, sender: 'student', text: `Consolidate at ${res.recommendedBpm} BPM`, timestamp: timeStr },
          { id: `mascot-consolidate-${Date.now()}`, sender: 'mascot', text: res.tootsMessage, timestamp: timeStr, actionOptions: res.actionOptions }
        ]);
      }
      return;
    }
    if (actionKey === 'take_break') {
      setBreakCountdown(30);
      setChatMessages(prev => [
        ...prev,
        { id: `user-break-${Date.now()}`, sender: 'student', text: 'I need a quick 30-second break', timestamp: timeStr },
        { 
          id: `mascot-break-${Date.now()}`, 
          sender: 'mascot', 
          text: `☕ Great decision! Taking a 30-second neural rest. Close your eyes, shake out your fingers and shoulders, and breathe deeply. Timer started!`, 
          timestamp: timeStr 
        }
      ]);
      return;
    }
    if (actionKey === 'handoff_exit') {
      const res = crossRhythmLoopRef.current?.triggerTeacherReferral('Student chose teacher handoff after tempo floor check.');
      if (res?.handoffRecord) {
        setTeacherHandoffRecord(res.handoffRecord);
        try {
          const stored = localStorage.getItem('aipc_teacher_handoff_records');
          const records = stored ? JSON.parse(stored) : [];
          records.unshift(res.handoffRecord);
          localStorage.setItem('aipc_teacher_handoff_records', JSON.stringify(records.slice(0, 10)));
        } catch (e) {}
        setChatMessages(prev => [
          ...prev,
          { id: `user-handoff-${Date.now()}`, sender: 'student', text: 'Save this for my teacher', timestamp: timeStr },
          { id: `mascot-handoff-${Date.now()}`, sender: 'mascot', text: res.tootsMessage, timestamp: timeStr, actionOptions: res.actionOptions }
        ]);
      }
      return;
    }
    if (actionKey === 'confirm_handoff_exit') {
      engine.stop();
      onResolved('Referred to Teacher for Bar 1 cross-rhythm. Ready to advance to the next section on your practice agenda!');
      onClose();
      return;
    }

    if (actionKey === 'listen_demo') {
      const promptText = `🎧 Playing reference demo for Bar ${extracted.startMeasure} Beat 1 cross-rhythm (4-beat practice loop at ${activeTempoBpm} BPM)... Listen closely and watch each note light up green!`;

      setChatMessages(prev => [
        ...prev,
        { id: `user-${Date.now()}`, sender: 'student', text: 'Play the demo for me!', timestamp: timeStr },
        { 
          id: `mascot-${Date.now()}`, 
          sender: 'mascot', 
          text: promptText, 
          timestamp: timeStr,
        }
      ]);
      setMascotMood('listening');
      startPracticeAttempt(true);
    } else if (actionKey === 'ready_to_play') {
      const promptText = `Starting 4-beat count-in at ${activeTempoBpm} BPM! Get ready to tap the 4-beat cross-rhythm loop on attack slots [1, 4, 5].`;

      setChatMessages(prev => [
        ...prev,
        { id: `user-${Date.now()}`, sender: 'student', text: "I'm ready to play!", timestamp: timeStr },
        { id: `mascot-${Date.now()}`, sender: 'mascot', text: promptText, timestamp: timeStr }
      ]);
      setMascotMood('coaching');
      startPracticeAttempt(false);
    } else if (actionKey === 'what_to_do') {
      let advice = '';
      if (isDemoMode) {
        advice = `We are currently playing the reference demo. Listen closely to the rhythm and watch how each note lights up right on the beat. When it finishes, it'll be your turn to play!`;
      } else if (phase === 'practicing') {
        advice = `You're currently in active practice! Tap the spacebar or clap into your mic in time with the notes on the stave.`;
      } else if (phase === 'result' && lastAttemptResult) {
        if (lastAttemptResult.passed) {
          advice = `You passed that last attempt with ${Math.round(lastAttemptResult.accuracy * 100)}% accuracy! Click "I'm ready to play!" or press Spacebar to keep your momentum going and advance to the next level.`;
        } else {
          advice = `Your last attempt was ${Math.round(lastAttemptResult.accuracy * 100)}% (${lastAttemptResult.earlyLateCount} early/late notes). Click "Slower tempo" to ease the pace by 10 BPM, or click "Play it for me" to hear the reference demo again before trying!`;
        }
      } else {
        advice = `Right now we're isolating the Bar ${extracted.startMeasure} Beat 1 cross-rhythm loop (Level ${sessionState.currentLevel}: "${currentScaffold.mascotInstruction}"). Click "Play it for me" to hear the reference demo, or click "I'm ready to play!" to tap along!`;
      }

      setChatMessages(prev => [
        ...prev,
        { id: `user-${Date.now()}`, sender: 'student', text: 'What do I do?', timestamp: timeStr },
        { 
          id: `mascot-${Date.now()}`, 
          sender: 'mascot', 
          text: advice, 
          timestamp: timeStr,
          actionOptions: [
            { key: 'ready_to_play', label: `Start Practice (Level ${sessionState.currentLevel})`, icon: '▶️', variant: 'primary' },
            { key: 'listen_demo', label: 'Play it for me', icon: '🎧', variant: 'secondary' },
            { key: 'slower_tempo', label: 'Slower tempo (-10 BPM)', icon: '🐢', variant: 'secondary' },
          ]
        }
      ]);
      setMascotMood('coaching');
    } else if (actionKey === 'slower_tempo') {
      const newTempo = Math.max(50, activeTempoBpm - 10);
      setActiveTempoBpm(newTempo);
      const targetName = `the Bar ${extracted.startMeasure} Beat 1 cross-rhythm loop`;

      setChatMessages(prev => [
        ...prev,
        { id: `user-${Date.now()}`, sender: 'student', text: 'Slower tempo please', timestamp: timeStr },
        { 
          id: `mascot-${Date.now()}`, 
          sender: 'mascot', 
          text: `Slowed tempo down from ${activeTempoBpm} to ${newTempo} BPM! Let's lock in ${targetName} at a steady, comfortable pace.`, 
          timestamp: timeStr,
          actionOptions: [
            { key: 'ready_to_play', label: `Start at ${newTempo} BPM`, icon: '▶️', variant: 'primary' },
            { key: 'listen_demo', label: 'Listen at this Tempo', icon: '🎧', variant: 'secondary' },
          ]
        }
      ]);
      setMascotMood('coaching');
    } else if (actionKey === 'goto_step_1') {
      handleSelectGuidedStep(1);
    } else if (actionKey === 'goto_step_2') {
      handleSelectGuidedStep(2);
    } else if (actionKey === 'goto_step_3') {
      handleSelectGuidedStep(3);
    } else if (actionKey === 'goto_step_4') {
      handleSelectGuidedStep(4);
    }
  }, [extracted.startMeasure, extracted.endMeasure, activeTempoBpm, sessionState.currentLevel, currentScaffold.mascotInstruction, startPracticeAttempt, handleFinishAndReturn]);

  // Companion student text question handler
  const handleSendChatMessage = useCallback((text: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lower = text.toLowerCase();
    let reply = `Great question! Focus on feeling the underlying pulse on beats 1 and 3. On Level ${sessionState.currentLevel}, the audio guide will keep you steady!`;
    let actionOptions: any = undefined;

    if (lower.includes('tempo') || lower.includes('speed') || lower.includes('fast') || lower.includes('slow')) {
      reply = `Current tempo is ${activeTempoBpm} BPM. You can click 'Slower tempo' below if you want to slow it down, or practice at this tempo with spacebar / microphone!`;
      actionOptions = [
        { key: 'slower_tempo', label: 'Slower Tempo (-10 BPM)', icon: '🐢', variant: 'secondary' },
        { key: 'ready_to_play', label: `Play at ${activeTempoBpm} BPM`, icon: '▶️', variant: 'primary' },
      ];
    } else if (lower.includes('tie') || lower.includes('syncop') || lower.includes('offbeat')) {
      reply = `Syncopated notes steal the accent from the downbeat! Count '1-and-2-and' and sustain through the tied beat without anticipating the next entrance.`;
      actionOptions = [
        { key: 'listen_demo', label: 'Listen to Groove Demo', icon: '🎧', variant: 'primary' },
        { key: 'ready_to_play', label: "I'm Ready to Try", icon: '🎺', variant: 'amber' },
      ];
    } else if (lower.includes('mic') || lower.includes('clap') || lower.includes('space') || lower.includes('tap')) {
      reply = `You can tap the spacebar, click the tap pad, or turn on the microphone to clap or play your trumpet. Spacebar gives the most precise timing feedback!`;
      actionOptions = [
        { key: 'ready_to_play', label: 'Start Practice', icon: '▶️', variant: 'primary' },
      ];
    } else if (lower.includes('level') || lower.includes('ladder') || lower.includes('retest')) {
      reply = `We use a 0-to-5 fading ladder: Level 0 gives maximum assistance, fading support away as you advance with 70%+ scores. Level 5 is the final unassisted retest in original context!`;
      actionOptions = [
        { key: 'ready_to_play', label: `Start Level ${sessionState.currentLevel}`, icon: '▶️', variant: 'primary' },
      ];
    } else if (lower.includes('subdivision') || lower.includes('pivot') || lower.includes('why') || lower.includes('fail') || lower.includes('change')) {
      reply = `When an exercise fails twice in a row, AIPC's pedagogical rules trigger an automated Strategy Pivot! The first attempt suggested slowing down tempo (Persist). But when timing still struggled on the second attempt, AIPC diagnosed that tempo wasn't the bottleneck—the underlying difficulty was mentally dividing the beat (Subdivision Capacity RC04). AIPC therefore pivoted to Explicit Subdivision (R07) to turn on an audible micro-tick grid for every slot!`;
      actionOptions = [
        { key: 'listen_demo', label: '🎧 Listen with Subdivision', icon: '🎧', variant: 'primary' },
        { key: 'ready_to_play', label: "Start Practice", icon: '▶️', variant: 'secondary' },
      ];
    }

    setChatMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'student', text, timestamp: timeStr },
      { id: `mascot-${Date.now()}`, sender: 'mascot', text: reply, timestamp: timeStr, actionOptions }
    ]);
    setMascotMood('coaching');
  }, [activeTempoBpm, sessionState.currentLevel]);

  // Microphone toggle handlers
  const enableMicrophone = useCallback(async () => {
    try {
      setMicError(null);
      await globalAudioInput.start();
      globalAudioInput.setSensitivity(micSensitivity);
      globalAudioInput.setNotchFilter(enableNotchFilter);
      setIsMicActive(true);
      setInputMode('mic');
    } catch (err: any) {
      console.error('Failed to start microphone:', err);
      setMicError('Microphone permission denied. Using Spacebar / Tap mode instead.');
      setIsMicActive(false);
      setInputMode('tap');
    }
  }, [micSensitivity, enableNotchFilter]);

  const disableMicrophone = useCallback(() => {
    globalAudioInput.stop();
    setIsMicActive(false);
    setInputMode('tap');
  }, []);

  // Guided Practice Stepper Handler
  const handleSelectGuidedStep = useCallback((step: 1 | 2 | 3 | 4) => {
    setGuidedStep(step);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (step === 1) {
      setVisualTab('subdivision_grid');
      setCrossRhythmRatio([3, 2]);
      disableMicrophone();
      setInputMode('tap');
      setChatMessages(prev => [
        ...prev,
        {
          id: `step-1-${Date.now()}`,
          sender: 'mascot',
          text: `🎯 Step 1: Touchpad or Spacebar Tap Rehearsal!\n\nInternalize the 6-slot LCM microtick grid on Slots 1, 4, and 5! Slot 1 is the coincidence downbeat, Slot 4 is the straight "&" (1/2 point), and Slot 5 is the triplet "li" (2/3 point).\n\n👉 Press Spacebar or tap the on-screen Touchpad right on Slots 1, 4, and 5 with the metronome. No trumpet needed yet!`,
          timestamp: timeStr,
          highlight: true,
          actionOptions: [
            { key: 'ready_to_play', label: 'Start Tap Practice', icon: '▶️', variant: 'primary' },
            { key: 'goto_step_2', label: 'Next: 🎺 Step 2 Single-Pitch', icon: '🎺', variant: 'secondary' },
          ]
        }
      ]);
    } else if (step === 2) {
      setVisualTab('score');
      enableMicrophone();
      setChatMessages(prev => [
        ...prev,
        {
          id: `step-2-${Date.now()}`,
          sender: 'mascot',
          text: `🎺 Step 2: Single-Pitch Trumpet Transfer!\n\nPick up your trumpet and play a single steady pitch (e.g., tuning C or G) on the rhythm [1, 4, 5] resolving to Beat 2 downbeat [1].\n\n💡 Isolating to a single pitch decouples valve fingering motor load, letting you focus 100% on clean embouchure attack timing!`,
          timestamp: timeStr,
          highlight: true,
          actionOptions: [
            { key: 'ready_to_play', label: 'Start Single-Pitch Run', icon: '▶️', variant: 'primary' },
            { key: 'goto_step_3', label: 'Next: 🎶 Step 3 Real Notes', icon: '🎶', variant: 'secondary' },
          ]
        }
      ]);
    } else if (step === 3) {
      setVisualTab('score');
      enableMicrophone();
      setChatMessages(prev => [
        ...prev,
        {
          id: `step-3-${Date.now()}`,
          sender: 'mascot',
          text: `🎶 Step 3: Real Repertoire Notes & Beat 2 Target Landing!\n\nPlay the actual written notes: F4 (Slot 1) → Ab4 (Slot 4) → Bb4 (Slot 5), and land resolutely on the Beat 2 downbeat C5 (Slot 1 of Beat 2)!\n\n🎯 Do not rush the 16th tuplet into the 8th tuplet! Feel the difference between the straight "&" and triplet "li".`,
          timestamp: timeStr,
          highlight: true,
          actionOptions: [
            { key: 'ready_to_play', label: 'Start Full Melody Attempt', icon: '▶️', variant: 'primary' },
            { key: 'goto_step_4', label: 'Next: ⏱️ Step 4 Autonomy', icon: '⏱️', variant: 'secondary' },
          ]
        }
      ]);
    } else if (step === 4) {
      setVisualTab('score');
      enableMicrophone();
      setChatMessages(prev => [
        ...prev,
        {
          id: `step-4-${Date.now()}`,
          sender: 'mascot',
          text: `🚀 Step 4: Tempo Calibration & Autonomy Test!\n\nLet's test internal clock stability. We will ramp tempo (60 → 80 → 100 → 112 BPM) and fade the metronome clicks (downbeat-only and gap-clicks) to ensure your rhythm holds up without external reliance!`,
          timestamp: timeStr,
          highlight: true,
          actionOptions: [
            { key: 'ready_to_play', label: 'Start Autonomy Run', icon: '▶️', variant: 'primary' },
            { key: 'goto_step_1', label: 'Back to 🎯 Step 1 Tap Grid', icon: '🔄', variant: 'secondary' },
          ]
        }
      ]);
    }
  }, [disableMicrophone, enableMicrophone]);

  // Mic onset connection
  useEffect(() => {
    const unsubOnset = globalAudioInput.addOnsetListener(() => {
      setLastClapFlash(true);
      if (clapFlashTimerRef.current) clearTimeout(clapFlashTimerRef.current);
      clapFlashTimerRef.current = window.setTimeout(() => setLastClapFlash(false), 120);
      handleTap();
    });

    return () => {
      unsubOnset();
    };
  }, [handleTap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engine.stop();
      globalAudioInput.stop();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (clapFlashTimerRef.current) clearTimeout(clapFlashTimerRef.current);
    };
  }, [engine]);

  if (!isOpen) return null;

  const isCountdown = phase === 'countdown';
  const isPracticing = phase === 'practicing';
  const isResult = phase === 'result';
  const isReady = phase === 'ready';

  const beatNum = Math.max(1, Math.ceil(Math.abs(currentBeatPos)));
  const beatColors: Record<number, string> = { 4: 'text-zinc-300', 3: 'text-blue-400', 2: 'text-purple-400', 1: 'text-pink-400' };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-5 z-50 animate-in fade-in duration-200 overflow-x-hidden pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="bg-slate-900 w-full max-w-7xl max-h-[96dvh] h-[96dvh] md:h-auto overflow-y-auto overflow-x-hidden rounded-3xl border border-purple-500/30 shadow-2xl flex flex-col text-slate-100 scroll-touch">
        
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-md">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-white flex items-center gap-1.5">
                  <span>AIPC Rhythm Portal</span>
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {pieceTitle}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {(isPracticing || isCountdown) && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-xl bg-slate-800/90 border border-slate-700 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block" />
                <button
                  onClick={() => handleRestartExercise()}
                  className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                  title="Restart exercise immediately (Press R)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Restart</span>
                </button>
                <button
                  onClick={handleStopExercise}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                  title="Stop exercise (Press Esc)"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                  <span>Stop</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-xl">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 select-none">
                Dev:
              </span>
              <select
                value={selectedScenarioId}
                onChange={(e) => handleScenarioChange(e.target.value)}
                className="bg-slate-700/80 border border-slate-600/70 text-xs rounded-lg px-2 py-0.5 text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                title="[Developer Tool] Switch targeted strategy or diagnostic scenario"
              >
                <optgroup label="12 Targeted Interventions">
                  {RhythmStrategyRegistry.getAll().map(strat => (
                    <option key={strat.strategyId} value={strat.strategyId}>
                      [{strat.strategyId}] {strat.name} ({strat.family})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Diagnostic Portal Scenarios">
                  {RHYTHM_SCENARIOS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <button
              onClick={() => { engine.stop(); onClose(); }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Return to piece"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Return to Piece</span>
            </button>

            <button
              onClick={() => { engine.stop(); onClose(); }}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content: 2-Column Responsive Layout (Side-by-side on iPad 768px+) */}
        <div className="p-3 sm:p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          
          {/* Left Column: Notation, Controls, Fading Ladder */}
          <div className="md:col-span-7 xl:col-span-8 flex flex-col gap-3">

            {/* Pivot Notice Banner */}
            {pivotNotice && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/40 flex items-center justify-between gap-3 text-xs shadow-md">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
                  <span className="text-slate-200">{pivotNotice.message}</span>
                </div>
                <button onClick={() => setPivotNotice(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Active 30s Neural Reset Countdown Banner (Rule G8) */}
            {breakCountdown !== null && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/90 to-orange-950/90 border border-amber-500/50 flex items-center justify-between gap-3 text-xs shadow-xl animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">☕</span>
                  <div>
                    <h5 className="font-bold text-amber-200">30-Second Neural Reset in Progress</h5>
                    <p className="text-[11px] text-amber-300/80">Relax your hands, shake out shoulder tension, and let your internal ear reset.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black font-mono text-amber-400 bg-black/40 px-3 py-1 rounded-xl border border-amber-500/40">
                    00:{breakCountdown.toString().padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => setBreakCountdown(0)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
                  >
                    Resume Now
                  </button>
                </div>
              </div>
            )}

            {/* Targeted Bypass Banner */}
            {routeRecommendation.routeType === 'targeted_bypass' && !showLearnerChoice && (
              <div className="p-2.5 px-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">⚡ Targeted Bypass Active:</span>
                  <span className="text-slate-300">{routeRecommendation.rationale}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                  {routeRecommendation.primaryStrategyId}
                </span>
              </div>
            )}

            {/* If Learner Choice Front Door is open, show Choice View */}
            {showLearnerChoice ? (
              <LearnerChoiceView
                recommendation={routeRecommendation}
                targetBpm={activeTempoBpm}
                measureRange={measureRange}
                onSelectOption={handleSelectLearnerChoice}
                onExploreOther={() => setShowLearnerChoice(false)}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {/* AIPC Guided Practice Focus Header */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 rounded-2xl border border-indigo-500/30 px-4 py-2.5 shadow-xl flex items-center gap-2.5">
                  <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    AIPC Guided Rhythm Focus • Bar {extracted.startMeasure} Beat 1
                  </h4>
                </div>

              {/* Visual Display Mode: Only show specialized tabs when strategy calls for it (Item 1) */}
              <div className="flex flex-col gap-2">
                {hasSpecializedVisualTab ? (
                  <div className="flex flex-wrap items-center justify-between text-xs font-bold px-1 gap-2">
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                      <button
                        onClick={() => setVisualTab('score')}
                        className={`px-3 py-1 rounded-lg transition text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                          visualTab === 'score'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>🎼</span> Score Stave
                      </button>

                      {callsForPhaseWheel && (
                        <button
                          onClick={() => setVisualTab('phase_wheel')}
                          className={`px-3 py-1 rounded-lg transition text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                            visualTab === 'phase_wheel'
                              ? 'bg-amber-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>🌀</span> Phase Wheel
                        </button>
                      )}

                      {callsForSubdivisionGrid && (
                        <button
                          onClick={() => setVisualTab('subdivision_grid')}
                          className={`px-3 py-1 rounded-lg transition text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                            visualTab === 'subdivision_grid'
                              ? 'bg-indigo-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>📊</span> LCM Matrix Grid
                        </button>
                      )}
                    </div>

                    {/* Score Notation Legends */}
                    {visualTab === 'score' && (
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Perfect
                        </span>
                        <span className="flex items-center gap-1 text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Good
                        </span>
                        <span className="flex items-center gap-1 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Early / Late
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Miss
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs font-bold px-1">
                    <div className="flex items-center gap-2 text-slate-300 font-semibold">
                      <span>🎼</span>
                      <span>Score Stave</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Perfect
                      </span>
                      <span className="flex items-center gap-1 text-blue-400">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Good
                      </span>
                      <span className="flex items-center gap-1 text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Early / Late
                      </span>
                      <span className="flex items-center gap-1 text-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Miss
                      </span>
                    </div>
                  </div>
                )}

                {/* View Container */}
                {visualTab === 'phase_wheel' && callsForPhaseWheel ? (
                  <PolyrhythmPhaseWheel
                    ratio={crossRhythmRatio}
                    bpm={activeTempoBpm}
                    isPlaying={isPracticing || isCountdown}
                    className="w-full"
                  />
                ) : visualTab === 'subdivision_grid' && callsForSubdivisionGrid ? (
                  <div className="flex flex-col gap-3">
                    <CommonSubdivisionGrid
                      ratio={crossRhythmRatio}
                      bpm={activeTempoBpm}
                      onBpmChange={setActiveTempoBpm}
                      isPlaying={isPracticing || isCountdown}
                      slotVolume={crossRhythmSlotVol}
                      onVolumeChange={setCrossRhythmSlotVol}
                      highlightSlots={[1, 4, 5]}
                      slotLabels={{
                        1: { title: 'Note 1 (Dotted 8th tuplet)', subtitle: 'Downbeat Coincidence (12 ticks)', badge: 'Slot 1' },
                        4: { title: 'Note 2 (16th tuplet)', subtitle: 'Duple "&" Midpoint (4 ticks)', badge: 'Slot 4' },
                        5: { title: 'Note 3 (8th tuplet)', subtitle: 'Triplet "li" 2/3 Point (8 ticks)', badge: 'Slot 5' },
                      }}
                      patternName="Sailing with Whales - Bar 1 Beat 1 Tuplet Rhythm"
                      className="w-full"
                    />

                    {/* MusicXML Notation Excerpt: 4-beat loop of this rhythm (Item 3) */}
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-700 overflow-hidden w-full max-w-full relative">
                      <div className="bg-slate-900 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🎼</span>
                          <span className="font-bold text-slate-200">
                            MusicXML Beat 1 Tuplet Rhythm (4-Beat Practice Loop) • Aligned with 6-Slot Grid
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-400 font-semibold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                          Target Attacks: Slots 1, 4, 5
                        </span>
                      </div>
                      <VexFlowRenderer
                        measures={gridTarget4BeatsMeasure}
                        hideMeasureNumbers={true}
                        activeNoteIndex={activeNoteIndex}
                        noteTapsRecord={noteTapsRecord}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-700 overflow-hidden w-full max-w-full relative">
                    <VexFlowRenderer
                      measures={targetMeasures}
                      activeNoteIndex={activeNoteIndex}
                      noteTapsRecord={noteTapsRecord}
                      startMeasureNumber={extracted.startMeasure}
                    />

                    {/* Metronome Beat Tracker strip below stave */}
                    {(isPracticing || isCountdown) && (
                      <div className="bg-slate-950/90 border-t border-slate-200/20 px-4 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                          <span className="font-mono text-purple-300 font-bold">
                            {isCountdown ? 'Count-in' : 'Practice Run'}
                          </span>
                        </div>

                        {/* 4 Beat lights */}
                        <div className="flex items-center gap-2">
                          {[0, 1, 2, 3].map((b) => {
                            const isActiveBeat = isPracticing && (Math.floor(Math.abs(currentBeatPos)) % 4 === b);
                            const isDownbeat = b === 0;

                            return (
                              <div
                                key={b}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs transition-all duration-75 ${
                                  isActiveBeat
                                    ? isDownbeat
                                      ? 'bg-amber-500 text-slate-950 scale-110 shadow-lg shadow-amber-500/50'
                                      : 'bg-purple-600 text-white scale-110 shadow-lg shadow-purple-600/50'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                                }`}
                              >
                                {b + 1}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                            {activeTempoBpm || 112} BPM &middot; {sessionState.currentLevel === 5 ? 'Silent Retest' : `L${sessionState.currentLevel} Click`}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRestartExercise(); }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                            title="Restart exercise immediately (R)"
                          >
                            <RotateCcw className="w-3 h-3 text-cyan-400" />
                            <span>Restart</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStopExercise(); }}
                            className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                            title="Stop exercise (Esc)"
                          >
                            <Square className="w-3 h-3 fill-current text-rose-400" />
                            <span>Stop</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}


          {/* Input Mode Selector Bar (Rule G1 Enforced: Trumpet Down / Tap Mode) */}
          <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/60 p-1.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { disableMicrophone(); setInputMode('tap'); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'tap'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span>⌨️</span> Spacebar / Tap Mode
              </button>

              {/* Rule G1: Somatic Tap-Only Isolation Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px] font-medium" title="Rule G1: Instrument Decoupling">
                <span className="font-bold text-amber-400">🛑 Trumpet Down:</span>
                <span>Mic locked off. Tap spacebar / touch pad to decouple motor resistance.</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pr-1">
              {inputMode === 'mic' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowMicSettings((s: boolean) => !s)}
                    className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      showMicSettings ? 'bg-slate-700 text-purple-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Settings</span>
                  </button>
                  {isMicActive ? (
                    <button
                      onClick={disableMicrophone}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition text-xs cursor-pointer"
                      title="Mute Mic"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={enableMicrophone}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Connect Mic
                    </button>
                  )}
                </div>
              )}

              {/* Developer Testing Tools (Grey Differentiated) */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/80 bg-slate-850 px-2 py-1 rounded-xl border border-slate-700/70 text-slate-400">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 select-none">
                  Dev:
                </span>
                <button
                  onClick={() => handleFastSimulateAttempt(true)}
                  className="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-slate-500 border border-slate-600 text-slate-200 hover:text-white font-medium text-[10px] flex items-center gap-1 transition cursor-pointer"
                  title="[Developer Tool] Simulate passing attempt (94% accuracy, advance ladder)"
                >
                  <CheckCircle className="w-3 h-3 text-slate-300" /> Pass
                </button>
                <button
                  onClick={() => handleFastSimulateAttempt(false)}
                  className="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-slate-500 border border-slate-600 text-slate-200 hover:text-white font-medium text-[10px] flex items-center gap-1 transition cursor-pointer"
                  title="[Developer Tool] Simulate failing attempt (58% accuracy, test regression/feedback)"
                >
                  <AlertTriangle className="w-3 h-3 text-slate-300" /> Fail
                </button>
              </div>
            </div>
          </div>

          {/* Microphone Settings Drawer */}
          {showMicSettings && inputMode === 'mic' && (
            <div className="p-3 bg-slate-800/90 border border-slate-700 rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Sensitivity Multiplier</span>
                <span className="font-mono text-purple-400 font-bold">{micSensitivity}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="95"
                value={micSensitivity}
                onChange={(e) => setMicSensitivity(Number(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-300">Metronome Feedback Notch Filter</span>
                <input
                  type="checkbox"
                  checked={enableNotchFilter}
                  onChange={(e) => setEnableNotchFilter(e.target.checked)}
                  className="accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {micError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          {/* Reflection prompt is now communicated directly inside Toots Chatbot (Item 2) */}

          {/* Sleek Compact Touchpad Trigger Surface */}
          <div
            onPointerDown={() => {
              setPadActive(true);
              if (isReady || isResult) {
                startPracticeAttempt(false);
              } else if (isPracticing && !isDemoMode) {
                handleTap();
              }
            }}
            onPointerUp={() => setPadActive(false)}
            onPointerLeave={() => setPadActive(false)}
            className={`w-full h-22 sm:h-24 md:h-28 rounded-2xl border-2 transition-all duration-75 select-none touch-none touch-surface cursor-pointer relative flex items-center justify-between px-4 sm:px-6 overflow-hidden ${
              padActive || lastClapFlash
                ? 'bg-purple-600/30 border-purple-400 shadow-xl shadow-purple-500/25 scale-[0.99]'
                : isPracticing && !isDemoMode
                ? 'bg-slate-800/90 border-purple-500/50 hover:border-purple-400 shadow-md'
                : isPracticing && isDemoMode
                ? 'bg-purple-950/30 border-purple-500/40 animate-pulse'
                : 'bg-slate-800/70 border-slate-700 hover:border-purple-500/40'
            }`}
          >
            {/* Subtle tactile grid texture */}
            <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none" />

            {/* Ready State */}
            {isReady && (
              <div className="flex items-center justify-between w-full z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                    <Play className="w-5 h-5 fill-purple-400 text-purple-400 animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black tracking-wider text-purple-200 uppercase flex items-center gap-2">
                      Touchpad &middot; Ready
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Tap pad or press SPACEBAR to start &middot; Or follow Chatbot steps
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); startPracticeAttempt(false); }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Practice</span>
                </button>
              </div>
            )}

            {/* Countdown Phase */}
            {isCountdown && (
              <div className="flex items-center justify-between w-full z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                    <span className={`font-black text-2xl font-mono leading-none drop-shadow ${beatColors[beatNum] || 'text-purple-400'}`}>
                      {beatNum}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black tracking-wider text-purple-200 uppercase">
                      {isDemoMode ? 'Demo Count-in' : 'Count-in'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isDemoMode ? 'Listen closely to the reference demo' : 'Get ready to tap or play on instrument'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestartExercise(); }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                    title="Restart count-in"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Restart</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStopExercise(); }}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                    title="Stop count-in"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                    <span>Stop</span>
                  </button>
                </div>
              </div>
            )}

            {/* Active Practice Phase */}
            {isPracticing && !isDemoMode && (
              <div className="flex items-center justify-between w-full z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                    padActive || lastClapFlash
                      ? 'bg-purple-500 text-white border-purple-300 scale-105 shadow-md shadow-purple-500/40'
                      : 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                  }`}>
                    {inputMode === 'mic' ? (
                      <Mic className={`w-5 h-5 ${lastClapFlash ? 'text-emerald-300' : 'text-purple-300'}`} />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-purple-400 animate-ping" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black tracking-wider text-purple-100 uppercase">
                      {inputMode === 'mic' ? 'Touchpad Active &middot; Mic & Spacebar' : 'Touchpad Active &middot; Tap or Spacebar'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Tap on every note in time with the metronome
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Floating Live Timing Feedback Badge */}
                  {latestFeedback && (
                    <div className={`px-3 py-1 rounded-full border text-xs font-black tracking-wider shadow-lg animate-in fade-in zoom-in-95 duration-100 ${
                      latestFeedback.rating === 'Perfect' ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300' :
                      latestFeedback.rating === 'Great' || latestFeedback.rating === 'Good' ? 'bg-blue-500/25 border-blue-400 text-blue-300' :
                      latestFeedback.rating === 'Early' || latestFeedback.rating === 'Late' ? 'bg-amber-500/25 border-amber-400 text-amber-300' :
                      'bg-rose-500/25 border-rose-400 text-rose-300'
                    }`}>
                      {latestFeedback.rating.toUpperCase()} ({latestFeedback.deltaMs >= 0 ? '+' : ''}{latestFeedback.deltaMs.toFixed(0)}ms)
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestartExercise(); }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                    title="Restart attempt (R)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Restart</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStopExercise(); }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                    title="Stop attempt (Esc)"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                </div>
              </div>
            )}

            {/* Reference Demo Playing Phase */}
            {isPracticing && isDemoMode && (
              <div className="flex items-center justify-between w-full z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 animate-pulse">
                    <Volume2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black tracking-wider text-purple-200 uppercase">
                      Reference MIDI Playing...
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Watch the score notes light up green in real time
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestartExercise(true); }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Restart Demo</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStopExercise(); }}
                    className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                    <span>Stop Demo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Result Phase */}
            {isResult && (
              <div className="flex items-center justify-between w-full z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-mono font-black text-sm ${
                    lastAttemptResult?.passed
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  }`}>
                    {lastAttemptResult ? `${Math.round(lastAttemptResult.accuracy * 100)}%` : '--'}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-black tracking-wider uppercase ${
                      lastAttemptResult?.passed ? 'text-emerald-300' : 'text-amber-300'
                    }`}>
                      {lastAttemptResult?.passed ? 'Trial Passed!' : 'Trial Complete &middot; Scaffold Maintained'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {lastAttemptResult?.perfectCount || 0} perfect, {lastAttemptResult?.missCount || 0} missed &middot; Check Chatbot for coaching
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); startPracticeAttempt(false); }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Fading Ladder Visualizer */}
          <div className="p-2.5 px-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span className="uppercase tracking-wider">0-to-5 Assistance Fading Ladder</span>
              <span className="text-[10px] text-purple-400">
                2 Consecutive Passes Advance &middot; 2 Fails Regress
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((lvl) => {
                const isCurrent = sessionState.currentLevel === lvl;
                const isPassed = sessionState.currentLevel > lvl;
                const isRetest = lvl === 5;

                return (
                  <div
                    key={lvl}
                    className={`p-1.5 rounded-xl border text-center flex flex-col items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-purple-600/25 border-purple-500 ring-1 ring-purple-500/40 text-purple-200'
                        : isPassed
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-black text-xs">
                        {isRetest ? 'L5' : `L${lvl}`}
                      </span>
                      {isPassed && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <span className="text-[9px] truncate max-w-[80px]">
                      {isRetest ? 'Portal Retest' : lvl === 0 ? 'Subdivision' : lvl === 1 ? 'Metronome' : lvl === 2 ? 'Gap Click' : lvl === 3 ? 'Downbeat' : 'Dropout'}
                    </span>
                    {isCurrent && (
                      <span className="text-[8px] font-black uppercase mt-0.5 px-1.5 py-0.2 rounded-full bg-purple-500 text-white">
                        Active
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          </div>

          {/* Right Column: Full Interactive Student Chat Companion (Toots the Trumpet) */}
          <div className="md:col-span-5 xl:col-span-4 flex flex-col min-h-[360px] md:min-h-0">
            <StudentChatCompanion
              instrumentName={extracted.partName || 'Trumpet'}
              messages={chatMessages}
              onQuickAction={handleChatQuickAction}
              onSendMessage={handleSendChatMessage}
              isListening={phase === 'practicing' && !isDemoMode}
              mood={mascotMood}
              activeSectionName={`Bars ${extracted.startMeasure}–${extracted.endMeasure}`}
              recordingMode="audio"
            />
          </div>

        </div>

        {/* Teacher Handoff Modal */}
        {teacherHandoffRecord && (
          <TeacherHandoffModal
            record={teacherHandoffRecord}
            isOpen={showHandoffModal}
            onClose={() => setShowHandoffModal(false)}
          />
        )}
      </div>
    </div>
  );
};
