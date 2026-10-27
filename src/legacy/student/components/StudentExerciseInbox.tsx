import React, { useState, useEffect } from 'react';
import { 
  Music, BookOpen, Clock, Target, Play, 
  CheckCircle2, RefreshCw, Sparkles, User, AlertCircle, 
  ChevronRight, Calendar, ArrowRight, ShieldCheck
} from 'lucide-react';
import type { StoredExercise, StudentProfile, PlanNote } from '../../../contracts/portal';
import { fetchExercisesFromStorage, fetchStudentsFromStorage } from '../../utils/studentRecordingManager';
import { fetchPlanNotes } from '../../utils/libraryApi';

interface StudentExerciseInboxProps {
  selectedStudent: StudentProfile;
  onSelectStudent: (student: StudentProfile) => void;
  onSelectExercise: (exercise: StoredExercise) => void;
  onOpenScore?: (scoreId: string, scoreTitle: string) => void;
}

export const StudentExerciseInbox: React.FC<StudentExerciseInboxProps> = ({
  selectedStudent,
  onSelectStudent,
  onSelectExercise,
  onOpenScore,
}) => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [exercises, setExercises] = useState<StoredExercise[]>([]);
  const [planNotes, setPlanNotes] = useState<PlanNote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load students & exercises
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const roster = await fetchStudentsFromStorage();
      setStudents(roster);
      
      const loaded = await fetchExercisesFromStorage(selectedStudent.id);
      setExercises(loaded);
      setPlanNotes(await fetchPlanNotes().catch(() => []));
    } catch (err: any) {
      setError(err?.message || 'Failed to load assigned exercises from storage.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStudent.id]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f5f5f7] text-slate-800 overflow-hidden font-sans select-none">
      {/* Top Navigation Bar */}
      <header className="h-16 px-6 bg-white/95 border-b border-slate-200/80 flex items-center justify-between z-30 shrink-0 backdrop-blur-md shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-semibold text-xl">
            🎼
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              NUS Wind Symphony <span className="text-blue-600 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">Student Portal</span>
            </h1>
            <p className="text-sm text-slate-500">Interactive practice with ensemble minus-one backing and score companion</p>
          </div>
        </div>

        {/* Student Profile Switcher & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100/90 px-3.5 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <User className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500 font-medium">Practicing As:</span>
            <select
              value={selectedStudent.id}
              onChange={(e) => {
                const found = students.find(s => s.id === e.target.value);
                if (found) onSelectStudent(found);
              }}
              className="bg-transparent text-xs font-bold text-slate-900 outline-hidden cursor-pointer"
            >
              {students.map(st => (
                <option key={st.id} value={st.id} className="bg-white text-slate-800 font-medium">
                  {st.name} ({st.instrument})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            title="Refresh assigned exercises from storage"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* Main Inbox Content */}
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span>Assigned Practice Plans</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Rehearsal passages and practice goals assigned to {selectedStudent.name} ({selectedStudent.instrument}).
            </p>
          </div>

          <span className="text-xs bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full border border-blue-200">
            {exercises.length} {exercises.length === 1 ? 'Exercise' : 'Exercises'} Active
          </span>
        </div>

        {/* Free-text practice plans from the director */}
        {planNotes.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-xs font-semibold  text-slate-500">From your director</h3>
            {planNotes.map(n => (
              <div key={n.id} className="bg-white rounded-2xl border border-blue-200/80 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2 text-sm font-bold">
                  <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(`${n.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  {n.scoreTitle && <span className="text-slate-600">{n.scoreTitle}</span>}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{n.text}</p>
                {n.scoreId && onOpenScore && (
                  <button
                    onClick={() => onOpenScore(n.scoreId!, n.scoreTitle || 'Score')}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0071e3] hover:bg-[#0062c4] text-white rounded-full text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Music className="w-3.5 h-3.5" /> Open score
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Exercises Grid */}
        {exercises.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
              ♪
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">No Assigned Exercises Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              Your band director has not assigned an exercise for {selectedStudent.name} yet. Check back soon or switch student profiles.
            </p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              Check Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {exercises.map(ex => {
              const sec = ex.section;
              const hasGoals = sec.goals && sec.goals.length > 0;
              const targetBpm = sec.goals?.[0]?.targetTempo || 96;

              return (
                <div
                  key={ex.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-5 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Status and Date */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-sm font-semibold  bg-blue-50 text-blue-700 border border-blue-200">
                          {ex.instrumentName}
                        </span>
                        <span className="text-sm font-bold text-slate-400">
                          Bars {sec.startMeasure}–{sec.endMeasure}
                        </span>
                      </div>
                      <span className="text-sm text-slate-400 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(ex.assignedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Title & Score */}
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors mb-1 line-clamp-1">
                      {ex.title}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 font-medium">
                      Piece: <span className="font-semibold text-slate-700">{ex.scoreTitle}</span>
                    </p>

                    {/* Rehearsal Focus Badge */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-blue-600" />
                          <span>Rehearsal Focus:</span>
                        </span>
                        <span className="font-bold text-blue-600 font-mono text-sm">
                          ♩ = {targetBpm} BPM
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {hasGoals ? sec.goals[0].goal : 'Master passage with steady tempo and clean articulation.'}
                      </p>
                      {sec.goals?.[0]?.teacherNote && (
                        <p className="text-sm text-blue-700/80 font-medium italic pt-1 border-t border-slate-200/60">
                          Director note: "{sec.goals[0].teacherNote}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <button
                    onClick={() => onSelectExercise(ex)}
                    className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Open Interactive Practice</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
