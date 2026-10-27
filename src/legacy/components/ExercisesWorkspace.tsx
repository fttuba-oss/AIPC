import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Send, X, Check, Sparkles, AlertTriangle, Users, Eye
} from 'lucide-react';
import type { ExerciseTemplate, LibraryScore, RhythmKind, StoredExercise, StudentProfile } from '../../contracts/portal';
import {
  deleteExerciseTemplate, fetchExerciseTemplates, saveExerciseTemplate
} from '../utils/libraryApi';
import {
  RHYTHM_KIND_LABEL, defaultRhythmNotes, extractScoreStructure, matchStudentsToParts, suggestExercises
} from '../utils/exerciseSuggester';
import { saveExerciseToStorage } from '../utils/studentRecordingManager';

export interface ExercisesWorkspaceProps {
  score: LibraryScore;
  /** Score XML for this score (null while loading). */
  xmlContent: string | null;
  students: StudentProfile[];
  passageRange: [number, number];
  onPassageChange: (range: [number, number]) => void;
  onToast: (text: string) => void;
}

// Shared in-flight loads so StrictMode / quick switching can't seed a score twice.
const loading = new Map<string, Promise<ExerciseTemplate[]>>();

/** Remove duplicate *suggested* exercises (same type, bars and rhythm kind) left by racing loads. */
async function dedupeSuggested(list: ExerciseTemplate[]): Promise<ExerciseTemplate[]> {
  const seen = new Set<string>();
  const kept: ExerciseTemplate[] = [];
  for (const t of list) {
    const key = `${t.type}:${t.rhythmKind || ''}:${t.startMeasure}-${t.endMeasure}`;
    if (t.suggested && seen.has(key)) {
      await deleteExerciseTemplate(t.id);
      continue;
    }
    if (t.suggested) seen.add(key);
    kept.push(t);
  }
  return kept;
}

async function loadOrSeedTemplates(scoreId: string, xml: string): Promise<ExerciseTemplate[]> {
  const inFlight = loading.get(scoreId);
  if (inFlight) return inFlight;
  const promise = (async () => {
    const existing = await fetchExerciseTemplates(scoreId);
    if (existing.length > 0) return dedupeSuggested(existing);
    const suggestions = suggestExercises(scoreId, xml);
    for (const tpl of suggestions) await saveExerciseTemplate(tpl);
    return dedupeSuggested(await fetchExerciseTemplates(scoreId));
  })().finally(() => loading.delete(scoreId));
  loading.set(scoreId, promise);
  return promise;
}

const barsLabel = (t: { startMeasure: number; endMeasure: number }) =>
  t.startMeasure === t.endMeasure ? `Bar ${t.startMeasure}` : `Bars ${t.startMeasure}–${t.endMeasure}`;

