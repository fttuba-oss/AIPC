import { useState } from 'react';
import type { ScoreSelection } from '../../contracts';
import { unpackMusicXml, parseMusicXmlToScore } from './engine/scoreParser';
import type { ScoreCatalog } from './catalog';

export function ScoreFilesManager({ catalog, onOpenScore }: { catalog: ScoreCatalog; onOpenScore: (selection: ScoreSelection) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file: File) {
    setBusy(true); setError('');
    try {
      const xml = await unpackMusicXml(await file.arrayBuffer());
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.querySelector('parsererror') || !doc.querySelector('score-partwise')) throw new Error('Choose a valid partwise MusicXML or MXL score.');
      const parsed = parseMusicXmlToScore(xml);
      const score = await catalog.gateway.upload({ xml, fileName: file.name, title: parsed.title || file.name, composer: parsed.composer });
      await catalog.refresh(); onOpenScore({ score });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section className="module-panel">
    <h2>Score files manager</h2><p>Upload MusicXML or MXL files, then open a score to follow along.</p>
    <label className="action">{busy ? 'Uploading…' : 'Upload score'}<input aria-label="Upload score" type="file" accept=".xml,.musicxml,.mxl" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} /></label>
    {(error || catalog.error) && <p role="alert">{error || catalog.error}</p>}
    <ul className="module-list">{catalog.scores.map(score => <li key={score.id}><div><strong>{score.title}</strong><p>{score.composer || 'Uploaded score'}</p></div><button onClick={() => onOpenScore({ score })}>Open score</button></li>)}</ul>
  </section>;
}
