/**
 * AIPC 10 Controlled Rhythmic Capacities (RC01 - RC10)
 */

export type RhythmicCapacityId =
  | 'RC01' // Beat perception
  | 'RC02' // Beat synchronisation
  | 'RC03' // Internal pulse
  | 'RC04' // Subdivision
  | 'RC05' // Pattern representation
  | 'RC06' // Metrical organisation
  | 'RC07' // Temporal adaptation
  | 'RC08' // Rhythmic execution
  | 'RC09' // Self-monitoring and correction
  | 'RC10' // Expressive timing control
  | 'RC11' // Dual-stream phase independence
  | 'RC12' // Metrical anchor stability under counter-periodicity
  | 'RC13'; // Asymmetric additive chunking

export interface RhythmicCapacityDefinition {
  id: RhythmicCapacityId;
  name: string;
  operationalDefinition: string;
  typicalFailure: string;
}

export const RHYTHMIC_CAPACITIES: Record<RhythmicCapacityId, RhythmicCapacityDefinition> = {
  RC01: {
    id: 'RC01',
    name: 'Beat Perception',
    operationalDefinition: 'Ability to detect, extract, and predict an underlying periodic pulse from acoustic stimuli.',
    typicalFailure: 'Unable to tap along with a steady pulse; inconsistent perceived tempo.',
  },
  RC02: {
    id: 'RC02',
    name: 'Beat Synchronisation',
    operationalDefinition: 'Sensorimotor ability to align motor actions with an external periodic pulse.',
    typicalFailure: 'Consistently lags or rushes ahead of the metronome click.',
  },
  RC03: {
    id: 'RC03',
    name: 'Internal Pulse',
    operationalDefinition: 'Endogenous timekeeping ability to sustain a steady tempo in the absence of an external pacer.',
    typicalFailure: 'Drifts significantly faster or slower during silent bars or solo playing.',
  },
  RC04: {
    id: 'RC04',
    name: 'Subdivision',
    operationalDefinition: 'Ability to mentally divide the beat interval into equal micro-intervals (eighths, triplets, sixteenths).',
    typicalFailure: 'Uneven spacing between short notes; rushing during complex rhythmic figures.',
  },
  RC05: {
    id: 'RC05',
    name: 'Pattern Representation',
    operationalDefinition: 'Cognitive encoding of rhythmic duration syntax and proportional durations.',
    typicalFailure: 'Playing incorrect rhythm values regardless of tempo; cannot imitate rhythmic motifs.',
  },
  RC06: {
    id: 'RC06',
    name: 'Metrical Organisation',
    operationalDefinition: 'Hierarchical metric structuring (downbeats, bar lines, strong vs. weak beat relationships).',
    typicalFailure: 'Loss of pulse across ties, rests, or syncopated off-beat figures.',
  },
  RC07: {
    id: 'RC07',
    name: 'Temporal Adaptation',
    operationalDefinition: 'Dynamic error correction when tempo changes or when ensemble partners shift phase.',
    typicalFailure: 'Unable to adjust to small tempo fluctuations or recover after a slight timing stumble.',
  },
  RC08: {
    id: 'RC08',
    name: 'Rhythmic Execution',
    operationalDefinition: 'Instrument-specific motor execution, coordination, and biomechanical agility.',
    typicalFailure: 'Rhythm is accurate when tapped or spoken, but breaks down when played on the instrument.',
  },
  RC09: {
    id: 'RC09',
    name: 'Self-Monitoring and Correction',
    operationalDefinition: 'Auditory feedback processing to detect and correct one\'s own timing errors in real time.',
    typicalFailure: 'Unaware of rushing/dragging; does not notice missed durations.',
  },
  RC10: {
    id: 'RC10',
    name: 'Expressive Timing Control',
    operationalDefinition: 'Deliberate micro-timing variations (rubato, swing, agogic accents) for artistic interpretation.',
    typicalFailure: 'Inflexible mechanical timing; uncontrolled involuntary tempo changes confused with expression.',
  },
  RC11: {
    id: 'RC11',
    name: 'Dual-Stream Phase Independence',
    operationalDefinition: 'Ability to sustain two competing rhythmic periodicities concurrently (bimanually or against accompaniment) without involuntary motor coupling or assimilation.',
    typicalFailure: 'Non-coincident attacks pull together; layers collapse into an uneven single-stream shuffle.',
  },
  RC12: {
    id: 'RC12',
    name: 'Metrical Anchor Stability',
    operationalDefinition: 'Ability to preserve cognitive and physical orientation to the primary reference beat and cycle start when strong cross-accents or syncopated timeline patterns enter.',
    typicalFailure: 'Attentional capture; reference beat is abandoned and locks onto the counter-rhythm.',
  },
  RC13: {
    id: 'RC13',
    name: 'Asymmetric Additive Chunking',
    operationalDefinition: 'Ability to internalize and execute irregular macro-beats (2+3, 3+2+2) with organic timing, resisting the tendency to regularize them into symmetrical subdivisions.',
    typicalFailure: 'Smooths asymmetrical beats into equal pulses or stumbles on the odd-length pulse.',
  },
};

