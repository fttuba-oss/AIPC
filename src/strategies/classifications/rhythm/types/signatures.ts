import { RhythmicCapacityId } from './capacities';
import { GenericProblemSignature } from '../../../core/types/strategy';

export type RhythmSignatureType =
  | 'progressive_rushing'
  | 'uneven_subdivision'
  | 'drift_after_click_removal'
  | 'beat_loss_syncopation_tie'
  | 'instrument_only_breakdown'
  | 'polyrhythmic_motor_assimilation'
  | 'cross_rhythm_attentional_capture'
  | 'polyrhythmic_shuffle_distortion'
  | 'hemiola_pulse_displacement'
  | 'additive_asymmetry_regularization';


export interface RhythmProblemSignature extends GenericProblemSignature {
  signatureType: RhythmSignatureType;
  metrics: {
    driftSlopeMsPerBeat?: number;
    timingVariabilityMs?: number;
    meanOffsetMs?: number;
    reentryErrorMs?: number;
    errorRate?: number;
  };
  candidateCapacityIds: RhythmicCapacityId[];
  locationDetails?: {
    measures: [number, number];
    tiedNoteLocations?: number[];
    transitionNotes?: string[];
  };
}
