// Audio Input Manager & Real-Time Acoustic Onset Detection Engine
// Uses Web Audio API + AudioWorklet (with Analyser fallback) for sub-frame latency detection of claps, taps, and instrument notes.

export interface AudioInputConfig {
  sensitivity: number; // 1 to 100 (default: 50)
  noiseGate: number; // 0.0 to 0.2 (default: 0.02)
  enableNotchFilter: boolean; // Filters 1000Hz & 1400Hz metronome beeps
  holdoffMs: number; // Lockout window after trigger in ms (default: 85ms)
}

export type OnsetCallback = (audioTime: number, energy: number) => void;
export type VolumeCallback = (level: number) => void;

// Worklet code as an inline Blob string for zero-build-step universal compatibility
const ONSET_WORKLET_CODE = `
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.prevEnergy = 0;
    this.noiseFloor = 0.005;
    this.lastTriggerTime = 0;
    this.sensitivity = 50;
    this.noiseGate = 0.02;
    this.holdoffSec = 0.085;
    this.decayRate = 0.92;
    this.meterDecay = 0.85;
    this.currentLevel = 0;

    this.port.onmessage = (e) => {
      if (e.data.sensitivity !== undefined) this.sensitivity = e.data.sensitivity;
      if (e.data.noiseGate !== undefined) this.noiseGate = e.data.noiseGate;
      if (e.data.holdoffMs !== undefined) this.holdoffSec = e.data.holdoffMs / 1000;
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0];
    const len = channelData.length;

    // 1. Calculate RMS energy of current block (128 samples)
    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      const s = channelData[i];
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / len);

    // Track level for UI metering
    this.currentLevel = Math.max(rms, this.currentLevel * this.meterDecay);

    // 2. Adaptive noise floor tracking (slow upward, fast downward)
    if (rms > this.noiseFloor) {
      this.noiseFloor = this.noiseFloor * 0.999 + rms * 0.001;
    } else {
      this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02;
    }
    this.noiseFloor = Math.max(0.001, Math.min(0.08, this.noiseFloor));

    // 3. Transient Energy Derivative (Delta Energy)
    const deltaEnergy = Math.max(0, rms - this.prevEnergy);
    this.prevEnergy = rms * this.decayRate + this.prevEnergy * (1 - this.decayRate);

    // 4. Dynamic Threshold Calculation
    // Sensitivity: 1 (least sensitive, requires high delta) to 100 (most sensitive)
    const sensFactor = Math.max(0.05, (105 - this.sensitivity) / 25);
    const threshold = Math.max(this.noiseGate, this.noiseFloor * 2.5 + sensFactor * 0.035);

    const now = currentTime;

    // 5. Onset Trigger Check with Holdoff
    if (deltaEnergy > threshold && rms > this.noiseGate && (now - this.lastTriggerTime) > this.holdoffSec) {
      this.lastTriggerTime = now;
      this.port.postMessage({
        type: 'ONSET',
        time: now,
        energy: rms,
        delta: deltaEnergy
      });
    }

    // Periodic meter report (throttled)
    if (Math.random() < 0.2) {
      this.port.postMessage({
        type: 'METER',
        level: this.currentLevel
      });
    }

    return true;
  }
}

registerProcessor('onset-processor', OnsetProcessor);
`;

