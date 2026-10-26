import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Square, Mic, MicOff, Video, Clock, Send, CheckCircle2, Play, Pause, Music, Sparkles, Target, User, Sliders,
  SkipBack, SkipForward, Calendar, Users, X, ChevronRight, HelpCircle
} from 'lucide-react';
import { StudentScoreViewer } from './StudentScoreViewer';
import { type MusicalSection } from '../types/portal';
import { StudentChatCompanion, type ChatMessage } from './StudentChatCompanion';
import { AipcStrategyCoachModal } from './AipcStrategyCoachModal';

import { MetronomeControls } from './MetronomeControls';

import { meterAtBeat, pulseQuarterNotes, countInPulses } from '../utils/metronome';
import { StudentAudioEngine, type MetronomeSubdivision } from '../utils/studentAudioEngine';
import { EnsembleMixerPanel, type InstrumentTrack } from '../student/components/EnsembleMixerPanel';
import { StudentAcousticInput } from '../utils/studentAcousticInput';
import { beatToSeconds, secondsToBeats, mapInstrumentToSoundfont, getTargetPartAndNotes, type ScorePlaybackData, type NoteEvent } from '../utils/scorePlaybackParser';
import { listScoreParts, matchPartToInstrument } from '../utils/scoreParts';
import {
  MediaRecordingEngine,
  getOrCreateActiveSession,
  recordSectionTime,
  saveRecordedTake,
  submitSectionToTeacher,
  formatDuration,
  uploadRecordingTake,
  saveSubmissionToStorage,
  type RecordedTake,
  type PracticeSession
} from '../utils/studentRecordingManager';

interface StudentPracticeViewProps {
  xmlUrl?: string;
  xmlContent?: string | null;
  pieceTitle: string;
  instrumentName: string;
  sectionId: string;
  sectionTitle: string;
  measureRange: [number, number];
  sections?: MusicalSection[];
  activeSection?: MusicalSection;
  onSelectSection?: (section: MusicalSection) => void;
  onExit: () => void;
  onViewSubmissions?: () => void;
  exerciseId?: string;
  studentId?: string;
  studentName?: string;
}

