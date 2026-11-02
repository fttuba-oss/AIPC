import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

async function processor() {
  let Processor: any;
  class Synth {
    active = new Map<number, number>();
    levels = new Map<number, number>();
    static async waitForWasmInitialized() {}
    init() {} async loadSFont() { return 1; }
    setChannelType() {} midiProgramSelect() {} setGenerator() {}
    midiControl(channel: number, controller: number, value: number) { if (controller === 11) this.levels.set(channel, value); }
    midiNoteOn(channel: number, key: number) { this.active.set(channel, key); }
    midiNoteOff(channel: number) { this.active.delete(channel); }
    midiAllSoundsOff() { this.active.clear(); } close() { this.active.clear(); }
    render(channels: Float32Array[]) { for (const channel of channels) channel.fill([...this.active.keys()].reduce((sum, id) => sum + (this.levels.get(id) ?? 127) / 127, 0)); }
  }
  const context: any = {
    sampleRate: 48000, currentTime: 0,
    AudioWorkletProcessor: class { port = { onmessage: null, postMessage() {} }; },
    JSSynth: { Synthesizer: Synth },
    registerProcessor(_name: string, value: any) { Processor = value; },
  };
  vm.runInNewContext(fs.readFileSync(new URL('../public/audio/worklets/fluid-player.js', import.meta.url), 'utf8'), context);
  const instance = new Processor();
  await instance.port.onmessage({ data: { type: 'init', font: new ArrayBuffer(0) } });
  return { instance, context };
}
test('FluidSynth note onset and release split an audio block at the exact sample', async () => {
  const { instance } = await processor();
  await instance.port.onmessage({ data: { type: 'events', events: [
    { type: 'on', channel: 0, pitch: 60, velocity: 100, at: .001, order: 1 },
    { type: 'off', channel: 0, pitch: 60, at: .002, order: 0 },
  ] } });
  const left=new Float32Array(128),right=new Float32Array(128);
  instance.process([], [[left,right]]);
  assert.ok(left.slice(0,48).every(v=>v===0));
  assert.ok(left.slice(48,96).every(v=>v===1));
  assert.ok(left.slice(96).every(v=>v===0));
  assert.deepEqual(left,right);
});
test('stop clears queued notes and sounding voices so an old part cannot bleed into a seek', async () => {
  const { instance, context } = await processor();
  await instance.port.onmessage({ data: { type: 'events', events: [
    { type: 'on', channel: 0, pitch: 72, velocity: 100, at: 0, order: 1 },
    { type: 'on', channel: 1, pitch: 60, velocity: 100, at: .1, order: 1 },
  ] } });
  instance.process([], [[new Float32Array(128),new Float32Array(128)]]);
  await instance.port.onmessage({ data: { type: 'stop' } });context.currentTime=.1;
  const output=new Float32Array(128);instance.process([],[[output,new Float32Array(128)]]);
  assert.ok(output.every(v=>v===0));assert.equal(instance.queue.length,0);
});
test('a late event is played at the next block boundary rather than being lost', async () => {
  const { instance, context } = await processor();context.currentTime=1;
  await instance.port.onmessage({ data: { type: 'events', events: [
    { type: 'on', channel: 0, pitch: 60, velocity: 100, at: .99, order: 1 },
  ] } });
  const output=new Float32Array(128);instance.process([],[[output,new Float32Array(128)]]);
  assert.ok(output.every(v=>v===1));
});

test('expression controls are independent per channel and change a held note without reattacking', async () => {
  const { instance } = await processor();
  await instance.port.onmessage({ data: { type: 'events', events: [
    { type: 'gain', channel: 0, value: 32, at: 0, order: -1 },
    { type: 'gain', channel: 1, value: 96, at: 0, order: -1 },
    { type: 'on', channel: 0, pitch: 60, velocity: 100, at: 0, order: 1 },
    { type: 'on', channel: 1, pitch: 64, velocity: 100, at: 0, order: 1 },
    { type: 'gain', channel: 0, value: 64, at: .001, order: -1 },
  ] } });
  const output = new Float32Array(128);
  instance.process([], [[output, new Float32Array(128)]]);
  assert.ok(Math.abs(output[0] - 128 / 127) < 1e-6);
  assert.ok(Math.abs(output[48] - 160 / 127) < 1e-6);
  assert.equal(instance.synth.active.size, 2);
  assert.equal(instance.synth.levels.get(1), 96);
});
