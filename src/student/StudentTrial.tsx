import React, { useEffect, useState } from 'react';
import { StudentPracticeView } from '../components/StudentPracticeView';

/** Public, static trial: no roster, inbox, teacher portal or storage API. */
export function StudentTrial() {
  const [xml, setXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(`${import.meta.env.BASE_URL}trial/sunny-island.musicxml`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Sunny Island could not be loaded. Please retry.');
        const text = await response.text();
        if (!text.includes('<score-partwise')) throw new Error('The trial score is unavailable. Please retry.');
        if (!controller.signal.aborted) setXml(text);
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load the trial.'); });
    return () => controller.abort();
  }, [retry]);
  if (!xml) return <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
    <div role="status" className="rounded-2xl bg-white p-8 border border-slate-200 text-center max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">AIPC · Sunny Island</h1>
      <p className="mt-3 text-slate-600">{error || 'Opening your student practice trial…'}</p>
      {error && <button onClick={() => setRetry(n => n + 1)} className="mt-4 rounded-lg bg-blue-600 text-white px-4 py-2">Retry</button>}
    </div>
  </main>;
  return <StudentPracticeView xmlContent={xml} pieceTitle="Sunny Island" instrumentName="Flute 2"
    sectionId="sunny-trial" sectionTitle="Full piece" measureRange={[1, 116]}
    studentId="trial-guest" studentName="Guest" trialMode onExit={() => {}} />;
}
