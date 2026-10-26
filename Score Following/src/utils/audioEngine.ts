import * as Tone from 'tone';
import type { ScoreData } from './scoreParser';

/**
 * Loads a General MIDI Soundfont JS file from the Gleitz public CDN.
 */
function loadSoundfontScript(catalog: string, instrument: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const globalMidi = (window as any).MIDI;
    if (globalMidi?.Soundfont?.[instrument]) {
      resolve(globalMidi.Soundfont[instrument]);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://gleitz.github.io/midi-js-soundfonts/${catalog}/${instrument}-mp3.js`;
    script.async = true;
    script.onload = () => {
      const midiData = (window as any).MIDI?.Soundfont?.[instrument];
      if (midiData) {
        resolve(midiData);
      } else {
        reject(new Error(`Soundfont data for ${instrument} not found.`));
      }
    };
    script.onerror = () => {
      reject(new Error(`Failed to load soundfont: ${instrument} from ${catalog}`));
    };
    document.body.appendChild(script);
  });
}

export class AudioEngine {
  private samplers: Map<string, Tone.Sampler> = new Map(); // key is partId (unique per part)
  private instrumentData: Map<string, Record<string, string>> = new Map(); // key is `${soundfontCatalog}::${soundfontInstrument}` (shared data)
  private partVolumeNodes: Map<string, Tone.Volume> = new Map(); // partId -> VolumeNode
  private scheduledEvents: number[] = [];
  private metronomeSynth: Tone.PolySynth;
  private metronomeVolumeNode: Tone.Volume;
  private masterBackingVolumeNode: Tone.Volume;
  
  private soundfontCatalog: 'FluidR3_GM' | 'MusyngKite' = 'MusyngKite';
  private currentCountInDuration: number = 0;
  private isMetronomeMuted: boolean = false;
  private onTimeUpdateCallback: ((seconds: number) => void) | null = null;
  private onPlaybackEndCallback: (() => void) | null = null;

  private recorder: Tone.Recorder | null = null;
  private isRecording: boolean = false;

