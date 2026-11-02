/* FluidSynth runs on the audio thread. Events use the same AudioContext clock as Tone/tracker. */
class AipcFluidPlayer extends AudioWorkletProcessor {
  constructor() {
    super(); this.queue = []; this.index = 0; this.synth = null;
    this.port.onmessage = async ({ data }) => {
      try {
        if (data.type === 'init') {
          await globalThis.JSSynth.Synthesizer.waitForWasmInitialized();
          this.synth = new globalThis.JSSynth.Synthesizer();
          this.synth.init(sampleRate, { midiChannelCount: 256, polyphony: 512, initialGain: 0.35, reverbActive: false, chorusActive: false });
          this.font = await this.synth.loadSFont(data.font);
          this.port.postMessage({ type: 'ready' });
        } else if (data.type === 'part') {
          this.synth.setChannelType(data.channel, !!data.drum);
          this.synth.midiProgramSelect(data.channel, this.font, data.drum ? 128 : 0, data.program);
          this.synth.midiControl(data.channel, 7, 127);
          this.synth.midiControl(data.channel, 1, 0);
          this.synth.setGenerator(data.channel, 13, data.program === 73 && !data.drum ? -4 : 0);
        } else if (data.type === 'stop') {
          this.queue = []; this.index = 0;
          this.synth?.midiAllSoundsOff();
        } else if (data.type === 'events') {
          this.queue = this.queue.slice(this.index).concat(data.events).sort((a, b) => a.at - b.at || a.order - b.order);
          this.index = 0;
        } else if (data.type === 'close') { this.synth?.close(); this.synth = null; }
      } catch (error) { this.port.postMessage({ type: 'error', message: String(error) }); }
    };
  }
  apply(event) {
    if (event.type === 'on') this.synth.midiNoteOn(event.channel, event.pitch, event.velocity);
    else if (event.type === 'off') this.synth.midiNoteOff(event.channel, event.pitch);
    else if (event.type === 'gain') this.synth.midiControl(event.channel, 11, event.value);
  }
  process(_inputs, outputs) {
    if (!this.synth) return true;
    const out = outputs[0]; const length = out[0].length;
    let offset = 0;
    while (offset < length) {
      const next = this.queue[this.index];
      const frame = next ? Math.max(0, Math.min(length, Math.round((next.at - currentTime) * sampleRate))) : length;
      if (frame > offset) { this.synth.render(out.map(channel => channel.subarray(offset, frame))); offset = frame; }
      if (next && frame < length) { this.apply(next); this.index++; }
      else break;
    }
    if (this.index > 2048) { this.queue = this.queue.slice(this.index); this.index = 0; }
    return true;
  }
}
registerProcessor('aipc-fluid-player', AipcFluidPlayer);
