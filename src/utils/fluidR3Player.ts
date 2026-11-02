import * as Tone from 'tone';

export const FLUID_PROGRAMS: Record<string, number> = {
  flute: 73, piccolo: 72, oboe: 68, english_horn: 69, bassoon: 70, clarinet: 71,
  alto_sax: 65, tenor_sax: 66, baritone_sax: 67, soprano_sax: 64,
  trumpet: 56, french_horn: 60, trombone: 57, tuba: 58,
  timpani: 47, glockenspiel: 9, tubular_bells: 14, xylophone: 13, marimba: 12, vibraphone: 11,
  violin: 40, cello: 42, double_bass: 43, piano: 0,
};
export class FluidR3Player {
  private node?: AudioWorkletNode;
  private loading?: Promise<void>;
  private channels = new Map<string, number>();
  private context?: AudioContext;
  private lastError?: Error;
  private generation = 0;
  private abort?: AbortController;
  private cancelInitialization?: () => void;
  async prepare(parts: { id: string; instrument: string; drum?: boolean }[], destination: Tone.ToneAudioNode) {
    if (!this.loading) { const generation = this.generation; this.loading = this.initialize(destination).catch(error => { if (generation === this.generation) { this.loading = undefined; this.node?.disconnect(); this.node = undefined; } throw error; }); }
    await this.loading;
    if (this.lastError) throw this.lastError;
    for (const part of parts) {
      let channel = this.channels.get(part.id);
      if (channel === undefined) {
        channel = this.channels.size;
        if (channel >= 256) throw new Error('This score exceeds 256 independently mixed parts.');
        this.channels.set(part.id, channel);
      }
      this.node!.port.postMessage({ type: 'part', channel, program: FLUID_PROGRAMS[part.instrument] ?? 0, drum: part.drum });
    }
  }
  private async initialize(destination: Tone.ToneAudioNode) {
    const generation = this.generation;
    this.lastError = undefined;
    this.abort = new AbortController();
    const context = Tone.getContext().rawContext;
    if (!('audioWorklet' in context)) throw new Error('AudioWorklet is required. Use a current browser on localhost or HTTPS.');
    this.context = context as AudioContext;
    const base = `${import.meta.env.BASE_URL}audio/`;
    const response = await fetch(`${base}vendor/FluidR3_GM.sf2`, { signal: this.abort.signal });
    if (!response.ok) {
      throw new Error('FluidR3 is missing. Run npm run setup:audio and restart the development server.');
    }
    const font = await response.arrayBuffer();
    if (font.byteLength < 1000000 || new TextDecoder().decode(new Uint8Array(font, 0, 4)) !== 'RIFF') throw new Error('Invalid FluidR3 bank. Run npm run setup:audio.');
    if (generation !== this.generation) throw new Error('Audio loading cancelled');
    await context.audioWorklet.addModule(`${base}vendor/libfluidsynth.js`);
    await context.audioWorklet.addModule(`${base}vendor/js-synthesizer.worklet.js`);
    await context.audioWorklet.addModule(`${base}worklets/fluid-player.js`);
    if (generation !== this.generation) throw new Error('Audio loading cancelled');
    const node = Tone.getContext().createAudioWorkletNode('aipc-fluid-player', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    this.node = node; Tone.connect(node, destination);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('FluidR3 took too long to initialize. Please reload and retry.')), 60000);
      this.cancelInitialization = () => { clearTimeout(timer); reject(new Error('Audio loading cancelled')); };
      node.port.onmessage = ({ data }) => {
        if (data.type === 'ready') { clearTimeout(timer); this.cancelInitialization = undefined; resolve(); }
        else if (data.type === 'error') { clearTimeout(timer); this.lastError = new Error(data.message); reject(this.lastError); }
      };
      node.onprocessorerror = () => { clearTimeout(timer); this.lastError = new Error('The FluidSynth audio worklet failed. Reload the page.'); reject(this.lastError); };
      node.port.postMessage({ type: 'init', font }, [font]);
    });
  }
  play(id: string, pitch: number, velocity: number, at: number, duration: number) {
    const channel = this.channels.get(id); if (channel === undefined || !this.node) return;
    if (this.lastError) throw this.lastError;
    this.node.port.postMessage({ type: 'events', events: [
      { type: 'on', channel, pitch: Math.round(pitch), velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))), at, order: 1 },
      { type: 'off', channel, pitch: Math.round(pitch), at: at + duration, order: 0 },
    ] });
  }
  gain(id: string, value: number, at: number) {
    if (!this.node) return;
    for (const [key, channel] of this.channels) if (key === id || key === id + ':gm-drums') {
      this.node.port.postMessage({ type: 'events', events: [{ type: 'gain', channel, value: Math.round(Math.max(0, Math.min(1.25, value)) / 1.25 * 127), at, order: -1 }] });
    }
  }
  stop() { this.node?.port.postMessage({ type: 'stop' }); }
  dispose() {
    this.generation++; this.abort?.abort(); this.cancelInitialization?.(); this.cancelInitialization = undefined;
    this.node?.port.postMessage({ type: 'close' }); this.node?.disconnect(); this.node = undefined;
    this.loading = undefined; this.channels.clear(); this.lastError = undefined;
  }
}
