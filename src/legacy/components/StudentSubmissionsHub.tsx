import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, User, Folder, Video, Mic, Clock, CheckCircle2,
  MessageSquare, ArrowLeft, RefreshCw, Sparkles, Check
} from 'lucide-react';
import {
  getAllPracticeSessions,
  formatDuration,
  MOCK_STUDENTS,
  fetchSubmissionsFromStorage,
  fetchStudentsFromStorage,
  updateSubmissionFeedbackInStorage,
  type PracticeSession,
  type RecordedTake
} from '../utils/studentRecordingManager';
import type { StoredSubmission, StudentProfile } from '../../contracts/portal';

interface StudentSubmissionsHubProps {
  onBack: () => void;
}

export const StudentSubmissionsHub: React.FC<StudentSubmissionsHubProps> = ({ onBack }) => {
  const [localSessions, setLocalSessions] = useState<PracticeSession[]>(() => getAllPracticeSessions());
  const [storedSubmissions, setStoredSubmissions] = useState<StoredSubmission[]>([]);
  const [studentsRoster, setStudentsRoster] = useState<StudentProfile[]>(MOCK_STUDENTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [teacherFeedbackText, setTeacherFeedbackText] = useState<string>('');
  const [feedbackSaved, setFeedbackSaved] = useState<boolean>(false);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [subs, roster] = await Promise.all([
        fetchSubmissionsFromStorage(),
        fetchStudentsFromStorage()
      ]);
      if (subs) setStoredSubmissions(subs);
      if (roster && roster.length > 0) setStudentsRoster(roster);
    } catch (err) {
      console.error('Failed to load storage submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Combine stored submissions into practice session objects
  const allSessions = useMemo(() => {
    const combined: PracticeSession[] = [...localSessions];

    storedSubmissions.forEach(sub => {
      const existing = combined.find(s => s.sessionId === sub.sessionId || s.sessionId === sub.id);
      if (!existing) {
        combined.unshift({
          sessionId: sub.sessionId || sub.id,
          studentId: sub.studentId,
          studentName: sub.studentName,
          title: `${sub.pieceName} - ${new Date(sub.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
          pieceName: sub.pieceName,
          instrumentName: sub.instrumentName,
          startedAt: sub.submittedAt,
          totalPracticeSeconds: sub.timeSpentSeconds,
          isSubmitted: true,
          sections: {
            [sub.sectionId]: {
              sectionId: sub.sectionId,
              sectionName: sub.sectionName,
              measureRange: sub.measureRange,
              timeSpentSeconds: sub.timeSpentSeconds,
              submittedAt: sub.submittedAt,
              lastPracticedAt: sub.submittedAt,
              takes: sub.takes.map(t => ({
                id: t.id,
                takeNumber: t.takeNumber,
                timestamp: t.timestamp,
                mode: t.mode,
                blobUrl: t.mediaFile,
                blobSize: 0,
                mimeType: t.mode === 'video' ? 'video/webm' : 'audio/webm',
                durationSeconds: t.durationSeconds,
                tempoUsed: t.tempoUsed,
                selfRating: t.selfRating
              }))
            }
          }
        });
      }
    });

    return combined;
  }, [localSessions, storedSubmissions]);

  // 1. Group sessions by Student
  const studentMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; instrument: string; sessions: PracticeSession[]; totalSeconds: number }>();

    // Register known roster students first
    studentsRoster.forEach(st => {
      map.set(st.id, {
        id: st.id,
        name: st.name,
        instrument: st.instrument,
        sessions: [],
        totalSeconds: 0,
      });
    });

    // Populate with sessions
    allSessions.forEach(sess => {
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
  }, [allSessions, studentsRoster]);

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

  // Find corresponding stored submission with diagnostic telemetry
  const matchingStoredSub = useMemo(() => {
    if (!activeSession) return null;
    return storedSubmissions.find(s => s.sessionId === activeSession.sessionId || s.id === activeSession.sessionId) || null;
  }, [activeSession, storedSubmissions]);

  useEffect(() => {
    if (matchingStoredSub) {
      setTeacherFeedbackText(matchingStoredSub.teacherFeedback || '');
    } else {
      setTeacherFeedbackText('');
    }
  }, [matchingStoredSub?.id]);

  const handleSaveFeedback = async () => {
    if (!matchingStoredSub) return;
    setFeedbackSaved(false);
    const updated = await updateSubmissionFeedbackInStorage(matchingStoredSub.id, teacherFeedbackText);
    if (updated) {
      setFeedbackSaved(true);
      setTimeout(() => setFeedbackSaved(false), 3000);
    }
  };

  // Active Take for playback
  const [activeTake, setActiveTake] = useState<RecordedTake | null>(null);

  // Current take to display (either user-selected or the latest take of the active section)
  const currentTake = activeTake || (activeSectionLog && activeSectionLog.takes.length > 0 ? activeSectionLog.takes[activeSectionLog.takes.length - 1] : null);

  return (
    <div className="aipc-recordings flex flex-col h-full w-full min-h-0 min-w-0 bg-slate-50  overflow-hidden select-none">
      {/* ------------------------------------------------------------------ */}
      {/* Header Bar */}
      {/* ------------------------------------------------------------------ */}
      <header className="aipc-recordings-header px-6 py-3.5 bg-white  border-b border-slate-200  flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200   font-semibold text-sm rounded-xl border border-slate-300  transition-all active:scale-95 text-slate-800  cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Close</span>
          </button>
          <div className="h-5 w-px bg-slate-300 " />
          <div>
            <h1 className="text-base md:text-lg font-semibold text-slate-900  flex items-center gap-2">
              
              <span>Recordings</span>
            </h1>
            <p className="text-sm text-slate-500 ">
              Choose a student and passage to review their practice.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200   text-slate-700  text-sm font-semibold rounded-xl border border-slate-300  transition-all cursor-pointer"
            title="Refresh submissions from shared storage"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <span className="text-sm font-semibold bg-slate-100  text-blue-700  px-3 py-1.5 rounded-xl border border-slate-200  flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>{studentMap.length} students</span>
          </span>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Multi-Column Hierarchical Browser */}
      {/* ------------------------------------------------------------------ */}
      <div className="aipc-recordings-layout flex-1 min-h-0">
        {/* ================================================================ */}
        {/* LEVEL 1: STUDENTS LIST (Organized by Student) */}
        {/* ================================================================ */}
        <div className="aipc-recordings-students min-w-0 border-r border-slate-200  bg-white/80  flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200  text-sm font-semibold text-slate-500   flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Students</span>
            </span>
            <span className="text-sm font-mono text-slate-500">{studentMap.length}</span>
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
                      ? 'bg-blue-50  border-blue-200  text-blue-700  shadow-sm ring-1 ring-blue-200'
                      : 'bg-white  hover:bg-slate-100  border-slate-200  text-slate-800 '
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                      isSelected
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-200  text-slate-700 '
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate text-slate-900 ">
                        {student.name}
                      </div>
                      <div className="text-sm text-slate-500 truncate">
                        {student.instrument}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100 ">
                    <span className="text-slate-500 text-sm">
                      {student.sessions.length} session{student.sessions.length === 1 ? '' : 's'}
                    </span>
                    <span className="font-mono font-semibold text-blue-600  text-sm">
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
        <div className="aipc-recordings-sessions min-w-0 border-r border-slate-200  bg-white/40  flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200  text-sm font-semibold text-slate-500   flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-slate-500" />
              <span>Practice Sessions</span>
            </span>
            <span className="text-sm font-semibold text-slate-600  truncate max-w-[120px]">
              {activeStudent?.name}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {studentSessions.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
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
                        ? 'border-sky-400  bg-white  shadow-sm'
                        : 'border-slate-200  bg-slate-50 '
                    }`}
                  >
                    {/* Session Header Card */}
                    <div
                      onClick={() => {
                        setSelectedSessionId(sess.sessionId);
                        setSelectedSectionId(null);
                        setActiveTake(null);
                      }}
                      className="p-3 cursor-pointer hover:bg-sky-50/50  transition-colors border-b border-slate-100 "
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-slate-900  truncate">
                          {sess.pieceName}
                        </span>
                        <span className="text-sm font-mono font-semibold text-slate-600 ">
                          {formatDuration(sess.totalPracticeSeconds)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500">
                        {sess.title}
                      </div>
                    </div>

                    {/* Nested Sections Practiced */}
                    <div className="p-2 space-y-1.5 bg-slate-50/70 ">
                      {sSections.length === 0 ? (
                        <p className="text-sm text-slate-500 italic px-2 py-1">No section log details</p>
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
                                  ? 'bg-blue-50 border-blue-200  text-blue-700  font-semibold shadow-xs'
                                  : 'bg-white  border-slate-200  text-slate-700  hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-semibold min-w-0 break-words">{sec.sectionName}</span>
                                
                              </div>

                              {/* Time Taken Badge */}
                              <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100  text-sm">
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-blue-600" />
                                  <span>Practice:</span>
                                </span>
                                <span className="font-mono font-semibold text-slate-600 ">
                                  {formatDuration(sec.timeSpentSeconds)}
                                </span>
                              </div>

                              <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
                                <span>{sec.takes.length} Take{sec.takes.length === 1 ? '' : 's'}</span>
                                {sec.submittedAt && (
                                  <span className="text-emerald-600  font-semibold flex items-center gap-0.5">
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
        <div className="aipc-recordings-detail min-w-0 min-h-0 flex flex-col p-6 overflow-y-auto bg-white ">
          {!activeSectionLog ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center">
              <User className="w-12 h-12 text-slate-300  mb-2" />
              <p className="font-semibold text-sm text-slate-600 ">
                Select a passage to review
              </p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Choose a student, then a practice session and passage.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-6">
              {/* Top Banner: Student & Section Overview */}
              <div className="flex flex-wrap gap-4 items-center justify-between pb-4 border-b border-slate-200 ">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold bg-slate-100 text-blue-700   px-2 py-0.5 rounded-md">
                      {activeStudent.name} ({activeStudent.instrument})
                    </span>
                    <span className="text-sm text-slate-500">•</span>
                    <span className="text-sm font-semibold text-slate-500">
                      {activeSession?.pieceName}
                    </span>
                  </div>

                  <h2 className="text-xl font-semibold text-slate-900 ">
                    {activeSectionLog.sectionName}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Bars {activeSectionLog.measureRange[0]}–{activeSectionLog.measureRange[1]} • Last practiced {new Date(activeSectionLog.lastPracticedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Big Time Taken Highlight */}
                <div className="bg-slate-50 border border-slate-200  rounded-2xl px-5 py-2.5 flex items-center gap-3 shadow-xs">
                  <Clock className="w-6 h-6 text-blue-600  shrink-0" />
                  <div>
                    <div className="text-sm font-semibold  text-slate-600 ">
                      Practice time
                    </div>
                    <div className="text-xl font-mono font-semibold text-blue-700 ">
                      {formatDuration(activeSectionLog.timeSpentSeconds)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Diagnostic Assessment Card (if submitted with diagnostic results) */}
              {matchingStoredSub?.diagnosticResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex items-center gap-2">
                      
                      <h4 className="font-semibold text-base text-slate-900">Rhythm assessment</h4>
                      {matchingStoredSub.exerciseId && (
                        <span className="text-sm font-mono text-slate-600 bg-white px-2 py-0.5 rounded">
                          Exercise: {matchingStoredSub.exerciseId}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
                      matchingStoredSub.diagnosticResult.overallAccuracyPercent >= 85 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/40' 
                        : matchingStoredSub.diagnosticResult.overallAccuracyPercent >= 70
                        ? 'bg-blue-50 text-amber-800 border border-blue-300/40'
                        : 'bg-rose-50 text-rose-700 border border-rose-500/40'
                    }`}>
                      {matchingStoredSub.diagnosticResult.overallAccuracyPercent}% Rhythm Accuracy
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">
                    {matchingStoredSub.diagnosticResult.summaryText}
                  </p>

                  <div className="flex flex-wrap gap-2 text-sm pt-1">
                    {matchingStoredSub.diagnosticResult.problemMeasureNumbers?.length > 0 ? (
                      <span className="bg-rose-50 text-rose-700 border border-rose-500/30 px-2.5 py-0.5 rounded-lg font-mono font-semibold">
                        Bars to review: {matchingStoredSub.diagnosticResult.problemMeasureNumbers.join(', ')}
                      </span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg font-mono font-semibold">
                        ✓ Metronome Sync Stable Across All Bars
                      </span>
                    )}
                    <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-lg font-mono">
                      Rushed Notes: {matchingStoredSub.diagnosticResult.rushedCount}
                    </span>
                    <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-lg font-mono">
                      Dragged Notes: {matchingStoredSub.diagnosticResult.draggedCount}
                    </span>
                    <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-lg font-mono">
                      Stable Notes: {matchingStoredSub.diagnosticResult.stableCount}
                    </span>
                  </div>
                </div>
              )}

              {/* Recorded Takes Selection */}
              <div>
                <h3 className="font-semibold text-sm  text-slate-500  mb-3 flex items-center gap-1.5">
                  <span>Recorded Takes</span>
                  <span className="text-sm bg-slate-200  px-1.5 py-0.2 rounded font-mono">
                    {activeSectionLog.takes.length}
                  </span>
                </h3>

                {activeSectionLog.takes.length === 0 ? (
                  <div className="p-6 bg-slate-50  rounded-2xl border border-slate-200  text-center text-sm text-slate-500">
                    No recorded takes submitted for this section.
                  </div>
                ) : (
                  <div className="aipc-takes-grid grid gap-3 mb-4">
                    {activeSectionLog.takes.map(take => {
                      const isTakeActive = currentTake?.id === take.id;
                      return (
                        <button
                          key={take.id}
                          aria-pressed={isTakeActive}
                          onClick={() => setActiveTake(take)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isTakeActive
                              ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs ring-1 ring-blue-200'
                              : 'bg-white  border-slate-200  hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {take.mode === 'video' ? (
                                <Video className="w-4 h-4 text-rose-500" />
                              ) : (
                                <Mic className="w-4 h-4 text-slate-500" />
                              )}
                              <span className="font-semibold text-sm">Take #{take.takeNumber}</span>
                            </div>
                            <span className="text-sm font-mono text-slate-500 font-semibold">
                              {take.durationSeconds}s
                            </span>
                          </div>
                          <div className="text-sm text-slate-500">
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
                <div className="bg-slate-50  rounded-2xl border border-slate-200  p-5 space-y-4 shadow-sm">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <h4 className="font-semibold text-sm text-slate-900  flex items-center gap-2">
                      
                      <span>Reviewing Take #{currentTake.takeNumber} ({currentTake.mode.toUpperCase()})</span>
                    </h4>
                    <span className="text-sm font-mono text-slate-500 font-semibold">
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
                          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Mic className="w-8 h-8" />
                          </div>
                          <audio src={currentTake.blobUrl} controls className="w-full max-w-md" />
                        </div>
                      )
                    ) : (
                      /* Demo / Seed Take placeholder representation */
                      <div className="w-full p-8 flex flex-col items-center justify-center text-center text-slate-300">
                        <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                          {currentTake.mode === 'video' ? <Video className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                        </div>
                        <p className="text-sm font-semibold text-white mb-1">
                          Take #{currentTake.takeNumber} ({currentTake.mode.toUpperCase()})
                        </p>
                        <p className="text-sm text-slate-500 max-w-xs">
                          Duration: {currentTake.durationSeconds}s • Recorded at ♩ = {currentTake.tempoUsed} BPM
                        </p>
                        <span className="mt-3 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-500/40 rounded-full text-sm font-semibold">
                          ✓ Audio/Video Analyzed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Teacher Feedback Note Box */}
                  <div className="pt-2 space-y-2">
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700  flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        <span>Feedback for {activeStudent.name}</span>
                      </label>
                      {matchingStoredSub && (
                        <button
                          onClick={handleSaveFeedback}
                          className="flex items-center gap-1.5 px-3 py-1 bg-[#0071e3] hover:bg-[#0062c4] text-white font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          {feedbackSaved ? <Check className="w-3.5 h-3.5" /> : null}
                          <span>{feedbackSaved ? 'Saved' : 'Save feedback'}</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={teacherFeedbackText}
                      onChange={(e) => setTeacherFeedbackText(e.target.value)}
                      aria-label="Teacher feedback" className="w-full p-3 bg-white  rounded-xl border border-slate-200  text-sm text-slate-800  focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder="Add pedagogical observations or directives for the student..."
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
