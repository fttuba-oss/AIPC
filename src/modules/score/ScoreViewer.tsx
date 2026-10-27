import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScoreSelection } from '../../contracts';
import { StudentScoreViewer as NotationViewer } from './viewer/NotationViewer';
import { StudentAudioEngine } from './engine/studentAudioEngine';
import { secondsToBeats, type ScorePlaybackData } from './engine/scorePlaybackParser';
import { DEFAULT_ORCHESTRA_MIX, assignedPartId, type OrchestraMix } from './engine/orchestraMix';
import { unpackMusicXml } from './engine/scoreParser';
import './ScoreViewer.css';

/** Both role shells share this viewer. Notation filtering never filters the audible orchestra. */
export function ScoreViewer({ selection }: { selection: ScoreSelection | null }) {
  const [xml, setXml] = useState<string | null>(null);
  const [data, setData] = useState<ScorePlaybackData | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visiblePartId, setVisiblePartId] = useState('');
  const [mix, setMix] = useState<OrchestraMix>({ ...DEFAULT_ORCHESTRA_MIX });
  const [metronomeOnly, setMetronomeOnly] = useState(false);
  const [fallbackParts, setFallbackParts] = useState<string[]>([]);
  const [peak, setPeak] = useState(0);
  const engine = useRef<StudentAudioEngine | null>(null);
  const generation = useRef(0);
  const onParsed = useCallback((value: ScorePlaybackData) => {
    setData(value);
    // Ambiguous assignment names need an explicit choice rather than muting the wrong player.
    setMix(previous => ({ ...previous, practicePartId: assignedPartId(value.parts, selection?.instrumentName) }));
  }, [selection?.instrumentName]);
  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    engine.current?.dispose(); engine.current = null;
    setPlaying(false); setLoading(false); setProgress(0); setData(null); setXml(null); setError('');
    setVisiblePartId(''); setMix({ ...DEFAULT_ORCHESTRA_MIX }); setMetronomeOnly(false); setFallbackParts([]); setPeak(0);
    if (selection) void (async () => {
      try {
        const response = await fetch(selection.score.xmlPath, { signal: controller.signal });
        if (!response.ok) throw new Error('Could not load this score.');
        const text = await unpackMusicXml(await response.arrayBuffer());
        if (!controller.signal.aborted) {
          // Resolve an assigned staff before engraving a potentially large orchestral score.
          const doc = new DOMParser().parseFromString(text, 'application/xml');
          const parts = Array.from(doc.getElementsByTagName('score-part')).map(part => ({
            id: part.getAttribute('id') ?? '', name: part.getElementsByTagName('part-name')[0]?.textContent ?? '',
          }));
          setVisiblePartId(assignedPartId(parts, selection.instrumentName));
          setXml(text);
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e)); }
    })();
    return () => { controller.abort(); generation.current++; engine.current?.dispose(); engine.current = null; };
  }, [selection]);
  useEffect(() => { engine.current?.setOrchestraMix(mix); }, [mix]);
  const updateMix = <K extends keyof OrchestraMix>(key: K, value: OrchestraMix[K]) => setMix(previous => ({ ...previous, [key]: value }));
  const stop = () => { generation.current++; engine.current?.stop(); setPlaying(false); setLoading(false); setPeak(0); };
  async function play() {
    if (!data || !selection) return;
    const start = selection.range?.[0] ?? data.metronomeMeasures?.[0]?.measureNumber ?? 1;
    const end = selection.range?.[1] ?? data.metronomeMeasures?.at(-1)?.measureNumber ?? data.measureStartBeats.length;
    const startBeat = data.measureStartBeatByNumber?.[start] ?? data.measureStartBeats[start - 1] ?? 0;
    const endBeat = data.measureStartBeatByNumber?.[end + 1] ?? data.measureStartBeats[end] ?? secondsToBeats(data.durationInSeconds, data.tempos);
    if (!(endBeat > startBeat)) { setError('This score has no playable measures in the selected range. Check the MusicXML file.'); return; }
    const current = ++generation.current;
    const audio = engine.current ?? (engine.current = new StudentAudioEngine());
    audio.setOrchestraMix(mix);
    audio.setOnTimeUpdate(seconds => { setProgress(seconds); setPeak(audio.getOutputPeak()); });
    audio.setOnEnd(() => { setPlaying(false); setPeak(0); });
    audio.setAudioBackingMuted(metronomeOnly);
    setLoading(true); setError('');
    try {
      await audio.startSectionPlayback({ intendedBpm: data.intendedBpm,
        timeSignature: [data.initialTimeSignature.numerator, data.initialTimeSignature.denominator],
        startMeasure: start, endMeasure: end, startBeat, totalBeats: endBeat - startBeat, countInBeats: 0,
        parts: data.parts, notes: data.parts.flatMap(part => part.notes), tempos: data.tempos, metronomeMeasures: data.metronomeMeasures });
      if (generation.current === current) { setPlaying(audio.getIsPlaying()); setFallbackParts(audio.getFallbackParts()); }
    } catch (e) { if (generation.current === current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (generation.current === current) setLoading(false); }
  }
  if (!selection) return <section className="module-panel"><h2>Score viewer</h2><p>Open a score from {document.documentElement.dataset.role === 'student' ? 'your practice plans' : 'the score files manager'}.</p></section>;
  return <section className="score-module">
    <div className="viewer-toolbar">
      <div><h2>{selection.score.title}</h2><p>{selection.range ? `Bars ${selection.range[0]}–${selection.range[1]}` : 'Full score'} · Score following</p></div>
      <label>Visible staves<select aria-label="Visible score part" value={visiblePartId} onChange={e => setVisiblePartId(e.target.value)}>
        <option value="">All parts</option>{data?.parts.map(part => <option key={part.id} value={part.id}>{part.name}</option>)}
      </select></label>
      <button disabled={!data || playing || loading} onClick={() => void play()}>{loading ? 'Preparing audio…' : 'Play & follow'}</button>
      <button disabled={!playing && !loading} onClick={stop}>Stop</button>
      <span aria-label="Playback time">{progress.toFixed(1)} s</span>
    </div>
    <section className="orchestra-controls" aria-label="Orchestra mix">
      <div className="orchestra-options">
        <label>Accompaniment<select aria-label="Orchestra playback" value={mix.mode} onChange={e => updateMix('mode', e.target.value as OrchestraMix['mode'])}>
          <option value="balanced">Balanced orchestra</option><option value="clear">Clear lines</option>
        </select></label>
        <label>My part<select aria-label="My practice part" value={mix.practicePartId} onChange={e => updateMix('practicePartId', e.target.value)}>
          <option value="">Choose a part</option>{data?.parts.map(part => <option key={part.id} value={part.id}>{part.name}</option>)}
        </select></label>
        <label className="orchestra-toggle"><input type="checkbox" disabled={!mix.practicePartId} checked={mix.mutePracticePart} onChange={e => updateMix('mutePracticePart', e.target.checked)} /> Mute my part</label>
        <label className="orchestra-toggle"><input type="checkbox" checked={metronomeOnly} onChange={e => { setMetronomeOnly(e.target.checked); engine.current?.setAudioBackingMuted(e.target.checked); }} /> Metronome only</label>
      </div>
      <p>{mix.mode === 'balanced' ? 'All orchestral parts stay in the mix. Changing visible staves only changes the score.' : 'Equivalent same-sound doubling is reduced. Different instruments and octaves stay audible.'}</p>
      <div className="orchestra-faders">
        {(['orchestraLevel', 'guideLevel', 'metronomeLevel'] as const).map((key, index) => <label key={key}>
          <span>{['Orchestra', 'My guide part', 'Metronome'][index]} <output>{mix[key]}%</output></span>
          <input aria-label={['Orchestra volume', 'Guide part volume', 'Metronome volume'][index]} type="range" min="0" max="100" value={mix[key]} disabled={key === 'guideLevel' && (!mix.practicePartId || mix.mutePracticePart)} onChange={e => updateMix(key, Number(e.target.value))} />
        </label>)}
        <label>Output level<meter aria-label="Output level" min={0} max={1} high={0.9} value={Math.min(1, peak)} /></label>
      </div>
      {peak > 0.95 && <p role="status">The mix is loud. Lower the orchestra or guide level.</p>}
      {fallbackParts.length > 0 && <p role="status">Some instrument sounds could not load; synthesized sounds are being used for {fallbackParts.join(', ')}.</p>}
    </section>
    {error && <p role="alert">{error}</p>}
    {!xml && !error && <p className="module-panel">Loading score…</p>}
    {xml && <NotationViewer xmlContent={xml} startMeasure={selection.range?.[0] ?? 1} endMeasure={selection.range?.[1] ?? 99999}
      instrumentPartName={selection.instrumentName} instrumentPartId={mix.practicePartId || null} visiblePartIds={visiblePartId ? [visiblePartId] : null}
      viewMode="full" playbackProgress={progress} isPlaying={playing} getPlaybackTime={() => engine.current?.getScorePlaybackSeconds() ?? null}
      onScoreParsed={onParsed} onSeek={(seconds, beat) => { setProgress(seconds); if (playing) engine.current?.seekToScoreBeat(beat ?? secondsToBeats(seconds, data?.tempos ?? [])); }} />}
  </section>;
}