export const StudentPracticeView: React.FC<StudentPracticeViewProps> = ({
  xmlUrl,
  xmlContent,
  pieceTitle,
  instrumentName,
  sectionId,
  sectionTitle,
  measureRange,
  sections,
  activeSection,
  onSelectSection,
  onExit,
  onViewSubmissions: _onViewSubmissions,
  exerciseId,
  studentId,
  studentName,
}) => {
  // ------------------------------------------------------------------
  // Section Navigation & Practice Agenda State
  // ------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<'focus' | 'full'>('full');
  const [startFromBeat, setStartFromBeat] = useState<number | null>(null);
  const [startFromMeasure, setStartFromMeasure] = useState<number | null>(null);

  const [currentSection, setCurrentSection] = useState<MusicalSection | null>(() => {
    if (activeSection) return activeSection;
    if (sections && sections.length > 0) {
      return sections.find(s => s.id === sectionId) || sections[0];
    }
    return null;
  });

  useEffect(() => {
    if (activeSection) {
      setCurrentSection(activeSection);
    }
  }, [activeSection]);

  const availableSections: MusicalSection[] = useMemo(() => {
    if (sections && sections.length > 0) return sections;
    if (currentSection) return [currentSection];
    return [
      {
        id: sectionId,
        sectionNumber: 1,
        title: sectionTitle,
        startMeasure: measureRange[0],
        endMeasure: measureRange[1],
        totalMeasures: measureRange[1] - measureRange[0] + 1,
        challenges: [],
        status: 'pending',
      }
    ];
  }, [sections, currentSection, sectionId, sectionTitle, measureRange]);



  const activeSectionId = currentSection ? currentSection.id : sectionId;
  const activeSectionTitle = currentSection ? `Section ${currentSection.sectionNumber}` : sectionTitle;

  const currentSectionIndex = useMemo(() => {
    return availableSections.findIndex(s => s.id === activeSectionId);
  }, [availableSections, activeSectionId]);

  const nextSection = useMemo(() => {
    if (currentSectionIndex >= 0 && currentSectionIndex < availableSections.length - 1) {
      return availableSections[currentSectionIndex + 1];
    }
    return null;
  }, [availableSections, currentSectionIndex]);

  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState<boolean>(false);

  const handleSelectSection = (newSec: MusicalSection) => {
    if (newSec.id === activeSectionId) return;
    audioEngineRef.current?.stop();
    setPlaybackPhase('idle');
    setPlaybackProgress(0);
    setViewMode('focus');
    setStartFromBeat(null);
    setStartFromMeasure(null);
    setCurrentSection(newSec);
    setSectionTimeSeconds(session.sections[newSec.id]?.timeSpentSeconds || 0);
    setIsSubmitted(!!session.sections[newSec.id]?.submittedAt);
    if (onSelectSection) {
      onSelectSection(newSec);
    }
    // Automatically match tempo to section's active tempo in score
    if (scorePlaybackData?.tempos && scorePlaybackData.tempos.length > 0) {
      const targetStartBeat = scorePlaybackData.measureStartBeats?.[newSec.startMeasure - 1] ?? ((newSec.startMeasure - 1) * 4);
      let secTempo = scorePlaybackData.intendedBpm || 120;
      for (const t of scorePlaybackData.tempos) {
        if (t.beat <= targetStartBeat + 0.01) {
          secTempo = t.bpm;
        } else {
          break;
        }
      }
      setIntendedBpm(secTempo);
      setCurrentBpm(secTempo);
      setTempoPreset('target');
      audioEngineRef.current?.setBpm(secTempo);
    }
    setChatMessages(prev => [
      ...prev,
      {
        id: `sec_switch_${Date.now()}`,
        sender: 'mascot',
        text: `Switched to ${newSec.startMeasure === newSec.endMeasure ? `Bar ${newSec.startMeasure}` : `Bars ${newSec.startMeasure}–${newSec.endMeasure}`}. Let's work on these bars.`,
        timestamp: 'Just now',
        highlight: true,
      }
    ]);
  };

  // Session & Section Practice Time tracking
  const [session] = useState<PracticeSession>(() =>
    getOrCreateActiveSession(pieceTitle, instrumentName)
  );
  const [sectionTimeSeconds, setSectionTimeSeconds] = useState<number>(0);
  const sectionTimerRef = useRef<any>(null);

  // Audio & Metronome state: Solo Reference MIDI is ON by default matching mock-up
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  // Metronome subdivision state matching mock-up (eighth notes active)
  const [subdivision, setSubdivision] = useState<MetronomeSubdivision>('eighth');
  const [isMinusOneActive, setIsMinusOneActive] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(75);
  const [isMixerCollapsed, setIsMixerCollapsed] = useState<boolean>(false);

  // ---- Parts of THIS score: which part I'm practising, and which parts I practise with ----
  const scoreParts = useMemo(() => listScoreParts(xmlContent), [xmlContent]);
  const [myPartId, setMyPartId] = useState<string | null>(null);
  const myPartIdRef = useRef<string | null>(null);
  myPartIdRef.current = myPartId;

  const FALLBACK_TRACKS: InstrumentTrack[] = [
    { id: 'flute1', name: 'Flute 1', section: 'Woodwinds', volume: 80, isMuted: false, isVisible: true },
    { id: 'flute2', name: 'Flute 2', section: 'Woodwinds', volume: 80, isMuted: false, isVisible: true, isUserPart: true },
  ];
  const [tracks, setTracks] = useState<InstrumentTrack[]>(FALLBACK_TRACKS);
  const tracksRef = useRef<InstrumentTrack[]>(tracks);
  tracksRef.current = tracks;

  // Build the mixer from the real score; the student's own part is on and visible, others start off
  useEffect(() => {
    if (scoreParts.length === 0) return;
    const mine = matchPartToInstrument(scoreParts, instrumentName);
    setMyPartId(mine);
    setTracks(scoreParts.map(sp => ({
      id: sp.id,
      name: sp.name,
      section: sp.section,
      volume: 80,
      isMuted: sp.id !== mine,
      isVisible: sp.id === mine,
      isUserPart: sp.id === mine,
    })));
  }, [scoreParts, instrumentName]);

  const handleMyPartChange = (id: string) => {
    setMyPartId(id);
    setTracks(prev => prev.map(t => {
      if (t.id === id) return { ...t, isMuted: false, isVisible: true, isUserPart: true };
      // the part I just left behind drops back to an ordinary, switched-off track
      if (t.isUserPart) return { ...t, isMuted: true, isVisible: false, isUserPart: false };
      return t;
    }));
  };
  const myPartName = scoreParts.find(p => p.id === myPartId)?.name || instrumentName;
  const visiblePartIds = useMemo(
    () => (scoreParts.length > 0 ? tracks.filter(t => t.isVisible).map(t => t.id) : null),
    [tracks, scoreParts.length]
  );

  /**
   * The reference MIDI: every part of the score, each tagged with its own instrument voice and part id.
   * Which parts are actually heard (ticked in "Practise with", my own part left out while I play) is
   * decided live by the audio engine's part mix, so ticking/unticking works during playback.
   * Falls back to my part when the score has no parts.
   */
  const buildBackingNotes = (ownNotes: NoteEvent[], _forDemo: boolean): NoteEvent[] => {
    const sp = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    if (!sp || scoreParts.length === 0) return ownNotes;
    const out: NoteEvent[] = [];
    for (const part of sp.parts) {
      const instrument = mapInstrumentToSoundfont(part.name);
      for (const n of part.notes) out.push({ ...n, instrument, partId: part.id });
    }
    return out;
  };

  const handleSubdivisionChange = (sub: MetronomeSubdivision) => {
    setSubdivision(sub);
    audioEngineRef.current?.setSubdivision(sub);
  };

  const [countInEnabled, setCountInEnabled] = useState(true);
  const [isMetronomeMuted, setIsMetronomeMuted] = useState<boolean>(false);
  const [intendedBpm, setIntendedBpm] = useState<number>(120);
  const [currentBpm, setCurrentBpm] = useState<number>(120);
  const [tempoPreset, setTempoPreset] = useState<'slow' | 'steady' | 'target' | 'custom'>('target');

  // Practice & Playback state
  const [countInTotal, setCountInTotal] = useState(4);
  const [playbackPhase, setPlaybackPhase] = useState<'idle' | 'count_in' | 'playing' | 'review'>('idle');

  // Push the "Practise with" mix to the engine: ticked parts sound at their slider level,
  // unticked parts are silent, and my own part is silent while "Mute my part" is on (but heard in a demo).
  useEffect(() => {
    const mix: Record<string, number> = {};
    for (const t of tracks) {
      const ownSilenced = t.id === myPartId && isMinusOneActive && !isListeningDemoRef.current;
      mix[t.id] = t.isMuted || ownSilenced ? 0 : Math.max(0, t.volume / 80);
    }
    audioEngineRef.current?.setPartMix(mix);
  }, [tracks, myPartId, isMinusOneActive, playbackPhase]);
  const [countInNumber, setCountInNumber] = useState<number | null>(null);
  const [scorePlaybackData, setScorePlaybackData] = useState<ScorePlaybackData | null>(null);

  const totalScoreMeasures = useMemo(() => {
    if (scorePlaybackData?.measureStartBeats?.length) {
      return scorePlaybackData.measureStartBeats.length;
    }
    if (availableSections.length > 0) {
      return Math.max(...availableSections.map(s => s.endMeasure));
    }
    return measureRange[1];
  }, [scorePlaybackData, availableSections, measureRange]);

  const activeMeasureRange: [number, number] = useMemo(() => {
    if (viewMode === 'full' && totalScoreMeasures > 0) {
      return [1, totalScoreMeasures];
    }
    if (currentSection) {
      return [currentSection.startMeasure, currentSection.endMeasure];
    }
    return measureRange;
  }, [viewMode, totalScoreMeasures, currentSection, measureRange]);

  const getTempoAtBeat = useCallback((targetBeat: number): number => {
    if (!scorePlaybackData?.tempos || scorePlaybackData.tempos.length === 0) {
      return scorePlaybackData?.intendedBpm || 120;
    }
    let matched = scorePlaybackData.tempos[0].bpm;
    for (const t of scorePlaybackData.tempos) {
      if (t.beat <= targetBeat + 0.01) {
        matched = t.bpm;
      } else {
        break;
      }
    }
    return matched;
  }, [scorePlaybackData]);

  // Synchronize count-in and playback tempo automatically with active section/music selection
  useEffect(() => {
    if (!scorePlaybackData) return;
    const startM = (viewMode === 'full' && startFromMeasure) ? startFromMeasure : activeMeasureRange[0];
    const targetStartBeat = scorePlaybackData.measureStartBeats?.[startM - 1] ?? ((startM - 1) * 4);
    const secTempo = getTempoAtBeat(targetStartBeat);

    setIntendedBpm(secTempo);
    if (tempoPreset === 'target') {
      setCurrentBpm(secTempo);
      audioEngineRef.current?.setBpm(secTempo);
    } else if (tempoPreset === 'slow') {
      const slow = Math.round(secTempo * 0.7);
      setCurrentBpm(slow);
      audioEngineRef.current?.setBpm(slow);
    } else if (tempoPreset === 'steady') {
      const steady = Math.round(secTempo * 0.85);
      setCurrentBpm(steady);
      audioEngineRef.current?.setBpm(steady);
    }
  }, [currentSection, activeMeasureRange, viewMode, startFromMeasure, scorePlaybackData, getTempoAtBeat, tempoPreset]);

  const [playbackProgress, setPlaybackProgress] = useState<number>(0);

  // Input Mode (Acoustic Mic vs iPad Screen Tap Pad)
  const [inputMode, setInputMode] = useState<'mic' | 'tap'>('tap');
  const inputModeRef = useRef<'mic' | 'tap'>(inputMode);
  inputModeRef.current = inputMode;
  const [micLevel, setMicLevel] = useState<number>(0);
  const [tapFlash, setTapFlash] = useState<boolean>(false);
  const [tapCount, setTapCount] = useState<number>(0);

  // Recording Mode (Audio Only vs Video + Audio) - default audio
  const [recordingMode, setRecordingMode] = useState<'audio' | 'video'>('audio');
  const [isRecordingTake, setIsRecordingTake] = useState<boolean>(false);
  const [recentTake, setRecentTake] = useState<RecordedTake | null>(null);
  const latestTakeBlobRef = useRef<Blob | null>(null);
  const [showTakeModal, setShowTakeModal] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Mascot Chat Messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const startM = activeSection ? activeSection.startMeasure : measureRange[0];
    const endM = activeSection ? activeSection.endMeasure : measureRange[1];
    const barsLabel = startM === endM ? `Bar ${startM}` : `Bars ${startM}–${endM}`;
    return [
      {
        id: 'm1',
        sender: 'mascot',
        text: `Welcome! Let's work on ${barsLabel} together. Follow along with the score or start practice when you're ready.`,
        timestamp: 'Just now',
      },
    ];
  });

  // Video Preview ref for selfie camera & live stream lifecycle
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'denied'>('idle');

  // Camera preview lifecycle: turn hardware on when video mode is selected, release when audio or unmount
  useEffect(() => {
    let isCancelled = false;

    if (recordingMode === 'video') {
      setCameraStatus('starting');
      const startWebcam = async () => {
        try {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: { ideal: 'user' },
              },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }

          if (isCancelled) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          cameraStreamRef.current = stream;
          setCameraStream(stream);
          setCameraStatus('active');

          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.play().catch(e => console.warn('Preview play error:', e));
          }
        } catch (err) {
          console.warn('Camera access denied or unavailable:', err);
          if (!isCancelled) {
            setCameraStatus('denied');
          }
        }
      };

      startWebcam();
    } else {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraStream(null);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
      setCameraStatus('idle');
    }

    return () => {
      isCancelled = true;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraStream(null);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, [recordingMode]);

  // Engines
  const audioEngineRef = useRef<StudentAudioEngine | null>(null);
  if (!audioEngineRef.current) {
    audioEngineRef.current = new StudentAudioEngine();
  }

  const acousticInputRef = useRef<StudentAcousticInput | null>(null);
  if (!acousticInputRef.current) {
    acousticInputRef.current = new StudentAcousticInput();
  }

  const recorderRef = useRef<MediaRecordingEngine | null>(null);
  if (!recorderRef.current) {
    recorderRef.current = new MediaRecordingEngine();
  }

  const playbackStartTimeRef = useRef<number | null>(null);
  const isListeningDemoRef = useRef<boolean>(false);

  // AIPC Pedagogical Strategy Coach Modal state
  const [isCoachModalOpen, setIsCoachModalOpen] = useState<boolean>(false);
  const [coachTargetMeasures, setCoachTargetMeasures] = useState<[number, number]>([6, 10]);
  const [coachStrategyId, setCoachStrategyId] = useState<string | undefined>(undefined);
  const [coachResolutionToast, setCoachResolutionToast] = useState<string | null>(null);
  const [repertoireShadowMode, setRepertoireShadowMode] = useState<boolean>(false);

  // Repertoire Front Door Pedagogical Progression
  type FrontDoorStep =
    | 'idle'
    | 'option_a_shadowed'
    | 'option_a_testing'
    | 'option_b_suggested'
    | 'option_b_practicing'
    | 'tempo_ladder';
  const [frontDoorStep, setFrontDoorStep] = useState<FrontDoorStep>('idle');
  const frontDoorStepRef = useRef<FrontDoorStep>('idle');
  useEffect(() => {
    frontDoorStepRef.current = frontDoorStep;
  }, [frontDoorStep]);


  const handleLaunchCoachStrategy = useCallback((scenario?: string, measures?: [number, number]) => {
    if (scenario) setCoachStrategyId(scenario);
    if (measures) setCoachTargetMeasures(measures);
    setIsCoachModalOpen(true);
  }, []);
  const handleFinishPlaybackRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const liveParamsRef = useRef({
    scorePlaybackData,
    instrumentName,
    activeMeasureRange,
    viewMode,
    startFromBeat,
    currentBpm,
    intendedBpm,
  });
  useEffect(() => {
    liveParamsRef.current = {
      scorePlaybackData,
      instrumentName,
      activeMeasureRange,
      viewMode,
      startFromBeat,
      currentBpm,
      intendedBpm,
    };
  });

  // Live onset detection/evaluation removed: no diagnostics are run while practising.
  // Live onset detection/evaluation removed: no diagnostics are run while practising.

  // Live stopwatch for active section practice time
  useEffect(() => {
    sectionTimerRef.current = setInterval(() => {
      setSectionTimeSeconds(sec => {
        const next = sec + 1;
        if (next % 5 === 0) {
          recordSectionTime(session.sessionId, activeSectionId, activeSectionTitle, activeMeasureRange, 5);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
    };
  }, [session.sessionId, activeSectionId, activeSectionTitle, activeMeasureRange]);

  const readScorePlaybackTime = useCallback(() => audioEngineRef.current?.getScorePlaybackSeconds() ?? null, []);

  // Audio Engine Callbacks
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    engine.setOnTick((beatNumber, isCountIn) => {
      if (isCountIn) {
        setCountInNumber(beatNumber);
        setPlaybackPhase(prev => (prev !== 'count_in' ? 'count_in' : prev));
      } else {
        setCountInNumber(prev => (prev !== null ? null : prev));
        setPlaybackPhase(prev => (prev !== 'playing' ? 'playing' : prev));
        if (playbackStartTimeRef.current === null) {
          playbackStartTimeRef.current = Date.now();
        }
      }
    });

    engine.setOnTimeUpdate((timeSec) => {
      setPlaybackProgress(timeSec);
      const { scorePlaybackData: spData } = liveParamsRef.current;

      if (spData && timeSec >= 0) {
        const beat = secondsToBeats(timeSec, spData.tempos);
        const meter = meterAtBeat(spData.metronomeMeasures || [], beat, spData.initialTimeSignature);
        setCountInTotal(countInPulses(meter.numerator, meter.denominator));
        setCurrentBpm(engine.getCurrentBpm());
        let scoreTempo = spData.intendedBpm;
        for (const tempo of spData.tempos || []) { if (tempo.beat > beat) break; scoreTempo = tempo.bpm; }
        setIntendedBpm(scoreTempo);
      }
    });

    engine.setOnEnd(() => {
      handleFinishPlaybackRef.current();
    });
  }, []);

  // Acoustic Mic Engine Callbacks
  useEffect(() => {
    const input = acousticInputRef.current;
    if (!input) return;

    input.setCallbacks(
      (_time) => {
        setTapCount(c => c + 1);
        setTapFlash(true);
        setTimeout(() => setTapFlash(false), 120);
      },
      (level) => {
        setMicLevel(level);
      }
    );

    input.stop();

  }, [inputMode]);

  // Discreet Developer Tap Simulator (Supports spacebar key and tap button)
  const triggerDevTap = useCallback(() => {
    setTapFlash(true);
    setTapCount(c => c + 1);
    setTimeout(() => setTapFlash(false), 100);

    // Automatically switch to tap mode and stop mic if currently in mic mode
    if (inputModeRef.current === 'mic') {
      setInputMode('tap');
      acousticInputRef.current?.stop();
      setMicLevel(0);
    }
  }, []);

  // Keyboard Spacebar listener for discreet developer testing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        triggerDevTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [triggerDevTap]);

  // Tempo Calculations & Dynamic Adjustment
  const handleBpmChange = (newBpm: number) => {
    const clamped = Math.max(30, Math.min(260, Math.round(newBpm * 1000) / 1000));
    setCurrentBpm(clamped);
    setTempoPreset('custom');
    audioEngineRef.current?.setBpm(clamped);
  };

  const handlePresetSelect = (preset: 'slow' | 'steady' | 'target') => {
    setTempoPreset(preset);
    let target = intendedBpm;
    if (preset === 'slow') target = Math.round(intendedBpm * 0.7);
    else if (preset === 'steady') target = Math.round(intendedBpm * 0.85);
    else target = intendedBpm;
    setCurrentBpm(target);
    audioEngineRef.current?.setBpm(target);
  };

  const handleViewModeChange = (mode: 'focus' | 'full') => {
    if (mode === viewMode) return;
    audioEngineRef.current?.stop();
    setPlaybackPhase('idle');
    setPlaybackProgress(0);
    setStartFromBeat(null);
    setStartFromMeasure(null);
    setViewMode(mode);

    if (mode === 'full') {
      // In full piece mode, cursor points to Bar 1 (beat 0)
      const bar1Tempo = getTempoAtBeat(0);
      setIntendedBpm(bar1Tempo);
      setCurrentBpm(bar1Tempo);
      setTempoPreset('target');
      audioEngineRef.current?.setBpm(bar1Tempo);

      setChatMessages(prev => [
        ...prev,
        {
          id: `mode_${Date.now()}`,
          sender: 'mascot',
          text: `Switched to Full Piece practice (Bars 1–${totalScoreMeasures}). Click any bar on the score to jump the playhead, or start practice to play through.`,
          timestamp: 'Just now',
          highlight: true,
        }
      ]);
    } else {
      // In focus mode, cursor points to section start measure
      const secStartM = currentSection?.startMeasure ?? measureRange[0];
      const startBeat = scorePlaybackData?.measureStartBeats?.[secStartM - 1] ?? ((secStartM - 1) * 4);
      const secTempo = getTempoAtBeat(startBeat);
      setIntendedBpm(secTempo);
      setCurrentBpm(secTempo);
      setTempoPreset('target');
      audioEngineRef.current?.setBpm(secTempo);

      setChatMessages(prev => [
        ...prev,
        {
          id: `mode_${Date.now()}`,
          sender: 'mascot',
          text: `Focused back on Section ${currentSection?.sectionNumber ?? 1} (Bars ${currentSection?.startMeasure ?? measureRange[0]}–${currentSection?.endMeasure ?? measureRange[1]}).`,
          timestamp: 'Just now',
        }
      ]);
    }
  };

  // 1. Practice Attempt Flow
  const handleStartPractice = async (overrideBpm?: number | React.MouseEvent) => {
    const numericOverride = typeof overrideBpm === 'number' ? overrideBpm : undefined;
    isListeningDemoRef.current = false;
    setPlaybackPhase('count_in');
    setIsRecordingTake(false);
    setPlaybackProgress(-0.1);

    const spData = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    const instName = liveParamsRef.current.instrumentName || instrumentName;
    const mRange = liveParamsRef.current.activeMeasureRange || activeMeasureRange;

    const { activePart, targetNotes, sectionStartBeat: partStartBeat, totalSectionEndBeat } = getTargetPartAndNotes(
      spData,
      instName,
      mRange, myPartIdRef.current);
    const activeNotes = activePart?.notes || [];
    // Full-score view plays from bar 1 (or the bar the student clicked); a focused section starts at its first note
    const sectionStartBeat = viewMode === 'full' ? (spData?.measureStartBeats?.[0] ?? 0) : partStartBeat;
    const playbackStartBeat = startFromBeat !== null ? startFromBeat : sectionStartBeat;
    const totalBeats = Math.max(1e-6, totalSectionEndBeat - sectionStartBeat);

    // Ground count-in tempo dynamically in the section being attempted
    const playbackMeter = meterAtBeat(spData?.metronomeMeasures || [], playbackStartBeat, spData?.initialTimeSignature);
    const countIn = countInPulses(playbackMeter.numerator, playbackMeter.denominator);
    setCountInTotal(countIn);
    const sectionTargetTempo = getTempoAtBeat(playbackStartBeat);
    let effectiveBpm: number;

    if (numericOverride !== undefined) {
      effectiveBpm = Math.max(30, Math.min(260, numericOverride));
      setTempoPreset('custom');
      setCurrentBpm(effectiveBpm);
      audioEngineRef.current?.setBpm(effectiveBpm);
      liveParamsRef.current.currentBpm = effectiveBpm;
    } else if (tempoPreset === 'custom') {
      effectiveBpm = currentBpm;
      audioEngineRef.current?.setBpm(effectiveBpm);
      liveParamsRef.current.currentBpm = effectiveBpm;
    } else if (tempoPreset === 'slow') {
      effectiveBpm = Math.round(sectionTargetTempo * 0.7);
      setCurrentBpm(effectiveBpm);
      audioEngineRef.current?.setBpm(effectiveBpm);
      liveParamsRef.current.currentBpm = effectiveBpm;
    } else if (tempoPreset === 'steady') {
      effectiveBpm = Math.round(sectionTargetTempo * 0.85);
      setCurrentBpm(effectiveBpm);
      audioEngineRef.current?.setBpm(effectiveBpm);
      liveParamsRef.current.currentBpm = effectiveBpm;
    } else {
      effectiveBpm = sectionTargetTempo;
      setCurrentBpm(sectionTargetTempo);
      setIntendedBpm(sectionTargetTempo);
      audioEngineRef.current?.setBpm(sectionTargetTempo);
      liveParamsRef.current.currentBpm = sectionTargetTempo;
    }
    
    // Deterministic start time: count-in is 4 beats at effectiveBpm
    playbackStartTimeRef.current = null; // Set by the first audible music tick, after preload and count-in.


    setChatMessages(prev => [
      ...prev,
      {
        id: `practice_${Date.now()}`,
        sender: 'mascot',
        text: `Section tempo is ${effectiveBpm} BPM. Play along with the metronome click!`,
        timestamp: 'Now',
      },
    ]);

    // In practice runs, student plays unassisted with metronome click only (reference MIDI notes muted by default)
    audioEngineRef.current?.setAudioBackingMuted(isAudioMuted);
    audioEngineRef.current?.setMetronomeMuted(isMetronomeMuted);

    await audioEngineRef.current?.startSectionPlayback(
      {
        intendedBpm: sectionTargetTempo,
        bpm: effectiveBpm,
        timeSignature: [playbackMeter.numerator, playbackMeter.denominator],
        startMeasure: activeMeasureRange[0],
        endMeasure: activeMeasureRange[1],
        startBeat: sectionStartBeat,
        startFromBeat: playbackStartBeat,
        totalBeats,
        countInBeats: countInEnabled ? countIn : 0,
        instrumentName,
        notes: buildBackingNotes(activeNotes, false),
        tempos: spData?.tempos,
        metronomeMeasures: spData?.metronomeMeasures,
      },
      effectiveBpm
    );

    // The audio-clock tick callback changes phase after the count-in.
  };

  // 2. Listen Demo Flow (Groundtruth reference playback - not scored as a student run)
  const handleStartListenDemo = async () => {
    isListeningDemoRef.current = true;
    setPlaybackPhase('count_in');
    setIsRecordingTake(false);
    setPlaybackProgress(-0.1);

    const spData = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    const instName = liveParamsRef.current.instrumentName || instrumentName;
    const mRange = liveParamsRef.current.activeMeasureRange || activeMeasureRange;

    const { activePart, targetNotes, sectionStartBeat: partStartBeat, totalSectionEndBeat } = getTargetPartAndNotes(
      spData,
      instName,
      mRange, myPartIdRef.current);
    const activeNotes = activePart?.notes || [];
    // Full-score view plays from bar 1 (or the bar the student clicked); a focused section starts at its first note
    const sectionStartBeat = viewMode === 'full' ? (spData?.measureStartBeats?.[0] ?? 0) : partStartBeat;
    const playbackStartBeat = startFromBeat !== null ? startFromBeat : sectionStartBeat;
    const totalBeats = Math.max(1e-6, totalSectionEndBeat - sectionStartBeat);

    const playbackMeter = meterAtBeat(spData?.metronomeMeasures || [], playbackStartBeat, spData?.initialTimeSignature);
    const countIn = countInPulses(playbackMeter.numerator, playbackMeter.denominator);
    setCountInTotal(countIn);
    const sectionTargetTempo = getTempoAtBeat(playbackStartBeat);
    let effectiveBpm = currentBpm;
    if (tempoPreset === 'target' || Math.abs(currentBpm - intendedBpm) < 2) {
      effectiveBpm = sectionTargetTempo;
      setCurrentBpm(sectionTargetTempo);
      setIntendedBpm(sectionTargetTempo);
      audioEngineRef.current?.setBpm(sectionTargetTempo);
    } else if (tempoPreset === 'slow') {
      effectiveBpm = Math.round(sectionTargetTempo * 0.7);
    } else if (tempoPreset === 'steady') {
      effectiveBpm = Math.round(sectionTargetTempo * 0.85);
    }

    playbackStartTimeRef.current = null; // Set by the first audible music tick, after preload and count-in.

    setChatMessages(prev => [
      ...prev,
      {
        id: `demo_${Date.now()}`,
        sender: 'mascot',
        text: `🎧 Demonstration playback starting at ${effectiveBpm} BPM. Listen carefully to the reference rhythm and phrasing!`,
        timestamp: 'Now',
      },
    ]);

    // Demo requires audible reference solo playback
    audioEngineRef.current?.setAudioBackingMuted(false);
    audioEngineRef.current?.setMetronomeMuted(isMetronomeMuted);

    await audioEngineRef.current?.startSectionPlayback(
      {
        intendedBpm: sectionTargetTempo,
        bpm: effectiveBpm,
        timeSignature: [playbackMeter.numerator, playbackMeter.denominator],
        startMeasure: activeMeasureRange[0],
        endMeasure: activeMeasureRange[1],
        startBeat: sectionStartBeat,
        startFromBeat: playbackStartBeat,
        totalBeats,
        countInBeats: countInEnabled ? countIn : 0,
        instrumentName,
        notes: buildBackingNotes(activeNotes, true),
        tempos: spData?.tempos,
        metronomeMeasures: spData?.metronomeMeasures,
      },
      effectiveBpm
    );

    // The audio-clock tick callback changes phase after the count-in.
  };

  // Repertoire Front Door: Option A (Silent Shadow Fingering on Real Notes)
  const handleStartRepertoireShadow = async () => {
    setRepertoireShadowMode(true);
    setFrontDoorStep('option_a_shadowed');
    frontDoorStepRef.current = 'option_a_shadowed';
    setChatMessages(prev => [
      ...prev,
      {
        id: `shadow_prompt_${Date.now()}`,
        sender: 'mascot',
        text: "🎧 Repertoire Front Door (Option A): Silent Shadow Fingering! Keep your instrument in playing position. Silently press the real valves/keys as each note turns green with the reference audio, locking your fingers into the beat!",
        timestamp: 'Just now',
        highlight: true,
      }
    ]);
    await handleStartListenDemo();
  };

  // Repertoire Front Door: Option A Step 2 (Active Testing on Instrument - Rehearsal, NOT Recorded Take)
  const handleStartOptionATest = () => {
    setRepertoireShadowMode(false);
    setFrontDoorStep('option_a_testing');
    frontDoorStepRef.current = 'option_a_testing';
    setChatMessages(prev => [
      ...prev,
      {
        id: `opt_a_test_${Date.now()}`,
        sender: 'mascot',
        text: `♪ Repertoire Front Door (Option A Rehearsal): Play on your instrument now at target tempo (${intendedBpm} BPM)! Let's test if your shadow rehearsal locked in.`,
        timestamp: 'Just now',
      }
    ]);
    handleStartPractice();
  };

  // Repertoire Front Door: Option B (Slower Tempo: -20 BPM with Real Notes)
  const handleStartRepertoireSlow = () => {
    setRepertoireShadowMode(false);
    const slowBpm = Math.max(40, intendedBpm - 20);
    setFrontDoorStep('option_b_practicing');
    frontDoorStepRef.current = 'option_b_practicing';
    setTempoPreset('custom');
    setCurrentBpm(slowBpm);
    setIsMetronomeMuted(false);
    audioEngineRef.current?.setMetronomeMuted(false);
    audioEngineRef.current?.setBpm(slowBpm);
    liveParamsRef.current.currentBpm = slowBpm;
    setChatMessages(prev => [
      ...prev,
      {
        id: `slow_prompt_${Date.now()}`,
        sender: 'mascot',
        text: `🐢 Repertoire Front Door (Option B): Slower Tempo (-20 BPM = ${slowBpm} BPM) with real notes! Play on your instrument—lock into the slower pulse!`,
        timestamp: 'Just now',
        highlight: true,
      }
    ]);
    handleStartPractice(slowBpm);
  };

  // In-Situ 1-Click Reflection Handler
  const handleInSituReflection = (chipKey: 'steady' | 'stumbled_fingers' | 'rushing_dragging' | 'confused') => {
    const timeStr = 'Just now';

    if (chipKey === 'stumbled_fingers') {
      setChatMessages(prev => [
        ...prev,
        {
          id: `ref_fingers_${Date.now()}`,
          sender: 'mascot',
          text: "🎹 Fingering Bottleneck noted! Your rhythmic pulse is fine—the hesitation comes from moving between difficult fingerings or wide intervals. Let's stay on your piece and practice the finger transitions without isolating rhythm.",
          timestamp: timeStr,
          actionOptions: [
            { key: 'repertoire_slow_tempo', label: 'Play Slower on Real Notes', icon: '🐢', variant: 'primary' },
            { key: `focus_bar_${activeMeasureRange[0]}`, label: `Focus on Bar ${activeMeasureRange[0]}`, icon: '🎯', variant: 'amber' },
          ]
        }
      ]);
    } else if (chipKey === 'steady') {
      setChatMessages(prev => [
        ...prev,
        {
          id: `ref_steady_${Date.now()}`,
          sender: 'mascot',
          text: "🎯 Excellent! You locked in on the real notes! Ready to bring the tempo back up towards your target pace.",
          timestamp: timeStr,
          actionOptions: [
            { key: `tempo_${Math.min(intendedBpm, currentBpm + 8)}`, label: `Step Tempo Up (+8 BPM)`, icon: '🚀', variant: 'success' },
            { key: 'ready_to_play', label: 'Record a New Take', icon: '🔴', variant: 'primary' },
          ]
        }
      ]);
    } else if (chipKey === 'rushing_dragging') {
      setChatMessages(prev => [
        ...prev,
        {
          id: `ref_rhythm_${Date.now()}`,
          sender: 'mascot',
          text: "⚠️ Confirmed Rhythm Pulse Deficit: Even with reference audio or slower tempo, the internal pulse is wavering across the offbeats. Let's take a quick 60-second pit stop in the Rhythm Portal to rebuild pulse stability, then bring it right back to your piece!",
          timestamp: timeStr,
          actionOptions: [
            { 
              key: `start_strategy_rushing_${activeMeasureRange[0]}`, 
              label: 'Enter Rhythm Portal (60s Pulse Rebuilding)', 
              icon: '🛠️', 
              variant: 'primary' 
            },
            { key: 'repertoire_shadow_fingering', label: 'Shadow Finger One More Time', icon: '🎧', variant: 'secondary' },
          ]
        }
      ]);
    } else {
      setChatMessages(prev => [
        ...prev,
        {
          id: `ref_confused_${Date.now()}`,
          sender: 'mascot',
          text: "❓ Beat coordination needs grounding. Shadow finger silently along with the reference demo to lock in where the downbeats fall.",
          timestamp: timeStr,
          actionOptions: [
            { key: 'repertoire_shadow_fingering', label: 'Option A: Shadow Fingering', icon: '🎧', variant: 'primary' },
            { key: 'repertoire_slow_tempo', label: 'Option B: Slower Tempo (-20 BPM)', icon: '🐢', variant: 'secondary' },
          ]
        }
      ]);
    }
  };

  // 3. Start Recording Take
  const handleStartRecordingTake = async () => {
    isListeningDemoRef.current = false;
    setPlaybackPhase('count_in');
    setIsRecordingTake(true);
    setPlaybackProgress(-0.1);

    const spData = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    const instName = liveParamsRef.current.instrumentName || instrumentName;
    const mRange = liveParamsRef.current.activeMeasureRange || activeMeasureRange;

    const { activePart, targetNotes, sectionStartBeat: partStartBeat, totalSectionEndBeat } = getTargetPartAndNotes(
      spData,
      instName,
      mRange, myPartIdRef.current);
    const activeNotes = activePart?.notes || [];
    // Full-score view plays from bar 1 (or the bar the student clicked); a focused section starts at its first note
    const sectionStartBeat = viewMode === 'full' ? (spData?.measureStartBeats?.[0] ?? 0) : partStartBeat;
    const playbackStartBeat = startFromBeat !== null ? startFromBeat : sectionStartBeat;
    const totalBeats = Math.max(1e-6, totalSectionEndBeat - sectionStartBeat);

    // Ground count-in tempo dynamically in the section being attempted
    const playbackMeter = meterAtBeat(spData?.metronomeMeasures || [], playbackStartBeat, spData?.initialTimeSignature);
    const countIn = countInPulses(playbackMeter.numerator, playbackMeter.denominator);
    setCountInTotal(countIn);
    const sectionTargetTempo = getTempoAtBeat(playbackStartBeat);
    let effectiveBpm = currentBpm;
    if (tempoPreset === 'target' || Math.abs(currentBpm - intendedBpm) < 2) {
      effectiveBpm = sectionTargetTempo;
      setCurrentBpm(sectionTargetTempo);
      setIntendedBpm(sectionTargetTempo);
      audioEngineRef.current?.setBpm(sectionTargetTempo);
    } else if (tempoPreset === 'slow') {
      effectiveBpm = Math.round(sectionTargetTempo * 0.7);
    } else if (tempoPreset === 'steady') {
      effectiveBpm = Math.round(sectionTargetTempo * 0.85);
    }

    // Deterministic start time: count-in is 4 beats at effectiveBpm
    playbackStartTimeRef.current = null; // Set by the first audible music tick, after preload and count-in.


    setChatMessages(prev => [
      ...prev,
      {
        id: `rec_${Date.now()}`,
        sender: 'mascot',
        text: `Count-in starting at ${effectiveBpm} BPM. Play along with bars ${activeMeasureRange[0]}–${activeMeasureRange[1]}.`,
        timestamp: 'Now',
      },
    ]);

    // Start video/audio recorder
    await recorderRef.current?.start(recordingMode, videoPreviewRef.current, cameraStreamRef.current);

    // In take recording, solo reference audio notes are muted by default
    audioEngineRef.current?.setAudioBackingMuted(isAudioMuted);
    audioEngineRef.current?.setMetronomeMuted(isMetronomeMuted);

    await audioEngineRef.current?.startSectionPlayback(
      {
        intendedBpm: sectionTargetTempo,
        bpm: effectiveBpm,
        timeSignature: [playbackMeter.numerator, playbackMeter.denominator],
        startMeasure: activeMeasureRange[0],
        endMeasure: activeMeasureRange[1],
        startBeat: sectionStartBeat,
        startFromBeat: playbackStartBeat,
        totalBeats,
        countInBeats: countInEnabled ? countIn : 0,
        instrumentName,
        notes: buildBackingNotes(activeNotes, false),
        tempos: spData?.tempos,
        metronomeMeasures: spData?.metronomeMeasures,
      },
      effectiveBpm
    );

    // The audio-clock tick callback changes phase after the count-in.
  };

  // 4. Stop Playback / Finish Take
  const handleFinishPlayback = async () => {
    const wasInCountIn = playbackPhase === 'count_in' || playbackProgress < 0;

    playbackStartTimeRef.current = null;
    audioEngineRef.current?.stop();
    setPlaybackPhase('idle');
    setCountInNumber(null);
    // FREEZE AT RESULTS: Do NOT reset playbackProgress to 0! Keep progress and notehead colors frozen on screen.

    // If cancelled during count-in, reset cleanly without false diagnostics
    if (wasInCountIn) {
      setPlaybackProgress(0);
      setChatMessages(prev => [
        ...prev,
        {
          id: `cancel_${Date.now()}`,
          sender: 'mascot',
          text: "Practice stopped before start. Hit 'Start Practice' whenever you're ready to play!",
          timestamp: 'Just now',
        }
      ]);
      if (isRecordingTake) {
        setIsRecordingTake(false);
        await recorderRef.current?.stop();
      }
      return;
    }

    // If this was a Listen Demo session, reset cleanly without showing any evaluations or results
    if (isListeningDemoRef.current) {
      const wasShadow = repertoireShadowMode;
      isListeningDemoRef.current = false;
      setPlaybackProgress(0);

      if (wasShadow) {
        {
          setChatMessages(prev => [
            ...prev,
            {
              id: `shadow_fin_${Date.now()}`,
              sender: 'mascot',
              text: "🎧 Shadow Fingering pass complete! Choose your next step:",
              timestamp: 'Just now',
              actionOptions: [
                { key: 'play_instrument_test', label: '♪ Play on Instrument Now', icon: '♪', variant: 'primary' },
                { key: 'repertoire_slow_tempo', label: '🐢 Slower Tempo (-20 BPM)', icon: '🐢', variant: 'amber' },
                { key: 'repertoire_shadow_fingering', label: '🔁 Shadow Again', icon: '🔁', variant: 'secondary' },
              ]
            }
          ]);
        }
      } else {
        setChatMessages(prev => [
          ...prev,
          {
            id: `demo_fin_${Date.now()}`,
            sender: 'mascot',
            text: "🎧 Demo finished! Now it's your turn. Hit 'Start Practice' to play along with the metronome.",
            timestamp: 'Just now',
            actionOptions: [
              { key: 'play_instrument_test', label: "Start Practice", icon: '▶️', variant: 'primary' },
              { key: 'listen_demo', label: "Listen to Demo Again", icon: '🔁', variant: 'secondary' },
            ]
          }
        ]);
      }
      if (isRecordingTake) {
        setIsRecordingTake(false);
        await recorderRef.current?.stop();
      }
      return;
    }

    // No diagnostics in this version: finishing playback only wraps up the take.

    if (isRecordingTake) {
      setIsRecordingTake(false);
      const result = await recorderRef.current?.stop();
      if (result) {
        latestTakeBlobRef.current = result.blob;
        const take = saveRecordedTake(
          session.sessionId,
          activeSectionId,
          activeSectionTitle,
          activeMeasureRange,
          result.blob,
          recordingMode,
          result.durationSeconds,
          currentBpm
        );

        setRecentTake(take);
        setShowTakeModal(true);
      }
    }
  };
  handleFinishPlaybackRef.current = handleFinishPlayback;

  // Quick Action handler from Chatbot
  const handleQuickAction = (key: string) => {
    if (key === 'repertoire_shadow_fingering') {
      handleStartRepertoireShadow();
      return;
    }
    if (key === 'repertoire_slow_tempo') {
      handleStartRepertoireSlow();
      return;
    }
    if (key === 'reflect_steady') {
      handleInSituReflection('steady');
      return;
    }
    if (key === 'reflect_fingers') {
      handleInSituReflection('stumbled_fingers');
      return;
    }
    if (key === 'reflect_rushing') {
      handleInSituReflection('rushing_dragging');
      return;
    }
    if (key === 'reflect_confused') {
      handleInSituReflection('confused');
      return;
    }
    if (key.startsWith('start_strategy_')) {
      const parts = key.split('_');
      // format: start_strategy_{scenario}_{measure}
      const scenario = parts[2] || 'rushing';
      const targetBar = parseInt(parts[3] || `${activeMeasureRange[0]}`, 10);
      const endBar = Math.min(targetBar + 2, activeMeasureRange[1]);
      setCoachTargetMeasures([targetBar, endBar]);
      setCoachStrategyId(scenario);
      setIsCoachModalOpen(true);
      return;
    }

    if (key === 'switch_to_tap') {
      setInputMode('tap');
      setChatMessages(prev => [
        ...prev,
        {
          id: `tap_${Date.now()}`,
          sender: 'mascot',
          text: "Developer Tap Mode active. Click 'Start Practice' to begin.",
          timestamp: 'Now',
        }
      ]);
      return;
    }

    if (key.startsWith('focus_bar_')) {
      const mNum = parseInt(key.replace('focus_bar_', ''), 10);
      if (!isNaN(mNum)) {
        setViewMode('focus');
        setStartFromMeasure(mNum);
        const targetBeat = scorePlaybackData?.measureStartBeats?.[mNum - 1] ?? ((mNum - 1) * 4);
        setStartFromBeat(targetBeat);
        setChatMessages(prev => [
          ...prev,
          {
            id: `focus_${Date.now()}`,
            sender: 'mascot',
            text: `Focused on Bar ${mNum}. Let's work on this rhythm together.`,
            timestamp: 'Now',
          }
        ]);
      }
    } else if (key.startsWith('tempo_')) {
      const targetTempo = parseInt(key.replace('tempo_', ''), 10);
      if (!isNaN(targetTempo)) {
        handleBpmChange(targetTempo);
        setChatMessages(prev => [
          ...prev,
          {
            id: `tempo_${Date.now()}`,
            sender: 'mascot',
            text: `Tempo adjusted to ${targetTempo} BPM. Ready when you are!`,
            timestamp: 'Now',
          }
        ]);
      }
    } else if (key === 'play_instrument_test') {
      handleStartOptionATest();
    } else if (key === 'record_take_now') {
      handleStartRecordingTake();
    } else if (key === 'rehearse_again') {
      handleStartPractice(currentBpm);
    } else if (key === 'tempo_step_3') {
      const nextBpm = Math.min(intendedBpm, currentBpm + 3);
      setFrontDoorStep('tempo_ladder');
      frontDoorStepRef.current = 'tempo_ladder';
      handleStartPractice(nextBpm);
    } else if (key === 'tempo_step_5') {
      const nextBpm = Math.min(intendedBpm, currentBpm + 5);
      setFrontDoorStep('tempo_ladder');
      frontDoorStepRef.current = 'tempo_ladder';
      handleStartPractice(nextBpm);
    } else if (key === 'tempo_step_10') {
      const nextBpm = Math.min(intendedBpm, currentBpm + 10);
      setFrontDoorStep('tempo_ladder');
      frontDoorStepRef.current = 'tempo_ladder';
      handleStartPractice(nextBpm);
    } else if (key === 'tempo_step_down_5') {
      const nextBpm = Math.max(40, currentBpm - 5);
      setFrontDoorStep('tempo_ladder');
      frontDoorStepRef.current = 'tempo_ladder';
      handleStartPractice(nextBpm);
    } else if (key === 'tempo_step_down_10') {
      const nextBpm = Math.max(40, currentBpm - 10);
      setFrontDoorStep('tempo_ladder');
      frontDoorStepRef.current = 'tempo_ladder';
      handleStartPractice(nextBpm);
    } else if (key.startsWith('next_sec_')) {
      const targetSecId = key.replace('next_sec_', '');
      const sec = availableSections.find(s => s.id === targetSecId);
      if (sec) handleSelectSection(sec);
    } else if (key === 'listen_demo') {
      handleStartListenDemo();
    } else if (key === 'ready_to_play') {
      if (frontDoorStepRef.current === 'option_a_shadowed' || repertoireShadowMode) {
        handleStartOptionATest();
      } else {
        handleStartPractice();
      }
    } else if (key === 'slower_tempo') {
      handlePresetSelect('slow');
      setChatMessages(prev => [
        ...prev,
        {
          id: `slow_${Date.now()}`,
          sender: 'mascot',
          text: `Tempo set to ${Math.round(intendedBpm * 0.7)} BPM. Try it at this speed.`,
          timestamp: 'Now',
        },
      ]);
    } else if (key === 'give_hint') {
      setChatMessages(prev => [
        ...prev,
        {
          id: `hint_${Date.now()}`,
          sender: 'mascot',
          text: "Keep your airflow steady and match each note to the click.",
          timestamp: 'Now',
        },
      ]);
    }
  };

  // Submit take to teacher & shared studio storage
  const handleSubmitTake = async () => {
    submitSectionToTeacher(session.sessionId, sectionId);
    setIsSubmitted(true);
    setShowTakeModal(false);

    // 1. Upload audio recording file to shared storage if available
    let uploadedMediaUrl: string | undefined = undefined;
    if (latestTakeBlobRef.current && recentTake) {
      const filename = `take_${session.sessionId}_${recentTake.id}.webm`;
      const url = await uploadRecordingTake(latestTakeBlobRef.current, filename);
      if (url) uploadedMediaUrl = url;
    }

    // 2. Link student, exercise, practice session, and diagnostics into StoredSubmission
    const activeStudentId = studentId || session.studentId || 'stud_alex';
    const activeStudentName = studentName || session.studentName || 'Alex Morgan';

    await saveSubmissionToStorage({
      id: `sub_${session.sessionId}_${activeSectionId}`,
      exerciseId: exerciseId || '',
      sessionId: session.sessionId,
      studentId: activeStudentId,
      studentName: activeStudentName,
      pieceName: pieceTitle,
      instrumentName: instrumentName,
      submittedAt: new Date().toISOString(),
      sectionId: activeSectionId,
      sectionName: activeSectionTitle,
      measureRange: activeMeasureRange,
      timeSpentSeconds: sectionTimeSeconds,
      takes: recentTake ? [
        {
          id: recentTake.id,
          takeNumber: recentTake.takeNumber,
          timestamp: recentTake.timestamp,
          mode: recentTake.mode,
          mediaFile: uploadedMediaUrl || recentTake.blobUrl || '',
          durationSeconds: recentTake.durationSeconds,
          tempoUsed: recentTake.tempoUsed,
          selfRating: recentTake.selfRating
        }
      ] : [],
    });

    setChatMessages(prev => [
      ...prev,
      {
        id: `submit_${Date.now()}`,
        sender: 'mascot',
        text: `🚀 Sent to your teacher! Your take recording, practicing stopwatch (${formatDuration(sectionTimeSeconds)}), and diagnostic results are saved in the shared studio storage.`,
        timestamp: 'Just now',
        highlight: true,
      },
    ]);
  };

  // ------------------------------------------------------------------
  // Student Portal Navigation & Timeline Controls
  // ------------------------------------------------------------------
  const [activeNavTab, setActiveNavTab] = useState<'score' | 'plan' | 'recordings'>('score');
  const [isCoachDrawerOpen, setIsCoachDrawerOpen] = useState<boolean>(false);

  const timelineStartBeat = viewMode === 'full' ? 0
    : scorePlaybackData?.measureStartBeatByNumber?.[activeMeasureRange[0]]
      ?? scorePlaybackData?.measureStartBeats?.[activeMeasureRange[0] - 1] ?? 0;
  const timelineStartSec = scorePlaybackData ? beatToSeconds(timelineStartBeat, scorePlaybackData.tempos) : 0;
  const totalDurationSec = useMemo(() => {
    if (!scorePlaybackData) return 0;
    const measures = scorePlaybackData.metronomeMeasures || [];
    const end = viewMode === 'full' ? measures.at(-1)?.endBeat
      : measures.find(m => m.measureNumber === activeMeasureRange[1])?.endBeat;
    return end === undefined ? scorePlaybackData.durationInSeconds : beatToSeconds(end, scorePlaybackData.tempos);
  }, [scorePlaybackData, viewMode, activeMeasureRange]);

  const handleTimelineScrub = (seconds: number) => {
    if (!scorePlaybackData) return;
    const sec = Math.max(timelineStartSec, Math.min(totalDurationSec, seconds));
    const beat = secondsToBeats(sec, scorePlaybackData.tempos);
    setPlaybackProgress(sec);
    setStartFromBeat(beat);
    if (playbackPhase !== 'idle') audioEngineRef.current?.seekToScoreBeat(beat);
  };
  const handleRestartPlayback = () => handleTimelineScrub(timelineStartSec);
  const handleSkipForward = () => {
    const data = scorePlaybackData;
    if (!data) return;
    const beat = secondsToBeats(Math.max(timelineStartSec, playbackProgress), data.tempos);
    const next = data.metronomeMeasures?.find(m => m.startBeat > beat + 1e-7)?.startBeat;
    handleTimelineScrub(next === undefined ? totalDurationSec : beatToSeconds(next, data.tempos));
  };

  const displayedMeter = meterAtBeat(scorePlaybackData?.metronomeMeasures || [],
    playbackProgress > 0 ? secondsToBeats(playbackProgress, scorePlaybackData?.tempos || []) : (startFromBeat ?? scorePlaybackData?.measureStartBeatByNumber?.[activeMeasureRange[0]] ?? scorePlaybackData?.measureStartBeats?.[activeMeasureRange[0] - 1] ?? 0),
    scorePlaybackData?.initialTimeSignature);
  const usesQuarterPulse = pulseQuarterNotes(displayedMeter.numerator, displayedMeter.denominator) === 1;
  const displayedPulse = pulseQuarterNotes(displayedMeter.numerator, displayedMeter.denominator);
  const currentScoreBeat = secondsToBeats(Math.max(0, playbackProgress), scorePlaybackData?.tempos || []);
  const beatWithinBar = ('startBeat' in displayedMeter && typeof displayedMeter.startBeat === 'number' ? currentScoreBeat - displayedMeter.startBeat : currentScoreBeat) / displayedPulse;
  const activeMetronomeBeat = playbackPhase === 'count_in' ? countInNumber : playbackPhase === 'playing'
    ? Math.floor(beatWithinBar % countInPulses(displayedMeter.numerator, displayedMeter.denominator)) + 1 : null;

  return (
    <div className="flex h-screen w-screen bg-[#f5f5f7] text-slate-800 select-none overflow-hidden font-sans">
      {/* ------------------------------------------------------------------ */}
      {/* Region 1: Narrow Left Navigation */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-56 flex flex-col justify-between py-6 px-5 select-none shrink-0 border-r border-slate-200/60">
        <div>
          {/* Logo */}
          <div className="mb-7 pl-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-[#111c2e]">
              AIPC
            </h1>
          </div>

          {/* Piece Title and Student Part */}
          <div className="mb-7 pl-1">
            <p className="text-sm text-slate-500 font-medium mb-1 tracking-tight">Today's practice</p>
            <h2 className="text-[17px] font-bold text-slate-900 leading-snug tracking-tight">
              {(pieceTitle || 'Beautiful Danxia').replace(/\s+for\s+Concert\s+Band/i, '')}
            </h2>
            <p className="text-[14px] text-slate-700 font-medium mt-0.5">
              {instrumentName || 'Flute 2'}
            </p>
          </div>

          {/* Primary Navigation Tabs */}
          <nav className="space-y-2">
            <button
              onClick={() => setActiveNavTab('score')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all cursor-pointer ${
                activeNavTab === 'score'
                  ? 'bg-[#e2edfc] text-[#0071e3]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Music className="w-4.5 h-4.5 text-[#0071e3]" />
              <span>Score</span>
            </button>

            <button
              onClick={() => setActiveNavTab('plan')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all cursor-pointer ${
                activeNavTab === 'plan'
                  ? 'bg-[#e2edfc] text-[#0071e3]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Calendar className="w-4.5 h-4.5 text-slate-500" />
              <span>Practice plan</span>
            </button>

            <button
              onClick={() => setActiveNavTab('recordings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all cursor-pointer ${
                activeNavTab === 'recordings'
                  ? 'bg-[#e2edfc] text-[#0071e3]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users className="w-4.5 h-4.5 text-slate-500" />
              <span>Shared recordings</span>
            </button>
          </nav>
        </div>

      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Region 2: Central Score Workspace + Top Toolbar */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden p-3 pl-0 pr-3">
        {/* Top Toolbar matching Reference Mock-up */}
        <header className="relative z-30 min-h-14 py-2 gap-3 flex-wrap bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs px-4 flex items-center justify-between shrink-0 mb-3 select-none">
          {/* Left Group: Playback & Timeline Scrubber */}
          <div className="flex items-center gap-3">
            {/* |< Restart */}
            <button
              onClick={handleRestartPlayback}
              className="text-slate-600 hover:text-slate-950 transition-colors p-1 cursor-pointer"
              title="Restart from beginning"
            >
              <SkipBack className="w-4.5 h-4.5 fill-current" />
            </button>

            {/* Royal Blue Play/Pause */}
            <button
              onClick={playbackPhase !== 'idle' ? handleFinishPlayback : handleStartPractice}
              className="w-9 h-9 rounded-full bg-[#0071e3] hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25 transition-transform active:scale-95 cursor-pointer"
              title={playbackPhase !== 'idle' ? 'Pause Practice' : 'Start Practice'}
            >
              {playbackPhase !== 'idle' ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* >| Skip */}
            <button
              onClick={handleSkipForward}
              className="text-slate-600 hover:text-slate-950 transition-colors p-1 cursor-pointer"
              title="Skip forward"
            >
              <SkipForward className="w-4.5 h-4.5 fill-current" />
            </button>

            {/* Timeline Text & Scrubber Slider */}
            <div className="flex items-center gap-2.5 ml-1">
              <span className="text-[13.5px] font-mono font-bold text-slate-800 tracking-tight select-none">
                {formatDuration(Math.max(0, playbackProgress))} / {formatDuration(totalDurationSec)}
              </span>
              <div className="w-32 sm:w-44 flex items-center">
                <input
                  type="range"
                  aria-label="Playback position"
                  min={timelineStartSec}
                  max={totalDurationSec}
                  step="0.1"
                  value={Math.max(timelineStartSec, Math.min(totalDurationSec, playbackProgress))}
                  onChange={(e) => handleTimelineScrub(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#d6e4f8] rounded-lg appearance-none cursor-pointer accent-[#0071e3]"
                />
              </div>
            </div>
          </div>

          <MetronomeControls
            quarterBpm={currentBpm}
            numerator={displayedMeter.numerator}
            denominator={displayedMeter.denominator}
            subdivision={subdivision}
            muted={isMetronomeMuted}
            countIn={countInEnabled}
            activeBeat={activeMetronomeBeat}
            onBpmChange={handleBpmChange}
            onSubdivisionChange={handleSubdivisionChange}
            onMutedChange={muted => { setIsMetronomeMuted(muted); audioEngineRef.current?.setMetronomeMuted(muted); }}
            onCountInChange={setCountInEnabled}
          />
        </header>

        {/* Central Card: Score, Plan or Shared Recordings */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-white/90 backdrop-blur-xs rounded-2xl border border-slate-200/80 shadow-xs">
          {activeNavTab === 'score' && (
            <>
              {/* Sheet Music Score Area */}
              <div className="flex-1 overflow-auto min-h-0 relative">
                <StudentScoreViewer
                  xmlUrl={xmlUrl}
                  xmlContent={xmlContent}
                  startMeasure={activeMeasureRange[0]}
                  endMeasure={activeMeasureRange[1]}
                  sectionStartMeasure={currentSection ? currentSection.startMeasure : measureRange[0]}
                  sectionEndMeasure={currentSection ? currentSection.endMeasure : measureRange[1]}
                  totalMeasures={totalScoreMeasures}
                  viewMode={viewMode}
                  onViewModeChange={handleViewModeChange}
                  instrumentPartName={myPartName}
                  instrumentPartId={myPartId}
                  visiblePartIds={visiblePartIds}
                  playbackProgress={playbackProgress}
                  getPlaybackTime={readScorePlaybackTime}
                  isPlaying={playbackPhase !== 'idle'}
                  onScoreParsed={(data) => {
                    setScorePlaybackData(data);
                    const targetStartBeat = data.measureStartBeats?.[activeMeasureRange[0] - 1] ?? ((activeMeasureRange[0] - 1) * 4);
                    let secTempo = data.intendedBpm || 96;
                    if (data.tempos && data.tempos.length > 0) {
                      for (const t of data.tempos) {
                        if (t.beat <= targetStartBeat + 0.01) {
                          secTempo = t.bpm;
                        } else {
                          break;
                        }
                      }
                    }
                    setIntendedBpm(secTempo);
                    setCurrentBpm(secTempo);
                    setTempoPreset('target');
                    audioEngineRef.current?.preloadSoundfont(mapInstrumentToSoundfont(instrumentName));
                    audioEngineRef.current?.preloadInstruments(data.parts.map(p => mapInstrumentToSoundfont(p.name)));
                  }}
                  onSeek={(targetSec, beat, measureNum) => {
                    setPlaybackProgress(targetSec);
                    if (beat !== undefined) setStartFromBeat(beat);
                    if (measureNum !== undefined) setStartFromMeasure(measureNum);

                    let targetBarTempo = currentBpm;
                    if (beat !== undefined) {
                      targetBarTempo = getTempoAtBeat(beat);
                      setIntendedBpm(targetBarTempo);
                      setCurrentBpm(targetBarTempo);
                      setTempoPreset('target');
                      audioEngineRef.current?.setBpm(targetBarTempo);
                    }

                    if (playbackPhase !== 'idle') {
                      audioEngineRef.current?.seekToScoreBeat(beat ?? 0, targetBarTempo);
                    }
                  }}
                />

                {/* Non-intrusive floating count-in badge */}
                {countInNumber !== null && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-full shadow-lg border border-blue-500/40 text-white select-none text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                      <span className="font-bold text-blue-300">Count-in: Beat {countInNumber} of {countInTotal}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Single Small Floating Record Pill Control Beneath the Score */}
              <div className="py-2.5 flex justify-center shrink-0 border-t border-slate-100 bg-[#fdfdfd]/95 select-none">
                <button
                  onClick={playbackPhase === 'idle' ? handleStartRecordingTake : handleFinishPlayback}
                  className="px-5 py-2 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 shadow-xs flex items-center gap-2.5 text-[13px] font-semibold text-slate-800 transition-all active:scale-95 cursor-pointer hover:shadow-sm"
                >
                  <span className={`w-3 h-3 rounded-full bg-[#ef4444] shadow-2xs ${isRecordingTake ? 'animate-ping' : ''}`} />
                  <span>{isRecordingTake ? 'Stop recording' : 'Record practice'}</span>
                </button>
              </div>
            </>
          )}

          {/* Practice Plan Tab View */}
          {activeNavTab === 'plan' && (
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Practice Plan & Goals</h3>
                    <p className="text-xs text-slate-500">Assigned by Band Director for {instrumentName}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    Bars {activeMeasureRange[0]}–{activeMeasureRange[1]}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-sm font-bold text-slate-400 r">Teacher Objective</span>
                    <p className="text-xs font-medium text-slate-800">
                      Lock into 8th/16th subdivision clicks and anchor syncopations without rushing bar 28.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-sm font-bold text-slate-400 r">Recommended Tempo</span>
                    <p className="text-xs font-semibold text-slate-800 font-mono">{usesQuarterPulse ? '♩' : pulseQuarterNotes(displayedMeter.numerator, displayedMeter.denominator) === 1.5 ? '♩.' : 'Beat'} = {Math.round(currentBpm / pulseQuarterNotes(displayedMeter.numerator, displayedMeter.denominator))} BPM (Allegro con spirito)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-sm font-bold text-slate-400 r">Ensemble Backing</span>
                    <p className="text-xs text-slate-600">
                      Practice with the full Woodwinds/Ensemble accompaniment. Use Minus-One mode to mute Flute 2 so you can hear your own tone clearly against the ensemble.
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveNavTab('score')}
                    className="w-full py-2.5 rounded-xl bg-[#0071e3] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    Return to Score
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shared Recordings Tab View */}
          {activeNavTab === 'recordings' && (
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Shared Recordings & Studio Submissions</h3>
                    <p className="text-xs text-slate-500">Access your recorded practice takes and teacher feedback</p>
                  </div>
                  <button
                    onClick={() => setActiveNavTab('score')}
                    className="text-xs font-bold text-[#0071e3] hover:underline cursor-pointer"
                  >
                    Back to Score
                  </button>
                </div>

                {recentTake ? (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                          #{recentTake.takeNumber}
                        </span>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{pieceTitle} — Take #{recentTake.takeNumber}</h4>
                          <p className="text-sm text-slate-500">{new Date(recentTake.timestamp).toLocaleTimeString()} • {recentTake.durationSeconds}s • {recentTake.mode.toUpperCase()}</p>
                        </div>
                      </div>
                      {isSubmitted ? (
                        <span className="flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                        </span>
                      ) : (
                        <button
                          onClick={handleSubmitTake}
                          className="px-3.5 py-1.5 bg-[#0071e3] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Submit to Teacher
                        </button>
                      )}
                    </div>
                    <div className="rounded-lg overflow-hidden bg-slate-950 p-2">
                      <audio src={recentTake.blobUrl} controls className="w-full h-8" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-xl">
                      🎙️
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No recordings saved yet</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Press "Record practice" beneath the score to record an audio or video take. Your submitted takes will appear here.
                    </p>
                    <button
                      onClick={() => {
                        setActiveNavTab('score');
                        handleStartRecordingTake();
                      }}
                      className="mt-3 px-4 py-2 rounded-xl bg-[#0071e3] text-white text-xs font-bold shadow-xs hover:bg-blue-700 cursor-pointer"
                    >
                      Start Recording Practice
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Region 3: Compact Right Panel: Practise with */}
      {/* ------------------------------------------------------------------ */}
      <div className="py-3 pr-3 shrink-0 h-full">
        <div className="h-full rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <EnsembleMixerPanel
            userInstrument={instrumentName}
                parts={scoreParts.map(p => ({ id: p.id, name: p.name }))}
                myPartId={myPartId}
                onMyPartChange={handleMyPartChange}
            tracks={tracks}
            onTrackVolumeChange={(id, vol) => {
              setTracks(prev => prev.map(t => t.id === id ? { ...t, volume: vol } : t));
            }}
            onTrackMuteToggle={(id) => {
              // Ticking a part both plays it and shows its staff in the score (my own part always stays visible)
              setTracks(prev => prev.map(t => t.id === id ? { ...t, isMuted: !t.isMuted, isVisible: t.isMuted || !!t.isUserPart } : t));
            }}
            onTrackVisibilityToggle={(id) => {
              setTracks(prev => prev.map(t => t.id === id ? { ...t, isVisible: !t.isVisible } : t));
            }}
            isReferenceMidiActive={!isAudioMuted}
            onToggleReferenceMidi={(active) => {
              setIsAudioMuted(!active);
              audioEngineRef.current?.setAudioBackingMuted(!active);
            }}
            isMinusOneActive={isMinusOneActive}
            onToggleMinusOne={(active) => {
              setIsMinusOneActive(active);
            }}
            masterVolume={masterVolume}
            onMasterVolumeChange={(vol) => {
              setMasterVolume(vol);
              audioEngineRef.current?.setBackingVolumePercent(vol);
            }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Post-Take Review Modal (Watch/Listen & Submit to Teacher) */}
      {/* ------------------------------------------------------------------ */}
      {showTakeModal && recentTake && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-amber-300 dark:border-slate-700 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Take #{recentTake.takeNumber} Recorded!
                  </h3>
                  <p className="text-xs text-slate-500">
                    {sectionTitle} • Duration: {recentTake.durationSeconds}s
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTakeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Media Playback Preview */}
            <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[160px]">
              {recentTake.mode === 'video' ? (
                <video
                  src={recentTake.blobUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-56 object-contain"
                />
              ) : (
                <div className="w-full p-4 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Mic className="w-6 h-6" />
                  </div>
                  <audio src={recentTake.blobUrl} controls className="w-full mt-2" />
                </div>
              )}
            </div>

            {/* Submission Action */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setShowTakeModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs rounded-xl text-slate-700 dark:text-slate-300"
              >
                Practice Again
              </button>

              <button
                onClick={handleSubmitTake}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Submit Take to Teacher</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AIPC Pedagogical Strategy Coach Modal */}
      <AipcStrategyCoachModal
        isOpen={isCoachModalOpen}
        onClose={() => setIsCoachModalOpen(false)}
        xmlContent={xmlContent ?? null}
        pieceTitle={pieceTitle}
        measureRange={coachTargetMeasures}
        tempoBpm={currentBpm || intendedBpm || 112}
        initialStrategyId={coachStrategyId}
        onResolved={(summary) => {
          setCoachResolutionToast(summary);
          setIsCoachModalOpen(false);
          setChatMessages(prev => [
            ...prev,
            {
              id: `resolved_${Date.now()}`,
              sender: 'mascot',
              text: `🎉 Fantastic job! You mastered the 5-level strategy ladder: "${summary}". Your timing is locked in! Ready for a new take on the main score.`,
              timestamp: 'Just now',
              highlight: true,
              actionOptions: [
                { key: 'ready_to_play', label: 'Play Section Now', icon: '▶️', variant: 'success' },
                { key: 'listen_demo', label: 'Listen Demo', icon: '🎧', variant: 'secondary' },
              ]
            }
          ]);
        }}
      />

      {/* Resolution Toast Notification */}
      {coachResolutionToast && (
        <div className="fixed bottom-6 right-6 bg-white border border-slate-200 text-slate-800 px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block text-white">Strategy Practice Mastered!</span>
            <span>{coachResolutionToast}</span>
          </div>
          <button
            onClick={() => setCoachResolutionToast(null)}
            className="text-emerald-400 hover:text-white text-xs ml-2 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
