import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, Music, RefreshCw, AlertCircle, 
  Edit2, Check, RotateCcw, Save
} from 'lucide-react';
import { ScoreViewer } from './components/ScoreViewer';
import { TeacherReviewPanel } from './components/TeacherReviewPanel';
import { AddGoalModal } from './components/AddGoalModal';
import { PracticePlanSummary } from './components/PracticePlanSummary';
import { StudentPracticeView } from './components/StudentPracticeView';
import { StudentSubmissionsHub } from './components/StudentSubmissionsHub';
import { KnowledgeSimulatorView } from './components/KnowledgeSimulatorView';
import { SuggestChangesWidget } from './components/SuggestChangesWidget';
import { 
  ParsedScore, PracticeArea, InstrumentProfile, 
  MusicalSection 
} from './types/portal';
import { INSTRUMENT_PROFILES } from './utils/instrumentProfiles';
import { parseMusicXmlToScore, unpackMusicXml } from './utils/scoreParser';
import { segmentMeasuresIntoSections, extractFlatPracticeAreas } from './utils/scoreAnalyzer';

const STORAGE_KEY = 'aipc_teacher_portal_state_v1';

interface SavedState {
  scoreTitle: string;
  xmlContent: string;
  selectedDemoId: string;
  currentInstrumentId: string;
  selectedPartId: string;
  sections: MusicalSection[];
  selectedSectionId: string | null;
  selectedAreaId: string | null;
  timestamp: number;
}

const DEMO_PIECES = [
  {
    id: 'neruda',
    name: 'Neruda: Concerto in E-flat (Trumpet)',
    path: '/neruda_trumpet_concerto_excerpt.musicxml',
    instrumentId: 'trumpet',
    description: 'Chunked in 4 sections: Section 2 (Bars 6-10) with Rapid Tonguing & Complex Rhythm, plus Leaps'
  },
  {
    id: 'cruelangel',
    name: 'Cruel Angel\'s Thesis (Brass / Ensemble)',
    path: '/cruelangel.musicxml',
    instrumentId: 'trumpet',
    description: 'Dynamic syncopations and running 16th figures'
  },
  {
    id: 'odetojoy',
    name: 'Beethoven: Ode to Joy (Theme)',
    path: '/Ode_To_Joy_Demo.musicxml',
    instrumentId: 'trumpet',
    description: 'Stepwise melodies, even rhythm & clear phrasing'
  },
  {
    id: 'whales',
    name: 'Galante: Sailing with Whales (Trumpet 1)',
    path: '/sailing_with_whales_trumpet1.musicxml',
    instrumentId: 'trumpet',
    description: 'Thematic ostinato groove & High Register Entrance'
  }
];

