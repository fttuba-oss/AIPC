import React, { useState, useEffect } from 'react';
import { 
  Users, User, Music, BookOpen, Clock, Play, 
  ExternalLink, ChevronRight, CheckCircle2, Award, Calendar,
  Sparkles, ArrowUpRight
} from 'lucide-react';
import type { StudentProfile, StoredExercise, StoredSubmission } from '../../contracts/portal';
import { 
  fetchStudentsFromStorage, 
  fetchExercisesFromStorage, 
  fetchSubmissionsFromStorage 
} from '../utils/studentRecordingManager';

export interface StudentsRosterTabProps {
  onAssignToStudent: (student: StudentProfile) => void;
  onLaunchStudentPortal: (student: StudentProfile, exercise?: StoredExercise) => void;
  onViewStudentSubmissions: (studentId: string) => void;
}

export const StudentsRosterTab: React.FC<StudentsRosterTabProps> = ({
  onAssignToStudent,
  onLaunchStudentPortal,
  onViewStudentSubmissions,
}) => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [exercises, setExercises] = useState<StoredExercise[]>([]);
  const [submissions, setSubmissions] = useState<StoredSubmission[]>([]);
  const [selectedSection, setSelectedSection] = useState<'all' | 'woodwinds' | 'brass'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      try {
        const [roster, allEx, allSubs] = await Promise.all([
          fetchStudentsFromStorage(),
          fetchExercisesFromStorage(),
          fetchSubmissionsFromStorage(),
        ]);
        setStudents(roster || []);
        setExercises(allEx || []);
        setSubmissions(allSubs || []);
      } catch (err) {
        console.error('Failed to load student roster data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  const filteredStudents = students.filter(st => {
    const inst = (st.instrument || '').toLowerCase();
    if (selectedSection === 'woodwinds') {
      return inst.includes('flute') || inst.includes('clarinet') || inst.includes('oboe') || inst.includes('sax');
    }
    if (selectedSection === 'brass') {
      return inst.includes('trumpet') || inst.includes('horn') || inst.includes('trombone') || inst.includes('tuba') || inst.includes('euph');
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f5f5f7] overflow-y-auto select-none p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Ensemble Roster & Student Profiles
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            NUS Wind Symphony roster, individual assignment tracking, and recorded student rehearsal submissions.
          </p>
        </div>

        {/* Section Filter */}
        <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-1 shadow-2xs text-xs font-semibold text-slate-600 self-start">
          {[
            { id: 'all', label: `All (${students.length})` },
            { id: 'woodwinds', label: 'Woodwinds' },
            { id: 'brass', label: 'Brass' },
          ].map(sec => (
            <button
              key={sec.id}
              onClick={() => setSelectedSection(sec.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                selectedSection === sec.id ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredStudents.map(student => {
          const studentExercises = exercises.filter(e => e.studentId === student.id);
          const studentSubmissions = submissions.filter(s => s.studentId === student.id);
          const latestEx = studentExercises[0];

          return (
            <div
              key={student.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header: Name, Instrument, Grade */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        {student.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mt-0.5">
                        <Music className="w-3 h-3" />
                        <span>{student.instrument}</span>
                        {student.grade && (
                          <span className="text-slate-400 font-normal">· {student.grade}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <a
                    href={`/student.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Open Student Companion in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-center">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Assigned Plans
                    </div>
                    <div className="text-sm font-black text-slate-800 mt-0.5">
                      {studentExercises.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Submissions
                    </div>
                    <div className="text-sm font-black text-emerald-600 mt-0.5">
                      {studentSubmissions.length}
                    </div>
                  </div>
                </div>

                {/* Latest Assignment */}
                <div className="text-xs space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">
                    Current Assignment:
                  </div>
                  {latestEx ? (
                    <div className="p-2 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-slate-800 font-medium leading-snug">
                      <div className="font-bold text-blue-900 truncate">
                        {latestEx.title}
                      </div>
                      <div className="text-[11px] text-blue-600 mt-0.5">
                        Bars {latestEx.section.startMeasure}–{latestEx.section.endMeasure}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs italic">
                      No active assignments.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
                <button
                  onClick={() => onLaunchStudentPortal(student, latestEx)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  title="Launch interactive student practice session as this musician"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Practice as {student.name.split(' ')[0]}</span>
                </button>

                <button
                  onClick={() => onViewStudentSubmissions(student.id)}
                  className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                  title="View recorded takes & teacher feedback for this student"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
