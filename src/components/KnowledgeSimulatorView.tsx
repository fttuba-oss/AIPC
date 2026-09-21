import React, { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  Stethoscope,
  Compass,
  HeartHandshake,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Zap,
  VolumeX,
  Sliders,
  Music,
  UserCheck,
  Sparkles,
  Layers,
  BookOpen,
  Info,
  Clock,
  Lightbulb,
  FileCode,
  Code2,
  ShieldCheck,
  CheckCircle2,
  X,
  Table,
  List
} from 'lucide-react';
import { KnowledgeSimulatorService } from '../backend/service/KnowledgeSimulatorService';
import { STRATEGY_CATALOGUE } from '../strategies/classifications/rhythm/registry/rhythmRegistry';
import type { KnowledgeNote } from '../backend/types/knowledge';

interface KnowledgeSimulatorViewProps {
  onBack: () => void;
}

// ----------------------------------------------------------------------------
// Curated Problem Signature -> Diagnosis -> Intervention Pedagogical Dataset
// ----------------------------------------------------------------------------
interface ProblemMapping {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  whatHappens: string;
  whatTeacherHears: string;
  diagnoses: {
    id: string;
    title: string;
    explanation: string;
    howToRecognize: string;
    howAipcDetects?: string;
  }[];
  interventions: {
    id: string;
    optionLabel?: string;
    name: string;
    whatStudentDoes: string;
    whyItHelps: string;
    variablesIsolated: string;
  }[];
  nextSteps: {
    ifSuccess: string;
    ifStruggles: string;
    teacherAlert: string;
  };
}

const PROBLEM_MAPPINGS: ProblemMapping[] = [
  {
    id: 'PS-RUSH-01',
    name: 'Progressive Rushing',
    badge: 'Tempo Drift',
    tagline: 'Playing faster and faster as the music continues',
    whatHappens: 'The student starts at the correct tempo, but subtly increases speed measure by measure, especially during runs or exciting passages.',
    whatTeacherHears: 'Tempo climbs from 120 BPM up to 135+ BPM by measure 4. The student rushes forward into downbeats.',
    diagnoses: [
      {
        id: 'RC03',
        title: 'Internal Pulse Instability',
        explanation: 'The student has not yet developed an autonomous internal pacemaker, causing their internal clock to accelerate with excitement or lack of external anchor.',
        howToRecognize: 'Rushing happens even on simple scalar passages or repetitive rhythms, particularly during silent bars or solo playing.',
        howAipcDetects: 'Gap-Click Protocol (R12): Linear regression drift slope m > 3.5 ms/beat across silent continuation bars, while mean asynchrony |Δ| < 30 ms during click bars.',
      },
      {
        id: 'RC08',
        title: 'Finger & Valve Mechanical Tension',
        explanation: 'Difficult finger transitions or high-register notes create physical hand tension that speeds up finger motions.',
        howToRecognize: 'Rushing starts right before or during specific tricky valve fingerings.',
        howAipcDetects: 'Shadow Differential: Accuracy on blown trumpet is < 55%, but jumps to > 85% during Reference Shadow Fingering (R08) without air load.',
      },
      {
        id: 'RC04',
        title: 'Collapsing Mental Subdivision',
        explanation: 'The student is thinking beat-by-beat rather than feeling the smaller eighth-note or sixteenth-note pulses inside each beat.',
        howToRecognize: 'Rushing accelerates primarily during passages with dense or quick notes.',
        howAipcDetects: 'Subdivision Jitter σ_sub > 25 ms across 16th-note onsets; note durations shorten non-linearly before downbeats.',
      },
      {
        id: 'RC05',
        title: 'Unfamiliar Rhythm Notation',
        explanation: 'The rhythmic pattern on the page looks crowded or confusing, creating anxiety that prompts premature note attacks.',
        howToRecognize: 'Student hesitates then dashes through the written figure.',
        howAipcDetects: 'Syntax Edit Distance > 0 on Echo Imitation Probe (R01): Student substitutes written syncopation with simpler metric chunks.',
      },
    ],
    interventions: [
      {
        id: 'DI-REF-SHADOW-01',
        optionLabel: 'Option A (Target Tempo)',
        name: 'Shadow Fingering with Reference Audio',
        whatStudentDoes: 'Listen to a high-quality artist recording at 120 BPM while silently pressing the valves without blowing.',
        whyItHelps: 'Completely removes tone production and breath fatigue so the student can verify finger familiarity and rhythm awareness.',
        variablesIsolated: 'Tone production, breathing effort, embouchure fatigue removed.',
      },
      {
        id: 'DI-SLOW-CLICK-01',
        optionLabel: 'Option B (Tempo Reduction)',
        name: 'Slower Tempo (-20 BPM) with Strong Click',
        whatStudentDoes: 'Play the passage at 100 BPM (20 BPM slower) with an audible metronome click on every beat.',
        whyItHelps: 'Tests whether cognitive speed load was the bottleneck. If rushing vanishes, basic rhythm comprehension is solid.',
        variablesIsolated: 'Fast motor speed load removed; external metronome anchor added.',
      },
      {
        id: 'DI-GAP-CLICK-01',
        name: 'Gap Click Internal Pulse Builder',
        whatStudentDoes: 'The metronome clicks for 2 measures, goes completely silent for 2 measures, then returns.',
        whyItHelps: 'Trains the student to maintain their own inner pulse when the metronome drops out.',
        variablesIsolated: 'Eliminates reliance on continuous external audio crutches.',
      },
    ],
    nextSteps: {
      ifSuccess: 'Tempo Ladder: Once stable at 100 BPM, progressively step up tempo (+3, +5, or +10 BPM) towards full speed.',
      ifStruggles: 'Isolate Bottleneck: If errors cluster on the same 1–2 notes, isolate that transition for at most 2–3 attempts.',
      teacherAlert: 'After 3 unsuccessful attempts, AIPC stops repetition and alerts the teacher to inspect valve hand position and embouchure shift.',
    },
  },
  {
    id: 'PS-UNEVEN-01',
    name: 'Uneven Notes in Running Figures',
    badge: 'Micro-Timing',
    tagline: 'Sixteenth notes or triplets sound bumpy or galloping',
    whatHappens: 'In runs of continuous notes, some notes sound too long while others are squished or clipped.',
    whatTeacherHears: 'Galloping or stuttering feeling instead of a smooth stream of even notes.',
    diagnoses: [
      {
        id: 'RC04',
        title: 'Micro-Subdivision Weakness',
        explanation: 'The student does not yet have an even internal subdivision grid to place every note evenly.',
        howToRecognize: 'Notes are uneven even when tapping fingers on a table without an instrument.',
      },
      {
        id: 'RC08',
        title: 'Asymmetrical Finger Velocity',
        explanation: 'Certain fingers (like the ring finger or pinky) move slower or lift later than the index and middle fingers.',
        howToRecognize: 'Notes stumble only when specific valve combinations are pressed.',
      },
      {
        id: 'RC02',
        title: 'Beat Alignment Disconnect',
        explanation: 'Student is trying to make up lost time before the next main downbeat arrives.',
        howToRecognize: 'The last two notes of the beat are squashed together right before the click.',
      },
    ],
    interventions: [
      {
        id: 'DI-RHYTHMIZE-01',
        optionLabel: 'Strategy 1',
        name: 'Dotted Rhythm Practice (Swing & Reverse Swing)',
        whatStudentDoes: 'Play the passage with dotted rhythms (long-short-long-short), then immediately reverse it (short-long-short-long).',
        whyItHelps: 'Forces the brain to master both the fast transition between notes and the relaxed release.',
        variablesIsolated: 'Equalizes finger release timing without mental fatigue.',
      },
      {
        id: 'DI-SUBDIV-SPOKEN-01',
        optionLabel: 'Strategy 2',
        name: 'Vocalized Subdivision with Hand Claps',
        whatStudentDoes: 'Clap the main beats while chanting "1-e-&-a, 2-e-&-a" with crisp articulation before picking up the horn.',
        whyItHelps: 'Installs the mental subdivision grid in the ear before physical instrument demands are added.',
        variablesIsolated: 'All instrument mechanics removed; isolates pure mental grid.',
      },
      {
        id: 'DI-BURST-01',
        name: 'Speed Burst Chunking',
        whatStudentDoes: 'Play only 3 notes at target speed, then stop and rest on note 4.',
        whyItHelps: 'Allows the fingers to feel correct speed in tiny chunks without losing control.',
        variablesIsolated: 'Reduces cognitive length fatigue down to a single beat.',
      },
    ],
    nextSteps: {
      ifSuccess: 'Expand chunks from 3 notes to 5 notes, then combine full measures.',
      ifStruggles: 'Return to vocalized chanting to confirm the ear knows the pattern.',
      teacherAlert: 'If one finger remains sluggish after 3 attempts, refers to teacher to check hand posture and finger curvature.',
    },
  },
  {
    id: 'PS-DRIFT-01',
    name: 'Click Dropout Drift',
    badge: 'Inner Clock',
    tagline: 'Plays in time with metronome, drifts as soon as it stops',
    whatHappens: 'The student relies on the metronome as a constant crutch. When playing solo, tempo rapidly fluctuates.',
    whatTeacherHears: 'Locked in tempo while metronome clicks; immediately rushes or drags during rests or solo bars.',
    diagnoses: [
      {
        id: 'RC03',
        title: 'Weak Endogenous Pulse',
        explanation: 'The student has not yet internalized the pulse and relies entirely on external sound.',
        howToRecognize: 'Student looks nervous or loses bearings whenever accompaniment stops.',
      },
      {
        id: 'RC09',
        title: 'Passive Listening Habit',
        explanation: 'The student waits to hear the click rather than anticipating and landing on the beat together with it.',
        howToRecognize: 'Student always plays 20–40 milliseconds late behind the click.',
      },
    ],
    interventions: [
      {
        id: 'DI-GAP-CLICK-02',
        optionLabel: 'Core Strategy',
        name: 'Progressive Gap Click Fading',
        whatStudentDoes: 'Play with a metronome that clicks on beats 1 and 3 only, then beat 1 only, then 2 bars on and 2 bars off.',
        whyItHelps: 'Systematically transfers timekeeping responsibility from the machine to the student’s inner ear.',
        variablesIsolated: 'Steadily fades external assistance step-by-step.',
      },
      {
        id: 'DI-SUBDIV-SILENT-01',
        name: 'Silent Inner Chanting',
        whatStudentDoes: 'Mentally count subdivisions during silent bars while maintaining gentle foot tap.',
        whyItHelps: 'Keeps the brain’s rhythm generator active through silent spaces.',
        variablesIsolated: 'Prevents mental dropouts during sustained notes and rests.',
      },
    ],
    nextSteps: {
      ifSuccess: 'Gradually increase silent gap from 1 measure to 2 measures, then 4 measures.',
      ifStruggles: 'Drop back to half-bar click support until stability returns.',
      teacherAlert: 'Teacher handoff notes if student exhibits anticipatory anxiety when external support is removed.',
    },
  },
  {
    id: 'PS-SYNC-TIE-01',
    name: 'Lost Across Syncopations & Ties',
    badge: 'Metric Anchor',
    tagline: 'Stumbling or entering early after held notes across the barline',
    whatHappens: 'When a note is tied across a beat or barline, the student loses track of "Beat 1" and enters early or late on the offbeat.',
    whatTeacherHears: 'Early attack on the note following a tie, or complete hesitation on the downbeat.',
    diagnoses: [
      {
        id: 'RC05',
        title: 'Cognitive Rhythm Representation',
        explanation: 'The student visualizes the tie as a stop in rhythm rather than a continuous duration with an invisible pulse beneath.',
        howToRecognize: 'Student plays the tied note as two separate notes or cuts it short.',
      },
      {
        id: 'RC06',
        title: 'Metrical Grounding Loss',
        explanation: 'Difficulty maintaining awareness of the strong beat (Beat 1) when no sound is produced on it.',
        howToRecognize: 'The entire measure following the tie shifts forward by half a beat.',
      },
    ],
    interventions: [
      {
        id: 'DI-XRAY-RHYTHM-01',
        optionLabel: 'Recommended',
        name: 'X-Ray Rhythm (Ghost Articulation)',
        whatStudentDoes: 'Re-articulate the tied note as repeated eighth notes first, then gradually lighten the tongue until it is held smoothly.',
        whyItHelps: 'Makes the invisible pulse inside the tie audible and physical before turning it into a sustained note.',
        variablesIsolated: 'Removes the silence of the tie so the pulse is felt directly.',
      },
      {
        id: 'DI-PULSE-FOOT-01',
        name: 'Grounding Tap & Offbeat Chanting',
        whatStudentDoes: 'Tap toe firmly on the downbeats while vocalizing "ta" on the offbeats.',
        whyItHelps: 'Physically separates the downbeat anchor from the offbeat vocal entrance.',
        variablesIsolated: 'Separates bodily downbeat perception from melodic rhythm.',
      },
    ],
    nextSteps: {
      ifSuccess: 'Fade ghost tongue strokes and perform unassisted with natural phrasing.',
      ifStruggles: 'Practice with a click that emphasizes the downbeat bell chime.',
      teacherAlert: 'Refer to teacher if student consistently misinterprets compound meter notation.',
    },
  },
  {
    id: 'PS-INST-BREAK-01',
    name: 'Table-to-Instrument Breakdown',
    badge: 'Instrument Transfer',
    tagline: 'Can clap and sing it perfectly, but stumbles on the instrument',
    whatHappens: 'The student has 100% accurate rhythm in their head, voice, and hands, but timing falls apart the moment they blow into the instrument.',
    whatTeacherHears: 'Accurate rhythm when singing or clapping; erratic rhythm and delayed attacks when playing the horn.',
    diagnoses: [
      {
        id: 'RC08',
        title: 'Instrument Cognitive Overload',
        explanation: 'Blowing air, supporting the embouchure, reading notes, and moving valves consume so much mental bandwidth that rhythm coordination collapses.',
        howToRecognize: 'Student looks physically tense with high shoulders when holding the instrument.',
      },
      {
        id: 'RC08-M',
        title: 'Embouchure & Air Resistance Hesitation',
        explanation: 'Back-pressure or embouchure uncertainty causes tongue releases to speak late.',
        howToRecognize: 'Tone sounds airy or cracked at note onsets.',
      },
    ],
    interventions: [
      {
        id: 'DI-LADDER-SING-FINGER-01',
        optionLabel: 'Transfer Ladder',
        name: 'Sing -> Shadow Finger -> Air -> Play',
        whatStudentDoes: '1) Sing rhythm with pitch syllables, 2) Press valves silently while singing, 3) Blow air through horn without buzzing, 4) Play.',
        whyItHelps: 'Bridges the gap one sensory channel at a time so the brain is never overwhelmed all at once.',
        variablesIsolated: 'Adds air and embouchure in controlled steps.',
      },
      {
        id: 'DI-AIR-ONLY-01',
        name: 'Air & Valve Stream Sync',
        whatStudentDoes: 'Blow continuous air through the instrument while moving valves in time, without buzzing the lips.',
        whyItHelps: 'Synchronizes finger action with air flow without embouchure resistance.',
        variablesIsolated: 'Lip buzzing and acoustic pressure removed.',
      },
    ],
    nextSteps: {
      ifSuccess: 'Play full phrase on instrument at comfortable volume.',
      ifStruggles: 'Check whether student is holding excess tension in the neck or shoulders.',
      teacherAlert: 'Referred to teacher for physical posture, embouchure setting, and breathing mechanics check.',
    },
  },
];