export const App: React.FC = () => {
  // Application State
  const [selectedDemoId, setSelectedDemoId] = useState<string>('neruda');
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [parsedScore, setParsedScore] = useState<ParsedScore | null>(null);
  const [currentInstrumentId, setCurrentInstrumentId] = useState<string>('trumpet');
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [customScoreTitle, setCustomScoreTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [hasRestoredSession, setHasRestoredSession] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  
  // Sections & Practice Areas
  const [sections, setSections] = useState<MusicalSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<number>(1);

  // App View Mode (Teacher Portal, Student Practice iPad View, Submissions Hub, Knowledge Simulator)
  const [appMode, setAppMode] = useState<'portal' | 'student_practice' | 'submissions' | 'knowledge_simulator'>('portal');
  const [activeStudentSection, setActiveStudentSection] = useState<MusicalSection | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);

  // Status & Loading
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentInstrument = INSTRUMENT_PROFILES[currentInstrumentId] || INSTRUMENT_PROFILES.trumpet;

  // Flattened practice areas derived from sections for ScoreViewer
  const allPracticeAreas = useMemo(() => {
    return extractFlatPracticeAreas(sections);
  }, [sections]);

  // Load selected piece XML
  const loadScoreFromUrl = async (url: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      const text = await resp.text();
      setXmlContent(text);
      processParsedScore(text, currentInstrument);
    } catch (err: any) {
      console.error('Failed to load score:', err);
      setErrorMessage(err.message || 'Failed to fetch score file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Track if initial URL ?view=student auto-launch has already been handled
  const hasAutoLaunchedRef = useRef<boolean>(false);

  // Auto-launch Student Practice Mode if ?view=student or ?mode=student URL query param is provided
  useEffect(() => {
    if (hasAutoLaunchedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if ((params.get('view') === 'student' || params.get('mode') === 'student') && sections.length > 0) {
      hasAutoLaunchedRef.current = true;
      const sec = sections.find(s => s.id === selectedSectionId) || sections[0];
      if (sec) {
        setActiveStudentSection(sec);
        setAppMode('student_practice');
      }
    }
  }, [sections, selectedSectionId]);

  // Clean exit from Student Practice back to Teacher Portal
  const handleExitStudentPractice = () => {
    hasAutoLaunchedRef.current = true;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('view') || url.searchParams.has('mode')) {
        url.searchParams.delete('view');
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    } catch (e) {
      // ignore
    }
    setAppMode('portal');
  };

  // Initial load: restore from localStorage if available
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const saved: SavedState = JSON.parse(savedRaw);
        if (saved && saved.xmlContent && saved.sections) {
          setXmlContent(saved.xmlContent);
          setCustomScoreTitle(saved.scoreTitle);
          setSelectedDemoId(saved.selectedDemoId || 'custom');
          setCurrentInstrumentId(saved.currentInstrumentId || 'trumpet');
          setSelectedPartId(saved.selectedPartId || '');
          setSections(saved.sections);
          setSelectedSectionId(saved.selectedSectionId);
          setSelectedAreaId(saved.selectedAreaId);
          setHasRestoredSession(true);
          setLastSavedTime(new Date(saved.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

          const parsed = parseMusicXmlToScore(saved.xmlContent);
          setParsedScore(parsed);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to restore saved state from localStorage:', err);
    }

    // Default fallback load
    loadScoreFromUrl(DEMO_PIECES[0].path);
  }, []);

  // Auto-save to localStorage whenever state meaningfully changes
  useEffect(() => {
    if (!xmlContent || sections.length === 0) return;

    try {
      const stateToSave: SavedState = {
        scoreTitle: customScoreTitle || parsedScore?.title || 'Practice Piece',
        xmlContent,
        selectedDemoId,
        currentInstrumentId,
        selectedPartId,
        sections,
        selectedSectionId,
        selectedAreaId,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('Auto-save error:', err);
    }
  }, [sections, xmlContent, customScoreTitle, currentInstrumentId, selectedDemoId, selectedPartId, selectedSectionId, selectedAreaId, parsedScore]);

  // Clear saved session and reset to default
  const handleResetSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHasRestoredSession(false);
    setSelectedDemoId('neruda');
    setCurrentInstrumentId('trumpet');
    setCustomScoreTitle('');
    loadScoreFromUrl(DEMO_PIECES[0].path);
  };

  // Process and analyze parsed score
  const processParsedScore = (rawXml: string, instrument: InstrumentProfile, forcedTitle?: string) => {
    try {
      const parsed = parseMusicXmlToScore(rawXml);
      setParsedScore(parsed);
      setSelectedPartId(parsed.selectedPartId);
      if (forcedTitle) {
        setCustomScoreTitle(forcedTitle);
      } else if (!customScoreTitle) {
        setCustomScoreTitle(parsed.title);
      }

      const partToAnalyze = parsed.parts.find(p => p.id === parsed.selectedPartId) || parsed.parts[0];
      if (partToAnalyze) {
        const detectedSections = segmentMeasuresIntoSections(partToAnalyze.measures, instrument);
        setSections(detectedSections);

        if (detectedSections.length > 0) {
          setSelectedSectionId(detectedSections[0].id);
          if (detectedSections[0].challenges.length > 0) {
            setSelectedAreaId(detectedSections[0].challenges[0].id);
          } else {
            setSelectedAreaId(null);
          }
        }
      }
    } catch (err: any) {
      console.error('Error processing score:', err);
      setErrorMessage(err.message || 'Error processing score analysis.');
    }
  };

  // Handle instrument change
  const handleInstrumentChange = (newInstId: string) => {
    setCurrentInstrumentId(newInstId);
    const newInst = INSTRUMENT_PROFILES[newInstId] || INSTRUMENT_PROFILES.trumpet;
    if (parsedScore) {
      const partToAnalyze = parsedScore.parts.find(p => p.id === selectedPartId) || parsedScore.parts[0];
      if (partToAnalyze) {
        const newlyDetectedSections = segmentMeasuresIntoSections(partToAnalyze.measures, newInst);
        setSections(newlyDetectedSections);
      }
    }
  };

  // Handle local file upload (.musicxml, .xml, .mxl)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediately extract a clean name from the file
    const cleanFileName = file.name
      .replace(/\.(musicxml|xml|mxl)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim();

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const unzippedXml = await unpackMusicXml(buffer);
      setXmlContent(unzippedXml);
      setSelectedDemoId('custom');
      processParsedScore(unzippedXml, currentInstrument, cleanFileName);
    } catch (err: any) {
      console.error('File upload error:', err);
      setErrorMessage(err.message || 'Failed to parse uploaded score file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Goal Actions
  const handleAcceptGoal = (areaId: string) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      challenges: sec.challenges.map(c => 
        c.id === areaId ? { ...c, status: 'accepted' } : c
      )
    })));
  };

  const handleAcceptAllInSection = (sectionId: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        challenges: sec.challenges.map(c => 
          c.status === 'removed' ? c : { ...c, status: 'accepted' }
        )
      };
    }));
  };

  const handleEditGoal = (areaId: string, updatedGoal: string, targetTempo?: number, teacherNote?: string) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      challenges: sec.challenges.map(c => 
        c.id === areaId ? { 
          ...c, 
          status: 'edited', 
          teacherGoal: updatedGoal, 
          targetTempo, 
          teacherNote: teacherNote || '' 
        } : c
      )
    })));
  };

  const handleRemoveGoal = (areaId: string) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      challenges: sec.challenges.map(c => 
        c.id === areaId ? { ...c, status: 'removed' } : c
      )
    })));
  };

  const handleRestoreGoal = (areaId: string) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      challenges: sec.challenges.map(c => 
        c.id === areaId ? { ...c, status: 'suggested' } : c
      )
    })));
  };

  const handleAddCustomArea = (newArea: PracticeArea) => {
    let placed = false;
    setSections(prev => prev.map(sec => {
      if (newArea.startMeasure >= sec.startMeasure && newArea.startMeasure <= sec.endMeasure) {
        placed = true;
        return {
          ...sec,
          challenges: [...sec.challenges, newArea]
        };
      }
      return sec;
    }));

    if (!placed && sections.length > 0) {
      setSections(prev => {
        const copy = [...prev];
        copy[copy.length - 1].challenges.push(newArea);
        return copy;
      });
    }

    setSelectedAreaId(newArea.id);
  };

  const handleSelectSection = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    const sec = sections.find(s => s.id === sectionId);
    if (sec && sec.challenges.length > 0) {
      setSelectedAreaId(sec.challenges[0].id);
    }
  };

  const acceptedCount = allPracticeAreas.filter(
    a => a.status === 'accepted' || a.status === 'edited'
  ).length;

  const totalChallengesCount = allPracticeAreas.filter(
    a => a.status !== 'removed'
  ).length;

  const availableParts = parsedScore?.parts.map(p => ({ id: p.id, name: p.name })) || [];
  const maxMeasures = parsedScore?.parts[0]?.measures.length || 100;
  const currentTitle = customScoreTitle || parsedScore?.title || 'Practice Piece';

  // --------------------------------------------------------------------------
  // Conditional Views: Student Practice Mode (iPad) & Submissions Hub
  // --------------------------------------------------------------------------
  if (appMode === 'student_practice' && activeStudentSection) {
    const currentDemo = DEMO_PIECES.find(d => d.id === selectedDemoId);
    return (
      <>
        <StudentPracticeView
          xmlUrl={currentDemo?.path}
          xmlContent={xmlContent}
          pieceTitle={currentTitle}
          instrumentName={currentInstrument.name}
          sectionId={activeStudentSection.id}
          sectionTitle={`Section ${activeStudentSection.sectionNumber}`}
          measureRange={[activeStudentSection.startMeasure, activeStudentSection.endMeasure]}
          sections={sections}
          activeSection={activeStudentSection}
          onSelectSection={(sec) => {
            setActiveStudentSection(sec);
            setSelectedSectionId(sec.id);
          }}
          onExit={handleExitStudentPractice}
          onViewSubmissions={() => setAppMode('submissions')}
        />
        <SuggestChangesWidget appMode={appMode} />
      </>
    );
  }

  if (appMode === 'submissions') {
    return (
      <>
        <StudentSubmissionsHub onBack={() => setAppMode('portal')} />
        <SuggestChangesWidget appMode={appMode} />
      </>
    );
  }

  if (appMode === 'knowledge_simulator') {
    return (
      <>
        <KnowledgeSimulatorView onBack={() => setAppMode('portal')} />
        <SuggestChangesWidget appMode={appMode} />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".musicxml,.xml,.mxl"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Top Header */}
      <header className="h-16 px-3 sm:px-6 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        {/* Brand & Axiom */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white">
                AIPC <span className="text-indigo-400 font-medium text-sm">Teacher Portal</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Repertoire / Score Selector */}
        <div className="flex items-center gap-3">
          {/* Saved State Indicator */}
          {lastSavedTime && (
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-emerald-400/90 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <Save className="w-3 h-3" />
              <span>Saved at {lastSavedTime}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <span className="text-xs text-slate-400 pl-2 font-medium">Piece:</span>
            <select
              value={selectedDemoId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDemoId(val);
                setCustomScoreTitle('');
                const demo = DEMO_PIECES.find(d => d.id === val);
                if (demo) {
                  loadScoreFromUrl(demo.path);
                  handleInstrumentChange(demo.instrumentId);
                }
              }}
              className="bg-transparent text-xs text-white font-semibold outline-none px-2 py-1 cursor-pointer"
            >
              {DEMO_PIECES.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                  {d.name}
                </option>
              ))}
              {selectedDemoId === 'custom' && (
                <option value="custom" className="bg-slate-900 text-white">Uploaded File</option>
              )}
            </select>
          </div>

          {/* Instrument Context Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <span className="text-xs text-slate-400 pl-2 font-medium">Instrument:</span>
            <select
              value={currentInstrumentId}
              onChange={(e) => handleInstrumentChange(e.target.value)}
              className="bg-transparent text-xs text-indigo-300 font-semibold outline-none px-2 py-1 cursor-pointer"
            >
              {Object.values(INSTRUMENT_PROFILES).map(inst => (
                <option key={inst.id} value={inst.id} className="bg-slate-900 text-white">
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prominent Student Portal Button */}
          <button
            onClick={() => {
              const targetSection = sections.find(s => s.id === selectedSectionId) || sections[0] || {
                id: 'default_sec_1',
                sectionNumber: 1,
                startMeasure: 1,
                endMeasure: 5,
                totalMeasures: 5,
                challenges: []
              };
              setActiveStudentSection(targetSection);
              setAppMode('student_practice');
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-amber-950 rounded-xl text-xs font-black shadow-md shadow-amber-500/20 border border-amber-300 transition-all active:scale-95 cursor-pointer ring-2 ring-amber-400/50"
            title="Open Student Practice Portal (iPad Mode)"
          >
            <span className="text-sm">🎺</span>
            <span className="tracking-wide">Student Portal</span>
          </button>

          {/* Submissions Hub Button */}
          <button
            onClick={() => setAppMode('submissions')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 hover:border-slate-600 transition-all shadow-sm cursor-pointer"
            title="View Student Practice Submissions & Archives (Organized by Student)"
          >
            <span>📥</span>
            <span>Submissions</span>
          </button>

          {/* Developer Knowledgebase Link */}
          <button
            onClick={() => setAppMode('knowledge_simulator')}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
            title="Developer: Pedagogical Knowledgebases (Diagnosis, Strategy, Guide)"
          >
            Developer
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            title="Upload score (.musicxml, .xml, .mxl)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Score</span>
          </button>
        </div>
      </header>

      {/* Sub-bar / Metric Ribbon & Editable Score Title */}
      <div className="h-10 px-6 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          {/* Inline Editable Score Title */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Score:</span>
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customScoreTitle}
                  onChange={(e) => setCustomScoreTitle(e.target.value)}
                  className="bg-slate-950 text-xs font-bold text-white px-2 py-0.5 rounded border border-indigo-500 outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 text-emerald-400 hover:text-white"
                  title="Save Name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-1 text-slate-200 hover:text-indigo-300 font-bold group"
                title="Click to rename score"
              >
                <span>{currentTitle}</span>
                <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </button>
            )}
          </div>

          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>
            Sections: <strong className="text-indigo-400">{sections.length} Chunks</strong>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>
            Challenges: <strong className="text-slate-200">{totalChallengesCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {hasRestoredSession && (
            <button
              onClick={handleResetSession}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors"
              title="Reset to fresh default piece"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Session</span>
            </button>
          )}

          <span className="text-slate-300">
            Approved for Plan: <strong className="text-emerald-400">{acceptedCount}</strong>
          </span>

          {isLoading && (
            <span className="flex items-center gap-1 text-indigo-400 animate-pulse text-[11px]">
              <RefreshCw className="w-3 h-3 animate-spin" /> Processing score...
            </span>
          )}
        </div>
      </div>

      {/* Error Alert if any */}
      {errorMessage && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-6 py-2 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 p-2 sm:p-4 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* Left: Interactive Score Viewer (7 cols) */}
        <section className="md:col-span-7 xl:col-span-8 h-full min-h-0">
          <ScoreViewer
            xmlContent={xmlContent}
            practiceAreas={allPracticeAreas}
            selectedAreaId={selectedAreaId}
            selectedSectionId={selectedSectionId}
            onSelectArea={(id) => setSelectedAreaId(id)}
            onMeasureClick={(mNum) => setSelectedMeasure(mNum)}
            selectedPartId={selectedPartId}
            onPartChange={(id) => setSelectedPartId(id)}
            availableParts={availableParts}
          />
        </section>

        {/* Right: Teacher Review Panel (5 cols) */}
        <section className="md:col-span-5 xl:col-span-4 h-full min-h-0">
          <TeacherReviewPanel
            sections={sections}
            selectedAreaId={selectedAreaId}
            selectedSectionId={selectedSectionId}
            onSelectArea={(id) => setSelectedAreaId(id)}
            onSelectSection={handleSelectSection}
            onAcceptGoal={handleAcceptGoal}
            onAcceptAllInSection={handleAcceptAllInSection}
            onEditGoal={handleEditGoal}
            onRemoveGoal={handleRemoveGoal}
            onRestoreGoal={handleRestoreGoal}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onGeneratePlan={() => setIsPlanModalOpen(true)}
            onLaunchStudentPractice={(section) => {
              setActiveStudentSection(section);
              setAppMode('student_practice');
            }}
            acceptedCount={acceptedCount}
            totalChallengesCount={totalChallengesCount}
          />
        </section>
      </main>

      {/* Modals */}
      <AddGoalModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddArea={handleAddCustomArea}
        initialMeasure={selectedMeasure}
        maxMeasures={maxMeasures}
      />

      <PracticePlanSummary
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        scoreTitle={currentTitle}
        instrumentName={currentInstrument.name}
        sections={sections}
        onAssignToStudent={(plan) => {
          console.log('Assigned Plan to Student:', plan);
        }}
      />

      {/* Suggest Changes Interactive Inspector & Agent Collaboration Widget */}
      <SuggestChangesWidget appMode={appMode} />
    </div>
  );
};

export default App;

