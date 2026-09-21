/**
 * AIPC Rhythm Strategy Knowledge-Base Registry
 * Implements capacities RC01-RC10, complete 32 strategy catalogue (R01-R32), and problem signatures.
 * Based on AIPC Rhythm Strategy Knowledge-Base Specification v0.1
 */

import type { RhythmicCapacity, ProblemSignature, StrategyRecord, StrategyFamily, RhythmicCapacityId, AssistanceConfig, AssistanceLevel } from '../types/aipcStrategy';

// ── 1. Controlled Vocabulary: Rhythmic Capacities ───────────────────────────
export const RHYTHMIC_CAPACITIES: Record<string, RhythmicCapacity> = {
  RC01: {
    id: 'RC01',
    name: 'Beat Perception',
    operationalDefinition: 'Locate the underlying pulse in an auditory or notated pattern.',
    typicalFailure: 'Beat location is unclear, erratic, or fluctuates unexpectedly.'
  },
  RC02: {
    id: 'RC02',
    name: 'Beat Synchronisation',
    operationalDefinition: 'Align motor actions predictively with an external auditory pulse.',
    typicalFailure: 'Stable early/late constant offset or high onset variability.'
  },
  RC03: {
    id: 'RC03',
    name: 'Internal Pulse',
    operationalDefinition: 'Maintain constant tempo when external temporal support is reduced or removed.',
    typicalFailure: 'Progressive tempo drift during silence or after click removal.'
  },
  RC04: {
    id: 'RC04',
    name: 'Subdivision',
    operationalDefinition: 'Represent smaller equal units within a beat grid.',
    typicalFailure: 'Uneven short note values (16ths/triplets) or unstable between-beat placement.'
  },
  RC05: {
    id: 'RC05',
    name: 'Pattern Representation',
    operationalDefinition: 'Encode, remember and reproduce duration relationships accurately.',
    typicalFailure: 'Pattern changes across repetitions or when reading without notation.'
  },
  RC06: {
    id: 'RC06',
    name: 'Metrical Organisation',
    operationalDefinition: 'Organise rhythmic events by subdivision, beat, bar and phrase hierarchy.',
    typicalFailure: 'Syncopation or ties displace the underlying beat or bar structure disappears.'
  },
  RC07: {
    id: 'RC07',
    name: 'Temporal Adaptation',
    operationalDefinition: 'Adjust motor timing appropriately to tempo or phase changes.',
    typicalFailure: 'Slow, excessive or oscillatory unstable error correction.'
  },
  RC08: {
    id: 'RC08',
    name: 'Rhythmic Execution',
    operationalDefinition: 'Translate an understood rhythm into reliable instrumental motor actions.',
    typicalFailure: 'Clap or spoken rhythm is accurate, but instrumental performance fails.'
  },
  RC09: {
    id: 'RC09',
    name: 'Self-Monitoring and Correction',
    operationalDefinition: 'Notice timing errors and instability in real-time and recover without stopping.',
    typicalFailure: 'Timing errors persist, compound, or cause full restarts.'
  },
  RC10: {
    id: 'RC10',
    name: 'Expressive Timing Control',
    operationalDefinition: 'Differentiate intentional expressive timing from instability and reproduce timing profiles.',
    typicalFailure: 'Timing variation is inconsistent with stated musical intent.'
  }
};

// ── 2. Problem Signatures (Diagnostic Triggers) ──────────────────────────────
export const PROBLEM_SIGNATURES: ProblemSignature[] = [
  {
    id: 'PS-RUSH-01',
    label: 'Progressive Tempo Rushing',
    observation: 'Note onsets become progressively early across consecutive measures.',
    metric: 'drift_slope',
    direction: 'early',
    locationPattern: 'progressive',
    candidateCapacityIds: ['RC03', 'RC07', 'RC08']
  },
  {
    id: 'PS-DRAG-01',
    label: 'Progressive Tempo Dragging',
    observation: 'Note onsets become progressively late over time.',
    metric: 'drift_slope',
    direction: 'late',
    locationPattern: 'progressive',
    candidateCapacityIds: ['RC03', 'RC08']
  },
  {
    id: 'PS-SUBDIV-01',
    label: 'Uneven Short Subdivisions',
    observation: 'High onset timing variability concentrated on 16th notes and triplet figures.',
    metric: 'variability',
    direction: 'unstable',
    locationPattern: 'pattern_linked',
    candidateCapacityIds: ['RC04', 'RC08']
  },
  {
    id: 'PS-GAP-01',
    label: 'Drift After Click Removal',
    observation: 'Accuracy collapses or re-entry timing error surges when external metronome click is removed or muted.',
    metric: 'reentry_error',
    direction: 'unstable',
    locationPattern: 'boundary_linked',
    candidateCapacityIds: ['RC03', 'RC02']
  },
  {
    id: 'PS-SYNCOP-01',
    label: 'Beat Loss Across Syncopation / Ties',
    observation: 'Underlying pulse is lost or displaced by half a beat following syncopated accents or tied notes.',
    metric: 'error_rate',
    direction: 'displaced',
    locationPattern: 'pattern_linked',
    candidateCapacityIds: ['RC06', 'RC04']
  },
  {
    id: 'PS-EXEC-01',
    label: 'High Motor Instability at Fast Tempo',
    observation: 'Rhythm is stable at moderate tempo but timing variability spikes sharply near target tempo.',
    metric: 'variability',
    direction: 'unstable',
    locationPattern: 'global',
    candidateCapacityIds: ['RC08', 'RC07']
  }
];