// ----------------------------------------------------------------------------
// Pedagogical Layers & Knowledgebases Catalog
// ----------------------------------------------------------------------------
export interface TechnicalDetection {
  protocol: string;
  trigger: string;
  metricsFormula?: string;
  thresholds?: string;
}

export interface KnowledgebaseItem {
  id: string;
  name: string;
  shortDesc: string;
  family?: string;
  detectionMechanism?: TechnicalDetection;
  fileRef: string;
  codeSnippet: string;
}

export const STRATEGY_FAMILY_METADATA: Record<string, { label: string; description: string }> = {
  'Representation': {
    label: 'Representation',
    description: 'Mental, verbal, and visual encoding of rhythmic durations away from full instrument mechanics.',
  },
  'Embodiment': {
    label: 'Embodiment',
    description: 'Grounding the metric pulse in physical bodily movement (stepping, foot taps, body percussion).',
  },
  'Subdivision': {
    label: 'Subdivision',
    description: 'Micro-grid division of beats into equal parts (eighths, triplets, sixteenths) to prevent rushed attacks.',
  },
  'Synchronisation': {
    label: 'Synchronisation',
    description: 'Sensorimotor phase-locking of physical motor actions to an external acoustic metronome click.',
  },
  'Internalisation': {
    label: 'Internalisation & Clock Autonomy',
    description: 'Fading external clicks (gap-click, downbeat-only) to build an unassisted internal pacemaker.',
  },
  'Chunking': {
    label: 'Structural Chunking & Isolation',
    description: 'Deconstructing difficult passages into short motor cells and loop chains.',
  },
  'Metric reconstruction': {
    label: 'Metric Reconstruction & Syncopation',
    description: 'Un-tying syncopations and sounding ghost-beats to illuminate hidden downbeat hierarchy.',
  },
  'Tempo calibration': {
    label: 'Tempo Calibration & Ladders',
    description: 'Systematic incremental tempo ladders (+3 to +5 BPM) to expand the neuromuscular timing window.',
  },
  'Adaptation and recovery': {
    label: 'Adaptation & Error Recovery',
    description: 'Training resilience against tempo fluctuations, perturbed clicks, and ensemble drift.',
  },
  'Feedback and monitoring': {
    label: 'Feedback & Self-Monitoring',
    description: 'Analyzing performance recordings and onset telemetry to build objective self-auditing.',
  },
  'Reintegration and transfer': {
    label: 'Reintegration & Transfer',
    description: 'Reconnecting rhythm to melody, tone, dynamic shaping, and unassisted performance tests.',
  },
};

export interface LayerKnowledgebase {
  name: string;
  simpleRole: string;
  items: KnowledgebaseItem[];
}

interface LayerKnowledgebaseSubset {
  subsetId: string;
  subsetName: string;
  badge: string;
  knowledgebases: LayerKnowledgebase[];
}

interface PedagogicalLayerItem {
  id: string;
  number: number;
  name: string;
  subsetsLabel: string;
  color: {
    bg: string;
    border: string;
    text: string;
    accent: string;
  };
  subsets: LayerKnowledgebaseSubset[];
  knowledgebases: LayerKnowledgebase[];
}

const OBSERVE_KNOWLEDGEBASES: LayerKnowledgebase[] = [
  {
    name: 'Score Context Knowledgebase',
    simpleRole: 'Musical score geography and difficulty markers',
    items: [
      {
        id: 'ASSET-MUSICXML-SCORE',
        name: 'MusicXML Score Parser',
        shortDesc: 'Extracts measures, parts, divisions, note durations, and syncopations.',
        fileRef: 'src/utils/scoreParser.ts',
        codeSnippet: `export const parseMusicXmlToScore = (xml: string): ParsedScore => {\n  // Extracts measures, notes, ties, time signatures\n  return { title, composer, parts };\n};`,
      },
      {
        id: 'CHALLENGE-REGISTRY',
        name: 'Section & Challenge Segmentation',
        shortDesc: 'Maps instrument-specific technical obstacles to score measure boundaries.',
        fileRef: 'src/utils/scoreAnalyzer.ts',
        codeSnippet: `export const extractFlatPracticeAreas = (sections: MusicalSection[]) => {\n  return sections.flatMap(s => s.challenges);\n};`,
      },
    ],
  },
  {
    name: 'Performance Measurement',
    simpleRole: 'Factual measurements from the microphone / MIDI',
    items: [
      {
        id: 'ASSET-ACOUSTIC-MIC-INPUT',
        name: 'Acoustic Onset Detector',
        shortDesc: 'Microphone audio buffer peak energy matched to score beat intervals.',
        fileRef: 'src/utils/studentAudioEngine.ts',
        codeSnippet: `export interface TelemetryBuffer {\n  onsetTimesMs: number[];\n  driftSlope: number;\n  meanOffsetMs: number;\n}`,
      },
      {
        id: 'ASSET-TAP-PAD-INPUT',
        name: 'Touch & MIDI Synchronization',
        shortDesc: 'Low-latency touchscreen/MIDI tap timestamps for motor synchronization.',
        fileRef: 'src/utils/studentAudioEngine.ts',
        codeSnippet: `export const recordTapOnset = (timestamp: number, tempo: number) => {\n  const beatMs = 60000 / tempo;\n  return (timestamp % beatMs) - (beatMs / 2);\n};`,
      },
      {
        id: 'ASSET-OSMD-SCORE-HIGHLIGHT',
        name: 'Realtime Score Tracker',
        shortDesc: 'Dynamic measure bounding boxes synced with musical playback.',
        fileRef: 'src/components/ScoreViewer.tsx',
        codeSnippet: `osmd.cursor.show();\nosmd.cursor.next();\nconst currentMeasure = osmd.cursor.iterator.currentMeasureIndex + 1;`,
      },
    ],
  },
  {
    name: 'Problem Signatures Knowledgebase',
    simpleRole: 'The AI’s catalog of recognized musical issues',
    items: [
      {
        id: 'PS-RUSH-01',
        name: 'Progressive Rushing',
        shortDesc: 'Timing accelerates progressively across measures exceeding 3.5ms/beat drift.',
        fileRef: 'src/diagnostics/rhythmDiagnosticEngine.ts',
        codeSnippet: `export const PS_RUSH_01 = {\n  id: 'PS-RUSH-01',\n  name: 'Progressive Rushing',\n  driftThresholdMsPerBeat: 3.5,\n  minConsecutiveMeasures: 3,\n  leadingHypotheses: ['RC03', 'RC08']\n};`,
      },
      {
        id: 'PS-UNEVEN-01',
        name: 'Uneven Subdivision',
        shortDesc: 'Micro-timing variance within 16th/triplet runs exceeding 25ms jitter.',
        fileRef: 'src/strategies/classifications/rhythm/strategies/UnevenSubdivisionStrategy.ts',
        codeSnippet: `export const PS_UNEVEN_01 = {\n  id: 'PS-UNEVEN-01',\n  name: 'Uneven Subdivision',\n  jitterThresholdMs: 25.0,\n  targetCapacities: ['RC04', 'RC07']\n};`,
      },
      {
        id: 'PS-SYNC-TIE-01',
        name: 'Syncopation & Tied Note Rush',
        shortDesc: 'Early attack on release of tied or syncopated offbeat pulses.',
        fileRef: 'src/diagnostics/rhythmDiagnosticEngine.ts',
        codeSnippet: `export const PS_SYNC_TIE_01 = {\n  id: 'PS-SYNC-TIE-01',\n  name: 'Syncopation & Tied Rush',\n  trigger: 'Tied release error > 40ms early',\n  primaryProbe: 'DI-RHYTHM-XRAY-01'\n};`,
      },
    ],
  },
];