export const ExercisesWorkspace: React.FC<ExercisesWorkspaceProps> = ({
  score, xmlContent, students, passageRange, onPassageChange, onToast,
}) => {
  const [templates, setTemplates] = useState<ExerciseTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExerciseTemplate | null>(null);
  const [sending, setSending] = useState<ExerciseTemplate | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Score-following card whose section picker is expanded (collapsed by default: the whole score is assumed)
  const [openAssign, setOpenAssign] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplates([]);
    setDraft(null);
    setSending(null);
    setActiveId(null);
    setError(null);
    if (!xmlContent) {
      setIsLoading(true);
      return;
    }
    setIsLoading(true);
    loadOrSeedTemplates(score.id, xmlContent)
      .then(list => { if (!cancelled) setTemplates(list); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to load exercises.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [score.id, xmlContent]);

  const followExercises = templates.filter(t => t.type === 'score_following');
  const rhythmExercises = templates.filter(t => t.type === 'rhythm');
  const trickyCounts = useMemo(() => ({
    syncopation: rhythmExercises.filter(t => t.rhythmKind === 'syncopation').length,
    cross: rhythmExercises.filter(t => t.rhythmKind === 'cross_rhythm').length,
  }), [rhythmExercises]);

  const upsert = (tpl: ExerciseTemplate) =>
    setTemplates(prev => {
      const next = prev.some(t => t.id === tpl.id) ? prev.map(t => (t.id === tpl.id ? tpl : t)) : [...prev, tpl];
      return next.sort((a, b) => a.startMeasure - b.startMeasure);
    });

  // Bar count and rehearsal-mark sections, for quick-picking what students follow
  const structure = useMemo(() => {
    if (!xmlContent) return { lastBar: 1, sections: [] as { label: string; start: number; end: number }[] };
    try {
      return extractScoreStructure(xmlContent);
    } catch {
      return { lastBar: 1, sections: [] };
    }
  }, [xmlContent]);

  /** Change the bars and/or tempo of a score-following exercise and save it. */
  const updateFollow = async (t: ExerciseTemplate, patch: { start?: number; end?: number; tempo?: number }) => {
    const max = structure.lastBar;
    let start = Math.min(Math.max(1, patch.start ?? t.startMeasure), max);
    let end = Math.min(Math.max(1, patch.end ?? t.endMeasure), max);
    if (end < start) [start, end] = [end, start];
    const tempo = Math.min(240, Math.max(30, patch.tempo ?? t.tempo));
    const isFull = start === 1 && end === max;
    try {
      const saved = await saveExerciseTemplate({
        ...t,
        startMeasure: start,
        endMeasure: end,
        tempo,
        title: isFull ? 'Score following – full score' : `Score following – ${barsLabel({ startMeasure: start, endMeasure: end })}`,
        suggested: false,
      });
      upsert(saved);
    } catch (e: any) {
      setError(e?.message || 'Failed to update exercise.');
    }
  };

  const startNew = (type: 'score_following' | 'rhythm') => {
    const [start, end] = passageRange;
    setDraft({
      id: '',
      scoreId: score.id,
      type,
      title: type === 'rhythm' ? `Rhythm – ${barsLabel({ startMeasure: start, endMeasure: end })}` : `Score following – ${barsLabel({ startMeasure: start, endMeasure: end })}`,
      startMeasure: start,
      endMeasure: end,
      tempo: 90,
      rhythmKind: type === 'rhythm' ? 'syncopation' : undefined,
      parts: [],
      notes: type === 'rhythm' ? defaultRhythmNotes('syncopation') : 'Follow along with the full score.',
      suggested: false,
      createdAt: '',
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    try {
      const start = Math.max(1, Math.min(draft.startMeasure, draft.endMeasure));
      const end = Math.max(draft.startMeasure, draft.endMeasure);
      const saved = await saveExerciseTemplate({ ...draft, id: draft.id || undefined, startMeasure: start, endMeasure: end, suggested: false });
      upsert(saved);
      setDraft(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to save exercise.');
    }
  };

  const removeTemplate = async (t: ExerciseTemplate) => {
    if (!confirm(`Delete "${t.title}"? Exercises already sent to students are not affected.`)) return;
    await deleteExerciseTemplate(t.id);
    setTemplates(prev => prev.filter(x => x.id !== t.id));
  };

  const openSend = (t: ExerciseTemplate) => {
    // Rhythm exercises: pre-select students whose instrument has the tricky rhythm
    const preselected = t.type === 'rhythm' && t.parts.length > 0
      ? matchStudentsToParts(students, t.parts)
      : students;
    setSelectedIds(preselected.map(s => s.id));
    setSending(t);
  };

  const sendExercise = async () => {
    if (!sending) return;
    const recipients = students.filter(s => selectedIds.includes(s.id));
    if (recipients.length === 0) return;
    setIsSending(true);
    try {
      const isFollow = sending.type === 'score_following';
      for (const st of recipients) {
        const exercise: StoredExercise = {
          id: `ex_${st.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: `${score.title} – ${sending.title}`,
          scoreTitle: score.title,
          scorePath: score.xmlPath,
          instrumentId: st.instrument.toLowerCase().replace(/\s+/g, '_'),
          instrumentName: st.instrument,
          studentId: st.id,
          studentName: st.name,
          assignedDate: new Date().toISOString(),
          status: 'assigned',
          section: {
            sectionNumber: 1,
            title: isFollow
              ? `Score following (${barsLabel(sending)})`
              : `${RHYTHM_KIND_LABEL[sending.rhythmKind || 'other']} (${barsLabel(sending)})`,
            startMeasure: sending.startMeasure,
            endMeasure: sending.endMeasure,
            goals: [{
              category: isFollow ? 'score_following' : 'complex_rhythm',
              measureRange: barsLabel(sending),
              startMeasure: sending.startMeasure,
              endMeasure: sending.endMeasure,
              goal: isFollow ? 'Follow the score along with the ensemble.' : sending.notes || 'Practise this rhythm with the click.',
              targetTempo: sending.tempo,
              teacherNote: sending.notes,
            }],
          },
          teacherGeneralNotes: sending.notes,
        };
        await saveExerciseToStorage(exercise);
      }
      onToast(`Sent "${sending.title}" to ${recipients.length} student${recipients.length === 1 ? '' : 's'}`);
      setSending(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to send exercise.');
    } finally {
      setIsSending(false);
    }
  };

  // Students grouped by instrument (section)
  const studentsByInstrument = useMemo(() => {
    const groups = new Map<string, StudentProfile[]>();
    [...students].sort((a, b) => a.instrument.localeCompare(b.instrument) || a.name.localeCompare(b.name)).forEach(s => {
      groups.set(s.instrument, [...(groups.get(s.instrument) || []), s]);
    });
    return [...groups.entries()];
  }, [students]);

  const renderCard = (t: ExerciseTemplate) => {
    const isRhythm = t.type === 'rhythm';
    const matched = isRhythm ? matchStudentsToParts(students, t.parts) : students;
    const isFullScore = !isRhythm && t.startMeasure === 1 && t.endMeasure === structure.lastBar;
    const assignOpen = !isRhythm && (openAssign === t.id || !isFullScore);
    return (
      <div
        key={t.id}
        onClick={() => { setActiveId(t.id); if (isRhythm) onPassageChange([t.startMeasure, t.endMeasure]); }}
        className={`aipc-exercise-card bg-white border rounded-2xl p-4 transition-colors cursor-pointer ${
          activeId === t.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button type="button" aria-pressed={activeId === t.id} onClick={() => { setActiveId(t.id); if (isRhythm) onPassageChange([t.startMeasure, t.endMeasure]); }} className="text-base font-semibold text-slate-900 leading-snug text-left cursor-pointer">{t.title}</button>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {!isFullScore && <span className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                {isRhythm ? barsLabel(t) : barsLabel(t)}
              </span>}
              <span className="text-sm font-semibold text-slate-500">♩ = {t.tempo}</span>
              {isRhythm && t.rhythmKind && (
                <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {RHYTHM_KIND_LABEL[t.rhythmKind]}
                </span>
              )}
              {t.suggested && isRhythm && (
                <span className="text-sm font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> Suggested
                </span>
              )}
            </div>
          </div>
        </div>

        {isRhythm && t.parts.length > 0 && (
          <div className="mt-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Found in: </span>
            {t.parts.join(', ')}
            <span className="text-slate-500"> · {matched.length} matching student{matched.length === 1 ? '' : 's'}</span>
          </div>
        )}
        {t.notes && isRhythm && (
          <details className="mt-3 text-sm text-slate-600 leading-relaxed" onClick={e => e.stopPropagation()}>
            <summary className="cursor-pointer text-slate-500">Practice notes</summary>
            <p className="mt-2">{t.notes}</p>
          </details>
        )}

        {!isRhythm && !assignOpen && (
          <button
            onClick={e => { e.stopPropagation(); setOpenAssign(t.id); }}
            className="mt-2 text-sm font-medium text-[#0071e3] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Users className="w-3 h-3" /> Assign sections to students
          </button>
        )}

        {assignOpen && (
          <div className="mt-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Choose sections</div>
              {isFullScore && <button onClick={() => setOpenAssign(null)} className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer">Done</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => updateFollow(t, { start: 1, end: structure.lastBar })}
                className={`px-2 py-1 rounded-lg text-sm font-semibold cursor-pointer border ${
                  t.startMeasure === 1 && t.endMeasure === structure.lastBar ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >Full score</button>
              {structure.sections.map(sec => (
                <button
                  key={`${sec.label}-${sec.start}`}
                  onClick={() => updateFollow(t, { start: sec.start, end: sec.end })}
                  title={`${sec.label}: bars ${sec.start}–${sec.end}`}
                  className={`px-2 py-1 rounded-lg text-sm font-semibold cursor-pointer border ${
                    t.startMeasure === sec.start && t.endMeasure === sec.end ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >{sec.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-semibold text-slate-600">From bar
                <input
                  key={`s-${t.id}-${t.startMeasure}`} type="number" min={1} max={structure.lastBar} defaultValue={t.startMeasure}
                  onBlur={e => { const v = parseInt(e.target.value, 10); if (v && v !== t.startMeasure) updateFollow(t, { start: v }); }}
                  className="block w-16 mt-0.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 outline-hidden focus:border-blue-500"
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">To bar
                <input
                  key={`e-${t.id}-${t.endMeasure}`} type="number" min={1} max={structure.lastBar} defaultValue={t.endMeasure}
                  onBlur={e => { const v = parseInt(e.target.value, 10); if (v && v !== t.endMeasure) updateFollow(t, { end: v }); }}
                  className="block w-16 mt-0.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 outline-hidden focus:border-blue-500"
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">Tempo ♩ =
                <input
                  key={`t-${t.id}-${t.tempo}`} type="number" min={30} max={240} defaultValue={t.tempo}
                  onBlur={e => { const v = parseInt(e.target.value, 10); if (v && v !== t.tempo) updateFollow(t, { tempo: v }); }}
                  className="block w-16 mt-0.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 outline-hidden focus:border-blue-500"
                />
              </label>
              <button
                onClick={() => updateFollow(t, { start: passageRange[0], end: passageRange[1] })}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1 pb-1.5"
              >
                <Eye className="w-3 h-3" /> Use selected bars ({passageRange[0]}–{passageRange[1]})
              </button>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap gap-2 items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); openSend(t); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            <Send className="w-3 h-3" /> Send to students
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setDraft(t); }}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
              aria-label="Edit exercise" title="Edit exercise"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); removeTemplate(t); }}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
              aria-label="Delete exercise" title="Delete exercise"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const inputCls = 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20';

  const panelBody = (
    <>
        <div className="px-5 pt-4 pb-2 shrink-0">
          <p className="text-sm text-slate-500">Created from “{score.title}”. Edit them, then send to students.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-slate-500 py-8 text-center">
              {xmlContent ? 'Analysing score…' : 'Loading score…'}
            </div>
          ) : (
            <>
              {/* Score following */}
              <section>
                <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold  text-slate-500">Score following</h3>
                  <button onClick={() => startNew('score_following')} className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {followExercises.length === 0 && <div className="text-sm text-slate-500">None yet.</div>}
                  {followExercises.map(renderCard)}
                </div>
              </section>

              {/* Rhythm exercises */}
              <section>
                <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold  text-slate-500">Rhythm exercises</h3>
                  <button onClick={() => startNew('rhythm')} className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
                    <Plus className="w-3 h-3" /> Add (selected bars)
                  </button>
                </div>
                {rhythmExercises.length > 0 && (
                  <div className="mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Tricky rhythms found in {rhythmExercises.length} section{rhythmExercises.length === 1 ? '' : 's'}
                      {trickyCounts.syncopation > 0 && ` · ${trickyCounts.syncopation} syncopated`}
                      {trickyCounts.cross > 0 && ` · ${trickyCounts.cross} cross-rhythm`}.
                      Send each to the students whose instrument plays it.
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  {rhythmExercises.length === 0 && (
                    <div className="text-sm text-slate-500">No tricky rhythms detected. Select bars on the score and add one manually.</div>
                  )}
                  {rhythmExercises.map(renderCard)}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Edit / create exercise */}
        {draft && (
          <div className="absolute inset-0 z-20 bg-white flex flex-col animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                {draft.id ? 'Edit' : 'New'} {draft.type === 'rhythm' ? 'rhythm exercise' : 'score-following exercise'}
              </span>
              <button onClick={() => setDraft(null)} aria-label="Close" className="p-2 text-slate-500 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Title</span>
                <input className={`${inputCls} mt-1`} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <div className="aipc-range-fields grid gap-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">From bar</span>
                  <input type="number" min={1} className={`${inputCls} mt-1`} value={draft.startMeasure}
                    onChange={e => setDraft({ ...draft, startMeasure: parseInt(e.target.value, 10) || 1 })} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">To bar</span>
                  <input type="number" min={1} className={`${inputCls} mt-1`} value={draft.endMeasure}
                    onChange={e => setDraft({ ...draft, endMeasure: parseInt(e.target.value, 10) || 1 })} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Tempo (♩)</span>
                  <input type="number" min={30} max={240} className={`${inputCls} mt-1`} value={draft.tempo}
                    onChange={e => setDraft({ ...draft, tempo: parseInt(e.target.value, 10) || 90 })} />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, startMeasure: passageRange[0], endMeasure: passageRange[1] })}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> Use bars selected on the score ({passageRange[0]}–{passageRange[1]})
              </button>

              {draft.type === 'rhythm' && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Rhythm type</span>
                  <select
                    className={`${inputCls} mt-1 cursor-pointer`}
                    value={draft.rhythmKind || 'other'}
                    onChange={e => {
                      const kind = e.target.value as RhythmKind;
                      const wasDefault = draft.notes === defaultRhythmNotes(draft.rhythmKind || 'other') || !draft.notes;
                      setDraft({ ...draft, rhythmKind: kind, notes: wasDefault ? defaultRhythmNotes(kind) : draft.notes });
                    }}
                  >
                    {(Object.keys(RHYTHM_KIND_LABEL) as RhythmKind[]).map(k => (
                      <option key={k} value={k}>{RHYTHM_KIND_LABEL[k]}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Notes for students</span>
                <textarea rows={4} className={`${inputCls} mt-1 resize-none leading-relaxed`} value={draft.notes}
                  onChange={e => setDraft({ ...draft, notes: e.target.value })} />
              </label>

              {draft.parts.length > 0 && (
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">Found in: </span>{draft.parts.join(', ')}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => setDraft(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={saveDraft} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0071e3] hover:bg-blue-700 cursor-pointer">Save exercise</button>
            </div>
          </div>
        )}

        {/* Send to students, grouped by instrument */}
        {sending && (
          <div className="absolute inset-0 z-20 bg-white flex flex-col animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Send to students</div>
                <div className="text-sm text-slate-500 truncate">{sending.title}</div>
              </div>
              <button onClick={() => setSending(null)} aria-label="Close" className="p-2 text-slate-500 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-2 flex flex-wrap gap-2 items-center justify-between text-sm border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {selectedIds.length} of {students.length} selected</span>
              <div className="flex gap-3">
                {sending.type === 'rhythm' && sending.parts.length > 0 && (
                  <button onClick={() => setSelectedIds(matchStudentsToParts(students, sending.parts).map(s => s.id))}
                    className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Relevant only</button>
                )}
                <button onClick={() => setSelectedIds(selectedIds.length === students.length ? [] : students.map(s => s.id))}
                  className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                  {selectedIds.length === students.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {students.length === 0 && <div className="text-sm text-slate-500">No students in the roster yet.</div>}
              {studentsByInstrument.map(([instrument, list]) => {
                const relevant = sending.type === 'rhythm' && sending.parts.length > 0
                  && matchStudentsToParts(list, sending.parts).length > 0;
                return (
                  <div key={instrument}>
                    <div className="text-sm font-semibold  text-slate-500 mb-1 flex items-center gap-1.5">
                      {instrument}
                      {relevant && <span className="text-sm normal-case font-semibold text-slate-600 bg-slate-100 px-1.5 rounded-full">plays this rhythm</span>}
                    </div>
                    {list.map(st => (
                      <label key={st.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                        <input type="checkbox" className="accent-blue-600" checked={selectedIds.includes(st.id)}
                          onChange={() => setSelectedIds(prev => prev.includes(st.id) ? prev.filter(x => x !== st.id) : [...prev, st.id])} />
                        <span className="font-semibold text-slate-900">{st.name}</span>
                        <span className="text-slate-500 ml-auto">{st.instrument}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={sendExercise}
                disabled={isSending || selectedIds.length === 0}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[#0071e3] hover:bg-blue-700 disabled:opacity-50 text-white cursor-pointer flex items-center justify-center gap-2"
              >
                {isSending ? 'Sending…' : (<><Check className="w-4 h-4" /> Send to {selectedIds.length} student{selectedIds.length === 1 ? '' : 's'}</>)}
              </button>
            </div>
          </div>
        )}
    </>
  );

  return (
    <div className="aipc-exercises relative flex flex-col h-full min-h-0 bg-white overflow-hidden select-none">
      {panelBody}
    </div>
  );
};
