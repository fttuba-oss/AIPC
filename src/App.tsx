import React, { useState, useEffect, useRef } from 'react';
import { 
  Music, Upload, Calendar, BookOpen, Folder, ChevronDown, 
  ArrowUpRight, Check, X, CheckCircle2, LayoutGrid, RotateCcw, GraduationCap
} from 'lucide-react';
import { ConductorScoreViewer } from './components/ConductorScoreViewer';
import { FloatingWindow, focusPopout } from './components/windows/FloatingWindow';
import { useWindowManager, snapRect, RAIL_W, TOP_H } from './components/windows/useWindowManager';
import type { WinId, SnapZone } from './components/windows/useWindowManager';
import { ExercisesWorkspace } from './components/ExercisesWorkspace';
import { PlanNotesTab } from './components/PlanNotesTab';
import { StudentSubmissionsHub } from './components/StudentSubmissionsHub';
import { ExercisesTab } from './components/ExercisesTab';
import { StudentPracticeView } from './components/StudentPracticeView';
import { SuggestChangesWidget } from './components/SuggestChangesWidget';
import { parseMusicXmlToScore, unpackMusicXml } from './utils/scoreParser';
import type { StudentProfile, StoredExercise, MusicalSection, PracticeArea, LibraryScore } from './types/portal';
import { fetchStudentsFromStorage } from './utils/studentRecordingManager';
import { fetchUploadedScores, uploadScore } from './utils/libraryApi';

/** Built-in sample scores, always available in the library. */
const BUILTIN_SCORES: LibraryScore[] = [
  {
    id: 'danxia',
    title: 'Beautiful Danxia',
    composer: 'Li Wei, 2023',
    xmlPath: '/beautiful_danxia_flutes.musicxml',
    builtin: true,
    uploadedAt: '2000-01-01T00:00:00.000Z',
  },
  {
    id: 'whales',
    title: 'Sailing with Whales',
    composer: 'Rossano Galante',
    xmlPath: '/sailing-with-whales-rossano-galante.mxl',
    builtin: true,
    uploadedAt: '2000-01-02T00:00:00.000Z',
  },
  {
    id: 'neruda',
    title: 'Trumpet Concerto in E-flat',
    composer: 'J.B.G. Neruda',
    xmlPath: '/neruda_trumpet_concerto_excerpt.musicxml',
    builtin: true,
    uploadedAt: '2000-01-03T00:00:00.000Z',
  },
];

const VIEW_OPTIONS: { id: string; label: string }[] = [
  { id: 'full', label: 'Full score' },
  { id: 'flute', label: 'Flute' },
  { id: 'oboe', label: 'Oboe' },
  { id: 'clarinet', label: 'Clarinet' },
  { id: 'saxophone', label: 'Saxophone' },
  { id: 'trumpet', label: 'Trumpet' },
  { id: 'horn', label: 'Horn' },
  { id: 'trombone', label: 'Trombone' },
  { id: 'euphonium_tuba', label: 'Euphonium & Tuba' },
  { id: 'percussion', label: 'Percussion' },
];