  constructor() {
    // Master volume controls
    this.masterBackingVolumeNode = new Tone.Volume(0).toDestination();
    this.metronomeVolumeNode = new Tone.Volume(0).toDestination();

    // Metronome Click synth using PolySynth to avoid monophonic overlaps
    this.metronomeSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.03,
      },
    }).connect(this.metronomeVolumeNode);

    // Initialize Tone.Recorder and connect volume outputs
    try {
      this.recorder = new Tone.Recorder();
      this.masterBackingVolumeNode.connect(this.recorder);
      this.metronomeVolumeNode.connect(this.recorder);
      console.log("[AudioEngine] Tone.Recorder initialized successfully.");
    } catch (e) {
      console.error("[AudioEngine] Failed to initialize Tone.Recorder", e);
    }
  }

  setSoundfontCatalog(catalog: 'FluidR3_GM' | 'MusyngKite') {
    this.soundfontCatalog = catalog;
  }

  getSoundfontCatalog(): 'FluidR3_GM' | 'MusyngKite' {
    return this.soundfontCatalog;
  }

  /**
   * Loads Soundfonts for all parts dynamically, creating a unique sampler for each part.
   */
  async loadInstruments(scoreData: ScoreData, onProgress: (progress: number) => void): Promise<void> {
    const instrumentsToLoad = Array.from(new Set(scoreData.parts.map(p => p.soundfontInstrument)));
    let loadedUniqueCount = 0;

    // Phase 1: Load base64 soundfont script data for all unique instruments
    await Promise.all(
      instrumentsToLoad.map(async (instName) => {
        const cacheKey = `${this.soundfontCatalog}::${instName}`;
        if (!this.instrumentData.has(cacheKey)) {
          try {
            // Delete window.MIDI.Soundfont[instName] before loading script
            // to prevent the loadSoundfontScript function from bypassing the script tag loading via window.MIDI cache
            const globalMidi = (window as any).MIDI;
            if (globalMidi?.Soundfont?.[instName]) {
              delete globalMidi.Soundfont[instName];
            }

            const midiData = await loadSoundfontScript(this.soundfontCatalog, instName);
            this.instrumentData.set(cacheKey, midiData);
          } catch (err) {
            console.error(`Error loading instrument data for ${instName} (${this.soundfontCatalog}), falling back to piano`, err);
            // Fallback load acoustic_grand_piano
            const fallbackKey = `${this.soundfontCatalog}::acoustic_grand_piano`;
            if (instName !== 'acoustic_grand_piano') {
              try {
                if (!this.instrumentData.has(fallbackKey)) {
                  const globalMidi = (window as any).MIDI;
                  if (globalMidi?.Soundfont?.['acoustic_grand_piano']) {
                    delete globalMidi.Soundfont['acoustic_grand_piano'];
                  }
                  const pianoData = await loadSoundfontScript(this.soundfontCatalog, 'acoustic_grand_piano');
                  this.instrumentData.set(fallbackKey, pianoData);
                }
                this.instrumentData.set(cacheKey, this.instrumentData.get(fallbackKey)!);
              } catch (pErr) {
                console.error("Critical: Fallback piano loading failed", pErr);
              }
            }
          }
        }
        loadedUniqueCount++;
        onProgress((loadedUniqueCount / instrumentsToLoad.length) * 0.5); // first 50% for data load
      })
    );

    // Phase 2: Create a separate sampler for each part using its instrument data
    // (This avoids channel cross-talk and hijacking issues when multiple parts share the same soundfont)
    this.samplers.forEach((s) => {
      try { s.dispose(); } catch (e) { console.error('Error disposing sampler:', e); }
    });
    this.samplers.clear();

    let loadedPartsCount = 0;
    await Promise.all(
      scoreData.parts.map(async (part) => {
        const cacheKey = `${this.soundfontCatalog}::${part.soundfontInstrument}`;
        const data = this.instrumentData.get(cacheKey);
        if (!data) {
          loadedPartsCount++;
          onProgress(0.5 + (loadedPartsCount / scoreData.parts.length) * 0.5);
          return;
        }

        try {
          const sampler = await new Promise<Tone.Sampler>((resolve) => {
            const s = new Tone.Sampler({
              urls: data,
              onload: () => resolve(s),
            });
          });
          this.samplers.set(part.id, sampler);
        } catch (err) {
          console.error(`Error creating sampler for part ${part.id} (${part.soundfontInstrument})`, err);
        }
        loadedPartsCount++;
        onProgress(0.5 + (loadedPartsCount / scoreData.parts.length) * 0.5); // remaining 50% for sampler setup
      })
    );
  }

  /**
   * Configures and schedules the score notes & metronome clicks in the Tone.js transport.
   */
  scheduleScore(scoreData: ScoreData, deduplicateUnisons: boolean = false, selectedPracticePartId: string = '', countInEnabled: boolean = true) {
    const currentSecs = Tone.Transport.seconds;
    this.cancelPlayback();

    // Set Transport clock baseline (60 BPM where 1 Transport Beat = 1 Absolute Second)
    Tone.Transport.bpm.value = 60;

    let countInDuration = 0;
    let countInClicks: MetronomeClick[] = [];
    let firstNoteBeat = 0;
    
    // firstNoteTime in seconds (used for click filtering in rests-count-in mode)
    let firstNoteTimeSeconds = 0;

    if (countInEnabled && scoreData.initialTimeSignature) {
      const numerator = scoreData.initialTimeSignature.numerator;
      const denominator = scoreData.initialTimeSignature.denominator;
      const initialBpm = scoreData.tempos[0]?.bpm ?? 120;
      const beatDuration = (4.0 / denominator) * (60.0 / initialBpm);
      
      // Find first note beat AND time of the practice part
      const practicePart = scoreData.parts.find(p => p.id === selectedPracticePartId);
      firstNoteBeat = practicePart && practicePart.notes.length > 0 ? practicePart.notes[0].beat : 0;
      firstNoteTimeSeconds = practicePart && practicePart.notes.length > 0 ? practicePart.notes[0].time : 0;
      
      console.log(`[AudioEngine] scheduleScore: selectedPracticePartId=${selectedPracticePartId}, firstNoteBeat=${firstNoteBeat}, firstNoteTimeSeconds=${firstNoteTimeSeconds}`);
      
      if (firstNoteBeat === 0 || firstNoteBeat >= numerator) {
        // Full negative bar count-in: add a full bar before the music starts
        countInDuration = numerator * beatDuration;
        for (let b = 0; b < numerator; b++) {
          countInClicks.push({
            time: b * beatDuration,
            isDownbeat: b === 0
          });
        }
      } else {
        // Countdown during rests in first measure (no time shift)
        countInDuration = 0;
        // Schedule clicks only for the rest beats BEFORE the practice part enters
        for (let b = 0; b < firstNoteBeat; b++) {
          countInClicks.push({
            time: b * beatDuration,
            isDownbeat: b === 0
          });
        }
      }
    }
    this.currentCountInDuration = countInDuration;

    interface NoteToSchedule {
      sampler: Tone.Sampler;
      noteName: string;
      playDuration: number;
      time: number;
      velocity: number;
      pitch: number;
      soundfontInstrument: string;
      partId: string;
    }

    const allNotes: NoteToSchedule[] = [];

    // Connect instruments to respective channel volumes and collect all notes
    scoreData.parts.forEach((part) => {
      const sampler = this.samplers.get(part.id);
      if (!sampler) return;

      // Create or locate a volume channel for this part
      let volNode = this.partVolumeNodes.get(part.id);
      if (!volNode) {
        volNode = new Tone.Volume(0).connect(this.masterBackingVolumeNode);
        this.partVolumeNodes.set(part.id, volNode);
      }
      
      // Disconnect from standard output and route through our channel volume
      sampler.disconnect();
      sampler.connect(volNode);

      // Collect notes
      part.notes.forEach((note) => {
        const noteName = Tone.Frequency(note.pitch, 'midi').toNote();
        
        // Shorten the play duration slightly (by 15ms) so there is a small gap before
        // the next contiguous note. This prevents Web Audio / Tone.js release envelope
        // commands from choking the attack of the next note starting at the same millisecond.
        const playDuration = Math.max(0.02, note.duration - 0.015);

        allNotes.push({
          sampler,
          noteName,
          playDuration,
          time: note.time,
          velocity: note.velocity ?? 0.75,
          pitch: note.pitch,
          soundfontInstrument: part.soundfontInstrument,
          partId: part.id
        });
      });
    });

    let notesToSchedule = allNotes;

    if (deduplicateUnisons) {
      // 1. Group notes by time (rounded to 3 decimal places / 1ms tolerance) and pitch
      const groups = new Map<string, NoteToSchedule[]>();
      allNotes.forEach((n) => {
        const timeKey = n.time.toFixed(3);
        const key = `${timeKey}_${n.pitch}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(n);
      });

      // Helper to prioritize instruments (Brass > Saxophones > Woodwinds > Percussion/Others)
      const getInstrumentPriority = (soundfontName: string): number => {
        const name = soundfontName.toLowerCase();
        // 1. Brass (Highest Priority: 4)
        if (
          name.includes('trumpet') ||
          name.includes('horn') ||
          name.includes('trombone') ||
          name.includes('tuba') ||
          name.includes('euphonium') ||
          name.includes('cornet') ||
          name.includes('mellophone')
        ) {
          return 4;
        }
        // 2. Saxophones (Medium Priority: 3)
        if (name.includes('sax')) {
          return 3;
        }
        // 3. Woodwinds (Lower Priority: 2)
        if (
          name.includes('flute') ||
          name.includes('piccolo') ||
          name.includes('oboe') ||
          name.includes('bassoon') ||
          name.includes('clarinet')
        ) {
          return 2;
        }
        // 4. Percussion / others (Lowest Priority: 1)
        return 1;
      };

      // 2. Select one note from each unison group based on priority, always preserving the practice part
      const distilled: NoteToSchedule[] = [];
      groups.forEach((groupNotes) => {
        if (groupNotes.length === 1) {
          distilled.push(groupNotes[0]);
        } else {
          // Separate the practice part note from the general backing notes
          const practiceNote = groupNotes.find(n => n.partId === selectedPracticePartId);
          const backingNotes = groupNotes.filter(n => n.partId !== selectedPracticePartId);

          if (backingNotes.length > 0) {
            // Sort backing notes by priority descending
            backingNotes.sort((a, b) => {
              const pA = getInstrumentPriority(a.soundfontInstrument);
              const pB = getInstrumentPriority(b.soundfontInstrument);
              if (pA !== pB) return pB - pA;
              // Break ties deterministically
              return a.partId.localeCompare(b.partId);
            });
            distilled.push(backingNotes[0]);
          }

          // ALWAYS keep the practice instrument note so it plays in Solo/practice mode
          if (practiceNote) {
            distilled.push(practiceNote);
          }
        }
      });

      notesToSchedule = distilled;
    }

    // Schedule all notes (in rests-count-in mode, skip notes before the practice part entry)
    const filteredNotes = notesToSchedule.filter((n) => {
      if (countInEnabled && countInDuration === 0 && firstNoteTimeSeconds > 0) {
        // Only schedule notes AT or AFTER the practice part's first note time
        return n.time >= firstNoteTimeSeconds - 0.01;
      }
      return true;
    });

    filteredNotes.forEach((n) => {
      const id = Tone.Transport.schedule((time) => {
        n.sampler.triggerAttackRelease(n.noteName, n.playDuration, time, n.velocity);
      }, n.time + countInDuration);
      this.scheduledEvents.push(id);
    });

    // Schedule count-in metronome clicks
    countInClicks.forEach((click) => {
      const id = Tone.Transport.schedule((time) => {
        if (!this.isMetronomeMuted) {
          const pitch = click.isDownbeat ? 'C6' : 'C5';
          this.metronomeSynth.triggerAttackRelease(pitch, '32n', time);
        }
      }, click.time);
      this.scheduledEvents.push(id);
    });

    // Schedule regular metronome clicks
    // In rests-count-in mode: skip clicks that occur BEFORE the practice part enters
    // (those beats are already covered by countInClicks above, and the entry beat click
    // should NOT be scheduled — the count-in ends, music starts, next click is beat 2 of the bar)
    const clicksToSchedule = scoreData.clicks.filter((click) => {
      if (countInEnabled && countInDuration === 0 && firstNoteTimeSeconds > 0) {
        // Only schedule clicks STRICTLY AFTER the entry beat (not on the entry beat itself,
        // since the count-in click already covers it)
        return click.time > firstNoteTimeSeconds + 0.01;
      }
      return true;
    });

    clicksToSchedule.forEach((click) => {
      const id = Tone.Transport.schedule((time) => {
        if (!this.isMetronomeMuted) {
          const pitch = click.isDownbeat ? 'C6' : 'C5';
          this.metronomeSynth.triggerAttackRelease(pitch, '32n', time);
        }
      }, click.time + countInDuration);
      this.scheduledEvents.push(id);
    });

    // Schedule regular playback ticker (runs every 40ms)
    const tickerId = Tone.Transport.scheduleRepeat(() => {
      const seconds = Tone.Transport.seconds;
      if (this.onTimeUpdateCallback) {
        setTimeout(() => this.onTimeUpdateCallback?.(seconds - this.currentCountInDuration), 0);
      }
      
      // Detect end of playback
      if (seconds >= scoreData.durationInSeconds + this.currentCountInDuration) {
        Tone.Transport.stop();
        if (this.onPlaybackEndCallback) {
          setTimeout(() => this.onPlaybackEndCallback?.(), 0);
        }
      }
    }, 0.04);
    this.scheduledEvents.push(tickerId);
    
    // Restore original transport position
    Tone.Transport.seconds = currentSecs;
  }

  /**
   * Play / Pause / Stop controls
   */
  async stopAndSaveRecording(label: string = 'audio_recording') {
    if (this.recorder && this.isRecording) {
      try {
        this.isRecording = false;
        const blob = await this.recorder.stop();
        console.log(`[AudioEngine] Recording stopped for ${label}, blob size: ${blob.size}`);
        
        // Send to local node receiver on port 3000
        const filename = `${label}_${Date.now()}.webm`;
        console.log(`[AudioEngine] Uploading recorded audio: ${filename}`);
        
        await fetch('http://localhost:3000', {
          method: 'POST',
          headers: {
            'x-filename': filename,
            'Content-Type': 'audio/webm'
          },
          body: blob
        });
        console.log("[AudioEngine] Audio upload completed successfully.");
      } catch (err) {
        console.error("[AudioEngine] Error stopping/saving/uploading recording:", err);
      }
    }
  }

  async start() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    
    if (this.recorder && !this.isRecording) {
      try {
        this.recorder.start();
        this.isRecording = true;
        console.log("[AudioEngine] Recording started.");
      } catch (err) {
        console.error("[AudioEngine] Error starting recorder:", err);
      }
    }
    
    Tone.Transport.start();
  }

  pause(label: string = 'practice_audio') {
    Tone.Transport.pause();
    this.stopAndSaveRecording(label);
  }

  stop(label: string = 'practice_audio') {
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(-this.currentCountInDuration);
    }
    this.stopAndSaveRecording(label);
  }

  seek(seconds: number) {
    Tone.Transport.seconds = Math.max(0, seconds + this.currentCountInDuration);
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(seconds);
    }
  }

  cancelPlayback() {
    this.scheduledEvents.forEach(id => Tone.Transport.clear(id));
    this.scheduledEvents = [];
    Tone.Transport.cancel();
    Tone.Transport.seconds = 0;
  }

  /**
   * Set global multiplier coefficient for tempo (e.g. 0.8x, 1.2x)
   */
  setSpeedMultiplier(multiplier: number) {
    // 60 BPM is baseline where 1 Transport unit = 1 second.
    Tone.Transport.bpm.value = 60 * multiplier;
  }

  /**
   * Set metronome volume & mute status
   */
  setMetronomeVolume(db: number) {
    this.metronomeVolumeNode.volume.value = db;
  }

  setMetronomeMuted(muted: boolean) {
    this.isMetronomeMuted = muted;
  }

  /**
   * Set global backing track volume
   */
  setBackingVolume(db: number) {
    this.masterBackingVolumeNode.volume.value = db;
  }

  /**
   * Toggle Minus-One muting for a specific part
   */
  setPartMuted(partId: string, muted: boolean) {
    const volNode = this.partVolumeNodes.get(partId);
    if (volNode) {
      volNode.volume.value = muted ? -Infinity : 0;
      console.log(`[AudioEngine] Set part volume: ${partId} -> muted: ${muted} (value: ${volNode.volume.value} dB)`);
    } else {
      console.warn(`[AudioEngine] setPartMuted: Volume node not found for part: ${partId}`);
    }
  }

  /**
   * Callback registration
   */
  setTimeUpdateCallback(cb: (seconds: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  setPlaybackEndCallback(cb: () => void) {
    this.onPlaybackEndCallback = cb;
  }

  get currentTime() {
    return Tone.Transport.seconds - this.currentCountInDuration;
  }
}
