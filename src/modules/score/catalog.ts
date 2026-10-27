import { useCallback, useEffect, useState } from 'react';
import type { ScoreFile, ScoreGateway } from '../../contracts';

export const BUILTIN_SCORES: ScoreFile[] = [
  { id: 'danxia', title: 'Beautiful Danxia', composer: 'Li Wei', xmlPath: '/beautiful_danxia_flutes.musicxml', builtin: true, uploadedAt: '2000-01-01' },
  { id: 'whales', title: 'Sailing with Whales', composer: 'Rossano Galante', xmlPath: '/sailing-with-whales-rossano-galante.mxl', builtin: true, uploadedAt: '2000-01-02' },
  { id: 'neruda', title: 'Trumpet Concerto in E-flat', composer: 'J.B.G. Neruda', xmlPath: '/neruda_trumpet_concerto_excerpt.musicxml', builtin: true, uploadedAt: '2000-01-03' },
];

export const httpScoreGateway: ScoreGateway = {
  async list() {
    const response = await fetch('/api/storage/scores');
    if (!response.ok) throw new Error('Could not load score files.');
    return [...BUILTIN_SCORES, ...await response.json()];
  },
  async upload(input) {
    const response = await fetch('/api/storage/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error('Could not upload score.');
    return response.json();
  },
};

export function useScoreCatalog(gateway: ScoreGateway = httpScoreGateway) {
  const [scores, setScores] = useState<ScoreFile[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setScores(await gateway.list()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [gateway]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { scores, error, refresh, gateway };
}
export type ScoreCatalog = ReturnType<typeof useScoreCatalog>;
