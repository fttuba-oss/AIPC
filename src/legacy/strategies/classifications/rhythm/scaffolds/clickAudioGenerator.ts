import { RhythmAssistanceConfig } from '../types/rhythmStrategy';

export interface AudioClickEvent {
  timeInBeats: number;
  frequencyHz: number;
  gain: number;
  type: 'downbeat' | 'beat' | 'subdivision' | 'ghost_beat';
}

/**
 * ClickAudioGenerator produces deterministic click and audio schedules
 * for any RhythmAssistanceConfig and time signature.
 */
export class ClickAudioGenerator {
  /**
   * Generates a sequence of click events across a measure range.
   */
  public static generateSchedule(
    config: RhythmAssistanceConfig,
    totalMeasures: number,
    beatsPerMeasure: number = 4
  ): AudioClickEvent[] {
    const events: AudioClickEvent[] = [];

    // Check gap click mute intervals (e.g. 2 bars play, 2 bars silence)
    const playBars = config.gapClick?.playBars ?? Infinity;
    const silentBars = config.gapClick?.silentBars ?? 0;
    const cycleLengthBars = playBars + silentBars;

    for (let m = 0; m < totalMeasures; m++) {
      const barInCycle = m % cycleLengthBars;
      const isSilentBar = barInCycle >= playBars;

      // If random dropout active
      const isRandomDrop = config.randomDropoutProb && Math.random() < config.randomDropoutProb;

      if (isSilentBar || isRandomDrop) {
        continue; // Silence during dropout
      }

      for (let b = 0; b < beatsPerMeasure; b++) {
        const beatPosition = m * beatsPerMeasure + b;
        const isDownbeat = b === 0;

        // Check sparse clicks
        if (config.sparseClicksEveryNBeats && (beatPosition % config.sparseClicksEveryNBeats !== 0)) {
          continue;
        }

        // Add primary beat click
        events.push({
          timeInBeats: beatPosition,
          frequencyHz: isDownbeat ? 1200 : 800,
          gain: isDownbeat ? 1.0 : 0.7,
          type: isDownbeat ? 'downbeat' : 'beat',
        });

        // Add subdivision clicks if enabled (adapting dynamically to embedded triplets or beat ratios)
        if (config.subdivisionClicks) {
          const ratio = (config.beatSubdivisions && config.beatSubdivisions[beatPosition] !== undefined)
            ? config.beatSubdivisions[beatPosition]
            : (config.subdivisionRatio || 2);
          for (let sub = 1; sub < ratio; sub++) {
            events.push({
              timeInBeats: beatPosition + (sub / ratio),
              frequencyHz: ratio === 3 ? 2400 : 2200, // Crisp high tick for triplets
              gain: 0.5,
              type: 'subdivision',
            });
          }
        }

        // Add ghost beat clicks if enabled
        if (config.ghostNotesAudible) {
          events.push({
            timeInBeats: beatPosition + 0.5,
            frequencyHz: 450,
            gain: (config.ghostNotesGain ?? 0.5) * 0.4,
            type: 'ghost_beat',
          });
        }
      }
    }

    return events;
  }

  /**
   * Generates a deterministic bi-timbral polyrhythm audio schedule (e.g. 3:2, 4:3).
   */
  public static generatePolyrhythmSchedule(
    ratio: [number, number],
    totalCycles: number = 4,
    beatsPerCycle: number = 2,
    options?: {
      muteA?: boolean;
      muteB?: boolean;
      slotVolume?: number;
      coincidenceOnly?: boolean;
    }
  ): AudioClickEvent[] {
    const events: AudioClickEvent[] = [];
    const [m, n] = ratio;
    const totalSlots = m * n;
    const slotDurationBeats = beatsPerCycle / totalSlots;

    for (let c = 0; c < totalCycles; c++) {
      const cycleStartBeat = c * beatsPerCycle;

      // 1. Coincidence at start of cycle (Phase 0)
      events.push({
        timeInBeats: cycleStartBeat,
        frequencyHz: 1350,
        gain: 1.0,
        type: 'downbeat',
      });

      if (options?.coincidenceOnly) {
        continue;
      }

      // 2. Layer A attacks (m attacks per cycle)
      if (!options?.muteA) {
        for (let k = 1; k < m; k++) {
          const attackBeat = cycleStartBeat + (k * beatsPerCycle) / m;
          events.push({
            timeInBeats: attackBeat,
            frequencyHz: 1100, // High crisp woodblock timbre
            gain: 0.85,
            type: 'beat',
          });
        }
      }

      // 3. Layer B attacks (n attacks per cycle)
      if (!options?.muteB) {
        for (let j = 1; j < n; j++) {
          const attackBeat = cycleStartBeat + (j * beatsPerCycle) / n;
          events.push({
            timeInBeats: attackBeat,
            frequencyHz: 550, // Low resonant clave/cowbell timbre
            gain: 0.85,
            type: 'beat',
          });
        }
      }

      // 4. Intermediate LCM subdivision clicks (if slotVolume > 0)
      if (options?.slotVolume && options.slotVolume > 0) {
        for (let s = 0; s < totalSlots; s++) {
          const isAttackA = s % n === 0;
          const isAttackB = s % m === 0;
          if (!isAttackA && !isAttackB) {
            events.push({
              timeInBeats: cycleStartBeat + s * slotDurationBeats,
              frequencyHz: 2200,
              gain: options.slotVolume * 0.35,
              type: 'subdivision',
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Generates an asymmetric additive meter schedule (e.g. 3+2 in 5/8, 2+2+3 in 7/8).
   */
  public static generateAdditiveSchedule(
    groupingPattern: number[] = [3, 2],
    totalMeasures: number = 4,
    eighthNoteDurationBeats: number = 0.5,
    options?: {
      subdivisionTickVolume?: number;
      macroAccentVolume?: number;
    }
  ): AudioClickEvent[] {
    const events: AudioClickEvent[] = [];
    const totalEighthsInMeasure = groupingPattern.reduce((sum, g) => sum + g, 0);
    const measureDurationBeats = totalEighthsInMeasure * eighthNoteDurationBeats;

    const subVol = options?.subdivisionTickVolume ?? 1.0;
    const macroVol = options?.macroAccentVolume ?? 1.0;

    for (let m = 0; m < totalMeasures; m++) {
      const measureStartBeat = m * measureDurationBeats;

      let eighthOffset = 0;
      groupingPattern.forEach((groupLength, groupIndex) => {
        const groupStartBeat = measureStartBeat + eighthOffset * eighthNoteDurationBeats;
        const isMeasureDownbeat = groupIndex === 0;

        // Group boundary macro-accent
        events.push({
          timeInBeats: groupStartBeat,
          frequencyHz: isMeasureDownbeat ? 1400 : 950,
          gain: isMeasureDownbeat ? macroVol : macroVol * 0.75,
          type: isMeasureDownbeat ? 'downbeat' : 'beat',
        });

        // Inner eighth subdivisions within group
        if (subVol > 0) {
          for (let step = 1; step < groupLength; step++) {
            events.push({
              timeInBeats: groupStartBeat + step * eighthNoteDurationBeats,
              frequencyHz: 2000,
              gain: subVol * 0.4,
              type: 'subdivision',
            });
          }
        }

        eighthOffset += groupLength;
      });
    }

    return events;
  }
}

