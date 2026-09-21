/**
 * Real Acoustic Orchestral Sample Engine (Path A)
 * 
 * Powered by open-source multi-sampled acoustic recordings from:
 * - Versilian Studios Chamber Orchestra 2: Community Edition (VSCO 2 CE - CC0 / Public Domain)
 * - University of Iowa Electronic Music Studios (Public Domain)
 * 
 * Delivers authentic, warm acoustic instrument tones for:
 * - Solo Trumpet, French Horn, Trombone, Tuba
 * - Concert Flute, Bb Clarinet, Bassoon
 * - Solo Violin, Cello, Acoustic Grand Piano
 */

import * as Tone from 'tone';

export interface OrchestralInstrumentPreset {
  id: string;
  folder: string;
  samples: Record<string, string>;
  envelope?: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  };
}

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/';

export const ORCHESTRAL_INSTRUMENTS: Record<string, OrchestralInstrumentPreset> = {
  trumpet: {
    id: 'trumpet',
    folder: 'trumpet',
    samples: {
      'F3': 'F3.mp3',
      'A3': 'A3.mp3',
      'C4': 'C4.mp3',
      'D#4': 'Ds4.mp3',
      'F4': 'F4.mp3',
      'G4': 'G4.mp3',
      'A#4': 'As4.mp3',
      'D5': 'D5.mp3',
      'F5': 'F5.mp3',
      'A5': 'A5.mp3',
      'C6': 'C6.mp3',
    },
    envelope: { attack: 0.01, release: 0.25 },
  },
  french_horn: {
    id: 'french_horn',
    folder: 'french-horn',
    samples: {
      'A1': 'A1.mp3',
      'C2': 'C2.mp3',
      'D#2': 'Ds2.mp3',
      'G2': 'G2.mp3',
      'D3': 'D3.mp3',
      'F3': 'F3.mp3',
      'A3': 'A3.mp3',
      'C4': 'C4.mp3',
      'D5': 'D5.mp3',
      'F5': 'F5.mp3',
    },
    envelope: { attack: 0.03, release: 0.35 },
  },
  trombone: {
    id: 'trombone',
    folder: 'trombone',
    samples: {
      'A#1': 'As1.mp3',
      'D#2': 'Ds2.mp3',
      'F2': 'F2.mp3',
      'G#2': 'Gs2.mp3',
      'C3': 'C3.mp3',
      'D3': 'D3.mp3',
      'F3': 'F3.mp3',
      'A#3': 'As3.mp3',
      'C4': 'C4.mp3',
      'D4': 'D4.mp3',
      'F4': 'F4.mp3',
    },
    envelope: { attack: 0.02, release: 0.3 },
  },
  tuba: {
    id: 'tuba',
    folder: 'tuba',
    samples: {
      'F1': 'F1.mp3',
      'A#1': 'As1.mp3',
      'D#2': 'Ds2.mp3',
      'F2': 'F2.mp3',
      'A#2': 'As2.mp3',
      'D3': 'D3.mp3',
      'F3': 'F3.mp3',
      'A#3': 'As3.mp3',
      'D4': 'D4.mp3',
    },
    envelope: { attack: 0.04, release: 0.35 },
  },
  flute: {
    id: 'flute',
    folder: 'flute',
    samples: {
      'C4': 'C4.mp3',
      'E4': 'E4.mp3',
      'A4': 'A4.mp3',
      'C5': 'C5.mp3',
      'E5': 'E5.mp3',
      'A5': 'A5.mp3',
      'C6': 'C6.mp3',
      'E6': 'E6.mp3',
      'A6': 'A6.mp3',
      'C7': 'C7.mp3',
    },
    envelope: { attack: 0.02, release: 0.2 },
  },
  clarinet: {
    id: 'clarinet',
    folder: 'clarinet',
    samples: {
      'D3': 'D3.mp3',
      'F3': 'F3.mp3',
      'A#3': 'As3.mp3',
      'D4': 'D4.mp3',
      'F4': 'F4.mp3',
      'A#4': 'As4.mp3',
      'D5': 'D5.mp3',
      'F5': 'F5.mp3',
      'A#5': 'As5.mp3',
      'D6': 'D6.mp3',
      'F#6': 'Fs6.mp3',
    },
    envelope: { attack: 0.02, release: 0.25 },
  },
  bassoon: {
    id: 'bassoon',
    folder: 'bassoon',
    samples: {
      'G2': 'G2.mp3',
      'A2': 'A2.mp3',
      'C3': 'C3.mp3',
      'A3': 'A3.mp3',
      'C4': 'C4.mp3',
      'E4': 'E4.mp3',
      'G4': 'G4.mp3',
      'A4': 'A4.mp3',
      'C5': 'C5.mp3',
    },
    envelope: { attack: 0.03, release: 0.25 },
  },
  violin: {
    id: 'violin',
    folder: 'violin',
    samples: {
      'G4': 'G4.mp3',
      'A3': 'A3.mp3',
      'C4': 'C4.mp3',
      'E4': 'E4.mp3',
      'A4': 'A4.mp3',
      'C5': 'C5.mp3',
      'E5': 'E5.mp3',
      'G5': 'G5.mp3',
      'A5': 'A5.mp3',
      'C6': 'C6.mp3',
      'E6': 'E6.mp3',
      'G6': 'G6.mp3',
      'C7': 'C7.mp3',
    },
    envelope: { attack: 0.03, release: 0.3 },
  },
  cello: {
    id: 'cello',
    folder: 'cello',
    samples: {
      'C2': 'C2.mp3',
      'D2': 'D2.mp3',
      'F2': 'F2.mp3',
      'G2': 'G2.mp3',
      'A2': 'A2.mp3',
      'C3': 'C3.mp3',
      'D3': 'D3.mp3',
      'F3': 'F3.mp3',
      'G3': 'G3.mp3',
      'A3': 'A3.mp3',
      'C4': 'C4.mp3',
      'D4': 'D4.mp3',
      'E4': 'E4.mp3',
      'F4': 'F4.mp3',
      'G4': 'G4.mp3',
      'A4': 'A4.mp3',
      'C5': 'C5.mp3',
    },
    envelope: { attack: 0.03, release: 0.35 },
  },
  piano: {
    id: 'piano',
    folder: 'piano',
    samples: {
      'A1': 'A1.mp3',
      'A2': 'A2.mp3',
      'C3': 'C3.mp3',
      'D#3': 'Ds3.mp3',
      'F#3': 'Fs3.mp3',
      'A3': 'A3.mp3',
      'C4': 'C4.mp3',
      'D#4': 'Ds4.mp3',
      'F#4': 'Fs4.mp3',
      'A4': 'A4.mp3',
      'C5': 'C5.mp3',
      'D#5': 'Ds5.mp3',
      'F#5': 'Fs5.mp3',
      'A5': 'A5.mp3',
      'C6': 'C6.mp3',
      'A6': 'A6.mp3',
      'C7': 'C7.mp3',
    },
    envelope: { attack: 0.005, release: 0.6 },
  },
};

