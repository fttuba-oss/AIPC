import { REFERENCE_DYNAMIC } from './scoreDynamics';
import * as Tone from 'tone';
import assets from '../../audio-assets.json';
import type { NoteEvent } from './scorePlaybackParser';
import { percussionFamily } from './percussionPlayback';

type Family = keyof typeof assets.vsco.families;
const families = assets.vsco.families as Record<Family, { velocity: number; files: string[] }[]>;
export function sampleFamily(note: NoteEvent): Family | undefined {
  if (note.percussion === undefined) return;
  const family = percussionFamily(note.percussion, note.percussionName);
  if (family === 'side-stick') return; // Use FluidR3's actual GM side-stick, not a mislabeled snare tap.
  if (note.percussionRoll && family === 'snare') return 'snare-roll';
  if (note.percussionRoll && family === 'suspended-cymbal') return 'suspended-roll';
  return family;
}
export function chooseVelocityLayer<T extends { velocity: number }>(layers: readonly T[], velocity: number): T {
  return layers.reduce((best, layer) => Math.abs(layer.velocity - velocity) < Math.abs(best.velocity - velocity) ? layer : best);
}
export class VscoPercussion {
  private buffers = new Map<string, Tone.ToneAudioBuffer>();
  private loads = new Map<string, Promise<Tone.ToneAudioBuffer>>();
  private roundRobins = new Map<string, number>();
  private players = new Set<Tone.Player>();
  private grace = new Map<string, number>();
  private expressionValues = new Map<string, number>();
  private rollGains = new Map<Tone.Player, { id: string; gain: Tone.Gain }>();
  expression(id: string, value: number, time: number) {
    this.expressionValues.set(id, value);
    for (const roll of this.rollGains.values()) if (roll.id === id) roll.gain.gain.setTargetAtTime(value, time, 0.025);
  }
  private destinations = new Map<string, Tone.ToneAudioNode>();
  async prepare(notes: readonly NoteEvent[], destination: (id: string) => Tone.ToneAudioNode) {
    const required = new Set<string>();
    for (const note of notes) {
      const family = sampleFamily(note); if (!family) continue;
      this.destinations.set(note.partId ?? note.instrument ?? 'default', destination(note.partId ?? note.instrument ?? 'default'));
      for (const layer of families[family]) for (const file of layer.files) required.add(file);
    }
    await Promise.all([...required].map(async file => {
      if (this.buffers.has(file)) return;
      let pending = this.loads.get(file);
      if (!pending) {
        pending = Tone.ToneAudioBuffer.fromUrl(`${import.meta.env.BASE_URL}audio/vendor/vsco/${encodeURIComponent(file)}`);
        this.loads.set(file, pending);
      }
      try { this.buffers.set(file, await pending); }
      catch { this.loads.delete(file); throw new Error(`Percussion sample missing: ${file}. Run npm run setup:audio.`); }
    }));
  }
  play(note: NoteEvent, time: number, duration: number, velocity: number, expressive = false): boolean {
    const family = sampleFamily(note); if (!family) return false;
    const id = note.partId ?? note.instrument ?? 'default';
    const ornamentKey = `${id}:${note.percussion}:${note.beat}`;
    if (note.percussionGrace) { this.grace.set(ornamentKey, Math.min(2, (this.grace.get(ornamentKey) ?? 0) + 1)); return true; }
    const count = this.grace.get(ornamentKey) ?? 0; this.grace.delete(ornamentKey);
    const strike = (at: number, level: number, loop = false) => {
      const layer = chooseVelocityLayer(families[family], (note.velocity ?? velocity) * level / Math.max(0.001, velocity));
      const rrKey = `${id}:${family}:${layer.velocity}`;
      const rr = this.roundRobins.get(rrKey) ?? 0; this.roundRobins.set(rrKey, rr + 1);
      const buffer = this.buffers.get(layer.files[rr % layer.files.length]);
      if (!buffer) throw new Error(`Percussion bank was not prepared for ${family}`);
      const offset = note.resumeOffsetSeconds ? (note.percussionRoll ? (loop ? Math.min(0.8, buffer.duration * 0.15) : 0) : note.resumeOffsetSeconds) : 0;
      if (!loop && offset >= buffer.duration) return;
      const player = new Tone.Player({ url: buffer, fadeOut: loop ? 0.12 : 0.04, loop });
      const hitLevel = expressive && !note.percussionRoll ? level * (note.velocity ?? REFERENCE_DYNAMIC) / REFERENCE_DYNAMIC : level;
      player.volume.value = -6 + 20 * Math.log10(Math.max(0.001, Math.min(4, hitLevel / Math.max(0.25, layer.velocity))));
      if (note.percussionRoll && expressive) {
        const gain = new Tone.Gain(this.expressionValues.get(id) ?? 1).connect(this.destinations.get(id)!);
        player.connect(gain); this.rollGains.set(player, { id, gain });
      } else player.connect(this.destinations.get(id)!);
      this.players.add(player);
      player.onstop = () => { this.players.delete(player); this.rollGains.get(player)?.gain.dispose(); this.rollGains.delete(player); player.dispose(); };
      if (loop) { player.loopStart = Math.min(0.8, buffer.duration * 0.15); player.loopEnd = Math.max(player.loopStart + 0.1, buffer.duration - 0.25); }
      player.start(Math.max(Tone.immediate(), at), offset);
      if (loop) player.stop(at + Math.max(0.12, duration));
    };
    for (let i = count; i > 0; i--) strike(time - i * 0.025, velocity * 0.55);
    if (note.percussionRoll && family !== 'snare-roll' && family !== 'suspended-roll') {
      const step = 1 / 12;
      for (let elapsed = 0, i = 0; elapsed < duration - 0.005; elapsed += step, i++) strike(time + elapsed, velocity * (i % 2 ? 0.82 : 0.95));
    } else strike(time, velocity, note.percussionRoll && (family === 'snare-roll' || family === 'suspended-roll'));
    return true;
  }
  stop() { for (const player of this.players) { player.stop(); } this.grace.clear(); }
  dispose() { this.stop(); for (const buffer of this.buffers.values()) buffer.dispose(); this.buffers.clear(); this.loads.clear(); this.destinations.clear(); this.expressionValues.clear(); }
}