export const App: React.FC = () => {
  // Floating window system
  const { wins, popped, setPopped, highlight, toggle, open, close, focus, setRect, toggleShade, toggleMaximize, arrange, resetLayout } = useWindowManager();
  const [snapZone, setSnapZone] = useState<SnapZone>(null);
  const frontId = (Object.keys(wins) as WinId[]).filter(k => wins[k].open).sort((a, b) => wins[b].z - wins[a].z)[0];
  // Exercises tab: exercises per score vs. what has been sent to students
  const [exercisesView, setExercisesView] = useState<'score' | 'sent'>('score');

  // Score library (built-in + uploaded)
  const [uploadedScores, setUploadedScores] = useState<LibraryScore[]>([]);
  const library = [...BUILTIN_SCORES, ...uploadedScores];
  const [selectedScoreId, setSelectedScoreId] = useState<string>('danxia');
  const [isScoreDropdownOpen, setIsScoreDropdownOpen] = useState<boolean>(false);
  const activeScore = library.find(s => s.id === selectedScoreId) || library[0];

  // Score Content & View Filter
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [xmlScoreId, setXmlScoreId] = useState<string | null>(null);
  const [scoreViewMode, setScoreViewMode] = useState<string>('full');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Passage Selection Range (bars selected on the score)
  const [passageRange, setPassageRange] = useState<[number, number]>([1, 2]);

  // Student Roster (distribution list from the parent platform)
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-App Student Practice Mode Preview
  const [activePracticeExercise, setActivePracticeExercise] = useState<StoredExercise | null>(null);
  const [practiceXmlContent, setPracticeXmlContent] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load uploaded scores + roster
  useEffect(() => {
    fetchUploadedScores().then(setUploadedScores).catch(err => console.error('Failed to load score library:', err));
    fetchStudentsFromStorage().then(roster => {
      if (roster && roster.length > 0) setStudents(roster);
    });
  }, []);

  // Load the XML for the selected score
  useEffect(() => {
    if (!activeScore) return;
    let cancelled = false;
    setXmlContent(null);
    setXmlScoreId(null);
    (async () => {
      try {
        const resp = await fetch(activeScore.xmlPath);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await unpackMusicXml(await resp.arrayBuffer());
        if (!cancelled) {
          setXmlContent(text);
          setXmlScoreId(activeScore.id);
        }
      } catch (err: any) {
        console.error('Failed to load score XML:', err);
        if (!cancelled) showToast(`Could not load "${activeScore.title}"`);
      }
    })();
    return () => { cancelled = true; };
  }, [activeScore?.id, activeScore?.xmlPath]);

  // Upload a score (one file at a time; repeat for more)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow uploading the same file again
    if (!file) return;

    setIsUploading(true);
    try {
      const xml = file.name.toLowerCase().endsWith('.mxl')
        ? await unpackMusicXml(await file.arrayBuffer())
        : await file.text();
      let title = file.name.replace(/\.[^.]+$/, '');
      let composer: string | undefined;
      try {
        const parsed = parseMusicXmlToScore(xml);
        if (parsed.title && parsed.title !== 'Untitled Piece') title = parsed.title;
        composer = parsed.composer;
      } catch {
        throw new Error('That file is not a valid MusicXML score.');
      }
      const saved = await uploadScore({ title, composer, fileName: file.name, xml });
      setUploadedScores(prev => [...prev, saved]);
      setSelectedScoreId(saved.id);
      open('exercises');
      setExercisesView('score');
      showToast(`Score "${title}" uploaded. Suggested exercises are ready.`);
    } catch (err: any) {
      console.error('Failed to upload file:', err);
      showToast(err?.message || 'Failed to upload score.');
    } finally {
      setIsUploading(false);
    }
  };

  // Launch In-App Student Practice Session
  const handleLaunchPractice = async (exercise: StoredExercise) => {
    try {
      let xml = xmlContent;
      if (exercise.scorePath !== activeScore.xmlPath) {
        const res = await fetch(exercise.scorePath);
        if (res.ok) {
          xml = await unpackMusicXml(await res.arrayBuffer());
        }
      }
      setPracticeXmlContent(xml);
      setActivePracticeExercise(exercise);
    } catch (e) {
      console.error('Failed to launch student practice view:', e);
    }
  };

  // If in-app student practice preview is active
  if (activePracticeExercise) {
    const sec = activePracticeExercise.section;
    const challenges: PracticeArea[] = (sec.goals || []).map((g, idx) => ({
      id: g.areaId || `goal_${idx}_${Date.now()}`,
      category: (g.category as any) || 'custom',
      startMeasure: g.startMeasure,
      endMeasure: g.endMeasure,
      detectedReason: g.teacherNote || g.goal,
      defaultGoal: g.goal,
      status: 'accepted',
      teacherGoal: g.goal,
      teacherNote: g.teacherNote || '',
      targetTempo: g.targetTempo,
    }));

    const activeSectionObj: MusicalSection = {
      id: sec.id || `sec_${sec.sectionNumber}`,
      sectionNumber: sec.sectionNumber,
      title: sec.title || `Section ${sec.sectionNumber} (Bars ${sec.startMeasure}–${sec.endMeasure})`,
      startMeasure: sec.startMeasure,
      endMeasure: sec.endMeasure,
      totalMeasures: sec.endMeasure - sec.startMeasure + 1,
      challenges,
      status: 'all_approved'
    };

    return (
      <StudentPracticeView
        xmlUrl={activePracticeExercise.scorePath}
        xmlContent={practiceXmlContent}
        pieceTitle={activePracticeExercise.scoreTitle}
        instrumentName={activePracticeExercise.instrumentName}
        sectionId={activeSectionObj.id}
        sectionTitle={activeSectionObj.title}
        measureRange={[activeSectionObj.startMeasure, activeSectionObj.endMeasure]}
        sections={[activeSectionObj]}
        activeSection={activeSectionObj}
        exerciseId={activePracticeExercise.id}
        studentId={activePracticeExercise.studentId}
        studentName={activePracticeExercise.studentName}
        onExit={() => setActivePracticeExercise(null)}
        onViewSubmissions={() => {
          setActivePracticeExercise(null);
          open('recordings');
        }}
      />
    );
  }


  const viewLabel = VIEW_OPTIONS.find(o => o.id === scoreViewMode)?.label || 'Full score';

  const WINDOWS: { id: WinId; title: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; key: string }[] = [
    { id: 'exercises', title: 'Exercises', icon: BookOpen, key: '1' },
    { id: 'plans', title: 'Practice plans', icon: Calendar, key: '2' },
    { id: 'recordings', title: 'Shared recordings', icon: Folder, key: '3' },
  ];

  const railClick = (id: WinId) => {
    if (popped[id]) focusPopout(id);
    else toggle(id);
  };

  // Ctrl/⌘ + 1–4 toggles windows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const w = WINDOWS.find(x => x.key === e.key);
      if (!w) return;
      e.preventDefault();
      railClick(w.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const renderWindowBody = (id: WinId) => {
    switch (id) {
      case 'exercises':
        return (
          <div className="flex flex-col h-full min-h-0">
            <div className="px-3 pt-2 pb-1 shrink-0">
              <div className="flex bg-slate-100 rounded-lg p-0.5 text-[11px] font-semibold text-slate-600">
                {([['score', 'Score exercises'], ['sent', 'Sent to students']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setExercisesView(k)}
                    className={`flex-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      exercisesView === k ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {exercisesView === 'score' ? (
                <ExercisesWorkspace
                  score={activeScore}
                  xmlContent={xmlScoreId === activeScore.id ? xmlContent : null}
                  students={students}
                  passageRange={passageRange}
                  onPassageChange={setPassageRange}
                  onToast={showToast}
                />
              ) : (
                <ExercisesTab
                  onLaunchPractice={(ex) => handleLaunchPractice(ex)}
                  onViewSubmissions={() => open('recordings')}
                  onOpenScoreForExercise={(path, range) => {
                    const match = library.find(s => s.xmlPath === path);
                    if (match) setSelectedScoreId(match.id);
                    setPassageRange(range);
                    setExercisesView('score');
                  }}
                />
              )}
            </div>
          </div>
        );
      case 'plans':
        return <PlanNotesTab scores={library} onToast={showToast} />;
      case 'recordings':
        return (
          <div className="h-full min-h-0 overflow-hidden">
            <StudentSubmissionsHub onBack={() => close('recordings')} />
          </div>
        );
    }
  };

  const snap = snapZone ? snapRect(snapZone) : null;

  return (
    <div className="h-screen w-screen bg-[#f5f5f7] text-slate-900 overflow-hidden font-sans select-none relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".musicxml,.xml,.mxl"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Canvas: the full score gets all the space */}
      <main className="absolute inset-0" style={{ left: RAIL_W, top: TOP_H }}>
        {xmlContent && xmlScoreId === activeScore.id ? (
          <ConductorScoreViewer
            scoreTitle={activeScore.title}
            xmlContent={xmlContent}
            scoreViewMode={scoreViewMode}
            passageRange={passageRange}
            onPassageChange={setPassageRange}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading score…</div>
        )}
      </main>

      {/* Left rail */}
      <aside
        className="absolute left-0 top-0 bottom-0 z-40 flex flex-col items-center py-3 gap-1 bg-white/70 backdrop-blur-xl border-r border-black/5"
        style={{ width: RAIL_W }}
      >
        <div className="h-9 flex items-end gap-[3px] pb-2 mb-2">
          {[10, 18, 14, 7].map((h, i) => (
            <span key={i} className="w-[3px] rounded-full bg-[#0071e3]" style={{ height: h }} />
          ))}
        </div>
        {WINDOWS.map(w => {
          const Icon = w.icon;
          const isOpen = wins[w.id].open || popped[w.id];
          return (
            <button
              key={w.id}
              onClick={() => railClick(w.id)}
              aria-label={w.title}
              className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isOpen ? 'bg-[#0071e3]/10 text-[#0071e3]' : 'text-slate-500 hover:bg-black/5 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={1.75} />
              {isOpen && <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#0071e3]" />}
              {popped[w.id] && <ArrowUpRight className="absolute right-1 top-1 w-2.5 h-2.5" />}
              <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {w.title} <span className="text-slate-400 ml-1">⌘{w.key}</span>
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={arrange}
          aria-label="Tidy windows"
          className="group relative w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-black/5 hover:text-slate-900 transition-all cursor-pointer"
        >
          <LayoutGrid className="w-5 h-5" strokeWidth={1.75} />
          <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
            Tidy windows
          </span>
        </button>
        <button
          onClick={resetLayout}
          aria-label="Reset layout"
          className="group relative w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-black/5 hover:text-slate-900 transition-all cursor-pointer"
        >
          <RotateCcw className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
            Reset layout
          </span>
        </button>
        <a
          href="/student.html"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Student Companion"
          className="group relative w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-black/5 hover:text-slate-900 transition-all"
        >
          <GraduationCap className="w-5 h-5" strokeWidth={1.75} />
          <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
            Student Companion
          </span>
        </a>
      </aside>

      {/* Top toolbar */}
      <header
        className="absolute top-0 right-0 z-30 flex items-center justify-between px-5 bg-white/70 backdrop-blur-xl border-b border-black/5"
        style={{ left: RAIL_W, height: TOP_H }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 truncate">{activeScore.title}</h1>
          {activeScore.composer && (
            <span className="text-xs text-slate-500 truncate hidden md:inline">{activeScore.composer}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View */}
          <div className="relative">
            <button
              onClick={() => { setIsViewDropdownOpen(!isViewDropdownOpen); setIsScoreDropdownOpen(false); }}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-black/5 text-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
            >
              <span>{viewLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {isViewDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-black/5 p-1 z-50 max-h-80 overflow-y-auto">
                {VIEW_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setScoreViewMode(opt.id); setIsViewDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                      scoreViewMode === opt.id ? 'bg-[#0071e3] text-white' : 'text-slate-700 hover:bg-black/5'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {scoreViewMode === opt.id && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scores */}
          <div className="relative">
            <button
              onClick={() => { setIsScoreDropdownOpen(!isScoreDropdownOpen); setIsViewDropdownOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-black/5 text-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
            >
              <Music className="w-3.5 h-3.5 text-slate-400" />
              <span>Scores ({library.length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {isScoreDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-72 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-black/5 p-1.5 z-50 max-h-96 overflow-y-auto">
                {library.map(score => (
                  <button
                    key={score.id}
                    onClick={() => {
                      setSelectedScoreId(score.id);
                      setIsScoreDropdownOpen(false);
                      setExercisesView('score');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                      selectedScoreId === score.id ? 'bg-[#0071e3] text-white' : 'text-slate-700 hover:bg-black/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium leading-tight truncate">{score.title}</div>
                      <div className={`text-[11px] mt-0.5 truncate ${selectedScoreId === score.id ? 'text-white/70' : 'text-slate-400'}`}>
                        {score.composer || score.fileName || 'Uploaded score'}
                      </div>
                    </div>
                    {selectedScoreId === score.id && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0071e3] hover:bg-[#0062c4] disabled:opacity-60 text-white font-medium text-xs rounded-full transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Uploading…' : 'Upload score'}</span>
          </button>
        </div>
      </header>

      {/* Snap preview */}
      {snap && (
        <div
          className="fixed z-[45] rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/40 pointer-events-none transition-all"
          style={{ left: snap.x, top: snap.y, width: snap.w, height: snap.h }}
        />
      )}

      {/* Floating windows */}
      {WINDOWS.map(w => {
        const st = wins[w.id];
        if (!st.open && !popped[w.id]) return null;
        return (
          <FloatingWindow
            key={w.id}
            id={w.id}
            title={w.title}
            state={st}
            isFront={frontId === w.id}
            highlight={highlight === w.id}
            onFocus={() => focus(w.id)}
            onRect={(r) => setRect(w.id, r)}
            onClose={() => close(w.id)}
            onMaximize={() => toggleMaximize(w.id)}
            onShade={() => toggleShade(w.id)}
            onSnapPreview={setSnapZone}
            onPopChange={(p) => setPopped(prev => ({ ...prev, [w.id]: p }))}
            onNotify={showToast}
          >
            {renderWindowBody(w.id)}
          </FloatingWindow>
        );
      })}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900/90 backdrop-blur-xl text-white pl-4 pr-3 py-2.5 rounded-full shadow-xl flex items-center gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <SuggestChangesWidget appMode={'exercises' as any} />
    </div>
  );
};

export default App;