// Family name normalizer
function mapFamily(f: string): StrategyFamily {
  const m: Record<string, StrategyFamily> = {
    'Representation': 'Representation',
    'Embodiment': 'Embodiment',
    'Subdivision': 'Subdivision',
    'Synchronisation': 'Synchronisation',
    'Internalisation': 'Internalisation',
    'Chunking': 'Chunking',
    'Metric reconstruction': 'Metric reconstruction',
    'Tempo calibration': 'Tempo calibration',
    'Adaptation and recovery': 'Adaptation and recovery',
    'Feedback and monitoring': 'Feedback and monitoring',
    'Reintegration and transfer': 'Reintegration and transfer',
    'Adaptation': 'Adaptation and recovery',
    'Recovery': 'Adaptation and recovery',
    'Feedback': 'Feedback and monitoring',
    'Transfer': 'Reintegration and transfer'
  };
  return m[f] || 'Representation';
}

// ── 3. Strategy Catalogue (Complete R01 - R32) ───────────────────────────────
export const STRATEGY_CATALOGUE: Record<string, StrategyRecord> = {
  R01: {
    strategyId: "R01",
    name: "Clap/Tap Written Rhythm",
    strategyFamily: mapFamily("Representation"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    
    mechanismClaim: "Removes instrumental and pitch biomechanics, forcing pure temporal pattern encoding and auditory-motor chunking through bodily percussion.",
    useWhen: ["Learner makes rhythmic syntax errors or cannot read the duration ratios correctly on their instrument."],
    avoidWhen: ["Learner can already clap the passage flawlessly away from the instrument."],
    procedureSteps: ["Isolate the passage.", "Tap/clap the rhythm against a steady pulse.", "Verify proportional accuracy before touching the instrument."],
    progressionRules: ["Spoken syllables + clap -> Clap alone -> Play on single pitch (R03) -> Full melody."],
    successCriterionTemplate: "95%+ rhythm accuracy across 3 consecutive trials away from the instrument.",
    transferTestTemplate: "Perform the passage on the instrument with clean durational syntax.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R02: {
    strategyId: "R02",
    name: "Speak/Count Rhythm",
    strategyFamily: mapFamily("Representation"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    
    mechanismClaim: "Vocal syllables (e.g. Kod\u00e1ly, French time-names, or metric numbers '1 e & a') recruit verbal working memory to clarify durational syntax and metric positioning.",
    useWhen: ["Learner is uncertain of note values, struggles with ties, or guesses durations during sight-reading."],
    avoidWhen: ["Learner suffers from vocal tension or speech motor impediments that distract from musical focus."],
    procedureSteps: ["Scan the rhythmic text.", "Speak rhythmic syllables out loud in strict time.", "Match vocal syllables with steady hand tapping."],
    progressionRules: ["Rhythmic syllables out loud -> Subvocalized internal counting -> Silent performance."],
    successCriterionTemplate: "Zero hesitation or syllable stutter across the full phrase at tempo.",
    transferTestTemplate: "Play the passage on instrument while maintaining clear inner vocalization.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R03: {
    strategyId: "R03",
    name: "Play Rhythm on One Pitch",
    strategyFamily: mapFamily("Representation"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    mechanismClaim: "Removing fingering, pitch intervals, register shifts, and embouchure adjustments isolates instrumental tone production and temporal coordination.",
    useWhen: ["Learner claps or speaks rhythm accurately, but rhythm breaks down completely when attempting the melodic score."],
    avoidWhen: ["Learner cannot identify the beat or clap the rhythm away from the instrument."],
    procedureSteps: ["Choose a comfortable single pitch in mid-register.", "Perform the written rhythm maintaining all articulation and dynamics.", "Progressively reintroduce melodic contour."],
    progressionRules: ["Single pitch -> 2-note pitch alternation -> Stepwise melodic contour -> Full melody with leaps."],
    successCriterionTemplate: "Timing variability on single pitch drops below 25ms.",
    transferTestTemplate: "Perform full melody with no increase in timing variability.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R04: {
    strategyId: "R04",
    name: "Tap Underlying Beat",
    strategyFamily: mapFamily("Embodiment"),
    primaryCapacityIds: ["RC02"] as RhythmicCapacityId[],
    
    mechanismClaim: "Assigns the primary isochronous beat to a physical somatic anchor (foot tap, thigh tap), anchoring motor planning in physical space.",
    useWhen: ["Learner loses track of the beat location during sustained notes, rests, or syncopated offbeats."],
    avoidWhen: ["Severe dual-motor interference where limb movement destabilizes finger or pedal coordination."],
    procedureSteps: ["Tap the beat with heel/toe.", "Verify steady isochronous pacing.", "Layer the performance on top."],
    progressionRules: ["Audible floor tap -> Silent shoe-internal toe tap -> Felt somatic pulse."],
    successCriterionTemplate: "Zero phase drift between foot tap and external metronome.",
    transferTestTemplate: "Play with unshakeable tempo without requiring an exaggerated physical motion.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R05: {
    strategyId: "R05",
    name: "Walk the Beat",
    strategyFamily: mapFamily("Embodiment"),
    primaryCapacityIds: ["RC02"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC06"] as RhythmicCapacityId[],
    mechanismClaim: "Dalcroze eurhythmics approach; stepping recruits large postural muscles and vestibular balance, grounding the metric pulse somatically.",
    useWhen: ["Learner understands meter intellectually but rushes through empty bars or collapses during sustained rests."],
    avoidWhen: ["Sedentary performance contexts or instruments requiring stationary posture."],
    procedureSteps: ["Walk in place or around the room at target BPM.", "Chant or clap the rhythm while stepping continuously.", "Internalize the physical momentum."],
    progressionRules: ["Walking + clapping -> Walking while playing portable instrument -> Seated performance."],
    successCriterionTemplate: "Continuous forward walking cadence with no stumbling across phrase boundaries.",
    transferTestTemplate: "Transfer rhythmic stability to normal seated/standing playing posture.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R06: {
    strategyId: "R06",
    name: "Beat + Spoken Rhythm",
    strategyFamily: mapFamily("Embodiment"),
    primaryCapacityIds: ["RC04"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC06"] as RhythmicCapacityId[],
    mechanismClaim: "Dual-stream somatic coordination: physical limb taps the steady ground beat while voice chants the surface rhythm, decoupling the pulse from the rhythmic surface.",
    useWhen: ["Surface rhythm pulls the underlying beat off-course; learner confuses surface notes with beat pulses."],
    avoidWhen: ["Learner cannot maintain an isochronous tap independently."],
    procedureSteps: ["Establish continuous steady hand or foot tapping.", "Chant surface rhythm over the tap without letting the tap fluctuate."],
    progressionRules: ["Tap beat + chant rhythm -> Tap beat + play instrument -> Play instrument with internal pulse."],
    successCriterionTemplate: "Zero tempo fluctuation in hand/foot tap across complex syncopations.",
    transferTestTemplate: "Clean separation of metric pulse and syncopated surface attacks in instrumental performance.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R07: {
    strategyId: "R07",
    name: "Explicit Subdivision",
    strategyFamily: mapFamily("Subdivision"),
    primaryCapacityIds: ["RC04"] as RhythmicCapacityId[],
    
    mechanismClaim: "Generating a smaller equal-unit grid (8ths/16ths) increases temporal resolution between beats, eliminating blind guesswork during long notes.",
    useWhen: ["Short values (16ths/triplets) are uneven, rushed, or compressed; dotted rhythms collapse into triplets."],
    avoidWhen: ["Learner cannot locate the primary beat; or tempo is so slow that subdividing causes analysis paralysis."],
    procedureSteps: ["Establish the primary beat.", "Activate audible subdivision grid (e.g. 16ths).", "Vocalize or tap the grid while executing attacks."],
    progressionRules: ["Audible smallest subdivision -> Learner-vocalized grid -> Silent internal grid -> Sparse beat click -> No click."],
    successCriterionTemplate: "Timing variability decreases by at least 40% when subdivision cue is removed.",
    transferTestTemplate: "Perform original unassisted passage at target tempo with even 16th/triplet spacing.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R08: {
    strategyId: "R08",
    name: "Fill Every Subdivision",
    strategyFamily: mapFamily("Subdivision"),
    primaryCapacityIds: ["RC04"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC06"] as RhythmicCapacityId[],
    mechanismClaim: "Physically plays or voices every micro-subdivision across long notes and rests, maintaining unbroken motor momentum.",
    useWhen: ["Learner rushes out of sustained notes or arrives prematurely on downbeats following rests."],
    avoidWhen: ["Advanced expressive passages requiring delicate agogic rubato."],
    procedureSteps: ["Turn all quarter/half notes into repeated 16th notes.", "Play every subdivision.", "Gradually tie the repeated notes back into sustained durations."],
    progressionRules: ["Sounding 16th notes -> Soft ghost-stroke 16ths -> Silent mental pulses inside sustained notes."],
    successCriterionTemplate: "Release timing of sustained notes matches ideal score duration within 20ms.",
    transferTestTemplate: "Sustain long notes to their exact acoustic boundary without rushing the next attack.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R09: {
    strategyId: "R09",
    name: "Audible to Silent Subdivision",
    strategyFamily: mapFamily("Subdivision"),
    primaryCapacityIds: ["RC03"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC04"] as RhythmicCapacityId[],
    mechanismClaim: "Systematically fades an audible subdivision click into a subvocalized mental grid, building autonomous internal temporal resolution.",
    useWhen: ["Learner plays evenly with a subdivision click but immediately becomes ragged when the click drops to quarter notes."],
    avoidWhen: ["Learner has not yet mastered playing in sync with an audible subdivision grid."],
    procedureSteps: ["Play 2 bars with audible subdivision ticks.", "Subdivision ticks mute for 2 bars while primary beat click remains.", "Check consistency."],
    progressionRules: ["Continuous subdivision ticks -> Alternating bars of ticks -> Beat click only -> Silent performance."],
    successCriterionTemplate: "Variability on 16th notes remains < 25ms during muted subdivision bars.",
    transferTestTemplate: "Flawless micro-timing resolution sustained purely through internal timekeeping.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R10: {
    strategyId: "R10",
    name: "Full Metronome Synchronisation",
    strategyFamily: mapFamily("Synchronisation"),
    primaryCapacityIds: ["RC02"] as RhythmicCapacityId[],
    
    mechanismClaim: "Continuous external acoustic reference provides predictive phase error correction feedback on every beat.",
    useWhen: ["Basic beat synchronisation is unstable; learner requires continuous external grounding."],
    avoidWhen: ["Advanced stages where continuous click creates an external dependency crutch."],
    procedureSteps: ["Set metronome to target BPM.", "Align physical attacks so the click sound is acoustically 'masked' (hidden) by your attack."],
    progressionRules: ["Loud click -> Soft click -> Sparse click (R11)."],
    successCriterionTemplate: "Mean asynchrony within +/- 20ms across 16 consecutive bars.",
    transferTestTemplate: "Predictive sensorimotor phase-locking established.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R11: {
    strategyId: "R11",
    name: "Sparse Metronome",
    strategyFamily: mapFamily("Internalisation"),
    primaryCapacityIds: ["RC03"] as RhythmicCapacityId[],
    
    mechanismClaim: "Reducing temporal anchor density forces internal striatal oscillator timekeeping mechanisms to span larger intervals.",
    useWhen: ["Learner tracks every beat accurately with a click, but rushes or drags when clicks stop."],
    avoidWhen: ["Learner cannot align reliably with a continuous 4-beat click."],
    procedureSteps: ["Start with standard 4-beat click.", "Switch metronome to beats 1 and 3 only.", "Reduce to downbeat only.", "Reduce to 1 click per 2 bars."],
    progressionRules: ["Clicks on 1,2,3,4 -> Clicks on 1,3 -> Click on 1 only -> 1 click per 2 bars."],
    successCriterionTemplate: "Drift slope remains < 0.05 across 4 consecutive bars with downbeat-only click.",
    transferTestTemplate: "Play 8 bars completely without click and re-enter within +/- 35ms of target tempo.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R12: {
    strategyId: "R12",
    name: "Gap-Click Practice",
    strategyFamily: mapFamily("Internalisation"),
    primaryCapacityIds: ["RC03"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC09"] as RhythmicCapacityId[],
    mechanismClaim: "Alternating reference clicks and silence tests and trains internal tempo maintenance over expanding intervals.",
    useWhen: ["Performance is stable with click but drifts immediately in silence; re-entry error exceeds 40ms."],
    avoidWhen: ["Beat cannot yet be located or basic synchronisation is unstable."],
    procedureSteps: ["Play 4 bars with click audible.", "Continue playing seamlessly during 2 bars of silence.", "Check alignment when click re-enters on bar."],
    progressionRules: ["4 bars click / 2 bars silent -> 2 bars click / 4 bars silent -> 1 bar click / 4 bars silent -> Random dropout."],
    successCriterionTemplate: "Re-entry offset error remains within +/- 30ms across 3 consecutive silent intervals.",
    transferTestTemplate: "Perform the entire passage with zero metronome support maintaining steady tempo throughout.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R13: {
    strategyId: "R13",
    name: "Synchronisation-Continuation",
    strategyFamily: mapFamily("Internalisation"),
    primaryCapacityIds: ["RC03"] as RhythmicCapacityId[],
    
    mechanismClaim: "Classical psychophysical paradigm: learner synchronises with metronome for N intervals, click ceases, and learner continues tapping indefinitely to evaluate unassisted tempo stability.",
    useWhen: ["Diagnosing and training pure endogenous pacemaker drift slope (m)."],
    avoidWhen: ["Complex multi-voice rhythmic reading tasks before basic continuation is secure."],
    procedureSteps: ["Provide 8 bars of click pacing.", "Click mutes permanently.", "Learner continues playing for 16-24 bars unassisted."],
    progressionRules: ["8 bars paced / 8 bars free -> 4 bars paced / 16 bars free -> Count-in only."],
    successCriterionTemplate: "Overall drift slope absolute value < 1.2 ms/note across 16 continuation bars.",
    transferTestTemplate: "Rock-solid internal tempo stability without external guidance.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R14: {
    strategyId: "R14",
    name: "Click on Selected Metric Positions",
    strategyFamily: mapFamily("Internalisation"),
    primaryCapacityIds: ["RC06"] as RhythmicCapacityId[],
    
    mechanismClaim: "Metronome click is placed exclusively on offbeats (e.g. beats 2 and 4 in swing/jazz, or the '&' of each beat), strengthening metric lattice orientation.",
    useWhen: ["Learner lacks groove feel, collapses on backbeats, or flips the downbeat."],
    avoidWhen: ["Beginner students who cannot yet track beat 1 reliably."],
    procedureSteps: ["Configure click on beats 2 &.", "Hear the silence on beat 1 as downbeat.", "Perform passage feeling the backbeat groove."],
    progressionRules: ["Beats 2 & 4 click -> Offbeat '&' clicks -> Upbeat-only 16th clicks."],
    successCriterionTemplate: "No accidental flipping of downbeat across 4 repetitions.",
    transferTestTemplate: "Deep, mature metric feel with clear downbeat identity.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R15: {
    strategyId: "R15",
    name: "Click Once Per Bar",
    strategyFamily: mapFamily("Internalisation"),
    primaryCapacityIds: ["RC03"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC06"] as RhythmicCapacityId[],
    mechanismClaim: "A single click sounds only on beat 1 of each measure, placing total responsibility for internal metric subdivision on the student while providing a barline anchor.",
    useWhen: ["Learner is ready to transition from beat-level tracking to measure-level phrase timekeeping."],
    avoidWhen: ["Fast tempo where bars pass too quickly, or very slow tempo exceeding working memory capacity (>4 seconds/bar)."],
    procedureSteps: ["Set metronome to trigger only on the measure downbeat.", "Internally subdivide beats 2, 3,.", "Land squarely on the downbeat click."],
    progressionRules: ["Click on Beat 1 -> Click on Beat 1 every 2 bars -> Click on Beat 1 every 4 bars."],
    successCriterionTemplate: "Downbeat landing accuracy within +/- 25ms over 8 consecutive bars.",
    transferTestTemplate: "Autonomous architectural phrase pacing.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R16: {
    strategyId: "R16",
    name: "Isolate Rhythmic Cell (Chunking)",
    strategyFamily: mapFamily("Chunking"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    
    mechanismClaim: "Isolating 1-2 beat rhythmic motifs reduces working-memory and motor coordination load, allowing motor chunking to stabilize.",
    useWhen: ["Errors occur consistently on specific complex figures within an otherwise stable passage."],
    avoidWhen: ["Errors are evenly distributed throughout the entire score."],
    procedureSteps: ["Isolate the troublesome 1-bar rhythmic motif.", "Loop the cell continuously with metronome.", "Reintegrate the cell back into phrase context."],
    progressionRules: ["Isolated cell loop -> Cell + 1 beat before/after -> Full measure -> Full phrase."],
    successCriterionTemplate: "Zero rhythm error rate on 5 consecutive cell repetitions.",
    transferTestTemplate: "Perform the full 4-bar phrase smoothly integrating the isolated cell.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R17: {
    strategyId: "R17",
    name: "Loop Short Rhythmic Cell",
    strategyFamily: mapFamily("Chunking"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    mechanismClaim: "Continuous uninterrupted repetition of an isolated motif automates neural motor pathways, transforming conscious counting into an automatic motor macro.",
    useWhen: ["Rhythmic cell is understood intellectually but executed with hesitation or inconsistent timing."],
    avoidWhen: ["Repeating a motor error without corrective feedback."],
    procedureSteps: ["Set up a 1-measure loop.", "Play 8-12 repetitions without stopping.", "Observe stabilization of timing jitter."],
    progressionRules: ["Loop with click -> Loop with sparse click -> Single pass in phrase context."],
    successCriterionTemplate: "Timing variability stabilizes below 20ms across 8 consecutive loops.",
    transferTestTemplate: "Effortless, reflexive execution of the figure in performance.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R18: {
    strategyId: "R18",
    name: "Rhythm Imitation / Echo",
    strategyFamily: mapFamily("Representation"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    
    mechanismClaim: "Teacher or software plays a rhythmic phrase, and student immediately echoes it by ear, training auditory perceptual memory without notation interference.",
    useWhen: ["Reading notation causes visual-cognitive overload; student cannot internalize rhythmic contour."],
    avoidWhen: ["Testing notation reading literacy specifically."],
    procedureSteps: ["Listen to 1-2 bar rhythmic call.", "Hold in auditory working memory.", "Echo back immediately in time."],
    progressionRules: ["Simple 1-bar echo -> 2-bar echo -> Echo with syncopation -> Call and response variation."],
    successCriterionTemplate: "Exact durational replication on first attempt.",
    transferTestTemplate: "Enhanced auditory imagery and rapid rhythmic internalization.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R19: {
    strategyId: "R19",
    name: "Notation-Only Reproduction",
    strategyFamily: mapFamily("Representation"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    
    mechanismClaim: "Student decodes rhythm purely from score without auditory demonstration, testing and training inner hearing (audiation) and syntactic decoding.",
    useWhen: ["Student is overly reliant on copying teacher audio and cannot read rhythms independently."],
    avoidWhen: ["Complete beginner who has not yet learned basic duration symbols."],
    procedureSteps: ["Study rhythm score silently without audio.", "Audiate the pulse and subdivisions mentally.", "Perform the passage 'cold' on the first take."],
    progressionRules: ["Single bar reading -> 4-bar sight-reading -> Sight-reading at target tempo."],
    successCriterionTemplate: "Correct rhythm on first reading without prior acoustic cueing.",
    transferTestTemplate: "Independent rhythmic literacy and fluent sight-reading autonomy.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R20: {
    strategyId: "R20",
    name: "Fill Missing Beat in Syncopation",
    strategyFamily: mapFamily("Metric reconstruction"),
    primaryCapacityIds: ["RC06"] as RhythmicCapacityId[],
    
    mechanismClaim: "Filling tied or rest-bound downbeats with physical or audible taps restores the metric hierarchy underneath syncopations.",
    useWhen: ["Learner displaces the downbeat or rushes syncopated offbeat figures."],
    avoidWhen: ["Straight rhythms with no syncopations or ties."],
    procedureSteps: ["Identify the tied or omitted downbeat.", "Play all ghost/subdivision notes loudly on the missed downbeat.", "Progressively soften filled notes."],
    progressionRules: ["Fully sounding filled notes -> Light ghost tap -> Silent internalised downbeat."],
    successCriterionTemplate: "Downbeat timing remains stable without physical ghost note.",
    transferTestTemplate: "Perform syncopated passage at target tempo with clean accent placement.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R21: {
    strategyId: "R21",
    name: "Remove Filled Beats Progressively",
    strategyFamily: mapFamily("Metric reconstruction"),
    primaryCapacityIds: ["RC06"] as RhythmicCapacityId[],
    
    mechanismClaim: "Gradually transitions from sounding ghost notes to light tactile touch, to subvocalized breath, to pure silent mental awareness.",
    useWhen: ["Student has stabilized syncopation with ghost notes and now needs to remove auditory ghosts for clean artistic performance."],
    avoidWhen: ["Downbeat stability has not yet been achieved with audible ghost notes."],
    procedureSteps: ["Step 1: Loud ghost note.", "Step 2: Whispered ghost tap.", "Step 3: Phantom air tap.", "Step 4: Pure mental awareness."],
    progressionRules: ["Sounding ghost -> Touch ghost -> Air ghost -> Silent audiation."],
    successCriterionTemplate: "Zero syncopation phase displacement with zero extraneous ghost sound.",
    transferTestTemplate: "Pristine artistic execution of syncopated literature.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R22: {
    strategyId: "R22",
    name: "Tempo Ladder Calibration",
    strategyFamily: mapFamily("Tempo calibration"),
    primaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    
    mechanismClaim: "Locates and systematically trains the tempo boundary where motor timing stability breaks down.",
    useWhen: ["Timing is clean at 80 BPM but degrades rapidly above 104 BPM."],
    avoidWhen: ["Learner cannot perform the rhythm accurately even at the slowest tempo."],
    procedureSteps: ["Start at a comfortable baseline tempo (e.g. 70 BPM).", "Increase tempo in small increments (+4 to +6 BPM) after 2 successful passes.", "Step back 1 rung when threshold is reached."],
    progressionRules: ["Baseline BPM -> +4 BPM per successful run -> Target BPM."],
    successCriterionTemplate: "Pass 3 consecutive runs at target tempo with < 25ms timing variability.",
    transferTestTemplate: "Perform cold run at target tempo following a 2-minute break.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R23: {
    strategyId: "R23",
    name: "Threshold Practice",
    strategyFamily: mapFamily("Tempo calibration"),
    primaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    
    mechanismClaim: "Identifies the exact critical velocity threshold where neuromuscular coordination fractures, training right on the boundary in brief, high-focus bursts.",
    useWhen: ["Learner has hit a speed wall and experiences muscular tension or breakdown at a specific BPM."],
    avoidWhen: ["Physical strain, tendon pain, or fatigue is observed."],
    procedureSteps: ["Determine failure tempo (e.g. 112 BPM).", "Train at 108 BPM for 3 reps.", "Perform 1 burst at 112 BPM.", "Immediately drop back to 96 BPM to release tension."],
    progressionRules: ["Sub-threshold mastery -> Short threshold burst -> Threshold consolidation -> Target tempo."],
    successCriterionTemplate: "Smooth, relaxed motor execution at previous breakdown threshold.",
    transferTestTemplate: "Target tempo unlocked with zero muscular excess tension.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R24: {
    strategyId: "R24",
    name: "Variable-Tempo Practice",
    strategyFamily: mapFamily("Tempo calibration"),
    primaryCapacityIds: ["RC05"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    mechanismClaim: "Practicing the same rhythm across widely varied tempos (slow, moderate, fast, slow) strengthens generalized motor programs and temporal elasticity.",
    useWhen: ["Rhythm becomes brittle or rigid; learner can only play at one exact rehearsal speed."],
    avoidWhen: ["Early acquisition stage where stable reference speed is still required."],
    procedureSteps: ["Play at 72 BPM.", "Immediately play at 108 BPM.", "Drop to 60 BPM (ultra-slow subdivision test).", "Return to target 92 BPM."],
    progressionRules: ["Fixed tempo -> Alternating tempos (+/- 20%) -> Random tempo trials."],
    successCriterionTemplate: "Rhythm ratios remain mathematically constant across all tempo changes.",
    transferTestTemplate: "Robust, adaptable rhythmic execution under any performance condition.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R25: {
    strategyId: "R25",
    name: "Gradual Tempo Modulation",
    strategyFamily: mapFamily("Adaptation and recovery"),
    primaryCapacityIds: ["RC07"] as RhythmicCapacityId[],
    
    mechanismClaim: "Metronome dynamically accelerates or decelerates (accelerando/ritardando), forcing predictive phase and period correction circuits to adapt dynamically.",
    useWhen: ["Student cannot follow conductor tempo changes or plays stiffly in ensemble contexts."],
    avoidWhen: ["Student cannot maintain a steady tempo when unmodulated."],
    procedureSteps: ["Start at 80 BPM.", "Software smoothly accelerates to 100 BPM across 8 bars.", "Student tracks tempo shift smoothly without jumping or lagging."],
    progressionRules: ["Predictable accelerando -> Predictable ritardando -> Sinusoidal tempo wave."],
    successCriterionTemplate: "Phase error remains < 30ms throughout dynamic tempo ramp.",
    transferTestTemplate: "Fluid responsive tempo adaptation in orchestral/chamber playing.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R26: {
    strategyId: "R26",
    name: "Unexpected Tempo Shift",
    strategyFamily: mapFamily("Adaptation and recovery"),
    primaryCapacityIds: ["RC07"] as RhythmicCapacityId[],
    
    mechanismClaim: "Software abruptly changes tempo by +/- 8-12 BPM mid-exercise; student must detect the shift and realign within 2-3 beats without stopping.",
    useWhen: ["Student is brittle; any ensemble tempo fluctuation causes total breakdown."],
    avoidWhen: ["Beginners who cannot hold basic synchronisation."],
    procedureSteps: ["Play steadily at 84 BPM.", "At random bar, metronome jumps to 96 BPM.", "Student realigns period and phase within 2 bars."],
    progressionRules: ["Shift announced 1 bar before -> Unannounced shift -> Multiple shifts per run."],
    successCriterionTemplate: "Recovery beats <= 3 following unexpected perturbation.",
    transferTestTemplate: "Resilient ensemble recovery during live performance fluctuations.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R27: {
    strategyId: "R27",
    name: "Perturbed-Beat Recovery",
    strategyFamily: mapFamily("Adaptation and recovery"),
    primaryCapacityIds: ["RC07"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC09"] as RhythmicCapacityId[],
    mechanismClaim: "A single click is deliberately displaced early or late by 60-100ms; trains rapid cerebellar phase correction and prevents compounding panic errors.",
    useWhen: ["A single stumble causes student to stop playing or completely lose the meter."],
    avoidWhen: ["Inability to identify when an error has occurred."],
    procedureSteps: ["Play with click.", "On an unannounced beat, click occurs 80ms early.", "Student absorbs the bump and recovers alignment immediately."],
    progressionRules: ["Single mild perturbation (+/- 50ms) -> Strong perturbation (+/- 100ms) -> Micro-stumble recovery."],
    successCriterionTemplate: "Timing re-stabilizes within 2 beats of perturbation without stopping.",
    transferTestTemplate: "Imperturbable stage confidence and recovery resilience.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R28: {
    strategyId: "R28",
    name: "Playback + Onset Comparison",
    strategyFamily: mapFamily("Feedback and monitoring"),
    primaryCapacityIds: ["RC09"] as RhythmicCapacityId[],
    
    mechanismClaim: "Multi-lane millisecond visualization showing student onsets plotted against ideal score positions; recalibrates subjective perception against objective physics.",
    useWhen: ["Student insists they are playing accurately when objective data shows significant early/late bias."],
    avoidWhen: ["Live playing distraction; should be used for post-performance analysis."],
    procedureSteps: ["Record performance with millisecond onset capture.", "Review visual timing lane showing early/late offset deviations.", "Replay with audio comparison against ideal metronome reference."],
    progressionRules: ["Post-performance visual review -> Live visual aid -> Blind retest."],
    successCriterionTemplate: "Self-estimated timing error correlates with measured offset within +/- 15ms.",
    transferTestTemplate: "Accurate subjective self-perception aligned with objective truth.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R29: {
    strategyId: "R29",
    name: "Record and Locate Rush / Drag",
    strategyFamily: mapFamily("Feedback and monitoring"),
    primaryCapacityIds: ["RC09"] as RhythmicCapacityId[],
    
    mechanismClaim: "Student listens back to their own audio recording with a visual cursor and marks where they believe they rushed; compared against algorithmic telemetry.",
    useWhen: ["Developing autonomous metacognitive evaluation and critical listening skills."],
    avoidWhen: ["Novices unable to distinguish early from late."],
    procedureSteps: ["Perform and record passage.", "Listen back without seeing telemetry.", "Mark bars where rushing occurred.", "Reveal telemetry to verify accuracy."],
    progressionRules: ["Teacher-guided listening -> Solo self-marking -> In-flight real-time self-correction."],
    successCriterionTemplate: "Student correctly identifies 80%+ of actual drift occurrences.",
    transferTestTemplate: "High-fidelity internal auditory monitoring loop.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R30: {
    strategyId: "R30",
    name: "Reintegrate Pitch and Technique",
    strategyFamily: mapFamily("Reintegration and transfer"),
    primaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    
    mechanismClaim: "Reintroduces instrumental technical variables in controlled stages to prevent cognitive dual-task overload.",
    useWhen: ["Rhythm is mastered on single pitch or clapping, but fails with full melody."],
    avoidWhen: ["Basic single-pitch rhythm is not yet rock solid."],
    procedureSteps: ["Master rhythm on 1 pitch.", "Add fingerings without sound (silent air-fingering).", "Perform full passage with pitch, articulation, and dynamics."],
    progressionRules: ["1 Pitch -> Silent fingerings + rhythm -> Half tempo full melody -> Target tempo."],
    successCriterionTemplate: "Timing variability on full melody matches single-pitch baseline within 10ms.",
    transferTestTemplate: "Complete performance in final musical context.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R31: {
    strategyId: "R31",
    name: "Click-Removal Test",
    strategyFamily: mapFamily("Reintegration and transfer"),
    primaryCapacityIds: ["RC03"] as RhythmicCapacityId[],
    secondaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    mechanismClaim: "Evaluates whether temporal control has been fully internalised without external scaffolding.",
    useWhen: ["Validating completion of an intervention sequence."],
    avoidWhen: ["Early stages of learning a new rhythmic concept."],
    procedureSteps: ["Provide 1 bar of metronome count-in.", "Cut all metronome clicks completely for the entire exercise.", "Evaluate drift slope, variability, and final bar offset."],
    progressionRules: ["Final verification stage (Assistance Level 0)."],
    successCriterionTemplate: "Drift slope < 0.04 and mean asynchrony < 35ms across entire unassisted run.",
    transferTestTemplate: "Graduate exercise to master status in practice session.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  },
  R32: {
    strategyId: "R32",
    name: "Target-Tempo Performance Test",
    strategyFamily: mapFamily("Reintegration and transfer"),
    primaryCapacityIds: ["RC08"] as RhythmicCapacityId[],
    
    mechanismClaim: "Full unassisted performance at concert tempo in full musical context, serving as the definitive mastery milestone.",
    useWhen: ["Final graduation of an exercise from active remediation to repertoire maintenance."],
    avoidWhen: ["Prior assistance levels (5 to 1) have not been cleared."],
    procedureSteps: ["Establish performance tempo count-in.", "Execute entire musical excerpt unassisted with full tone, dynamics, and expression.", "Measure overall retention."],
    progressionRules: ["Ultimate mastery milestone."],
    successCriterionTemplate: "Flawless score execution with zero tempo drift (< 1.0 ms/note) and expressive integrity.",
    transferTestTemplate: "Autonomous concert-ready performance.",
    evidenceSummary: 'Grounding in music cognition and motor learning principles.',
    evidenceStrength: 'direct',
    version: '1.0'
  }
};

// ── 4. Assistance Scale Configurations (Level 0 -> 5: 0 = Most Assistance, 5 = Retest) ──
export const ASSISTANCE_LEVELS: Record<AssistanceLevel, AssistanceConfig> = {
  0: {
    level: 0,
    temporalSupport: 'Maximum',
    description: 'Audible smallest subdivision grid (e.g. 16ths/8ths) with simplified single-pitch or reduced tempo.',
    subdivisionClicks: true
  },
  1: {
    level: 1,
    temporalSupport: 'High',
    description: 'Continuous click on every beat with vocalized/tapped subdivision support.',
    sparseClicksEveryNBeats: 1
  },
  2: {
    level: 2,
    temporalSupport: 'Moderate',
    description: 'Sparse metronome click every 2 beats (beats 1 and 3 in 4/4).',
    sparseClicksEveryNBeats: 2
  },
  3: {
    level: 3,
    temporalSupport: 'Low',
    description: '1 metronome click per bar on downbeat only, or 2 bars click / 2 bars silent gap.',
    gapClick: { playBars: 2, silentBars: 2 }
  },
  4: {
    level: 4,
    temporalSupport: 'Minimal',
    description: 'Occasional random click dropouts and intermittent reference clicks.',
    randomDropoutProb: 0.4
  },
  5: {
    level: 5,
    temporalSupport: 'None',
    description: 'Zero external clicks. Pure internal pulse and musical context (Transfer Test).'
  }
};

/**
 * Returns the exact tailored AssistanceConfig for any of the 32 strategies (R01-R32).
 */
export function getStrategyAssistanceConfig(strategyId: string, customLevel?: AssistanceLevel): AssistanceConfig {
  if (customLevel !== undefined) {
    const base = { ...ASSISTANCE_LEVELS[customLevel] };
    return applyStrategyOverrides(strategyId, base);
  }

  // Strategy-specific default scaffolds based on AIPC spec
  switch (strategyId) {
    case 'R01':
    case 'R02':
    case 'R04':
    case 'R05':
    case 'R06':
    case 'R10':
      return { ...ASSISTANCE_LEVELS[1] };
    case 'R03':
      return { ...ASSISTANCE_LEVELS[0], singlePitchNoteOnly: true };
    case 'R07':
    case 'R08':
      return { ...ASSISTANCE_LEVELS[0], subdivisionClicks: true };
    case 'R09':
      return { ...ASSISTANCE_LEVELS[1], subdivisionClicks: true, gapClick: { playBars: 2, silentBars: 2 } };
    case 'R11':
      return { ...ASSISTANCE_LEVELS[2], sparseClicksEveryNBeats: 2 };
    case 'R12':
      return { ...ASSISTANCE_LEVELS[3], gapClick: { playBars: 2, silentBars: 2 } };
    case 'R13':
      return { ...ASSISTANCE_LEVELS[3], continuationAfterBars: 2 };
    case 'R14':
      return { ...ASSISTANCE_LEVELS[2], selectedMetricPositions: [1, 3] }; // Beats 2 & 4 in 4/4
    case 'R15':
      return { ...ASSISTANCE_LEVELS[3], clicksOnlyOnDownbeat: true };
    case 'R16':
    case 'R17':
      return { ...ASSISTANCE_LEVELS[1], loopMeasureIndex: 0 };
    case 'R18':
      return { ...ASSISTANCE_LEVELS[0] };
    case 'R19':
    case 'R31':
    case 'R32':
      return { ...ASSISTANCE_LEVELS[5] };
    case 'R20':
      return { ...ASSISTANCE_LEVELS[0] };
    case 'R21':
      return { ...ASSISTANCE_LEVELS[2] };
    case 'R22':
    case 'R23':
    case 'R24':
      return { ...ASSISTANCE_LEVELS[1] };
    case 'R25':
      return { ...ASSISTANCE_LEVELS[2], tempoRamp: { startBpm: 80, endBpm: 104 } };
    case 'R26':
      return { ...ASSISTANCE_LEVELS[2] };
    case 'R27':
      return { ...ASSISTANCE_LEVELS[2], perturbedBeat: { measureIndex: 1, beatIndex: 2, offsetMs: -80 } };
    case 'R28':
    case 'R29':
    case 'R30':
      return { ...ASSISTANCE_LEVELS[2] };
    default:
      return { ...ASSISTANCE_LEVELS[1] };
  }
}

function applyStrategyOverrides(strategyId: string, config: AssistanceConfig): AssistanceConfig {
  if (strategyId === 'R03') config.singlePitchNoteOnly = true;
  if (strategyId === 'R07' || strategyId === 'R08') config.subdivisionClicks = true;
  if (strategyId === 'R12') config.gapClick = { playBars: 2, silentBars: 2 };
  if (strategyId === 'R13') config.continuationAfterBars = 2;
  if (strategyId === 'R14') config.selectedMetricPositions = [1, 3];
  if (strategyId === 'R15') config.clicksOnlyOnDownbeat = true;
  if (strategyId === 'R27') config.perturbedBeat = { measureIndex: 1, beatIndex: 2, offsetMs: -80 };
  return config;
}