export class AudioInputManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private notchFilter1: BiquadFilterNode | null = null;
  private notchFilter2: BiquadFilterNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private onOnsetCallbacks: Set<OnsetCallback> = new Set();
  private onVolumeCallbacks: Set<VolumeCallback> = new Set();

  private config: AudioInputConfig = {
    sensitivity: 65,
    noiseGate: 0.015,
    enableNotchFilter: true,
    holdoffMs: 85
  };

  private isListeningActive = false;
  private meterAnimFrame: number | null = null;

  public isListening(): boolean {
    return this.isListeningActive;
  }

  public getConfig(): AudioInputConfig {
    return { ...this.config };
  }

  public setSensitivity(sensitivity: number) {
    this.config.sensitivity = Math.max(1, Math.min(100, sensitivity));
    this.updateWorkletConfig();
  }

  public setNoiseGate(noiseGate: number) {
    this.config.noiseGate = Math.max(0.001, Math.min(0.2, noiseGate));
    this.updateWorkletConfig();
  }

  public setHoldoffMs(ms: number) {
    this.config.holdoffMs = Math.max(40, Math.min(250, ms));
    this.updateWorkletConfig();
  }

  public setNotchFilter(enabled: boolean) {
    this.config.enableNotchFilter = enabled;
    if (this.notchFilter1 && this.notchFilter2) {
      this.notchFilter1.gain.value = enabled ? -40 : 0;
      this.notchFilter2.gain.value = enabled ? -40 : 0;
    }
  }

  public addOnsetListener(cb: OnsetCallback) {
    this.onOnsetCallbacks.add(cb);
    return () => this.onOnsetCallbacks.delete(cb);
  }

  public addVolumeListener(cb: VolumeCallback) {
    this.onVolumeCallbacks.add(cb);
    return () => this.onVolumeCallbacks.delete(cb);
  }

  private updateWorkletConfig() {
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        sensitivity: this.config.sensitivity,
        noiseGate: this.config.noiseGate,
        holdoffMs: this.config.holdoffMs
      });
    }
  }

  public async start(): Promise<boolean> {
    if (this.isListeningActive) return true;

    try {
      // 1. Request microphone stream with pro-audio constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // Critical: don't let browser crush fast clapping/percussive attacks
          autoGainControl: false   // Critical: don't let browser pump volume
        }
      });

      // 2. Initialize AudioContext
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtxClass({ latencyHint: 'interactive' });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 3. Create audio source
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 4. Highpass filter (>80Hz) to remove desk thuds, AC rumble
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 80;
      this.highpassFilter.Q.value = 0.7;

      // 5. Notch filters for 1400Hz and 1000Hz metronome beeps (prevents speaker bleed triggers)
      this.notchFilter1 = this.audioContext.createBiquadFilter();
      this.notchFilter1.type = 'notch';
      this.notchFilter1.frequency.value = 1400;
      this.notchFilter1.Q.value = 8.0;

      this.notchFilter2 = this.audioContext.createBiquadFilter();
      this.notchFilter2.type = 'notch';
      this.notchFilter2.frequency.value = 1000;
      this.notchFilter2.Q.value = 8.0;

      // 6. AnalyserNode for visualizer
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;

      // Connect DSP chain
      let lastNode: AudioNode = this.sourceNode;
      lastNode.connect(this.highpassFilter);
      lastNode = this.highpassFilter;

      if (this.config.enableNotchFilter) {
        lastNode.connect(this.notchFilter1);
        this.notchFilter1.connect(this.notchFilter2);
        lastNode = this.notchFilter2;
      }

      lastNode.connect(this.analyserNode);

      // 7. Load & attach AudioWorklet
      try {
        const blob = new Blob([ONSET_WORKLET_CODE], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        this.workletNode = new AudioWorkletNode(this.audioContext, 'onset-processor');
        this.workletNode.port.onmessage = (event) => {
          const { type, time, energy, level } = event.data;
          if (type === 'ONSET') {
            this.notifyOnset(time, energy);
          } else if (type === 'METER') {
            this.notifyVolume(level);
          }
        };

        lastNode.connect(this.workletNode);
        this.updateWorkletConfig();
      } catch (workletErr) {
        console.warn('[AudioInputManager] AudioWorklet init failed, using Analyser fallback:', workletErr);
        this.startAnalyserFallback();
      }

      this.startMeterLoop();
      this.isListeningActive = true;
      return true;
    } catch (err) {
      console.error('[AudioInputManager] Failed to start microphone audio input:', err);
      this.stop();
      throw err;
    }
  }

  // Fallback if AudioWorklet is blocked
  private startAnalyserFallback() {
    if (!this.analyserNode || !this.audioContext) return;
    const buffer = new Float32Array(this.analyserNode.fftSize);
    let prevEnergy = 0;
    let lastTrigger = 0;

    const tick = () => {
      if (!this.isListeningActive || !this.analyserNode || !this.audioContext) return;
      this.analyserNode.getFloatTimeDomainData(buffer);

      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sum / buffer.length);
      const delta = Math.max(0, rms - prevEnergy);
      prevEnergy = rms * 0.9 + prevEnergy * 0.1;

      const sensFactor = Math.max(0.05, (105 - this.config.sensitivity) / 25);
      const threshold = Math.max(this.config.noiseGate, sensFactor * 0.04);
      const now = this.audioContext.currentTime;

      if (delta > threshold && rms > this.config.noiseGate && (now - lastTrigger) > (this.config.holdoffMs / 1000)) {
        lastTrigger = now;
        this.notifyOnset(now, rms);
      }

      this.notifyVolume(rms);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private startMeterLoop() {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const updateMeter = () => {
      if (!this.isListeningActive || !this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalizedLevel = Math.min(1.0, avg / 128);

      this.notifyVolume(normalizedLevel);
      this.meterAnimFrame = requestAnimationFrame(updateMeter);
    };

    this.meterAnimFrame = requestAnimationFrame(updateMeter);
  }

  private notifyOnset(time: number, energy: number) {
    this.onOnsetCallbacks.forEach(cb => {
      try {
        cb(time, energy);
      } catch (e) {
        console.error('[AudioInputManager] Error in onset callback:', e);
      }
    });
  }

  private notifyVolume(level: number) {
    this.onVolumeCallbacks.forEach(cb => {
      try {
        cb(level);
      } catch (e) {
        // Suppress meter callback error
      }
    });
  }

  public stop() {
    this.isListeningActive = false;

    if (this.meterAnimFrame !== null) {
      cancelAnimationFrame(this.meterAnimFrame);
      this.meterAnimFrame = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.highpassFilter) {
      this.highpassFilter.disconnect();
      this.highpassFilter = null;
    }

    if (this.notchFilter1) {
      this.notchFilter1.disconnect();
      this.notchFilter1 = null;
    }

    if (this.notchFilter2) {
      this.notchFilter2.disconnect();
      this.notchFilter2 = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.notifyVolume(0);
  }
}

// Global Singleton Instance for shared component access
export const globalAudioInput = new AudioInputManager();
