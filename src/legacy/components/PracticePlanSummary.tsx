import React, { useState, useEffect } from 'react';
import { 
  X, Printer, Copy, Check, 
  Send, User, Calendar, BookOpen, Sparkles
} from 'lucide-react';
import { PracticePlan, PracticePlanSection, PracticePlanGoal, MusicalSection, StudentProfile, StoredExercise } from '../../contracts/portal';
import { CATEGORY_DEFINITIONS } from '../../modules/score/engine/instrumentProfiles';
import { fetchStudentsFromStorage, saveExerciseToStorage } from '../utils/studentRecordingManager';

interface PracticePlanSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  scoreTitle: string;
  scorePath?: string;
  instrumentName: string;
  sections: MusicalSection[];
  onAssignToStudent?: (plan: PracticePlan) => void;
}

export const PracticePlanSummary: React.FC<PracticePlanSummaryProps> = ({
  isOpen,
  onClose,
  scoreTitle,
  scorePath,
  instrumentName,
  sections,
  onAssignToStudent
}) => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('stud_alex');
  const [studentName, setStudentName] = useState<string>('Alex Morgan');
  const [generalNotes, setGeneralNotes] = useState<string>(
    'Focus 15–20 minutes daily. First shadow finger with audio demo, then record your official take!'
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [assigned, setAssigned] = useState<boolean>(false);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  useEffect(() => {
    fetchStudentsFromStorage().then(roster => {
      if (roster && roster.length > 0) {
        setStudents(roster);
        setSelectedStudentId(roster[0].id);
        setStudentName(roster[0].name);
      }
    });
  }, []);

  if (!isOpen) return null;

  // Build section-based plan
  const planSections: PracticePlanSection[] = [];

  sections.forEach(sec => {
    const approvedChallenges = sec.challenges.filter(
      c => c.status === 'accepted' || c.status === 'edited'
    );

    if (approvedChallenges.length > 0) {
      const goals: PracticePlanGoal[] = approvedChallenges.map(area => ({
        areaId: area.id,
        sectionId: sec.id,
        sectionTitle: sec.title,
        category: area.category,
        measureRange: area.startMeasure === area.endMeasure ? `Bar ${area.startMeasure}` : `Bars ${area.startMeasure}–${area.endMeasure}`,
        startMeasure: area.startMeasure,
        endMeasure: area.endMeasure,
        goal: area.teacherGoal || area.defaultGoal,
        targetTempo: area.targetTempo,
        teacherNote: area.teacherNote
      }));

      planSections.push({
        sectionNumber: sec.sectionNumber,
        title: sec.title,
        startMeasure: sec.startMeasure,
        endMeasure: sec.endMeasure,
        goals
      });
    }
  });

  const totalApprovedGoals = planSections.reduce((acc, s) => acc + s.goals.length, 0);

  const plan: PracticePlan = {
    id: `plan-${Date.now().toString(36)}`,
    scoreTitle,
    studentName,
    studentInstrument: instrumentName,
    createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: 'assigned',
    sections: planSections,
    teacherGeneralNotes: generalNotes
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAssign = async () => {
    setIsAssigning(true);
    try {
      // Save each plan section as a distinct assigned exercise in shared storage
      for (const pSec of planSections) {
        const storedEx: StoredExercise = {
          id: `ex_${Date.now()}_${selectedStudentId}_sec${pSec.sectionNumber}`,
          title: `${scoreTitle} - ${pSec.title || `Section ${pSec.sectionNumber}`} (${pSec.startMeasure === pSec.endMeasure ? `Bar ${pSec.startMeasure}` : `Bars ${pSec.startMeasure}–${pSec.endMeasure}`})`,
          scoreTitle,
          scorePath: scorePath || '/neruda_trumpet_concerto_excerpt.musicxml',
          instrumentId: 'trumpet',
          instrumentName,
          studentId: selectedStudentId,
          studentName,
          assignedDate: new Date().toISOString(),
          status: 'assigned',
          section: {
            sectionNumber: pSec.sectionNumber,
            title: pSec.title,
            startMeasure: pSec.startMeasure,
            endMeasure: pSec.endMeasure,
            goals: pSec.goals
          },
          teacherGeneralNotes: generalNotes
        };
        await saveExerciseToStorage(storedEx);
      }

      onAssignToStudent?.(plan);
      setAssigned(true);
      setTimeout(() => setAssigned(false), 4000);
    } catch (err) {
      console.error('Failed to assign exercise to storage:', err);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:border-none print:shadow-none print:max-h-none print:w-full">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Generated Student Practice Plan</h2>
              <p className="text-[11px] text-slate-400">Review teacher-approved section assignments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-all"
              title="Copy JSON representation"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'JSON'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content / Printable Document */}
        <div className="p-6 overflow-y-auto space-y-6 print:p-8 print:text-black">
          {/* Document Header */}
          <div className="border-b border-slate-800 pb-5 print:border-slate-300">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 uppercase print:text-indigo-800">
                  AIPC Independent Practice Assignment
                </span>
                <h1 className="text-xl font-bold text-white print:text-black mt-1">
                  {scoreTitle}
                </h1>
              </div>

              <div className="text-right text-xs text-slate-400 font-mono print:text-slate-600 space-y-1">
                <div className="flex items-center justify-end gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{plan.createdDate}</span>
                </div>
                <div>{instrumentName}</div>
              </div>
            </div>

            {/* Student Selector & Name */}
            <div className="mt-4 flex flex-wrap items-center gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 print:border-none print:p-0 print:bg-transparent">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-400 print:hidden" />
                <span className="text-xs text-slate-400 font-medium print:text-black">Assign to Roster:</span>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    const st = students.find(s => s.id === e.target.value);
                    if (st) {
                      setSelectedStudentId(st.id);
                      setStudentName(st.name);
                    }
                  }}
                  className="bg-slate-900 text-xs font-bold text-emerald-300 px-2 py-1 rounded-lg border border-slate-700 outline-none cursor-pointer"
                >
                  {students.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.instrument})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium print:text-black">Display Name:</span>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-white print:text-black outline-none border-b border-dashed border-slate-700 focus:border-indigo-400 px-1 py-0.5"
                  placeholder="Student Name"
                />
              </div>
            </div>
          </div>

          {/* Sections List */}
          <div className="space-y-6">
            {planSections.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No practice goals have been approved yet. Review the sections and click &quot;Accept&quot; on the goals.
              </p>
            ) : (
              planSections.map(sec => (
                <div 
                  key={sec.sectionNumber}
                  className="rounded-xl bg-slate-950/50 border border-slate-800/80 p-4 print:border-slate-300 print:bg-slate-50 print:break-inside-avoid"
                >
                  {/* Section Title */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3 print:border-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white bg-indigo-600 px-2 py-0.5 rounded print:text-black print:bg-slate-200">
                        Section {sec.sectionNumber}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100 print:text-black">
                        Bars {sec.startMeasure}–{sec.endMeasure}
                      </h3>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400 print:text-slate-600">
                      {sec.goals.length} target goal(s)
                    </span>
                  </div>

                  {/* Chronological Goals */}
                  <div className="space-y-2.5 pl-2 border-l-2 border-indigo-500/40 print:border-indigo-600">
                    {sec.goals.map(goal => {
                      const meta = CATEGORY_DEFINITIONS[goal.category];
                      return (
                        <div key={goal.areaId} className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/60 print:bg-white print:border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-indigo-400 print:text-indigo-800">
                                {goal.measureRange}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-300 print:text-slate-700">
                                {meta.name}
                              </span>
                            </div>

                            {goal.targetTempo && (
                              <span className="text-[11px] font-mono font-bold text-emerald-400 print:text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded">
                                Target: ♩ = {goal.targetTempo}
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-semibold text-white print:text-black">
                            Goal: {goal.goal}
                          </p>

                          {goal.teacherNote && (
                            <p className="text-[11px] text-amber-300 print:text-amber-800 mt-1 italic pl-2 border-l border-amber-500">
                              Teacher Note: {goal.teacherNote}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Teacher Directions */}
          <div className="pt-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 print:text-slate-700">
              Teacher Instructions:
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 print:bg-transparent print:border-slate-300 print:text-black outline-none focus:border-indigo-500"
              placeholder="Add general practice directions..."
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-400">
            {totalApprovedGoals} approved goal(s) across {planSections.length} section(s)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Close
            </button>
            <button
              onClick={handleAssign}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              {assigned ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              <span>{assigned ? 'Assigned to Student!' : 'Assign to Student'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
