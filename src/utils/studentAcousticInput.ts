/**
 * Acoustic Onset Detection & Microphone Level Engine
 * Uses Web Audio API with notch filtering to ignore metronome clicks
 * and provide live "I hear you!" metering to the student.
 */

export type OnsetTriggerHandler = (timeSeconds: number, energy: number) => void;
export type MeterLevelHandler = (levelNormalized: number) => void;

export class StudentAcousticInput {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  private isRunning: boolean = false;
  private prevEnergy: number = 0;
  private lastTriggerTime: number = 0;
  private sensitivity: number = 65; // 1 - 100

  private onOnsetCallback: OnsetTriggerHandler | null = null;
  private onMeterCallback: MeterLevelHandler | null = null;

  setCallbacks(onOnset: OnsetTriggerHandler, onMeter: MeterLevelHandler) {
    this.onOnsetCallback = onOnset;
    this.onMeterCallback = onMeter;
  }

  setSensitivity(val: number) {
    this.sensitivity = Math.max(1, Math.min(100, val));
  }

  async start(): Promise<boolean> {
    if (this.isRunning) {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (e) {
          // ignore
        }
      }
      return true;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Metronome Notch Filters (C6 ~ 1046Hz, G5 ~ 784Hz)
      const notch1 = this.audioContext.createBiquadFilter();
      notch1.type = 'notch';
      notch1.frequency.value = 1046.5;
      notch1.Q.value = 12.0;

      const notch2 = this.audioContext.createBiquadFilter();
      notch2.type = 'notch';
      notch2.frequency.value = 784.0;
      notch2.Q.value = 12.0;

      // Bandpass filter to isolate instrument range (150Hz - 3500Hz)
      const highpass = this.audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 180;

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;

      source.connect(notch1);
      notch1.connect(notch2);
      notch2.connect(highpass);
      highpass.connect(this.analyser);

      this.isRunning = true;
      this.loopAnalysis();
      return true;
    } catch (e) {
      console.warn('Acoustic input microphone access unavailable or denied', e);
      return false;
    }
  }

  private loopAnalysis = () => {
    if (!this.isRunning || !this.analyser) return;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    // Calculate RMS energy
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);

    // UI Meter Level (0.0 to 1.0)
    const normalizedLevel = Math.min(1.0, rms * 8.0);
    if (this.onMeterCallback) {
      this.onMeterCallback(normalizedLevel);
    }

    // Onset detection
    const delta = Math.max(0, rms - this.prevEnergy);
    this.prevEnergy = rms * 0.85 + this.prevEnergy * 0.15;

    // Threshold determined by sensitivity (slider 1-100)
    const threshold = Math.max(0.015, (100 - this.sensitivity) * 0.001);
    const now = (this.audioContext?.currentTime || Date.now() / 1000);

    if (delta > threshold && rms > 0.02 && (now - this.lastTriggerTime) > 0.09) {
      this.lastTriggerTime = now;
      if (this.onOnsetCallback) {
        this.onOnsetCallback(now, rms);
      }
    }

    this.animFrameId = requestAnimationFrame(this.loopAnalysis);
  };

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isRunning = false;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}
