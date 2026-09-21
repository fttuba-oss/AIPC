import React, { useState, useMemo } from 'react';
import {
  Users, User, Folder, Video, Mic, Clock, CheckCircle2,
  MessageSquare, ArrowLeft
} from 'lucide-react';
import {
  getAllPracticeSessions,
  formatDuration,
  MOCK_STUDENTS,
  type PracticeSession,
  type RecordedTake
} from '../utils/studentRecordingManager';

interface StudentSubmissionsHubProps {
  onBack: () => void;
}

export const StudentSubmissionsHub: React.FC<StudentSubmissionsHubProps> = ({ onBack }) => {
  const [sessions] = useState<PracticeSession[]>(() => getAllPracticeSessions());
  
  // 1. Group sessions by Student
  const studentMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; instrument: string; sessions: PracticeSession[]; totalSeconds: number }>();

    // Register known roster students first
    MOCK_STUDENTS.forEach(st => {
      map.set(st.id, {
        id: st.id,
        name: st.name,
        instrument: st.instrument,
        sessions: [],
        totalSeconds: 0,
      });
    });

    // Populate with sessions
    sessions.forEach(sess => {
      const sId = sess.studentId || 'stud_alex';
      const sName = sess.studentName || 'Alex Morgan';
      if (!map.has(sId)) {
        map.set(sId, {
          id: sId,
          name: sName,
          instrument: sess.instrumentName || 'Brass',
          sessions: [],
          totalSeconds: 0,
        });
      }
      const studentEntry = map.get(sId)!;
      studentEntry.sessions.push(sess);
      studentEntry.totalSeconds += sess.totalPracticeSeconds;
    });

    return Array.from(map.values());
  }, [sessions]);

  // Selected Student
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    studentMap.length > 0 ? studentMap[0].id : 'stud_alex'
  );

  const activeStudent = studentMap.find(s => s.id === selectedStudentId) || studentMap[0];

  // Selected Session for the active student
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Active student's sessions
  const studentSessions = activeStudent ? activeStudent.sessions : [];

  // Default to first session of active student if none explicitly selected
  const activeSession = studentSessions.find(s => s.sessionId === selectedSessionId) || (studentSessions.length > 0 ? studentSessions[0] : null);

  // Selected Section
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const sectionLogs = activeSession ? Object.values(activeSession.sections) : [];
  const activeSectionLog = sectionLogs.find(sec => sec.sectionId === selectedSectionId) || (sectionLogs.length > 0 ? sectionLogs[0] : null);

  // Active Take for playback
  const [activeTake, setActiveTake] = useState<RecordedTake | null>(null);

  // Current take to display (either user-selected or the latest take of the active section)
  const currentTake = activeTake || (activeSectionLog && activeSectionLog.takes.length > 0 ? activeSectionLog.takes[activeSectionLog.takes.length - 1] : null);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">
      {/* ------------------------------------------------------------------ */}
      {/* Header Bar */}
      {/* ------------------------------------------------------------------ */}
      <header className="px-6 py-3.5 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-700 transition-all active:scale-95 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Teacher Portal</span>
          </button>
          <div className="h-5 w-px bg-slate-300 dark:bg-slate-700" />
          <div>
            <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>📥</span>
              <span>Student Practice Submissions</span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Organized by Student ➔ Practice Session ➔ Section Practiced ➔ Time Taken & Takes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-600" />
            <span>{studentMap.length} Students in Roster</span>
          </span>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Multi-Column Hierarchical Browser */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================================================================ */}
        {/* LEVEL 1: STUDENTS LIST (Organized by Student) */}
        {/* ================================================================ */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-500" />
              <span>Students</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">{studentMap.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {studentMap.map(student => {
              const isSelected = student.id === selectedStudentId;

              return (
                <button
                  key={student.id}
                  onClick={() => {
                    setSelectedStudentId(student.id);
                    setSelectedSessionId(null);
                    setSelectedSectionId(null);
                    setActiveTake(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 dark:bg-amber-500/25 border-amber-400 dark:border-amber-500 text-amber-950 dark:text-amber-200 shadow-sm ring-1 ring-amber-400/40'
                      : 'bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      isSelected
                        ? 'bg-amber-500 text-amber-950'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate text-slate-900 dark:text-white">
                        {student.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {student.instrument}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px]">
                      {student.sessions.length} session{student.sessions.length === 1 ? '' : 's'}
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                      {formatDuration(student.totalSeconds)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* LEVEL 2: SESSIONS & SECTIONS FOR SELECTED STUDENT */}
        {/* ================================================================ */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-sky-500" />
              <span>Practice Sessions</span>
            </span>
            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 truncate max-w-[120px]">
              {activeStudent?.name}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {studentSessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No sessions submitted yet by this student.
              </div>
            ) : (
              studentSessions.map(sess => {
                const isSessionSelected = (activeSession?.sessionId === sess.sessionId);
                const sSections = Object.values(sess.sections);

                return (
                  <div
                    key={sess.sessionId}
                    className={`rounded-xl border overflow-hidden transition-all ${
                      isSessionSelected
                        ? 'border-sky-400 dark:border-sky-600 bg-white dark:bg-slate-850 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60'
                    }`}
                  >
                    {/* Session Header Card */}
                    <div
                      onClick={() => {
                        setSelectedSessionId(sess.sessionId);
                        setSelectedSectionId(null);
                        setActiveTake(null);
                      }}
                      className="p-3 cursor-pointer hover:bg-sky-50/50 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {sess.pieceName}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400">
                          {formatDuration(sess.totalPracticeSeconds)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {sess.title}
                      </div>
                    </div>

                    {/* Nested Sections Practiced */}
                    <div className="p-2 space-y-1.5 bg-slate-50/70 dark:bg-slate-900/50">
                      {sSections.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic px-2 py-1">No section log details</p>
                      ) : (
                        sSections.map(sec => {
                          const isSecSelected = activeSectionLog?.sectionId === sec.sectionId && isSessionSelected;

                          return (
                            <button
                              key={sec.sectionId}
                              onClick={() => {
                                setSelectedSessionId(sess.sessionId);
                                setSelectedSectionId(sec.sectionId);
                                setActiveTake(sec.takes.length > 0 ? sec.takes[sec.takes.length - 1] : null);
                              }}
                              className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                                isSecSelected
                                  ? 'bg-amber-500/20 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200 font-bold shadow-xs'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-bold truncate">{sec.sectionName}</span>
                                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">
                                  Bars {sec.measureRange[0]}–{sec.measureRange[1]}
                                </span>
                              </div>

                              {/* Time Taken Badge */}
                              <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-700 text-[11px]">
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  <span>Time Taken:</span>
                                </span>
                                <span className="font-mono font-black text-amber-700 dark:text-amber-400">
                                  {formatDuration(sec.timeSpentSeconds)}
                                </span>
                              </div>

                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                <span>{sec.takes.length} Take{sec.takes.length === 1 ? '' : 's'}</span>
                                {sec.submittedAt && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Submitted</span>
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* LEVEL 3: SECTION DETAIL, TAKES & AUDIO/VIDEO MEDIA PLAYER */}
        {/* ================================================================ */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white dark:bg-slate-900">
          {!activeSectionLog ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
              <User className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                Select a Student and Section to review recorded takes and time taken.
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Each student's submitted takes, practicing stopwatch time, and musical progress are logged here.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-6">
              {/* Top Banner: Student & Section Overview */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded-md">
                      {activeStudent.name} ({activeStudent.instrument})
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-bold text-slate-500">
                      {activeSession?.pieceName}
                    </span>
                  </div>

                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {activeSectionLog.sectionName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Bars {activeSectionLog.measureRange[0]}–{activeSectionLog.measureRange[1]} • Last practiced {new Date(activeSectionLog.lastPracticedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Big Time Taken Highlight */}
                <div className="bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-950/60 dark:to-orange-950/60 border-2 border-amber-400 dark:border-amber-600 rounded-2xl px-5 py-2.5 flex items-center gap-3 shadow-xs">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Active Practice Time Taken
                    </div>
                    <div className="text-xl font-mono font-black text-amber-950 dark:text-amber-200">
                      {formatDuration(activeSectionLog.timeSpentSeconds)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recorded Takes Selection */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <span>Recorded Takes</span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded font-mono">
                    {activeSectionLog.takes.length}
                  </span>
                </h3>

                {activeSectionLog.takes.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No recorded takes submitted for this section.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {activeSectionLog.takes.map(take => {
                      const isTakeActive = currentTake?.id === take.id;
                      return (
                        <button
                          key={take.id}
                          onClick={() => setActiveTake(take)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isTakeActive
                              ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 shadow-xs ring-1 ring-amber-400'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {take.mode === 'video' ? (
                                <Video className="w-4 h-4 text-rose-500" />
                              ) : (
                                <Mic className="w-4 h-4 text-sky-500" />
                              )}
                              <span className="font-bold text-xs">Take #{take.takeNumber}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 font-bold">
                              {take.durationSeconds}s
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Recorded at ♩ = {take.tempoUsed} BPM
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Take Player & Teacher Feedback */}
              {currentTake && (
                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>🎬</span>
                      <span>Reviewing Take #{currentTake.takeNumber} ({currentTake.mode.toUpperCase()})</span>
                    </h4>
                    <span className="text-xs font-mono text-slate-500 font-bold">
                      Duration: {currentTake.durationSeconds}s
                    </span>
                  </div>

                  {/* Player Container */}
                  <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[220px]">
                    {currentTake.blobUrl ? (
                      currentTake.mode === 'video' ? (
                        <video
                          src={currentTake.blobUrl}
                          controls
                          className="w-full max-h-72 object-contain"
                        />
                      ) : (
                        <div className="w-full p-6 flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                            <Mic className="w-8 h-8" />
                          </div>
                          <audio src={currentTake.blobUrl} controls className="w-full max-w-md" />
                        </div>
                      )
                    ) : (
                      /* Demo / Seed Take placeholder representation */
                      <div className="w-full p-8 flex flex-col items-center justify-center text-center text-slate-300">
                        <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                          {currentTake.mode === 'video' ? <Video className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                        </div>
                        <p className="text-sm font-bold text-white mb-1">
                          Take #{currentTake.takeNumber} ({currentTake.mode.toUpperCase()})
                        </p>
                        <p className="text-xs text-slate-400 max-w-xs">
                          Duration: {currentTake.durationSeconds}s • Recorded at ♩ = {currentTake.tempoUsed} BPM
                        </p>
                        <span className="mt-3 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[11px] font-bold">
                          ✓ Audio/Video Analyzed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Teacher Feedback Note Box */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                      <span>Teacher Feedback for {activeStudent.name}'s Next Lesson:</span>
                    </label>
                    <textarea
                      rows={2}
                      defaultValue="Great breath control on the opening fanfare! Keep your embouchure firm through the triplet in Bar 2."
                      className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      placeholder="Add observations or practice directives for the student..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