const DIAGNOSIS_KNOWLEDGEBASES: LayerKnowledgebase[] = [
  {
    name: 'Rhythmic Capacities Knowledgebase (RC01–RC13)',
    simpleRole: 'The 13 fundamental rhythmic abilities every musician needs',
    items: [
      {
        id: 'RC01',
        name: 'Beat Perception (Aural Pulse Extraction)',
        shortDesc: 'Auditory ability to detect, extract, and predict an underlying periodic pulse from acoustic stimuli without playing.',
        detectionMechanism: {
          protocol: 'Receptive Pulse Listening Probe (no score cursor, student taps pad along with audio model)',
          trigger: 'Inability to detect tempo shifts or find beat 1; erratic tapping out of time with audio',
          metricsFormula: 'Rayleigh Z = N * |(1/N) * sum(e^(i * 2pi * t / T))|^2 (Circular variance vector length)',
          thresholds: 'Rayleigh z < 3.0 or tap IOI dispersion > 35% indicates failure to perceive periodic grid',
        },
        fileRef: 'src/strategies/classifications/rhythm/types/capacities.ts',
        codeSnippet: `// RC01: Beat Perception (Receptive Pulse Extraction)
export function evaluateBeatPerception(tapTimestamps: number[], beatIntervalMs: number): boolean {
  const phases = tapTimestamps.map(t => (2 * Math.PI * (t % beatIntervalMs)) / beatIntervalMs);
  const cosSum = phases.reduce((acc, p) => acc + Math.cos(p), 0);
  const sinSum = phases.reduce((acc, p) => acc + Math.sin(p), 0);
  const R = Math.sqrt(cosSum ** 2 + sinSum ** 2) / phases.length;
  const rayleighZ = phases.length * (R ** 2);
  return rayleighZ >= 3.0; // z < 3.0 confirms receptive beat perception deficit
}`,
      },
      {
        id: 'RC02',
        name: 'Beat Synchronisation (Sensorimotor Entrainment)',
        shortDesc: 'Sensorimotor ability to align physical motor actions (tongue, fingers) with an external audible metronome click.',
        detectionMechanism: {
          protocol: 'Synchronized Playback Telemetry (microphone onsets measured against active Tone.js Transport click)',
          trigger: 'Note attacks consistently lag behind or gallop ahead of the click, even though click is audible',
          metricsFormula: 'Mean Asynchrony: delta_bar = (1/N) * sum(t_detected - t_click); Jitter: sigma_async',
          thresholds: '|delta_bar| > 45 ms or sigma_async > 35 ms while external click is continuous and audible',
        },
        fileRef: 'src/diagnostics/rhythmDiagnosticEngine.ts',
        codeSnippet: `// RC02: Sensorimotor Entrainment Asynchrony Analysis
export function evaluateBeatSynchronisation(onsets: RhythmOnset[], targetBeats: number[]): CapacityAssessment {
  const asynchronies = onsets.map((o, i) => (o.timestampSeconds - targetBeats[i]) * 1000);
  const meanAsynchrony = asynchronies.reduce((a, b) => a + b, 0) / asynchronies.length;
  const stdDev = Math.sqrt(asynchronies.reduce((s, a) => s + (a - meanAsynchrony)**2, 0) / asynchronies.length);
  if (Math.abs(meanAsynchrony) > 45 || stdDev > 35) {
    return { capacityId: 'RC02', status: 'impaired', meanOffsetMs: meanAsynchrony, jitterMs: stdDev };
  }
  return { capacityId: 'RC02', status: 'intact' };
}`,
      },
      {
        id: 'RC03',
        name: 'Internal Pulse (Autonomous Clock Stability)',
        shortDesc: 'Endogenous timekeeping ability to generate and sustain steady tempo in the absence of an external pacer.',
        detectionMechanism: {
          protocol: 'Gap-Click Protocol (R12): 2 bars continuous click followed by 2 bars silent continuation',
          trigger: 'Plays in time with metronome, but accelerates (rushing) or drags during silent bars or solo playing',
          metricsFormula: 'Drift Slope: m = delta_IOI / delta_beat (linear regression slope of inter-onset intervals)',
          thresholds: '|m| > 3.5 ms/beat across silent bars while |delta_bar| < 30 ms during preceding click bars',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/GapClickStrategy.ts',
        codeSnippet: `// RC03: Endogenous Pacemaker Drift Analysis in Gap-Click
export function evaluateInternalPulseDrift(silentBarOnsets: number[], targetTempoBpm: number): CapacityAssessment {
  const actualIois = silentBarOnsets.slice(1).map((t, i) => (t - silentBarOnsets[i]) * 1000);
  const driftSlope = calculateLinearSlope(actualIois); // ms change per beat
  if (Math.abs(driftSlope) > 3.5) {
    return {
      capacityId: 'RC03',
      status: 'impaired',
      direction: driftSlope > 0 ? 'dragging' : 'rushing',
      driftSlopeMsPerBeat: driftSlope
    };
  }
  return { capacityId: 'RC03', status: 'intact' };
}`,
      },
      {
        id: 'RC04',
        name: 'Subdivision & Metric Chunking',
        shortDesc: 'Ability to mentally divide the beat interval into equal micro-intervals (eighths, triplets, sixteenths).',
        detectionMechanism: {
          protocol: 'X-Ray Subdivision Probe (R20): Acoustic note attacks compared against explicit subdivision grid',
          trigger: 'Uneven spacing between short notes; rushing during complex runs while whole beats remain on time',
          metricsFormula: 'Subdivision Jitter: sigma_sub = sqrt((1/N) * sum((IOI_sub - IOI_expected)^2))',
          thresholds: 'sigma_sub > 25.0 ms in 16th/triplet passages indicates collapsing mental subdivision',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/ExplicitSubdivisionStrategy.ts',
        codeSnippet: `// RC04: Subdivision Micro-Grid Jitter Analysis
export function evaluateSubdivisionJitter(onsets: RhythmOnset[], expectedSubdivisions: number[]): CapacityAssessment {
  const errors = onsets.map((o, i) => Math.abs(o.timestampSeconds - expectedSubdivisions[i]) * 1000);
  const jitterMs = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
  return jitterMs > 25.0 ? { capacityId: 'RC04', status: 'impaired', jitterMs } : { capacityId: 'RC04', status: 'intact' };
}`,
      },
      {
        id: 'RC05',
        name: 'Pattern Representation & Durational Syntax',
        shortDesc: 'Cognitive encoding of rhythmic duration syntax and proportional durations.',
        detectionMechanism: {
          protocol: 'Echo Representation Probe (R01): Audio motif played; student claps/repeats without score',
          trigger: 'Playing incorrect rhythm values regardless of tempo; cannot imitate rhythmic motifs',
          metricsFormula: 'Rhythmic Syntax Edit Distance on quantized duration categories',
          thresholds: 'Substituted duration category error (e.g. dotted eighth + sixteenth collapsed to straight eighths)',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/ReferenceAudioStrategy.ts',
        codeSnippet: `// RC05: Durational Syntax Categorization Error
export function evaluatePatternRepresentation(detectedRhythm: string[], expectedRhythm: string[]): boolean {
  const editDistance = levenshtein(detectedRhythm, expectedRhythm);
  return editDistance === 0; // > 0 indicates cognitive durational syntax breakdown
}`,
      },
      {
        id: 'RC06',
        name: 'Metrical Organisation (Downbeat & Barline Structuring)',
        shortDesc: 'Hierarchical metric structuring (downbeats, bar lines, strong vs. weak beat relationships).',
        detectionMechanism: {
          protocol: 'Downbeat Anchor Probe (R14): Clicks sound strictly on Beat 1 of each bar',
          trigger: 'Loss of pulse across ties, rests, or syncopated off-beat figures; losing barline orientation',
          metricsFormula: 'Downbeat Reset Error: delta_bar1 = |t_actual_downbeat - t_expected_downbeat|',
          thresholds: 'delta_bar1 > 60 ms on measure boundaries while mid-bar notes maintain tempo',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/DownbeatOnlyStrategy.ts',
        codeSnippet: `// RC06: Metrical Downbeat Grounding Analysis
export function evaluateMetricalOrganisation(measureOnsets: number[], barDurationMs: number): CapacityAssessment {
  const downbeatErrors = measureOnsets.map((t, idx) => Math.abs(t - idx * barDurationMs));
  const maxError = Math.max(...downbeatErrors);
  return maxError > 60 ? { capacityId: 'RC06', status: 'impaired', maxErrorMs: maxError } : { capacityId: 'RC06', status: 'intact' };
}`,
      },
      {
        id: 'RC07',
        name: 'Temporal Adaptation (Dynamic Phase Error Correction)',
        shortDesc: 'Dynamic phase and tempo error correction when external pulse shifts or ensemble partners drift.',
        detectionMechanism: {
          protocol: 'Phase-Perturbation Step Test (R25): Metronome introduces an unexpected +/- 50ms phase shift',
          trigger: 'Unable to resynchronize after timing stumbles; overcompensating with large hunting swings',
          metricsFormula: 'Correction Gain: alpha = - (delta_asynchrony / perturbation_size) per beat',
          thresholds: 'alpha < 0.2 (under-correction) or alpha > 1.3 (oscillatory overcompensation)',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/AdaptiveTempoStrategy.ts',
        codeSnippet: `// RC07: Phase Perturbation Correction Analysis
export function evaluateTemporalAdaptation(asynchroniesAfterShift: number[]): CapacityAssessment {
  const settlingBeats = asynchroniesAfterShift.findIndex(a => Math.abs(a) < 25);
  return settlingBeats > 3 || settlingBeats === -1
    ? { capacityId: 'RC07', status: 'impaired', settlingBeats: settlingBeats === -1 ? '>4' : settlingBeats }
    : { capacityId: 'RC07', status: 'intact' };
}`,
      },
      {
        id: 'RC08',
        name: 'Instrumental Motor Coordination (Speed Load)',
        shortDesc: 'Valve fingering speed, tongue-finger alignment, and physical resistance under tempo.',
        detectionMechanism: {
          protocol: 'Reference Shadow Fingering (R08): Student fingers valves and vocalizes without blowing',
          trigger: 'Timing breaks down on instrument but is accurate when clapping, vocalizing, or shadow-fingering',
          metricsFormula: 'Acoustic vs Shadow Differential: Delta_accuracy = Accuracy_shadow - Accuracy_blown',
          thresholds: 'Delta_accuracy > 30% (Shadow accuracy > 85% while blown instrument accuracy < 55%)',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/ReferenceShadowFingeringStrategy.ts',
        codeSnippet: `// RC08: Motor Load vs Cognitive Disambiguation
export function disambiguateMotorLoad(shadowScore: number, blownScore: number): CapacityAssessment {
  const delta = shadowScore - blownScore;
  if (shadowScore > 0.85 && blownScore < 0.55 && delta > 0.30) {
    return { capacityId: 'RC08', status: 'impaired', motorLoadConfirmed: true };
  }
  return { capacityId: 'RC08', status: 'unconfirmed' };
}`,
      },
      {
        id: 'RC09',
        name: 'Self-Monitoring and Correction',
        shortDesc: 'Auditory feedback processing to detect and correct one\'s own timing errors in real time.',
        detectionMechanism: {
          protocol: 'Delayed Auditory Feedback / Self-Annotation Probe (R28): Student annotates own timing errors',
          trigger: 'Unaware of rushing or dragging; does not perceive missed notes or collapsed durations',
          metricsFormula: 'Self-Report Sensitivity: d\' = Z(Hit Rate) - Z(False Alarm Rate) on deliberate timing flaws',
          thresholds: 'd\' < 1.0 indicates severe discrepancy detection impairment',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/SelfMonitoringStrategy.ts',
        codeSnippet: `// RC09: Real-time Self-Monitoring Sensitivity
export function evaluateSelfMonitoring(reportedErrors: number[], groundtruthErrors: number[]): CapacityAssessment {
  const hits = reportedErrors.filter(e => groundtruthErrors.some(g => Math.abs(e - g) < 200)).length;
  const hitRate = hits / (groundtruthErrors.length || 1);
  return hitRate < 0.6 ? { capacityId: 'RC09', status: 'impaired', hitRate } : { capacityId: 'RC09', status: 'intact' };
}`,
      },
      {
        id: 'RC10',
        name: 'Expressive Timing Control',
        shortDesc: 'Deliberate micro-timing variations (rubato, swing, agogic accents) for artistic interpretation.',
        detectionMechanism: {
          protocol: 'Expressive Timing Ratio Test (R31): Rubato/swing ratio reproducibility across multiple takes',
          trigger: 'Inflexible mechanical timing; uncontrolled involuntary tempo fluctuations confused with rubato',
          metricsFormula: 'Coefficient of Variation (CV) of expressive micro-timing offsets across repeated trials',
          thresholds: 'CV > 0.40 indicates random uncontrolled timing rather than repeatable expressive intent',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/ExpressiveTimingStrategy.ts',
        codeSnippet: `// RC10: Expressive Micro-Timing Consistency
export function evaluateExpressiveTiming(takeOffsets: number[][]): CapacityAssessment {
  const variance = calculateInterTakeVariance(takeOffsets);
  return variance > 0.40 ? { capacityId: 'RC10', status: 'impaired', variance } : { capacityId: 'RC10', status: 'intact' };
}`,
      },
      {
        id: 'RC11',
        name: 'Dual-Stream Phase Independence',
        shortDesc: 'Ability to sustain two competing rhythmic periodicities concurrently without involuntary motor coupling.',
        detectionMechanism: {
          protocol: 'Bimanual / Cross-Stream Independence Probe (R33): Tap 3 in right hand against 2 in left hand',
          trigger: 'Non-coincident attacks pull together; layers collapse into an uneven single-stream gallop',
          metricsFormula: 'Cross-Layer Coupling Ratio: C = 1 - |t_actual_cross - t_nominal_cross| / (0.5 * grid_interval)',
          thresholds: 'Coupling ratio C < 0.60 indicates magnetic attraction between independent rhythmic streams',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/PhaseIndependenceStrategy.ts',
        codeSnippet: `// RC11: Dual-Stream Phase Independence Analysis
export function evaluatePhaseIndependence(streamAOnsets: number[], streamBOnsets: number[]): CapacityAssessment {
  const couplingIndex = calculateCouplingIndex(streamAOnsets, streamBOnsets);
  return couplingIndex < 0.60 ? { capacityId: 'RC11', status: 'impaired', couplingIndex } : { capacityId: 'RC11', status: 'intact' };
}`,
      },
      {
        id: 'RC12',
        name: 'Metrical Anchor Stability',
        shortDesc: 'Bar-level grounding, error recovery, and metrical anchor stability under counter-periodicity.',
        detectionMechanism: {
          protocol: 'Dual-Stream Common Metric Grid (R34 / R37): 3:2 and 4:3 polyrhythmic alignment probes',
          trigger: 'Collapsing into one hand / voice; rushing or dragging to snap to the dominant rhythm',
          metricsFormula: 'Phase Locking Index (PLI) between polyrhythmic stream onsets',
          thresholds: 'PLI < 0.65 indicates stream cross-talk or metric collapse',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/PolyrhythmGridStrategy.ts',
        codeSnippet: `// RC12: Cross-Periodicity Phase Alignment
export function evaluatePolyrhythmicPhaseLock(streamA: number[], streamB: number[]): boolean {
  const pli = calculatePhaseLockingIndex(streamA, streamB);
  return pli >= 0.65;
}`,
      },
      {
        id: 'RC13',
        name: 'Asymmetric Additive Chunking',
        shortDesc: 'Ability to internalize and execute irregular macro-beats (2+3, 3+2+2) with organic timing.',
        detectionMechanism: {
          protocol: 'Additive Syllable Grouping Probe (R38): Ta-ki-ta (3) + Ta-ka (2) in 5/8 and 7/8',
          trigger: 'Smooths asymmetrical beats into equal pulses or stumbles on the odd-length pulse',
          metricsFormula: 'Macro-Beat Ratio Fidelity: Ratio_actual = IOI_long / IOI_short vs Nominal 1.5',
          thresholds: '|Ratio_actual - 1.5| > 0.25 indicates failure to sustain asymmetric metric units',
        },
        fileRef: 'src/strategies/classifications/rhythm/strategies/AdditiveGroupingStrategy.ts',
        codeSnippet: `// RC13: Asymmetric Additive Metric Ratio Fidelity
export function evaluateAdditiveChunking(longBeatMs: number, shortBeatMs: number): CapacityAssessment {
  const ratio = longBeatMs / (shortBeatMs || 1);
  return Math.abs(ratio - 1.5) > 0.25 ? { capacityId: 'RC13', status: 'impaired', ratio } : { capacityId: 'RC13', status: 'intact' };
}`,
      },
    ],
  },
  {
    name: 'Provisional Multi-Factor Profiler',
    simpleRole: 'Prevents the AI from jumping to conclusions',
    items: [
      {
        id: 'RULE-NEVER-FORCE-SINGLE-CAUSE',
        name: 'Multi-Hypothesis Invariant',
        shortDesc: 'Prohibits forcing a single root cause without strategy-as-probe empirical testing.',
        fileRef: 'src/backend/simulation/ReasoningSimulatorEngine.ts',
        codeSnippet: `// Maintain multi-hypothesis array with provisional weights\nconst hypotheses: CapacityHypothesis[] = [\n  { capacityId: 'RC03', confidence: 'moderate' },\n  { capacityId: 'RC08', confidence: 'possible' }\n];`,
      },
      {
        id: 'PROVISIONAL-EVIDENCE-WEIGHTER',
        name: 'Hypothesis Evidence Weighter',
        shortDesc: 'Calculates weighted support for candidate capacities based on telemetry.',
        fileRef: 'src/backend/simulation/ReasoningSimulatorEngine.ts',
        codeSnippet: `export function weightHypotheses(evidence: Evidence[]): CapacityHypothesis[] {\n  return hypotheses.map(h => calculateConfidence(h, evidence));\n}`,
      },
    ],
  },
  {
    name: 'Cognitive vs. Physical Factor Rules',
    simpleRole: 'Separates "knowing the rhythm" from "physical execution"',
    items: [
      {
        id: 'RULE-COMPARE-TAP-VS-PLAY',
        name: 'Motor Bottleneck Discriminator',
        shortDesc: 'Accurate table-tapping but inaccurate horn playing isolates motor coordination load.',
        fileRef: 'src/backend/simulation/ReasoningSimulatorEngine.ts',
        codeSnippet: `if (tableTapAccuracy > 0.9 && hornAccuracy < 0.7) {\n  diagnoseCapacity('RC08'); // Motor execution load confirmed\n}`,
      },
      {
        id: 'RULE-FATIGUE-ACCUMULATION',
        name: 'Fatigue & Resistance Detector',
        shortDesc: 'Identifies embouchure breakdown vs rhythm confusion over repeated takes.',
        fileRef: 'src/backend/simulation/ReasoningSimulatorEngine.ts',
        codeSnippet: `if (takeCount >= 3 && errorRateIncreasing) {\n  triggerTeacherHandoff('Embouchure fatigue detected');\n}`,
      },
    ],
  },
];

const ALL_32_PRACTICE_STRATEGIES: KnowledgebaseItem[] = Object.values(STRATEGY_CATALOGUE).map((strat) => ({
  id: strat.strategyId,
  name: strat.name,
  family: strat.strategyFamily,
  shortDesc: strat.mechanismClaim,
  detectionMechanism: {
    protocol: `Targeted Capacities: ${strat.primaryCapacityIds.join(', ')} (${strat.strategyFamily} Family)`,
    trigger: strat.useWhen[0] || 'Targeted rhythmic bottleneck',
    metricsFormula: strat.successCriterionTemplate,
    thresholds: `Transfer Goal: ${strat.transferTestTemplate}`,
  },
  fileRef: 'src/strategies/classifications/rhythm/registry/rhythmRegistry.ts',
  codeSnippet: `// Strategy ${strat.strategyId}: ${strat.name} (${strat.strategyFamily})
export const ${strat.strategyId} = {
  strategyId: "${strat.strategyId}",
  name: "${strat.name}",
  family: "${strat.strategyFamily}",
  primaryCapacities: ${JSON.stringify(strat.primaryCapacityIds)},
  mechanism: "${strat.mechanismClaim.replace(/"/g, '\\"')}",
  steps: ${JSON.stringify(strat.procedureSteps, null, 2)},
  progression: ${JSON.stringify(strat.progressionRules, null, 2)}
};`,
}));

const INTERVENTION_KNOWLEDGEBASES: LayerKnowledgebase[] = [
  {
    name: 'Practising Strategies Registry (All 32 Strategies R01–R32)',
    simpleRole: 'The complete 32 pedagogical strategies for deliberate practice',
    items: ALL_32_PRACTICE_STRATEGIES,
  },
  {
    name: 'Diagnostic Intervention Probes',
    simpleRole: 'Targeted exercises designed to reveal the root cause',
    items: [
      {
        id: 'DI-REF-SHADOW-01',
        name: 'Reference Shadow Fingering',
        shortDesc: 'Clicks valves silently to reference audio, removing blowing and embouchure load.',
        fileRef: 'src/strategies/classifications/rhythm/registry/DiagnosticInterventionRegistry.ts',
        codeSnippet: `{\n  id: 'DI-REF-SHADOW-01',\n  name: 'Reference Shadow Fingering',\n  variablesRemoved: ['tone_production', 'blowing_resistance'],\n  probesCapacities: ['RC03', 'RC08']\n};`,
      },
      {
        id: 'DI-SLOW-CLICK-01',
        name: 'Tempo Reduction Probe',
        shortDesc: 'Reduces tempo by 20 BPM with continuous click to probe cognitive speed load.',
        fileRef: 'src/strategies/classifications/rhythm/registry/DiagnosticInterventionRegistry.ts',
        codeSnippet: `{\n  id: 'DI-SLOW-CLICK-01',\n  name: 'Tempo Reduction Probe',\n  tempoOffset: -20,\n  probesCapacities: ['RC08']\n};`,
      },
      {
        id: 'DI-RHYTHM-XRAY-01',
        name: 'X-Ray Rhythm Subdivided',
        shortDesc: 'Replaces tied notes with audible 16th subdivisions to expose inner pulse.',
        fileRef: 'src/strategies/classifications/rhythm/strategies/ExplicitSubdivisionStrategy.ts',
        codeSnippet: `export class ExplicitSubdivisionStrategy {\n  renderSubdividedPitches(measure: Measure) {\n    return expandTiesToSixteenths(measure);\n  }\n}`,
      },
      {
        id: 'DI-GAP-CLICK-01',
        name: 'Metronome Dropout Probe',
        shortDesc: 'Metronome clicks for 2 bars then goes silent for 2 bars to test pulse autonomy.',
        fileRef: 'src/strategies/classifications/rhythm/registry/DiagnosticInterventionRegistry.ts',
        codeSnippet: `{\n  id: 'DI-GAP-CLICK-01',\n  clickPattern: [1, 1, 0, 0],\n  probesCapacities: ['RC01', 'RC03']\n};`,
      },
    ],
  },
  {
    name: 'Repertoire Front Door Choice Router',
    simpleRole: 'Empowers the learner with Choice A vs Choice B',
    items: [
      {
        id: 'ROUTER-CHOICE-A-VS-B',
        name: 'Learner Choice Router',
        shortDesc: 'Empowers learner with Option A (Shadow Fingering) vs Option B (Slower Tempo).',
        fileRef: 'src/strategies/AipcStrategyCoachModal.tsx',
        codeSnippet: `<ChoiceCard\n  optionA="Option A: Reference Shadow Fingering"\n  optionB="Option B: Slower Tempo (-20 BPM)"\n/>`,
      },
      {
        id: 'RULE-BOUNDED-ATTEMPTS-MAX-3',
        name: '2–3 Attempt Bound Guardrail',
        shortDesc: 'Enforces hard ceiling of 2–3 attempts per intervention before requiring decision.',
        fileRef: 'src/backend/service/KnowledgeSimulatorService.ts',
        codeSnippet: `if (attempts >= 3) { executeTeacherHandoff(); }`,
      },
    ],
  },
  {
    name: 'Interactive Practice Tools & Audio Assets',
    simpleRole: 'The digital tools used during practice',
    items: [
      {
        id: 'TOOL-TONEJS-METRONOME',
        name: 'Tone.js Audio Transport',
        shortDesc: 'Sub-millisecond audio scheduling for gap click and subdivision metronomes.',
        fileRef: 'src/strategies/classifications/rhythm/scaffolds/playbackSession.ts',
        codeSnippet: `Tone.Transport.scheduleRepeat((time) => {\n  clickSynth.triggerAttackRelease('C5', '32n', time);\n}, '4n');`,
      },
      {
        id: 'TOOL-VEXFLOW-RENDERER',
        name: 'VexFlow Dynamic Notation',
        shortDesc: 'SVG notation renderer displaying isolated measure transformations.',
        fileRef: 'src/strategies/classifications/rhythm/scaffolds/VexFlowRenderer.tsx',
        codeSnippet: `const vf = new VexFlow.Factory({ elementId });\nvf.Stave().addClef('treble').addTimeSignature('4/4');`,
      },
    ],
  },
];

const GUIDE_ADAPT_KNOWLEDGEBASES: LayerKnowledgebase[] = [
  {
    name: 'Response Sieve Rules (Responses A through E)',
    simpleRole: 'How the AI interprets student results',
    items: [
      {
        id: 'RESP-A',
        name: 'Shadowing Succeeded -> Retest Unassisted',
        shortDesc: 'Motor load cleared; internalize rhythmic pulse and retest without audio reference.',
        fileRef: 'src/strategies/classifications/rhythm/controllers/ResponseInterpreter.ts',
        codeSnippet: `case 'ResponseA':\n  return { decision: 'Pass_Internalize', nextAction: 'unassisted_retest' };`,
      },
      {
        id: 'RESP-B',
        name: 'Slower Tempo Succeeded -> Tempo Ladder',
        shortDesc: 'Cognitive speed load confirmed; progressively ladder tempo up in +3 or +5 BPM steps.',
        fileRef: 'src/strategies/classifications/rhythm/controllers/ResponseInterpreter.ts',
        codeSnippet: `case 'ResponseB':\n  return { decision: 'Persist_Ladder', deltaBpm: +5 };`,
      },
      {
        id: 'RESP-C',
        name: 'Tied Rhythm Still Fails -> Pivot to X-Ray',
        shortDesc: 'Rushing stopped but tied rhythm still breaks; pivot to X-Ray subdivision probe.',
        fileRef: 'src/strategies/classifications/rhythm/controllers/ResponseInterpreter.ts',
        codeSnippet: `case 'ResponseC':\n  return { decision: 'Pivot', newIntervention: 'DI-RHYTHM-XRAY-01' };`,
      },
      {
        id: 'RESP-D',
        name: 'Persistent Single Note Bottleneck -> Teacher Alert',
        shortDesc: 'Repeated mechanical failure at specific valve transition; limit to 3 tries and alert teacher.',
        fileRef: 'src/strategies/classifications/rhythm/controllers/ResponseInterpreter.ts',
        codeSnippet: `case 'ResponseD':\n  return { decision: 'Refer_Teacher', limit: 3 };`,
      },
      {
        id: 'RESP-E',
        name: 'Unstable Without Click -> Gap Click Training',
        shortDesc: 'External metronome dependency detected; train autonomous internal clock.',
        fileRef: 'src/strategies/classifications/rhythm/controllers/ResponseInterpreter.ts',
        codeSnippet: `case 'ResponseE':\n  return { decision: 'Pivot_InternalClock', newIntervention: 'DI-GAP-CLICK-01' };`,
      },
    ],
  },
  {
    name: 'Adaptive Progression Ladders',
    simpleRole: 'Rules for gradual tempo and scaffolding increases',
    items: [
      {
        id: 'LADDER-TEMPO-STEPS',
        name: 'Tempo Increment Protocol',
        shortDesc: 'Standard progression steps (+3 BPM fine, +5 BPM standard, +10 BPM stretch).',
        fileRef: 'src/strategies/classifications/rhythm/strategies/ExplicitSubdivisionStrategy.ts',
        codeSnippet: `export const TEMPO_LADDER = [0.8, 0.85, 0.9, 0.95, 1.0]; // fraction of target tempo`,
      },
      {
        id: 'FADING-SCAFFOLD-SCHEDULE',
        name: 'Support Fading Controller',
        shortDesc: 'Systematic fading: Continuous Click -> Gap Click -> Solo Retest.',
        fileRef: 'src/strategies/classifications/rhythm/scaffolds/playbackSession.ts',
        codeSnippet: `stages: ['continuous_click', 'subdivided_click', 'gap_click', 'unassisted']`,
      },
    ],
  },
  {
    name: 'Teacher Referral & Handoff Rules',
    simpleRole: 'Guarantees the human teacher remains the ultimate authority',
    items: [
      {
        id: 'RULE-MAX-3-ATTEMPT-GUARD',
        name: 'Attempt Limit Enforcer',
        shortDesc: 'Hard ceiling: 2–3 attempts max before stopping software and briefing teacher.',
        fileRef: 'src/backend/service/KnowledgeSimulatorService.ts',
        codeSnippet: `if (attemptCount >= 3 && status !== 'passed') {\n  createTeacherHandoffRecord();\n}`,
      },
      {
        id: 'HANDOFF-RECORD-GENERATOR',
        name: 'Teacher Handoff Record',
        shortDesc: 'Generates structured briefing: problem measures, tested probes, and physical checks.',
        fileRef: 'src/backend/simulation/ReasoningSimulatorEngine.ts',
        codeSnippet: `export interface TeacherHandoffRecord {\n  studentId: string;\n  problemSignature: string;\n  attempts: number;\n  suggestedPhysicalCheck: string;\n}`,
      },
    ],
  },
];

const PEDAGOGICAL_LAYERS: PedagogicalLayerItem[] = [
  {
    id: 'diagnosis',
    number: 1,
    name: 'Diagnosis',
    subsetsLabel: '2 Subsets: Observe & Diagnosis',
    color: {
      bg: 'bg-blue-950/30',
      border: 'border-blue-500/30',
      text: 'text-blue-300',
      accent: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    },
    subsets: [
      {
        subsetId: 'observe',
        subsetName: 'Observe Knowledgebase',
        badge: 'Subset 1',
        knowledgebases: OBSERVE_KNOWLEDGEBASES,
      },
      {
        subsetId: 'diagnosis',
        subsetName: 'Diagnosis Knowledgebase',
        badge: 'Subset 2',
        knowledgebases: DIAGNOSIS_KNOWLEDGEBASES,
      },
    ],
    knowledgebases: [...OBSERVE_KNOWLEDGEBASES, ...DIAGNOSIS_KNOWLEDGEBASES],
  },
  {
    id: 'strategy',
    number: 2,
    name: 'Strategy',
    subsetsLabel: 'Intervention Knowledgebase',
    color: {
      bg: 'bg-purple-950/30',
      border: 'border-purple-500/30',
      text: 'text-purple-300',
      accent: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
    subsets: [
      {
        subsetId: 'intervention',
        subsetName: 'Intervention Knowledgebase',
        badge: 'Core Subset',
        knowledgebases: INTERVENTION_KNOWLEDGEBASES,
      },
    ],
    knowledgebases: INTERVENTION_KNOWLEDGEBASES,
  },
  {
    id: 'guide',
    number: 3,
    name: 'Guide',
    subsetsLabel: 'Guide & Adapt Knowledgebase',
    color: {
      bg: 'bg-emerald-950/30',
      border: 'border-emerald-500/30',
      text: 'text-emerald-300',
      accent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    subsets: [
      {
        subsetId: 'guide_adapt',
        subsetName: 'Guide and Adapt Knowledgebase',
        badge: 'Core Subset',
        knowledgebases: GUIDE_ADAPT_KNOWLEDGEBASES,
      },
    ],
    knowledgebases: GUIDE_ADAPT_KNOWLEDGEBASES,
  },
];

export const KnowledgeSimulatorView: React.FC<KnowledgeSimulatorViewProps> = ({ onBack }) => {
  // Main View Switcher
  const [activeView, setActiveView] = useState<'problem_mapper' | 'layers_catalog'>('problem_mapper');

  // Problem Mapper State
  const [selectedProblemId, setSelectedProblemId] = useState<string>('PS-RUSH-01');
  const [expandedDiagnoses, setExpandedDiagnoses] = useState<Record<string, boolean>>({});
  const [expandedInterventions, setExpandedInterventions] = useState<Record<string, boolean>>({});

  // Layers Catalog State
  const [selectedLayerId, setSelectedLayerId] = useState<string>('diagnosis');
  const [expandedKbIndex, setExpandedKbIndex] = useState<Record<string, boolean>>({
    '0_0': true,
  });
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    'PS-RUSH-01': true,
  });
  const [expandedCodeItems, setExpandedCodeItems] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [selectedStrategyFamily, setSelectedStrategyFamily] = useState<string>('all');
  const [selectedTableStrategyId, setSelectedTableStrategyId] = useState<string | null>(null);
  const [strategyViewMode, setStrategyViewMode] = useState<'table' | 'cards'>('table');

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleCode = (itemId: string) => {
    setExpandedCodeItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleCopyCode = async (itemId: string, snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedCodeId(itemId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch (err) {
      console.error('Failed to copy code snippet:', err);
    }
  };

  // Note taking & Coding Prompt Copy
  const [noteAuthor, setNoteAuthor] = useState<string>('Pedagogical Lead');
  const [noteContent, setNoteContent] = useState<string>('');
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [savedNotes, setSavedNotes] = useState<KnowledgeNote[]>(KnowledgeSimulatorService.getNotes());
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  const selectedProblem = PROBLEM_MAPPINGS.find(p => p.id === selectedProblemId) || PROBLEM_MAPPINGS[0];
  const selectedLayer = PEDAGOGICAL_LAYERS.find(l => l.id === selectedLayerId) || PEDAGOGICAL_LAYERS[0];

  const toggleDiagnosis = (id: string) => {
    setExpandedDiagnoses(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleIntervention = (id: string) => {
    setExpandedInterventions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleKbCard = (key: string) => {
    setExpandedKbIndex(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveNote = () => {
    if (!noteContent.trim()) return;
    const note = KnowledgeSimulatorService.saveNote(
      selectedProblem.id,
      noteAuthor,
      noteContent,
      ['pedagogical_refinement', selectedProblem.id]
    );
    setSavedNotes(prev => [note, ...prev]);
    setNoteContent('');
  };

  const handleCopyAgentPrompt = async () => {
    const prompt = `# AIPC Pedagogical Knowledgebase Refinement Prompt

**Domain:** Rhythm & Metric Organisation  
**Selected Problem:** ${selectedProblem.name} (\`${selectedProblem.id}\`)  
**Context:** ${selectedProblem.tagline}

---

## 1. Observed Musical Symptoms
- **What happens:** ${selectedProblem.whatHappens}
- **What the teacher hears:** ${selectedProblem.whatTeacherHears}

---

## 2. Plausible Diagnoses (Causes Under Investigation)
${selectedProblem.diagnoses.map(d => `- **${d.id}: ${d.title}**: ${d.explanation}`).join('\n')}

---

## 3. Recommended Interventions (Probes)
${selectedProblem.interventions.map(i => `- **${i.name}**: ${i.whatStudentDoes} (Why: ${i.whyItHelps})`).join('\n')}

---

## 4. Adaptation & Teacher Handoff Guardrails
- **If improved:** ${selectedProblem.nextSteps.ifSuccess}
- **If struggling:** ${selectedProblem.nextSteps.ifStruggles}
- **Teacher referral limit:** ${selectedProblem.nextSteps.teacherAlert}

---

## 5. Developer & Teacher Notes
${savedNotes.length > 0 ? savedNotes.map(n => `- [${n.author}] ${n.noteText}`).join('\n') : 'No custom notes recorded.'}
`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Return to Teacher Portal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white">
                AIPC <span className="text-purple-400 font-medium text-sm">Pedagogical Knowledgebase</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Developer
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mode Switcher Navigation Ribbon */}
      <div className="h-12 px-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('problem_mapper')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeView === 'problem_mapper'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-4 h-4 text-purple-400" />
            <span>Intervention Map</span>
          </button>

          <button
            onClick={() => setActiveView('layers_catalog')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeView === 'layers_catalog'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Pedagogical Layers (Diagnosis, Strategy, Guide)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* ========================================================================= */}
        {/* VIEW 1: PROBLEM -> DIAGNOSIS -> STRATEGY MAPPER */}
        {/* ========================================================================= */}
        {activeView === 'problem_mapper' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Select Musical Problem Signature */}
            <div className="w-80 border-r border-slate-800 p-4 space-y-2.5 overflow-y-auto shrink-0 bg-slate-900/30">
              <div className="px-2 pb-1">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                  Step 1: Choose a Problem Pattern
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a common musical challenge to see how AIPC diagnoses and solves it:
                </p>
              </div>

              {PROBLEM_MAPPINGS.map(prob => {
                const isSelected = selectedProblemId === prob.id;
                return (
                  <button
                    key={prob.id}
                    onClick={() => {
                      setSelectedProblemId(prob.id);
                      setExpandedDiagnoses({});
                      setExpandedInterventions({});
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500/60 text-white shadow-md ring-1 ring-purple-500/40'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100">{prob.name}</span>
                      <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 border border-slate-700">
                        {prob.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">
                      {prob.tagline}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Right Main Panel: 3-Column Visual Pedagogical Flow */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Problem Overview Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Problem Signature: {selectedProblem.id}
                    </span>
                    <h2 className="text-base font-extrabold text-white">{selectedProblem.name}</h2>
                  </div>
                  <span className="text-xs text-slate-400 italic">
                    "{selectedProblem.tagline}"
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>What Is Happening:</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{selectedProblem.whatHappens}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                      <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                      <span>What The Teacher Hears:</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{selectedProblem.whatTeacherHears}</p>
                  </div>
                </div>
              </div>

              {/* 2-Column Section: Possible Diagnoses vs Recommended Interventions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Possible Diagnoses (Causes under investigation) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Possible Diagnoses
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          AIPC tests multiple causes rather than forcing one
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedProblem.diagnoses.length} candidates
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedProblem.diagnoses.map((diag, idx) => {
                      const isExpanded = !!expandedDiagnoses[diag.id];
                      return (
                        <div
                          key={diag.id}
                          className={`rounded-xl border transition-all ${
                            isExpanded
                              ? 'bg-slate-900/90 border-amber-500/40 shadow-sm'
                              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div
                            onClick={() => toggleDiagnosis(diag.id)}
                            className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold font-mono">
                                {diag.id}
                              </span>
                              <span className="text-xs font-bold text-slate-200">{diag.title}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="text-[10px] text-slate-500">
                                {isExpanded ? 'Hide' : 'Explain'}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/80 space-y-2 text-xs">
                              <p className="text-slate-300 leading-relaxed">
                                {diag.explanation}
                              </p>
                              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px]">
                                <span className="font-bold text-amber-300">How to Spot It: </span>
                                <span className="text-slate-400">{diag.howToRecognize}</span>
                              </div>
                              {diag.howAipcDetects && (
                                <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/25 text-[11px] space-y-1">
                                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                                    <Zap className="w-3 h-3 text-indigo-400" />
                                    How AIPC Technically Detects It:
                                  </span>
                                  <p className="text-slate-300 font-mono text-[10.5px] leading-relaxed">
                                    {diag.howAipcDetects}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Column 2: Recommended Practice Interventions (Probes) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                        <Lightbulb className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                          Recommended Practice Strategies
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Exercises that test and resolve the bottleneck
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedProblem.interventions.length} strategies
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedProblem.interventions.map((interv) => {
                      const isExpanded = !!expandedInterventions[interv.id];
                      return (
                        <div
                          key={interv.id}
                          className={`rounded-xl border transition-all ${
                            isExpanded
                              ? 'bg-slate-900/90 border-purple-500/40 shadow-sm'
                              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div
                            onClick={() => toggleIntervention(interv.id)}
                            className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2.5">
                              {interv.optionLabel && (
                                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[10px] font-extrabold">
                                  {interv.optionLabel}
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-100">{interv.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="text-[10px] text-slate-500">
                                {isExpanded ? 'Hide' : 'Details'}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/80 space-y-2.5 text-xs">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  What the Student Does:
                                </span>
                                <p className="text-slate-200 mt-0.5 leading-relaxed">
                                  {interv.whatStudentDoes}
                                </p>
                              </div>

                              <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/20">
                                <span className="font-bold text-purple-300">Why It Helps: </span>
                                <span className="text-slate-300">{interv.whyItHelps}</span>
                              </div>

                              <div className="text-[11px] text-slate-400">
                                <strong>Variables Removed:</strong> {interv.variablesIsolated}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Card: How AIPC Adapts & Involves the Teacher */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Next Steps: Evaluation, Adaptation & Teacher Handoff
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>If The Student Improves:</span>
                    </div>
                    <p className="text-slate-300 leading-snug">{selectedProblem.nextSteps.ifSuccess}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>If Still Struggling:</span>
                    </div>
                    <p className="text-slate-300 leading-snug">{selectedProblem.nextSteps.ifStruggles}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>2–3 Attempt Limit & Teacher Alert:</span>
                    </div>
                    <p className="text-amber-200/90 leading-snug">{selectedProblem.nextSteps.teacherAlert}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* VIEW 2: THE 3 PEDAGOGICAL LAYERS (DIAGNOSIS, STRATEGY, GUIDE) & KNOWLEDGEBASES */}
        {/* ========================================================================= */}
        {activeView === 'layers_catalog' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Select 1 of the 3 Pedagogical Layers */}
            <div className="w-80 border-r border-slate-800 p-4 space-y-3 overflow-y-auto shrink-0 bg-slate-900/30">
              <div className="px-2 pb-1">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                  The Pedagogical Layers
                </span>
              </div>

              {PEDAGOGICAL_LAYERS.map(lay => {
                const isSelected = selectedLayerId === lay.id;
                return (
                  <button
                    key={lay.id}
                    onClick={() => {
                      setSelectedLayerId(lay.id);
                      setExpandedKbIndex({ '0_0': true });
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? `${lay.color.bg} ${lay.color.border} shadow-md ring-1 ring-purple-500/30`
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${lay.color.accent}`}>
                        Layer {lay.number}: {lay.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {lay.knowledgebases.length} KBs
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-100 mt-2">{lay.name}</h3>
                    <div className="text-[11px] font-semibold text-purple-300/90 mt-0.5">
                      {lay.subsetsLabel}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Main Panel: Expandable Knowledgebase Subsets & Cards */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Layer Header Banner (Headers Only) */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2.5 flex-wrap">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border ${selectedLayer.color.accent}`}>
                  Layer {selectedLayer.number}: {selectedLayer.name}
                </span>
                <span className="text-xs font-bold text-purple-300 bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-800/40">
                  {selectedLayer.subsetsLabel}
                </span>
              </div>

              {/* Subsets Section */}
              <div className="space-y-6">
                {selectedLayer.subsets.map((subset, sIdx) => (
                  <div key={subset.subsetId} className="space-y-3">
                    {/* Subset Header (Only Header Text, No Descriptions) */}
                    <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {subset.badge}
                        </span>
                        <h3 className="text-sm font-black text-white">
                          {subset.subsetName}
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-2">
                        {subset.knowledgebases.length} modular registries
                      </span>
                    </div>

                    {/* Cards inside this subset */}
                    <div className="space-y-3">
                      {subset.knowledgebases.map((kb, kbIdx) => {
                        const cardKey = `${sIdx}_${kbIdx}`;
                        const isExpanded = !!expandedKbIndex[cardKey];
                        return (
                          <div
                            key={kb.name}
                            className={`rounded-2xl border transition-all ${
                              isExpanded
                                ? 'bg-slate-900/90 border-slate-700 shadow-md'
                                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* Card Header */}
                            <div
                              onClick={() => toggleKbCard(cardKey)}
                              className="p-4 flex items-center justify-between cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                                  {kbIdx + 1}
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    {kb.name}
                                  </h4>
                                  <p className="text-xs text-purple-300 font-medium mt-0.5">
                                    {kb.simpleRole}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 text-slate-400">
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                                  {kb.items.length} items
                                </span>
                                <span className="text-xs text-slate-500">
                                  {isExpanded ? 'Collapse' : 'Expand list'}
                                </span>
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </div>
                            </div>

                            {/* Expandable Items List */}
                            {isExpanded && (() => {
                              const isStrategyCatalogue = kb.name.includes('Practising Strategies');
                              const itemsToRender = isStrategyCatalogue && selectedStrategyFamily !== 'all'
                                ? kb.items.filter(i => i.family === selectedStrategyFamily)
                                : kb.items;

                              return (
                                <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 space-y-3">
                                  {isStrategyCatalogue ? (
                                    <div className="space-y-3">
                                      {/* Header with Mode Switcher */}
                                      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/80">
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                                            Strategy Families Pedagogical Matrix
                                          </span>
                                          <p className="text-[11px] text-slate-400">
                                            Click any strategy badge (e.g. <span className="text-purple-300 font-mono font-bold">R01</span>, <span className="text-purple-300 font-mono font-bold">R04</span>, <span className="text-purple-300 font-mono font-bold">R11</span>) to expand its specific description, procedure, and codebase.
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                                          <button
                                            onClick={() => setStrategyViewMode('table')}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                              strategyViewMode === 'table'
                                                ? 'bg-purple-600 text-white shadow-sm'
                                                : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                          >
                                            <Table className="w-3.5 h-3.5" />
                                            <span>Family Table</span>
                                          </button>
                                          <button
                                            onClick={() => setStrategyViewMode('cards')}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                              strategyViewMode === 'cards'
                                                ? 'bg-purple-600 text-white shadow-sm'
                                                : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                          >
                                            <List className="w-3.5 h-3.5" />
                                            <span>Cards List (32)</span>
                                          </button>
                                        </div>
                                      </div>

                                      {/* Strategy Families Table View */}
                                      {strategyViewMode === 'table' ? (
                                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-inner">
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                              <thead>
                                                <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                                                  <th className="py-3 px-4 font-bold text-slate-300 w-48">Family</th>
                                                  <th className="py-3 px-3 font-bold text-center w-16">Count</th>
                                                  <th className="py-3 px-4 font-bold text-slate-300 min-w-[240px]">Strategies</th>
                                                  <th className="py-3 px-4 font-bold text-slate-300">Pedagogical Role</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-800/60">
                                                {Object.entries(STRATEGY_FAMILY_METADATA).map(([famKey, meta]) => {
                                                  const familyStrategies = kb.items.filter(i => i.family === famKey);
                                                  const isAnyExpandedInThisFamily = familyStrategies.some(s => s.id === selectedTableStrategyId);
                                                  const expandedStrat = familyStrategies.find(s => s.id === selectedTableStrategyId);
                                                  const stratCatalogEntry = expandedStrat ? STRATEGY_CATALOGUE[expandedStrat.id] : null;

                                                  return (
                                                    <React.Fragment key={famKey}>
                                                      <tr className={`transition-colors ${isAnyExpandedInThisFamily ? 'bg-purple-950/25' : 'hover:bg-slate-900/40'}`}>
                                                        <td className="py-3.5 px-4 align-top">
                                                          <div className="font-bold text-white text-xs">
                                                            {meta.label}
                                                          </div>
                                                        </td>
                                                        <td className="py-3.5 px-3 align-top text-center">
                                                          <span className="inline-block px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-500/30 text-[10px] font-bold font-mono">
                                                            {familyStrategies.length}
                                                          </span>
                                                        </td>
                                                        <td className="py-3.5 px-4 align-top">
                                                          <div className="flex flex-wrap gap-1.5">
                                                            {familyStrategies.map((strat) => {
                                                              const isSelected = selectedTableStrategyId === strat.id;
                                                              return (
                                                                <button
                                                                  key={strat.id}
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedTableStrategyId(isSelected ? null : strat.id);
                                                                  }}
                                                                  title={`${strat.id}: ${strat.name}`}
                                                                  className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                                    isSelected
                                                                      ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400 scale-105'
                                                                      : 'bg-slate-800/90 text-purple-300 border border-purple-500/20 hover:bg-purple-900/40 hover:text-purple-100 hover:border-purple-400/40'
                                                                  }`}
                                                                >
                                                                  <span>{strat.id}</span>
                                                                  {isSelected ? (
                                                                    <ChevronDown className="w-3 h-3 text-purple-200" />
                                                                  ) : (
                                                                    <ChevronRight className="w-3 h-3 text-purple-400/60" />
                                                                  )}
                                                                </button>
                                                              );
                                                            })}
                                                          </div>
                                                        </td>
                                                        <td className="py-3.5 px-4 align-top text-slate-300 text-[11px] leading-relaxed">
                                                          {meta.description}
                                                        </td>
                                                      </tr>

                                                      {/* Expanded Strategy Details Drawer Row */}
                                                      {isAnyExpandedInThisFamily && expandedStrat && (
                                                        <tr className="bg-slate-900/95 border-t border-b border-purple-500/30">
                                                          <td colSpan={4} className="p-4">
                                                            <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-4 shadow-xl">
                                                              {/* Header */}
                                                              <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-3">
                                                                <div className="space-y-1">
                                                                  <div className="flex items-center gap-2.5 flex-wrap">
                                                                    <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold font-mono">
                                                                      {expandedStrat.id}
                                                                    </span>
                                                                    <h4 className="text-sm font-bold text-white">
                                                                      {expandedStrat.name}
                                                                    </h4>
                                                                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-medium">
                                                                      {meta.label} Family
                                                                    </span>
                                                                  </div>
                                                                  <p className="text-xs text-purple-200/80 font-mono">
                                                                    {expandedStrat.detectionMechanism?.protocol}
                                                                  </p>
                                                                </div>
                                                                <button
                                                                  onClick={() => setSelectedTableStrategyId(null)}
                                                                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                                                                  title="Close details"
                                                                >
                                                                  <X className="w-4 h-4" />
                                                                </button>
                                                              </div>

                                                              {/* Specific Description */}
                                                              <div className="space-y-1.5">
                                                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                                                  <span>Specific Pedagogical Mechanism:</span>
                                                                </h5>
                                                                <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                                                                  {expandedStrat.shortDesc}
                                                                </p>
                                                              </div>

                                                              {/* Use When / Avoid When Cues */}
                                                              {stratCatalogEntry && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                                                                  {stratCatalogEntry.useWhen && stratCatalogEntry.useWhen.length > 0 && (
                                                                    <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/25">
                                                                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                                                                        ✓ Indicator (Use When):
                                                                      </span>
                                                                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                                                                        {stratCatalogEntry.useWhen.map((uw, i) => (
                                                                          <li key={i}>{uw}</li>
                                                                        ))}
                                                                      </ul>
                                                                    </div>
                                                                  )}
                                                                  {stratCatalogEntry.avoidWhen && stratCatalogEntry.avoidWhen.length > 0 && (
                                                                    <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/25">
                                                                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                                                                        ⚠ Contraindication (Avoid When):
                                                                      </span>
                                                                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                                                                        {stratCatalogEntry.avoidWhen.map((aw, i) => (
                                                                          <li key={i}>{aw}</li>
                                                                        ))}
                                                                      </ul>
                                                                    </div>
                                                                  )}
                                                                </div>
                                                             )}

                                                              {/* Procedure Steps */}
                                                              {stratCatalogEntry?.procedureSteps && (
                                                                <div className="space-y-1.5">
                                                                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                                                    <span>Step-by-Step Deliberate Practice Procedure:</span>
                                                                  </h5>
                                                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                    {stratCatalogEntry.procedureSteps.map((step, sIdx) => (
                                                                      <div key={sIdx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                                                                        <span className="text-[10px] font-bold text-purple-400 block">Step {sIdx + 1}</span>
                                                                        <p className="text-slate-300 leading-snug">{step}</p>
                                                                      </div>
                                                                    ))}
                                                                  </div>
                                                                </div>
                                                              )}

                                                              {/* Codebase Implementation */}
                                                              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                                                                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 flex-wrap gap-2">
                                                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate">
                                                                    <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                                    <span className="text-indigo-300 font-bold">Codebase Implementation:</span>
                                                                    <span className="text-slate-400">{expandedStrat.fileRef}</span>
                                                                  </div>
                                                                  <button
                                                                    onClick={() => handleCopyCode(expandedStrat.id, expandedStrat.codeSnippet)}
                                                                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-all cursor-pointer shadow-sm"
                                                                  >
                                                                    {copiedCodeId === expandedStrat.id ? (
                                                                      <>
                                                                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                                                                        <span className="text-emerald-200">Copied!</span>
                                                                      </>
                                                                    ) : (
                                                                      <>
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                        <span>Copy Code</span>
                                                                      </>
                                                                    )}
                                                                  </button>
                                                                </div>
                                                                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed max-h-64 overflow-y-auto scrollbar-thin whitespace-pre-wrap">
                                                                  <code>{expandedStrat.codeSnippet}</code>
                                                                </pre>
                                                              </div>
                                                            </div>
                                                          </td>
                                                        </tr>
                                                      )}
                                                    </React.Fragment>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      ) : (
                                        /* Cards List View Mode */
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                              Filter by Strategy Family ({Object.keys(STRATEGY_FAMILY_METADATA).length} Families):
                                            </span>
                                            {selectedStrategyFamily !== 'all' && (
                                              <button
                                                onClick={() => setSelectedStrategyFamily('all')}
                                                className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                                              >
                                                Show All 32
                                              </button>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                                            <button
                                              onClick={() => setSelectedStrategyFamily('all')}
                                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                                                selectedStrategyFamily === 'all'
                                                  ? 'bg-purple-600 text-white shadow-sm'
                                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                              }`}
                                            >
                                              All (32)
                                            </button>
                                            {Object.entries(STRATEGY_FAMILY_METADATA).map(([famKey, meta]) => {
                                              const count = kb.items.filter(i => i.family === famKey).length;
                                              const isSelected = selectedStrategyFamily === famKey;
                                              return (
                                                <button
                                                  key={famKey}
                                                  onClick={() => setSelectedStrategyFamily(famKey)}
                                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                                                    isSelected
                                                      ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                                                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                                                  }`}
                                                >
                                                  <span>{meta.label}</span>
                                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-purple-800 text-white' : 'bg-slate-900 text-slate-400'}`}>
                                                    {count}
                                                  </span>
                                                </button>
                                              );
                                            })}
                                          </div>

                                          <div className="space-y-2.5">
                                            {itemsToRender.map((item) => {
                                              const isItemExpanded = !!expandedItems[item.id];
                                              const isCodeExpanded = !!expandedCodeItems[item.id];
                                              const isCopied = copiedCodeId === item.id;

                                              return (
                                                <div
                                                  key={item.id}
                                                  className={`rounded-xl border transition-all ${
                                                    isItemExpanded
                                                      ? 'bg-slate-950/90 border-slate-700 shadow-sm'
                                                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                                                  }`}
                                                >
                                                  <div
                                                    onClick={() => toggleItem(item.id)}
                                                    className="p-3 flex items-center justify-between cursor-pointer select-none"
                                                  >
                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                      <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 text-[10px] font-bold font-mono">
                                                        {item.id}
                                                      </span>
                                                      <span className="text-xs font-bold text-slate-200">
                                                        {item.name}
                                                      </span>
                                                      {item.family && (
                                                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[10px] font-medium">
                                                          {STRATEGY_FAMILY_METADATA[item.family]?.label || item.family}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-400">
                                                      <span className="text-[10px] text-slate-500">
                                                        {isItemExpanded ? 'Hide' : 'Details'}
                                                      </span>
                                                      {isItemExpanded ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                      ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                      )}
                                                    </div>
                                                  </div>

                                                  {isItemExpanded && (
                                                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/60 space-y-2.5 text-xs">
                                                      <p className="text-slate-300 leading-relaxed font-normal">
                                                        {item.shortDesc}
                                                      </p>
                                                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex-wrap gap-2">
                                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate max-w-full">
                                                          <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                          <span className="text-indigo-300 truncate">{item.fileRef}</span>
                                                        </div>
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleCode(item.id);
                                                          }}
                                                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                                            isCodeExpanded
                                                              ? 'bg-purple-600 text-white shadow-sm'
                                                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                                          }`}
                                                        >
                                                          <Code2 className="w-3 h-3" />
                                                          <span>{isCodeExpanded ? 'Close Code' : 'Open Codebase'}</span>
                                                        </button>
                                                      </div>

                                                      {isCodeExpanded && (
                                                        <div className="relative rounded-lg bg-slate-950 border border-purple-500/30 overflow-hidden mt-2">
                                                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono text-slate-400">
                                                            <span>Source Implementation</span>
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyCode(item.id, item.codeSnippet);
                                                              }}
                                                              className="flex items-center gap-1 text-purple-300 hover:text-purple-200 transition-colors cursor-pointer"
                                                            >
                                                              {isCopied ? (
                                                                <>
                                                                  <Check className="w-3 h-3 text-emerald-400" />
                                                                  <span className="text-emerald-400 font-bold">Copied!</span>
                                                                </>
                                                              ) : (
                                                                <>
                                                                  <Copy className="w-3 h-3" />
                                                                  <span>Copy</span>
                                                                </>
                                                              )}
                                                            </button>
                                                          </div>
                                                          <pre className="p-3 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                                                            <code>{item.codeSnippet}</code>
                                                          </pre>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    /* Non-Strategy Standard Items List */
                                    <div className="space-y-2.5">
                                      {kb.items.map((item) => {
                                        const isItemExpanded = !!expandedItems[item.id];
                                        const isCodeExpanded = !!expandedCodeItems[item.id];
                                        const isCopied = copiedCodeId === item.id;

                                        return (
                                          <div
                                            key={item.id}
                                            className={`rounded-xl border transition-all ${
                                              isItemExpanded
                                                ? 'bg-slate-950/90 border-slate-700 shadow-sm'
                                                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                                            }`}
                                          >
                                            {/* Item Summary Row */}
                                            <div
                                              onClick={() => toggleItem(item.id)}
                                              className="p-3 flex items-center justify-between cursor-pointer select-none"
                                            >
                                              <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25 text-[10px] font-bold font-mono">
                                                  {item.id}
                                                </span>
                                                <span className="text-xs font-bold text-slate-200">
                                                  {item.name}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2 text-slate-400">
                                                <span className="text-[10px] text-slate-500">
                                                  {isItemExpanded ? 'Hide' : 'Details'}
                                                </span>
                                                {isItemExpanded ? (
                                                  <ChevronDown className="w-3.5 h-3.5" />
                                                ) : (
                                                  <ChevronRight className="w-3.5 h-3.5" />
                                                )}
                                              </div>
                                            </div>

                                            {/* Expanded Item Details */}
                                            {isItemExpanded && (
                                              <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/60 space-y-2.5 text-xs">
                                                {/* Short Description */}
                                                <p className="text-slate-300 leading-relaxed font-normal">
                                                  {item.shortDesc}
                                                </p>

                                                {/* Technical Detection Mechanism (If Defined) */}
                                                {item.detectionMechanism && (
                                                  <div className="p-3 rounded-lg bg-slate-900 border border-purple-500/25 space-y-2">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                                                      <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                                      <span>How AIPC Technically Detects It:</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                      <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                                                        <span className="text-slate-400 font-medium block text-[10px]">Diagnostic Protocol:</span>
                                                        <span className="text-slate-200 font-semibold">{item.detectionMechanism.protocol}</span>
                                                      </div>
                                                      <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                                                        <span className="text-slate-400 font-medium block text-[10px]">Trigger Pattern:</span>
                                                        <span className="text-amber-300 font-semibold">{item.detectionMechanism.trigger}</span>
                                                      </div>
                                                      {item.detectionMechanism.metricsFormula && (
                                                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 font-mono">
                                                          <span className="text-slate-400 font-sans font-medium block text-[10px]">Mathematical Metric:</span>
                                                          <span className="text-indigo-300 text-[10.5px] leading-tight block">{item.detectionMechanism.metricsFormula}</span>
                                                        </div>
                                                      )}
                                                      {item.detectionMechanism.thresholds && (
                                                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                                                          <span className="text-slate-400 font-medium block text-[10px]">Decision Threshold:</span>
                                                          <span className="text-emerald-300 font-mono text-[10.5px] leading-tight block">{item.detectionMechanism.thresholds}</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Codebase Implementation Reference Bar */}
                                                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex-wrap gap-2">
                                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate max-w-full">
                                                    <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                    <span className="text-indigo-300 truncate">{item.fileRef}</span>
                                                  </div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleCode(item.id);
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                                      isCodeExpanded
                                                        ? 'bg-purple-600 text-white shadow-sm'
                                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                                    }`}
                                                  >
                                                    <Code2 className="w-3 h-3" />
                                                    <span>{isCodeExpanded ? 'Close Code' : 'Open Codebase'}</span>
                                                  </button>
                                                </div>

                                                {/* Code Block Snippet */}
                                                {isCodeExpanded && (
                                                  <div className="relative rounded-lg bg-slate-950 border border-purple-500/30 overflow-hidden mt-2">
                                                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono text-slate-400">
                                                      <span>Source Implementation</span>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCopyCode(item.id, item.codeSnippet);
                                                        }}
                                                        className="flex items-center gap-1 text-purple-300 hover:text-purple-200 transition-colors cursor-pointer"
                                                      >
                                                        {isCopied ? (
                                                          <>
                                                            <Check className="w-3 h-3 text-emerald-400" />
                                                            <span className="text-emerald-400 font-bold">Copied!</span>
                                                          </>
                                                        ) : (
                                                          <>
                                                            <Copy className="w-3 h-3" />
                                                            <span>Copy</span>
                                                          </>
                                                        )}
                                                      </button>
                                                    </div>
                                                    <pre className="p-3 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                                                      <code>{item.codeSnippet}</code>
                                                    </pre>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE-OVER DRAWER: NOTES & REFINEMENTS */}
        {/* ========================================================================= */}
        {isNotesOpen && (
          <div className="w-96 border-l border-slate-800 bg-slate-900/95 p-5 flex flex-col justify-between overflow-y-auto shrink-0 z-40 backdrop-blur-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                    Pedagogical Notes
                  </h3>
                </div>
                <button
                  onClick={() => setIsNotesOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              {/* Note Composer */}
              <div className="space-y-2">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Record an observation or refinement for this problem pattern..."
                  className="w-full h-24 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-purple-500 resize-none"
                />
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value)}
                    placeholder="Author"
                    className="w-36 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteContent.trim()}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Saved Notes ({savedNotes.length})
                </span>
                {savedNotes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                    No notes recorded yet.
                  </p>
                ) : (
                  savedNotes.map(n => (
                    <div
                      key={n.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="font-bold text-indigo-300">{n.author}</span>
                        <span className="font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{n.noteText}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleCopyAgentPrompt}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Instructions for Coding Agents</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
