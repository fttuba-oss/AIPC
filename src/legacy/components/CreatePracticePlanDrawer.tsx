import React, { useState } from 'react';
import { 
  ChevronUp, ChevronDown, Check, Music, Plus, Pencil, Sparkles, X
} from 'lucide-react';
import type { StoredExercise, StudentProfile } from '../../contracts/portal';
import { saveExerciseToStorage } from '../utils/studentRecordingManager';

export interface CreatePracticePlanDrawerProps {
  scoreTitle: string;
  scorePath: string;
  passageRange: [number, number];
  onEditPassage?: () => void;
  onPassageChange?: (range: [number, number]) => void;
  /** Distribution list supplied by the parent platform. */
  studentsRoster?: StudentProfile[];
  onPlanAssigned?: (count: number) => void;
}

const FALLBACK_ROSTER = [
  { id: 'stud_alex', name: 'Alex Morgan', instrument: 'Trumpet 1' },
  { id: 'stud_sarah', name: 'Sarah Lin', instrument: 'Flute' },
] as unknown as StudentProfile[];

export const CreatePracticePlanDrawer: React.FC<CreatePracticePlanDrawerProps> = ({
  scoreTitle,
  scorePath,
  passageRange,
  onEditPassage,
  onPassageChange,
  studentsRoster = [],
  onPlanAssigned
}) => {
  // Plan name (editable, defaults to the passage)
  const [planName, setPlanName] = useState<string>('');
  const displayName = planName.trim() || `Bars ${passageRange[0]}–${passageRange[1]}`;

  // Passage Edit Popover
  const [isEditingPassage, setIsEditingPassage] = useState<boolean>(false);

  // Practice Goal (type from scratch, or modify)
  const [practiceGoal, setPracticeGoal] = useState<string>('');

  // Exercises
  const [isExercisesOpen, setIsExercisesOpen] = useState<boolean>(true);
  const [exercises, setExercises] = useState<{ id: string; title: string; detail: string }[]>([]);

  // Student picker (opens after clicking Assign)
  const roster = studentsRoster.length > 0 ? studentsRoster : FALLBACK_ROSTER;
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Assignment Status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [assignedSuccess, setAssignedSuccess] = useState<boolean>(false);

  const autoGenerate = () => {
    setExercises([
      { id: `auto_sync_${Date.now()}`, title: 'Syncopation builder', detail: '72 → 96 bpm' },
      { id: `auto_artic_${Date.now()}`, title: 'Articulation control', detail: 'Staccato quavers' },
      { id: `auto_dynam_${Date.now()}`, title: 'Dynamic contrast', detail: 'p to mp' },
    ]);
    if (!practiceGoal.trim()) {
      setPracticeGoal('Keep the off-beat quavers steady against the pulse.');
    }
  };

  const buildManually = () => {
    const title = prompt('Enter exercise title:');
    if (!title) return;
    setExercises(prev => [...prev, { id: `ex_${Date.now()}`, title, detail: 'Custom exercise' }]);
  };

  const openPicker = () => {
    setSelectedIds(roster.map(s => s.id));
    setIsPickerOpen(true);
  };

  const toggleStudent = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const handleAssign = async () => {
    const recipients = roster.filter(s => selectedIds.includes(s.id));
    if (recipients.length === 0) return;
    setIsSubmitting(true);
    try {
      const baseTitle = `${scoreTitle} - ${displayName} (${exercises[0]?.title || 'Practice Drill'})`;
      const goalFor = (ex: { title: string }) => practiceGoal ? `${ex.title}: ${practiceGoal}` : ex.title;
      const goalsList = (prefix: string) => (exercises.length ? exercises : [{ id: 'default', title: 'Practice Drill', detail: '' }]).map((ex, idx) => ({
        areaId: `${prefix}_${idx}_${Date.now()}`,
        category: 'complex_rhythm',
        measureRange: `Bars ${passageRange[0]}–${passageRange[1]}`,
        startMeasure: passageRange[0],
        endMeasure: passageRange[1],
        goal: goalFor(ex),
        targetTempo: 96,
      }));

      // Save exercise for each student so it shows in their individual portal
      for (const st of recipients) {
        const studentExercise: StoredExercise = {
          id: `ex_${st.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: baseTitle,
          scoreTitle,
          scorePath,
          instrumentId: st.instrument.toLowerCase().replace(/\s+/g, '_'),
          instrumentName: st.instrument,
          studentId: st.id,
          studentName: st.name,
          assignedDate: new Date().toISOString(),
          status: 'assigned',
          section: {
            sectionNumber: 1,
            title: `Rehearsal Passage (Bars ${passageRange[0]}–${passageRange[1]})`,
            startMeasure: passageRange[0],
            endMeasure: passageRange[1],
            goals: goalsList('goal'),
          },
        };
        await saveExerciseToStorage(studentExercise);
      }

      // Master batch exercise for the plan registry
      const batchExercise: StoredExercise = {
        id: `batch_${Date.now()}`,
        title: baseTitle,
        scoreTitle,
        scorePath,
        instrumentId: 'band_ensemble',
        instrumentName: `${recipients.length} students`,
        studentId: recipients[0].id,
        studentName: `${recipients.length} students`,
        assignedDate: new Date().toISOString(),
        status: 'assigned',
        section: {
          sectionNumber: 1,
          title: `Rehearsal Passage (Bars ${passageRange[0]}–${passageRange[1]})`,
          startMeasure: passageRange[0],
          endMeasure: passageRange[1],
          goals: goalsList('batch_goal'),
        },
      };
      await saveExerciseToStorage(batchExercise);

      setIsPickerOpen(false);
      setAssignedSuccess(true);
      onPlanAssigned?.(recipients.length);
      setTimeout(() => setAssignedSuccess(false), 4000);
    } catch (e) {
      console.error('Error assigning practice plan:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside className="w-[370px] shrink-0 bg-white border-l border-slate-200/90 flex flex-col h-full overflow-hidden select-none relative">
      {/* Drawer Header */}
      <div className="px-6 py-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Create practice plan
          </h2>
          {assignedSuccess && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200 animate-fade-in">
              <Check className="w-3 h-3" />
              <span>Assigned!</span>
            </span>
          )}
        </div>
        {/* Plan name: edit to rename */}
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 group">
          <input
            type="text"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder={displayName}
            className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-hidden text-sm font-semibold text-slate-800 placeholder-slate-800 py-0.5"
            title="Plan name — click to rename"
          />
          <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
        </label>
      </div>

      {/* Form Fields Container */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* 1. Passage */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Passage
          </label>
          <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors">
            <span className="text-sm font-semibold text-slate-900">
              Bars {passageRange[0]}–{passageRange[1]}
            </span>
            <button
              onClick={() => {
                setIsEditingPassage(!isEditingPassage);
                onEditPassage?.();
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              {isEditingPassage ? 'Done' : 'Edit'}
            </button>
          </div>

          {isEditingPassage && (
            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-[11px] text-slate-500">
                Click any bar on the score to select it.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  [passageRange[0], passageRange[0]],
                  [passageRange[0], passageRange[0] + 1],
                  [passageRange[0], passageRange[0] + 3],
                  [passageRange[0], passageRange[0] + 7],
                ].map(([start, end]) => (
                  <button
                    key={`${start}-${end}`}
                    onClick={() => onPassageChange?.([start, end])}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      passageRange[0] === start && passageRange[1] === end
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Bars {start}–{end}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Practice Goal */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Practice goal
          </label>
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <textarea
              rows={3}
              value={practiceGoal}
              onChange={(e) => setPracticeGoal(e.target.value)}
              placeholder="Type a goal from scratch, or auto-generate to start from a suggestion…"
              className="w-full bg-transparent text-xs text-slate-800 font-normal leading-relaxed outline-hidden resize-none"
            />
          </div>
        </div>

        {/* 3. Exercises */}
        <div>
          <div 
            onClick={() => setIsExercisesOpen(!isExercisesOpen)}
            className="flex items-center justify-between mb-1.5 cursor-pointer"
          >
            <span className="text-xs font-semibold text-slate-700">Exercises</span>
            {isExercisesOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {isExercisesOpen && (
            <div className="space-y-2">
              {exercises.map((ex) => (
                <div 
                  key={ex.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        {ex.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ex.detail}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setExercises(prev => prev.filter(e => e.id !== ex.id))}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    title="Remove exercise"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {exercises.length === 0 && (
                <div className="text-[11px] text-slate-400 px-1">
                  No exercises yet. Auto-generate or build one manually.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={autoGenerate}
                  className="py-2 px-3 border border-slate-200/90 rounded-xl bg-white hover:bg-slate-50 text-blue-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-generate</span>
                </button>
                <button
                  type="button"
                  onClick={buildManually}
                  className="py-2 px-3 border border-slate-200/90 rounded-xl bg-white hover:bg-slate-50 text-blue-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Build manually</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student picker: choose recipients after clicking Assign */}
      {isPickerOpen && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-white border-t border-slate-200 shadow-2xl rounded-t-2xl max-h-[70%] flex flex-col animate-fade-in">
          <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">Choose students</span>
            <button onClick={() => setIsPickerOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">{selectedIds.length} of {roster.length} selected</span>
            <button
              onClick={() => setSelectedIds(selectedIds.length === roster.length ? [] : roster.map(s => s.id))}
              className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              {selectedIds.length === roster.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-1">
            {roster.map(st => (
              <label key={st.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(st.id)}
                  onChange={() => toggleStudent(st.id)}
                  className="accent-blue-600"
                />
                <span className="font-semibold text-slate-900">{st.name}</span>
                <span className="text-slate-400 ml-auto">{st.instrument}</span>
              </label>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100">
            <button
              onClick={handleAssign}
              disabled={isSubmitting || selectedIds.length === 0}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-[#0071e3] hover:bg-blue-700 disabled:opacity-50 text-white cursor-pointer"
            >
              {isSubmitting ? 'Assigning...' : `Confirm · ${selectedIds.length} students`}
            </button>
          </div>
        </div>
      )}

      {/* Drawer Bottom Actions */}
      <div className="p-5 border-t border-slate-100 bg-white flex flex-col gap-2 shrink-0">
        <button
          onClick={openPicker}
          disabled={isSubmitting}
          className={`w-full py-3 rounded-xl text-sm font-semibold shadow-xs transition-all active:scale-[0.99] cursor-pointer text-center ${
            assignedSuccess
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-[#0071e3] hover:bg-blue-700 active:bg-blue-800 text-white'
          }`}
        >
          {assignedSuccess ? '✓ Assigned' : 'Assign to students'}
        </button>

        <button
          type="button"
          onClick={() => {}}
          className="w-full py-1 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          Save draft
        </button>
      </div>
    </aside>
  );
};
