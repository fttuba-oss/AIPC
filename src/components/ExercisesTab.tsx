import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Music, User, Clock, CheckCircle2, Play, 
  Trash2, RefreshCw, Filter, Search, Sparkles, ExternalLink
} from 'lucide-react';
import type { StoredExercise, StudentProfile } from '../types/portal';
import { fetchExercisesFromStorage, fetchStudentsFromStorage } from '../utils/studentRecordingManager';

export interface ExercisesTabProps {
  onLaunchPractice: (exercise: StoredExercise) => void;
  onViewSubmissions: (exerciseId?: string) => void;
  onOpenScoreForExercise: (scorePath: string, range: [number, number]) => void;
}

export const ExercisesTab: React.FC<ExercisesTabProps> = ({
  onLaunchPractice,
  onViewSubmissions,
  onOpenScoreForExercise,
}) => {
  const [exercises, setExercises] = useState<StoredExercise[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allEx, roster] = await Promise.all([
        fetchExercisesFromStorage(),
        fetchStudentsFromStorage(),
      ]);
      setExercises(allEx || []);
      setStudents(roster || []);
    } catch (e) {
      console.error('Failed to load exercises:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteExercise = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this assigned exercise?')) return;
    try {
      const resp = await fetch(`/api/storage/exercises/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        setExercises(prev => prev.filter(ex => ex.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete exercise:', err);
    }
  };

  const filteredExercises = exercises.filter(ex => {
    if (selectedStudentFilter !== 'all' && ex.studentId !== selectedStudentFilter) {
      return false;
    }
    if (statusFilter !== 'all' && ex.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = ex.title.toLowerCase().includes(q) ||
        ex.studentName.toLowerCase().includes(q) ||
        ex.scoreTitle.toLowerCase().includes(q) ||
        ex.instrumentName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="aipc-sent flex-1 flex flex-col h-full min-w-0 bg-[#f5f5f7] overflow-y-auto select-none p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-semibold">
              <BookOpen className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Sent to students
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Review assigned exercises and student progress.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl border border-slate-200/90 shadow-2xs transition-colors cursor-pointer self-start"
          title="Refresh assigned exercises"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="aipc-exercise-filters flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search exercises or students" placeholder="Search exercises or students"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 shadow-2xs"
            />
          </div>

          {/* Student Filter */}
          <select
            aria-label="Filter by student" value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-700 outline-hidden shadow-2xs cursor-pointer"
          >
            <option value="all">All Students ({students.length})</option>
            {students.map(st => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.instrument})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 shadow-2xs text-sm font-semibold text-slate-600">
            {(['all', 'assigned', 'completed'] as const).map(st => (
              <button
                key={st}
                aria-pressed={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                  statusFilter === st ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-slate-500 font-medium">
          Showing {filteredExercises.length} of {exercises.length} exercises
        </div>
      </div>

      {/* Grid of Exercises */}
      {filteredExercises.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 mb-1">No exercises found</h3>
          <p className="text-sm text-slate-500">
            Adjust your filters, or send an exercise from Score exercises.
          </p>
        </div>
      ) : (
        <div className="aipc-exercise-grid grid gap-3">
          {filteredExercises.map(ex => {
            const sec = ex.section;
            const primaryGoal = sec.goals?.[0]?.goal || 'Practice passage with click';
            const targetBpm = sec.goals?.[0]?.targetTempo || 96;
            const isCompleted = ex.status === 'completed';

            return (
              <div
                key={ex.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  {/* Top Status & Student badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold">
                        {ex.studentName.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900 block leading-none">
                          {ex.studentName}
                        </span>
                        <span className="text-sm text-slate-500 font-medium">
                          {ex.instrumentName}
                        </span>
                      </div>
                    </div>

                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${
                      isCompleted 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {isCompleted ? '✓ Completed' : 'Assigned'}
                    </span>
                  </div>

                  {/* Title & Piece */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {ex.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mt-0.5">
                      <Music className="w-3 h-3 text-blue-600" />
                      <span>{ex.scoreTitle}</span>
                    </div>
                  </div>

                  {/* Rehearsal Measure Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      Bars {sec.startMeasure}–{sec.endMeasure}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">
                      Target: {targetBpm} BPM
                    </span>
                  </div>

                  {/* Goal Snippet */}
                  <div className="text-sm text-slate-600 leading-relaxed">
                    <strong className="text-slate-900 font-semibold">Goal: </strong>
                    {primaryGoal}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onLaunchPractice(ex)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer border border-blue-200/80"
                      title="Practice this exercise directly in the Student View"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => onOpenScoreForExercise(ex.scorePath, [sec.startMeasure, sec.endMeasure])}
                      className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                      title="Open in Conductor Score Viewer"
                    >
                      <Music className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onViewSubmissions(ex.id)}
                      className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                      title="View student submissions"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={(e) => handleDeleteExercise(ex.id, e)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete assigned exercise"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