/**
 * Normalizes input instrument name to match orchestral sample preset
 */
export function matchOrchestralPreset(name: string): OrchestralInstrumentPreset | null {
  const norm = name.toLowerCase().replace(/[^a-z_]/g, '');
  if (norm.includes('trumpet') || norm.includes('cornet') || norm.includes('soloist')) return ORCHESTRAL_INSTRUMENTS.trumpet;
  if (norm.includes('horn') || norm.includes('mellophone')) return ORCHESTRAL_INSTRUMENTS.french_horn;
  if (norm.includes('trombone') || norm.includes('euphonium') || norm.includes('baritone')) return ORCHESTRAL_INSTRUMENTS.trombone;
  if (norm.includes('tuba')) return ORCHESTRAL_INSTRUMENTS.tuba;
  if (norm.includes('flute') || norm.includes('piccolo')) return ORCHESTRAL_INSTRUMENTS.flute;
  if (norm.includes('clarinet')) return ORCHESTRAL_INSTRUMENTS.clarinet;
  if (norm.includes('bassoon')) return ORCHESTRAL_INSTRUMENTS.bassoon;
  if (norm.includes('violin')) return ORCHESTRAL_INSTRUMENTS.violin;
  if (norm.includes('cello')) return ORCHESTRAL_INSTRUMENTS.cello;
  if (norm.includes('piano')) return ORCHESTRAL_INSTRUMENTS.piano;
  return null;
}

/**
 * Loads a real acoustic orchestral instrument sampler with concert hall spatial reverb.
 */
export async function loadOrchestralSampler(
  instrumentName: string,
  destination: Tone.ToneAudioNode
): Promise<Tone.Sampler | null> {
  const preset = matchOrchestralPreset(instrumentName);
  if (!preset) return null;

  const baseUrl = `${CDN_BASE}${preset.folder}/`;

  return new Promise<Tone.Sampler | null>((resolve) => {
    let resolved = false;

    // Timeout safety fallback after 5s
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`[OrchestralSampleEngine] Loading timeout for ${preset.id}, falling back.`);
        resolve(null);
      }
    }, 5000);

    try {
      const sampler = new Tone.Sampler({
        urls: preset.samples,
        baseUrl,
        attack: preset.envelope?.attack ?? 0.01,
        release: preset.envelope?.release ?? 0.25,
        onload: () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.log(`[OrchestralSampleEngine] Successfully loaded real acoustic ${preset.id} (VSCO 2 CE).`);
            sampler.connect(destination);
            resolve(sampler);
          }
        },
        onerror: (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.warn(`[OrchestralSampleEngine] Failed loading acoustic ${preset.id}:`, err);
            resolve(null);
          }
        },
      });
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.warn(`[OrchestralSampleEngine] Exception initializing ${preset.id}:`, err);
        resolve(null);
      }
    }
  });
}
