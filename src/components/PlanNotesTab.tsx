import React, { useEffect, useState } from 'react';
import { Calendar, Send, Trash2, Music, MessageSquare } from 'lucide-react';
import type { LibraryScore, PlanNote } from '../types/portal';
import { deletePlanNote, fetchPlanNotes, savePlanNote } from '../utils/libraryApi';

export interface PlanNotesTabProps {
  scores: LibraryScore[];
  onToast: (text: string) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Practice plans: free-text messages for students (date + optional score link). */
export const PlanNotesTab: React.FC<PlanNotesTabProps> = ({ scores, onToast }) => {
  const [notes, setNotes] = useState<PlanNote[]>([]);
  const [date, setDate] = useState<string>(todayIso());
  const [scoreId, setScoreId] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanNotes().then(setNotes).catch(() => setError('Could not load practice plans.'));
  }, []);

  const send = async () => {
    if (!text.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const score = scores.find(s => s.id === scoreId);
      const saved = await savePlanNote({
        date,
        scoreId: score?.id,
        scoreTitle: score?.title,
        text: text.trim(),
      });
      setNotes(prev => [saved, ...prev]);
      setText('');
      onToast('Practice plan sent to all students');
    } catch (e: any) {
      setError(e?.message || 'Failed to send practice plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this practice plan? Students will no longer see it.')) return;
    await deletePlanNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const formatDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const inputCls = 'bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20';

  return (
    <div className="aipc-plans flex-1 h-full overflow-y-auto bg-[#f5f5f7] p-5 select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Practice plans</h1>
          <p className="text-sm text-slate-500 mt-1">
            Set the focus for the next practice.
          </p>
        </div>

        {/* Composer */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
          <div className="aipc-plan-fields grid gap-4">
            <label className="flex flex-col items-start gap-2 text-sm font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Next practice
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col items-start gap-2 text-sm font-medium text-slate-700">
              <Music className="w-3.5 h-3.5 text-slate-500" />
              Score
              <select value={scoreId} onChange={e => setScoreId(e.target.value)} className={`${inputCls} cursor-pointer w-full min-w-0`}>
                <option value="">None (general)</option>
                {scores.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
          </div>
          <textarea
            aria-label="Practice plan message" rows={5}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="For next practice, please work on 'Beautiful Danxia'. Practise with score following first, then the syncopation exercise in bars 27–28…"
            className={`${inputCls} w-full resize-none leading-relaxed`}
          />
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <div className="flex justify-end">
            <button
              onClick={send}
              disabled={isSaving || !text.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0071e3] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {isSaving ? 'Sending…' : 'Send to all students'}
            </button>
          </div>
        </div>

        {/* History */}
        <div>
          <h2 className="text-sm font-semibold  text-slate-500 mb-2">Previous plans</h2>
          {notes.length === 0 ? (
            <div className="p-10 text-center bg-white border border-slate-200/80 rounded-2xl text-sm text-slate-500">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No practice plans yet.
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(n => (
                <div key={n.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(n.date)}
                      </span>
                      {n.scoreTitle && (
                        <span className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                          <Music className="w-3 h-3 text-slate-500" /> {n.scoreTitle}
                        </span>
                      )}
                    </div>
                    <button onClick={() => remove(n.id)} aria-label="Delete plan" className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer" title="Delete plan">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
