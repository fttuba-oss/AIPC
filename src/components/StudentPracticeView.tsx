import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Square, Mic, MicOff, Video, Clock, Send, CheckCircle2, Play, Music, Sparkles, Target
} from 'lucide-react';
import { StudentScoreViewer } from './StudentScoreViewer';
import { type MusicalSection } from '../types/portal';
import { StudentChatCompanion, type ChatMessage } from './StudentChatCompanion';
import { AipcStrategyCoachModal } from './AipcStrategyCoachModal';
import { mapDiagnosisToStrategyScenario } from '../strategies/strategyBridge';
import { StudentAudioEngine } from '../utils/studentAudioEngine';
import { StudentAcousticInput } from '../utils/studentAcousticInput';
import { secondsToBeats, mapInstrumentToSoundfont, getTargetPartAndNotes, type ScorePlaybackData } from '../utils/scorePlaybackParser';
import { RhythmDiagnosticEngine, type RhythmOnset, type RhythmDiagnosisResult, type RhythmAccuracyRating } from '../diagnostics';
import {
  MediaRecordingEngine,
  getOrCreateActiveSession,
  recordSectionTime,
  saveRecordedTake,
  submitSectionToTeacher,
  formatDuration,
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
}) => {
  // ------------------------------------------------------------------
  // Section Navigation & Practice Agenda State
  // ------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<'focus' | 'full'>('focus');
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

  // Audio & Metronome state: Solo Reference MIDI is OFF by default in practice
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [isMetronomeMuted, setIsMetronomeMuted] = useState<boolean>(false);
  const [intendedBpm, setIntendedBpm] = useState<number>(120);
  const [currentBpm, setCurrentBpm] = useState<number>(120);
  const [tempoPreset, setTempoPreset] = useState<'slow' | 'steady' | 'target' | 'custom'>('target');

  // Practice & Playback state
  const [playbackPhase, setPlaybackPhase] = useState<'idle' | 'count_in' | 'playing' | 'review'>('idle');
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
  const [inputMode, setInputMode] = useState<'mic' | 'tap'>('mic');
  const inputModeRef = useRef<'mic' | 'tap'>(inputMode);
  inputModeRef.current = inputMode;
  const [micLevel, setMicLevel] = useState<number>(0);
  const [tapFlash, setTapFlash] = useState<boolean>(false);
  const [tapCount, setTapCount] = useState<number>(0);

  // Recording Mode (Audio Only vs Video + Audio) - default audio
  const [recordingMode, setRecordingMode] = useState<'audio' | 'video'>('audio');
  const [isRecordingTake, setIsRecordingTake] = useState<boolean>(false);
  const [recentTake, setRecentTake] = useState<RecordedTake | null>(null);
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

  // Rhythm Diagnostic Layer (Decoupled & Modular)
  const rhythmDiagnosticEngineRef = useRef<RhythmDiagnosticEngine>(new RhythmDiagnosticEngine());
  const [rhythmDiagnosis, setRhythmDiagnosis] = useState<RhythmDiagnosisResult | null>(null);
  const [liveEvaluations, setLiveEvaluations] = useState<Record<number, RhythmAccuracyRating>>({});
  const evaluatedNotesSetRef = useRef<Set<number>>(new Set());
  const onsetsRef = useRef<RhythmOnset[]>([]);
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

  // Dynamic Strategy Proposal from Diagnosis
  const activeStrategyProposal = useMemo(() => {
    if (!rhythmDiagnosis) return null;
    return mapDiagnosisToStrategyScenario(
      rhythmDiagnosis,
      currentBpm || intendedBpm,
      activeMeasureRange
    );
  }, [rhythmDiagnosis, currentBpm, intendedBpm, activeMeasureRange]);

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

  // Instant Live Onset Evaluation: colors notes in real-time as you play!
  const handleLiveOnset = useCallback((elapsedSec: number, source: 'mic' | 'tap', energy?: number) => {
    // Demonstration playback is reference listening only — do not evaluate student onsets
    if (isListeningDemoRef.current) return;

    const validSec = Math.max(0, elapsedSec);
    onsetsRef.current.push({
      timestampSeconds: validSec,
      source,
      energy,
    });

    const {
      scorePlaybackData: spData,
      instrumentName: instName,
      activeMeasureRange: mRange,
      viewMode: vMode,
      startFromBeat: sBeat,
      currentBpm: cBpm,
      intendedBpm: iBpm,
    } = liveParamsRef.current;

    const { targetNotes, sectionStartBeat } = getTargetPartAndNotes(spData, instName, mRange);

    const match = rhythmDiagnosticEngineRef.current.evaluateLiveOnset({
      onsetSeconds: validSec,
      expectedNotes: targetNotes,
      tempos: spData?.tempos,
      startBeat: sectionStartBeat,
      currentBpm: cBpm,
      intendedBpm: iBpm,
      alreadyEvaluatedIndices: evaluatedNotesSetRef.current,
      liveEvaluations,
    });

    if (match) {
      evaluatedNotesSetRef.current.add(match.noteIndex);
      setLiveEvaluations(prev => ({
        ...prev,
        [match.noteIndex]: match.rating,
      }));
    }
  }, []);

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

  // Audio Engine Callbacks
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    engine.setOnTick((beatNumber, isCountIn) => {
      if (isCountIn) {
        setCountInNumber(beatNumber);
        setPlaybackPhase('count_in');
      } else {
        setCountInNumber(null);
        setPlaybackPhase('playing');
        if (playbackStartTimeRef.current === null) {
          playbackStartTimeRef.current = Date.now();
        }
      }
    });

    engine.setOnTimeUpdate((timeSec, _totalSec, elapsedRealSec) => {
      setPlaybackProgress(timeSec);
      const {
        scorePlaybackData: spData,
        instrumentName: instName,
        activeMeasureRange: mRange,
        viewMode: _vMode,
        startFromBeat: _sBeat,
        currentBpm: cBpm,
        intendedBpm: iBpm,
      } = liveParamsRef.current;

      if (spData?.tempos && timeSec >= 0) {
        const curBeat = secondsToBeats(timeSec, spData.tempos);
        const liveTempo = getTempoAtBeat(curBeat);
        setIntendedBpm(prev => {
          if (prev !== liveTempo) {
            if (tempoPreset === 'target') {
              setCurrentBpm(liveTempo);
            }
            return liveTempo;
          }
          return prev;
        });

        // Real-time missed note detection as playhead moves past notes (only during practice attempts, not demo listening)
        const elapsedSec = (elapsedRealSec !== undefined && elapsedRealSec > 0)
          ? elapsedRealSec
          : (playbackStartTimeRef.current !== null ? (Date.now() - playbackStartTimeRef.current) / 1000 : 0);

        if (!isListeningDemoRef.current && elapsedSec > 0) {
          const { targetNotes, sectionStartBeat } = getTargetPartAndNotes(spData, instName, mRange);

          const missed = rhythmDiagnosticEngineRef.current.findMissedNotes({
            currentElapsedSeconds: elapsedSec,
            expectedNotes: targetNotes,
            tempos: spData?.tempos,
            startBeat: sectionStartBeat,
            currentBpm: cBpm,
            intendedBpm: iBpm,
            alreadyEvaluatedIndices: evaluatedNotesSetRef.current,
          });

          if (missed.length > 0) {
            missed.forEach(idx => evaluatedNotesSetRef.current.add(idx));
            setLiveEvaluations(prev => {
              const next = { ...prev };
              missed.forEach(idx => {
                next[idx] = 'Miss';
              });
              return next;
            });
          }
        }
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
      (_time, energy) => {
        setTapCount(c => c + 1);
        setTapFlash(true);
        setTimeout(() => setTapFlash(false), 120);

        const transportSec = audioEngineRef.current?.getElapsedPlaybackSeconds() ?? 0;
        if (transportSec > 0) {
          handleLiveOnset(transportSec, 'mic', energy);
        } else if (playbackStartTimeRef.current !== null) {
          const elapsed = (Date.now() - playbackStartTimeRef.current) / 1000;
          if (elapsed >= -0.4) {
            handleLiveOnset(elapsed, 'mic', energy);
          }
        }
      },
      (level) => {
        setMicLevel(level);
      }
    );

    if (inputMode === 'mic') {
      input.start();
    } else {
      input.stop();
    }

  }, [inputMode, handleLiveOnset]);

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

    if (playbackPhase === 'idle') return;

    const transportSec = audioEngineRef.current?.getElapsedPlaybackSeconds() ?? 0;
    if (transportSec > 0) {
      handleLiveOnset(transportSec, 'tap');
    } else if (playbackStartTimeRef.current !== null) {
      const elapsedSec = (Date.now() - playbackStartTimeRef.current) / 1000;
      if (elapsedSec >= -0.4) {
        handleLiveOnset(elapsedSec, 'tap');
      }
    }
  }, [playbackPhase, handleLiveOnset, isAudioMuted]);

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
    const clamped = Math.max(30, Math.min(260, Math.round(newBpm)));
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
    onsetsRef.current = [];
    setRhythmDiagnosis(null);
    setLiveEvaluations({});
    evaluatedNotesSetRef.current.clear();
    setPlaybackProgress(-0.1);

    const spData = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    const instName = liveParamsRef.current.instrumentName || instrumentName;
    const mRange = liveParamsRef.current.activeMeasureRange || activeMeasureRange;

    const { activePart, targetNotes, sectionStartBeat, totalSectionEndBeat } = getTargetPartAndNotes(
      spData,
      instName,
      mRange
    );
    const activeNotes = activePart?.notes || [];
    const playbackStartBeat = (viewMode === 'full' && startFromBeat !== null) ? startFromBeat : sectionStartBeat;
    const totalBeats = Math.max(4, totalSectionEndBeat - sectionStartBeat);

    // Ground count-in tempo dynamically in the section being attempted
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
    const countInMs = (4 * (60 / effectiveBpm)) * 1000;
    playbackStartTimeRef.current = Date.now() + countInMs;

    if (inputMode === 'mic' && acousticInputRef.current && !acousticInputRef.current.getIsRunning()) {
      acousticInputRef.current.start();
    }

    setChatMessages(prev => [
      ...prev,
      {
        id: `practice_${Date.now()}`,
        sender: 'mascot',
        text: inputMode === 'mic'
          ? `Section tempo is ${effectiveBpm} BPM. Play along with the metronome click!`
          : `Section tempo is ${effectiveBpm} BPM. Tap along with each note on the keyboard!`,
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
        timeSignature: [4, 4],
        startMeasure: activeMeasureRange[0],
        endMeasure: activeMeasureRange[1],
        startBeat: sectionStartBeat,
        startFromBeat: playbackStartBeat,
        totalBeats,
        countInBeats: 4,
        instrumentName,
        notes: activeNotes,
        tempos: scorePlaybackData?.tempos,
      },
      effectiveBpm
    );

    setPlaybackPhase('playing');
  };

  // 2. Listen Demo Flow (Groundtruth reference playback - not scored as a student run)
  const handleStartListenDemo = async () => {
    isListeningDemoRef.current = true;
    setPlaybackPhase('count_in');
    setIsRecordingTake(false);
    onsetsRef.current = [];
    setRhythmDiagnosis(null);
    setLiveEvaluations({});
    evaluatedNotesSetRef.current.clear();
    setPlaybackProgress(-0.1);

    const spData = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    const instName = liveParamsRef.current.instrumentName || instrumentName;
    const mRange = liveParamsRef.current.activeMeasureRange || activeMeasureRange;

    const { activePart, targetNotes, sectionStartBeat, totalSectionEndBeat } = getTargetPartAndNotes(
      spData,
      instName,
      mRange
    );
    const activeNotes = activePart?.notes || [];
    const playbackStartBeat = (viewMode === 'full' && startFromBeat !== null) ? startFromBeat : sectionStartBeat;
    const totalBeats = Math.max(4, totalSectionEndBeat - sectionStartBeat);

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

    const countInMs = (4 * (60 / effectiveBpm)) * 1000;
    playbackStartTimeRef.current = Date.now() + countInMs;

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
        timeSignature: [4, 4],
        startMeasure: activeMeasureRange[0],
        endMeasure: activeMeasureRange[1],
        startBeat: sectionStartBeat,
        startFromBeat: playbackStartBeat,
        totalBeats,
        countInBeats: 4,
        instrumentName,
        notes: activeNotes,
        tempos: scorePlaybackData?.tempos,
      },
      effectiveBpm
    );

    setPlaybackPhase('playing');
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
        text: `🎺 Repertoire Front Door (Option A Rehearsal): Play on your instrument now at target tempo (${intendedBpm} BPM)! Let's test if your shadow rehearsal locked in.`,
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
    onsetsRef.current = [];
    setRhythmDiagnosis(null);
    setLiveEvaluations({});
    evaluatedNotesSetRef.current.clear();
    setPlaybackProgress(-0.1);

    const spData = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    const instName = liveParamsRef.current.instrumentName || instrumentName;
    const mRange = liveParamsRef.current.activeMeasureRange || activeMeasureRange;

    const { activePart, targetNotes, sectionStartBeat, totalSectionEndBeat } = getTargetPartAndNotes(
      spData,
      instName,
      mRange
    );
    const activeNotes = activePart?.notes || [];
    const playbackStartBeat = (viewMode === 'full' && startFromBeat !== null) ? startFromBeat : sectionStartBeat;
    const totalBeats = Math.max(4, totalSectionEndBeat - sectionStartBeat);

    // Ground count-in tempo dynamically in the section being attempted
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
    const countInMs = (4 * (60 / effectiveBpm)) * 1000;
    playbackStartTimeRef.current = Date.now() + countInMs;

    if (inputMode === 'mic' && acousticInputRef.current && !acousticInputRef.current.getIsRunning()) {
      acousticInputRef.current.start();
    }

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
        timeSignature: [4, 4],
        startMeasure: activeMeasureRange[0],
        endMeasure: activeMeasureRange[1],
        startBeat: sectionStartBeat,
        startFromBeat: playbackStartBeat,
        totalBeats,
        countInBeats: 4,
        instrumentName,
        notes: activeNotes,
        tempos: scorePlaybackData?.tempos,
      },
      effectiveBpm
    );

    setPlaybackPhase('playing');
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
      setRhythmDiagnosis(null);
      setLiveEvaluations({});
      evaluatedNotesSetRef.current.clear();
      onsetsRef.current = [];

      if (wasShadow) {
        if (!activeStrategyProposal) {
          setChatMessages(prev => [
            ...prev,
            {
              id: `shadow_fin_${Date.now()}`,
              sender: 'mascot',
              text: "🎧 Shadow Fingering pass complete! Choose your next step:",
              timestamp: 'Just now',
              actionOptions: [
                { key: 'play_instrument_test', label: '🎺 Play on Instrument Now', icon: '🎺', variant: 'primary' },
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

    const spData = liveParamsRef.current.scorePlaybackData || scorePlaybackData;
    const instName = liveParamsRef.current.instrumentName || instrumentName;
    const mRange = liveParamsRef.current.activeMeasureRange || activeMeasureRange;
    const cBpm = liveParamsRef.current.currentBpm || currentBpm;
    const iBpm = liveParamsRef.current.intendedBpm || intendedBpm;

    const { activePart, targetNotes, sectionStartBeat, totalSectionEndBeat } = getTargetPartAndNotes(
      spData,
      instName,
      mRange
    );
    const activeNotes = activePart?.notes || [];

    console.log('[handleFinishPlayback]', {
      instrumentName: instName,
      activePartName: activePart?.name,
      totalNotesInPart: activeNotes.length,
      targetNotesCount: targetNotes.length,
      activeMeasureRange: mRange,
      sectionStartBeat,
      totalSectionEndBeat,
      onsetsCount: onsetsRef.current.length,
    });

    // Evaluate all notes across the active range so every notehead shows its status (attempted or not attempted)
    const diagnosis = rhythmDiagnosticEngineRef.current.evaluate({
      expectedNotes: targetNotes,
      onsets: onsetsRef.current,
      tempos: spData?.tempos,
      startBeat: sectionStartBeat,
      endBeat: totalSectionEndBeat,
      startMeasure: mRange[0],
      endMeasure: mRange[1],
      currentBpm: cBpm,
      intendedBpm: iBpm,
    });

    console.log('[handleFinishPlayback diagnosis]', {
      evaluationsCount: Object.keys(diagnosis.evaluations).length,
      evaluations: diagnosis.evaluations,
      summaryText: diagnosis.summaryText,
    });

    setRhythmDiagnosis(diagnosis);

    const currentStep = frontDoorStepRef.current;
    const topMeasure = diagnosis.problemMeasureNumbers[0] ?? mRange[0];
    const hasMistake = diagnosis.problemMeasureNumbers.length > 0 || diagnosis.overallAccuracyPercent < 75;

    let mascotMessageText = diagnosis.summaryText;
    let actionOptions = diagnosis.remedyActions.map(r => ({
      key: r.actionKey,
      label: r.label,
      icon: r.icon,
      variant: r.variant,
    }));

    if (currentStep === 'option_a_testing') {
      if (hasMistake) {
        // Option A rehearsal done, student still makes mistake -> proceed to Option B (-20 BPM)
        setFrontDoorStep('option_b_suggested');
        frontDoorStepRef.current = 'option_b_suggested';
        const slowBpm = Math.max(40, iBpm - 20);

        mascotMessageText = `⚠️ Rehearsal check at full tempo (${cBpm} BPM): Timing or notes wavered (${diagnosis.overallAccuracyPercent}% accuracy) in Bar(s) ${diagnosis.problemMeasureNumbers.join(', ') || mRange.join('-')}. Let's proceed to Option B: Slower Tempo (-20 BPM = ${slowBpm} BPM) so your fingers and brain can lock into the pulse without rushing!`;
        actionOptions = [
          { key: 'repertoire_slow_tempo', label: `🐢 Start Option B (${slowBpm} BPM)`, icon: '🐢', variant: 'primary' },
          { key: 'repertoire_shadow_fingering', label: '🎧 Shadow Finger Again', icon: '🎧', variant: 'secondary' },
          { key: 'play_instrument_test', label: '🔁 Rehearse at Full Tempo', icon: '🔁', variant: 'secondary' },
        ];
      } else {
        // Student succeeded after Option A!
        setFrontDoorStep('idle');
        frontDoorStepRef.current = 'idle';
        mascotMessageText = `🎯 Brilliant rehearsal run! Accuracy was ${diagnosis.overallAccuracyPercent}% at ${cBpm} BPM. Your shadow practice locked your fingers in! Ready to record an official take for your teacher or continue forward.`;
        actionOptions = [
          { key: 'record_take_now', label: '🔴 Record Take for Teacher', icon: '🔴', variant: 'primary' },
          { key: 'play_instrument_test', label: '🔁 Rehearse Again', icon: '🔁', variant: 'secondary' },
          ...(nextSection ? [{ key: `next_sec_${nextSection.id}`, label: `Next Section (Bars ${nextSection.startMeasure}–${nextSection.endMeasure}) ➡️`, icon: '➡️', variant: 'success' as const }] : []),
        ];
      }
    } else if (currentStep === 'option_b_practicing' || currentStep === 'tempo_ladder') {
      // Option B Rehearsal finished: see if it gets better!
      if (!hasMistake) {
        // It got better!
        if (cBpm >= iBpm) {
          setFrontDoorStep('idle');
          frontDoorStepRef.current = 'idle';
          mascotMessageText = `🏆 Outstanding progress! You successfully climbed all the way back to target tempo (${iBpm} BPM) with ${diagnosis.overallAccuracyPercent}% accuracy! Ready to record your take for your teacher.`;
          actionOptions = [
            { key: 'record_take_now', label: '🔴 Record Take for Teacher', icon: '🔴', variant: 'primary' },
            { key: 'rehearse_again', label: '🔁 Rehearse Again at Target Tempo', icon: '🔁', variant: 'secondary' },
            ...(nextSection ? [{ key: `next_sec_${nextSection.id}`, label: `Next Section ➡️`, icon: '➡️', variant: 'success' as const }] : []),
          ];
        } else {
          // Progressive pick up tempo: student can choose +3, +5 (recommended), or +10 BPM
          setFrontDoorStep('tempo_ladder');
          frontDoorStepRef.current = 'tempo_ladder';
          const step3 = Math.min(iBpm, cBpm + 3);
          const step5 = Math.min(iBpm, cBpm + 5);
          const step10 = Math.min(iBpm, cBpm + 10);
          mascotMessageText = `🌟 Much better! Timing stabilized at ${cBpm} BPM (${diagnosis.overallAccuracyPercent}% accuracy). Now let's progressively pick up the tempo back toward target speed (${iBpm} BPM). Choose your tempo increase:`;
          actionOptions = [
            { key: 'tempo_step_5', label: `⚡ +5 BPM (${step5} BPM - Recommended)`, icon: '⚡', variant: 'primary' },
            { key: 'tempo_step_3', label: `🌱 +3 BPM (${step3} BPM - Gradual)`, icon: '🌱', variant: 'secondary' },
            { key: 'tempo_step_10', label: `🚀 +10 BPM (${step10} BPM - Fast Track)`, icon: '🚀', variant: 'amber' },
            { key: 'record_take_now', label: '🔴 Record Take Now', icon: '🔴', variant: 'secondary' },
          ];
        }
      } else {
        // Did not get better at reduced tempo. Check if complex rhythm problem:
        const hasSyncopationOrTies = targetNotes.some((n: any) => n.isTie || n.isTuplet || (n.beat % 1 !== 0 && n.beat % 0.5 !== 0));
        const isGenuineRhythmDeficit = diagnosis.disambiguation?.likelyCause === 'genuine_rhythm_deficit';
        const isOffbeatProblem = diagnosis.summaryText.toLowerCase().includes('offbeat') ||
                                 diagnosis.summaryText.toLowerCase().includes('syncopat') ||
                                 diagnosis.summaryText.toLowerCase().includes('tie') ||
                                 diagnosis.summaryText.toLowerCase().includes('drift');

        const isComplexRhythm = isGenuineRhythmDeficit || hasSyncopationOrTies || isOffbeatProblem;

        if (isComplexRhythm) {
          // Escalate to Rhythm Gym
          let strategyScenario = 'rushing';
          if (diagnosis.measureDiagnoses[topMeasure]?.primaryIssue === 'missed_notes') {
            strategyScenario = 'syncopation';
          } else if (diagnosis.measureDiagnoses[topMeasure]?.primaryIssue === 'uneven') {
            strategyScenario = 'subdivision';
          } else if (diagnosis.measureDiagnoses[topMeasure]?.primaryIssue === 'dragging') {
            strategyScenario = 'execution';
          }

          mascotMessageText = `⚠️ Complex Rhythm Pattern Detected: Even at slower tempo (${cBpm} BPM), timing is unstable (${diagnosis.summaryText}). Slower tempo alone cannot solve this syncopation/tie pattern—let's take a quick 60-second pit stop in the Rhythm Portal to isolate and lock into the pulse!`;
          actionOptions = [
            { 
              key: `start_strategy_${strategyScenario}_${topMeasure}`, 
              label: '🛠️ Enter Rhythm Portal (Isolate Pulse)', 
              icon: '🛠️', 
              variant: 'primary' 
            },
            { key: 'tempo_step_down_5', label: `🐢 Drop Tempo -5 BPM (${Math.max(40, cBpm - 5)} BPM)`, icon: '🐢', variant: 'secondary' },
            { key: 'repertoire_shadow_fingering', label: '🎧 Shadow Finger with Audio', icon: '🎧', variant: 'secondary' },
          ];
        } else {
          // Other kinds of problems: fingering bottleneck, note transitions -> tempo ladder down then up
          setFrontDoorStep('tempo_ladder');
          frontDoorStepRef.current = 'tempo_ladder';
          const down5 = Math.max(40, cBpm - 5);
          const down10 = Math.max(40, cBpm - 10);
          mascotMessageText = `🎹 Note & Fingering Transition Bottleneck: Your pulse is fine, but the finger shifts or note transitions need more stabilization (${diagnosis.summaryText}). Let's ladder tempo down another step to find your solid baseline, then ladder back up!`;
          actionOptions = [
            { key: 'tempo_step_down_5', label: `🐢 Drop Tempo -5 BPM (${down5} BPM)`, icon: '🐢', variant: 'primary' },
            { key: 'tempo_step_down_10', label: `🐢 Drop Tempo -10 BPM (${down10} BPM)`, icon: '🐢', variant: 'secondary' },
            { key: 'repertoire_shadow_fingering', label: '🎧 Silent Shadow Fingering', icon: '🎧', variant: 'secondary' },
          ];
        }
      }
    }

    // When Repertoire Front Door (activeStrategyProposal) is active, it handles the interactive
    // progression and options directly. Suppress competing diagnostic messages and conflicting action chips in Toots.
    if (!activeStrategyProposal) {
      setChatMessages(prev => [
        ...prev,
        {
          id: `diag_${Date.now()}`,
          sender: 'mascot',
          text: mascotMessageText,
          timestamp: 'Just now',
          highlight: diagnosis.problemMeasureNumbers.length > 0 || onsetsRef.current.length === 0,
          actionOptions,
        },
      ]);
    }

    if (isRecordingTake) {
      setIsRecordingTake(false);
      const result = await recorderRef.current?.stop();
      if (result) {
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

  // Submit take to teacher
  const handleSubmitTake = () => {
    submitSectionToTeacher(session.sessionId, sectionId);
    setIsSubmitted(true);
    setShowTakeModal(false);
    setChatMessages(prev => [
      ...prev,
      {
        id: `submit_${Date.now()}`,
        sender: 'mascot',
        text: `🚀 Sent to your teacher! They will review your take and time spent (${formatDuration(sectionTimeSeconds)}).`,
        timestamp: 'Just now',
        highlight: true,
      },
    ]);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Top Header Bar (iPad Clean & Tactile) */}
      {/* ------------------------------------------------------------------ */}
      <header className="h-14 shrink-0 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-xs rounded-xl border border-slate-300 dark:border-slate-700 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Teacher Portal</span>
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm md:text-base text-slate-900 dark:text-white">
                {viewMode === 'full' ? 'Full Piece Practice' : activeSectionTitle}
              </h1>
              <span className="text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded-md">
                {viewMode === 'full' ? `Bars 1–${totalScoreMeasures}` : `Bars ${activeMeasureRange[0]}–${activeMeasureRange[1]}`}
              </span>
              {viewMode === 'full' && startFromMeasure && (
                <span className="text-[10px] font-bold bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-300 px-2 py-0.5 rounded-md">
                  From Bar {startFromMeasure}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {pieceTitle} • {instrumentName}
            </p>
          </div>
        </div>

        {/* Practice Timer & Submission status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleLaunchCoachStrategy()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            title="Open AIPC Strategy Coach (Fading Ladder & Cross Rhythms)"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>AIPC Strategy Coach</span>
          </button>

          {isSubmitted && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl border border-emerald-300 dark:border-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Submitted</span>
            </span>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main Practice Workspace (Full-Width Score with Bottom Companion Dock) */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 flex flex-col p-2.5 sm:p-3 gap-2 overflow-hidden min-h-0">
        {/* Full-Width Score Area (Hero Element) */}
        <div className="flex-1 flex flex-col min-h-0 relative w-full">
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
            instrumentPartName={instrumentName}
            playbackProgress={playbackProgress}
            isPlaying={playbackPhase !== 'idle'}
            noteEvaluations={
              (rhythmDiagnosis && Object.keys(rhythmDiagnosis.evaluations).length > 0)
                ? rhythmDiagnosis.evaluations
                : (Object.keys(liveEvaluations).length > 0 ? liveEvaluations : undefined)
            }
            problemMeasures={rhythmDiagnosis?.problemMeasureNumbers}
            onClearEvaluations={() => {
              setRhythmDiagnosis(null);
              setLiveEvaluations({});
              evaluatedNotesSetRef.current.clear();
            }}
            onScoreParsed={(data) => {
              setScorePlaybackData(data);
              const targetStartBeat = data.measureStartBeats?.[activeMeasureRange[0] - 1] ?? ((activeMeasureRange[0] - 1) * 4);
              let secTempo = data.intendedBpm || 120;
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
            }}
            onSeek={(targetSec, beat, measureNum) => {
              setPlaybackProgress(targetSec);
              if (beat !== undefined) setStartFromBeat(beat);
              if (measureNum !== undefined) setStartFromMeasure(measureNum);

              // Automatically match tempo to the exact bar the cursor is pointing to
              if (beat !== undefined) {
                const targetBarTempo = getTempoAtBeat(beat);
                setIntendedBpm(targetBarTempo);
                setCurrentBpm(targetBarTempo);
                setTempoPreset('target');
                audioEngineRef.current?.setBpm(targetBarTempo);
              }

              if (playbackPhase !== 'idle') {
                audioEngineRef.current?.seekToScoreBeat(beat ?? 0);
              }
            }}
          />

          {/* Visual Count-In: Sleek, non-intrusive floating indicator (Score remains 100% visible) */}
          {countInNumber !== null && (
            <>
              {/* Subtle pulsing accent line at the top of the score container */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/10 via-amber-500 to-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.6)] z-30 pointer-events-none transition-all duration-150" />

              {/* Floating Count-In Pill docked cleanly below score header */}
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-md rounded-full shadow-xl border border-amber-500/40 text-white select-none">
                  {/* Status badge */}
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Count-in</span>
                  </div>

                  <div className="h-4 w-px bg-slate-700/80" />

                  {/* 4 Beat Pips with dynamic active highlights */}
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((beat) => {
                      const isCurrent = beat === countInNumber;
                      const isPast = beat < countInNumber;
                      return (
                        <div
                          key={beat}
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs transition-all duration-150 ${
                            isCurrent
                              ? 'bg-amber-400 text-amber-950 scale-110 shadow-md shadow-amber-400/50 ring-2 ring-amber-300'
                              : isPast
                              ? 'bg-amber-900/60 text-amber-300 border border-amber-600/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/80'
                          }`}
                        >
                          {beat}
                        </div>
                      );
                    })}
                  </div>

                  <div className="h-4 w-px bg-slate-700/80" />

                  {/* Clear text status */}
                  <span className="text-xs font-bold text-amber-300 whitespace-nowrap">
                    Beat {countInNumber} of 4
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Horizontal Front Door Intervention Ribbon (when active) */}
        {activeStrategyProposal && (
          <div className="px-3 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/80 border border-purple-500/40 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-2 shrink-0 animate-in fade-in select-none">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-purple-300 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Repertoire Front Door</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 shrink-0">
                Bars {activeStrategyProposal.targetMeasures[0]}–{activeStrategyProposal.targetMeasures[1]}
              </span>

              {/* Diagnostic Sieve Notice */}
              {rhythmDiagnosis?.disambiguation ? (
                <span className="text-[11px] font-bold text-amber-300 bg-slate-950/70 px-2.5 py-0.5 rounded-lg border border-slate-700/60 truncate flex items-center gap-1">
                  <span>
                    {rhythmDiagnosis.disambiguation.likelyCause === 'cognitive_speed_load' && '🎯 Speed Comfort Limit'}
                    {rhythmDiagnosis.disambiguation.likelyCause === 'mechanical_note_bottleneck' && '🎹 Note/Fingering Bottleneck'}
                    {rhythmDiagnosis.disambiguation.likelyCause === 'genuine_rhythm_deficit' && '⚠️ Confirmed Rhythm Deficit'}
                    {rhythmDiagnosis.disambiguation.likelyCause === 'inconclusive' && '🎼 Timing Irregularity'}
                  </span>
                  <span className="text-slate-300 font-normal text-[10px] hidden sm:inline">• {rhythmDiagnosis.disambiguation.reason}</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-300 hidden md:inline">
                  Work on real notes first before isolating.
                </span>
              )}
            </div>

            {/* Front-Door Strategy Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {(repertoireShadowMode || frontDoorStep === 'option_a_shadowed') && playbackPhase === 'idle' ? (
                <button
                  onClick={handleStartOptionATest}
                  className="py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Step 2: Play on Instrument Now</span>
                </button>
              ) : frontDoorStep === 'option_b_suggested' && playbackPhase === 'idle' ? (
                <button
                  onClick={handleStartRepertoireSlow}
                  className="py-1.5 px-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start Option B ({Math.max(40, intendedBpm - 20)} BPM)</span>
                </button>
              ) : frontDoorStep === 'tempo_ladder' && playbackPhase === 'idle' ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-emerald-300 hidden sm:inline">Tempo:</span>
                  <button
                    onClick={() => handleQuickAction('tempo_step_3')}
                    className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold border border-slate-600 active:scale-95 cursor-pointer"
                  >
                    +3 BPM
                  </button>
                  <button
                    onClick={() => handleQuickAction('tempo_step_5')}
                    className="py-1 px-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold border border-emerald-500 active:scale-95 cursor-pointer"
                  >
                    +5 BPM
                  </button>
                  <button
                    onClick={() => handleQuickAction('tempo_step_10')}
                    className="py-1 px-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold border border-amber-500 active:scale-95 cursor-pointer"
                  >
                    +10 BPM
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleStartRepertoireShadow}
                    className="py-1.5 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <span>🎧 Option A (Shadow)</span>
                  </button>
                  <button
                    onClick={handleStartRepertoireSlow}
                    className="py-1.5 px-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <span>🐢 Option B (-20 BPM)</span>
                  </button>
                </div>
              )}

              {rhythmDiagnosis?.disambiguation?.likelyCause === 'genuine_rhythm_deficit' && (
                <button
                  onClick={() => handleLaunchCoachStrategy(activeStrategyProposal.scenarioId, activeStrategyProposal.targetMeasures)}
                  className="text-[11px] font-bold underline cursor-pointer flex items-center gap-1 text-amber-400 hover:text-amber-300 animate-pulse transition ml-1"
                >
                  <Target className="w-3 h-3" />
                  <span>Rhythm Portal</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Compact Horizontal Companion Dock (Toots) */}
        <StudentChatCompanion
          instrumentName={instrumentName}
          messages={chatMessages}
          onQuickAction={handleQuickAction}
          onSendMessage={(text) => {
            setChatMessages(prev => [
              ...prev,
              {
                id: `user_${Date.now()}`,
                sender: 'student',
                text,
                timestamp: 'Just now'
              }
            ]);
            setTimeout(() => {
              setChatMessages(prev => [
                ...prev,
                {
                  id: `mascot_${Date.now()}`,
                  sender: 'mascot',
                  text: `Great question! Focus on a steady breath and locked-in subdivision. Let's run ${sectionTitle}!`,
                  timestamp: 'Just now',
                  actionOptions: [
                    { key: 'listen_demo', label: 'Play Demo', icon: '👂', variant: 'primary' },
                    { key: 'ready_to_play', label: 'Start Now', icon: '🎺', variant: 'amber' }
                  ]
                }
              ]);
            }, 600);
          }}
          isListening={isRecordingTake || playbackPhase === 'playing'}
          activeSectionName={sectionTitle}
          recordingMode={recordingMode}
          videoPreviewRef={videoPreviewRef}
          cameraStatus={cameraStatus}
          cameraStream={cameraStream}
        />
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Compact Status Bar: Acoustic Mic Level & Discreet Dev Spacebar / Tap Simulator */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Instrument Mic with ON/OFF Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextMode = inputMode === 'mic' ? 'tap' : 'mic';
              setInputMode(nextMode);
              if (nextMode === 'tap') {
                acousticInputRef.current?.stop();
                setMicLevel(0);
              } else {
                acousticInputRef.current?.start();
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              inputMode === 'mic'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-2xs'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
            title={inputMode === 'mic' ? 'Microphone is ON (Click to turn OFF)' : 'Microphone is OFF (Click to turn ON)'}
          >
            {inputMode === 'mic' ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>Mic: {inputMode === 'mic' ? 'ON' : 'OFF'}</span>
          </button>

          {inputMode === 'mic' ? (
            <div className="flex items-center gap-1.5">
              <div className="w-20 sm:w-28 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                {Math.round(micLevel * 100)}%
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-mono text-slate-400 select-none hidden sm:inline">
              (Mic Disabled)
            </span>
          )}
        </div>

        {/* Right: Discreet Developer Tap / Spacebar Mode */}
        <div className="flex items-center gap-1.5 py-0.5 px-2 bg-slate-200/60 dark:bg-slate-800/60 rounded-lg border border-slate-300/60 dark:border-slate-700/60">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase select-none tracking-tight">
            dev input:
          </span>

          <button
            onClick={() => {
              const nextMode = inputMode === 'tap' ? 'mic' : 'tap';
              setInputMode(nextMode);
              if (nextMode === 'tap') {
                acousticInputRef.current?.stop();
                setMicLevel(0);
              } else {
                acousticInputRef.current?.start();
              }
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer select-none flex items-center gap-1 ${
              inputMode === 'tap'
                ? 'bg-slate-700 text-white border-slate-600 shadow-2xs'
                : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
            }`}
            title={inputMode === 'tap' ? 'Tap input mode is ACTIVE (Click to switch back to Mic)' : 'Click to activate Spacebar / Tap input mode'}
          >
            <span>👆</span>
            <span>Tap Mode{inputMode === 'tap' ? ' (Active)' : ''}</span>
          </button>

          <button
            onClick={triggerDevTap}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all border cursor-pointer select-none flex items-center gap-1 ${
              tapFlash
                ? 'bg-slate-600 text-white border-slate-500 scale-95 ring-1 ring-slate-400'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-650'
            }`}
            title="Press Spacebar or Click to simulate tap onset"
          >
            <span>[Spacebar ␣]</span>
          </button>

          <button
            onClick={triggerDevTap}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all border cursor-pointer select-none flex items-center gap-0.5 ${
              tapFlash
                ? 'bg-slate-600 text-white border-slate-500 scale-95 ring-1 ring-slate-400'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-650'
            }`}
            title="Click or Tap to simulate onset"
          >
            <span>👆</span>
            <span>Tap</span>
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom Practice Action Bar (Big iPad-Friendly Buttons) */}
      {/* ------------------------------------------------------------------ */}
      <footer className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        {/* Group of Practice Buttons: 'Start Practice' + side options (Metronome & Reference MIDI) */}
        <div className="flex flex-wrap items-center gap-2.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
          {/* 'Start Practice' / 'Listen Demo' Buttons */}
          {playbackPhase !== 'idle' && !isRecordingTake ? (
            <button
              onClick={handleFinishPlayback}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs md:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>{isListeningDemoRef.current ? 'Stop Demo' : 'Stop Practice'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleStartPractice}
                disabled={playbackPhase !== 'idle' && isRecordingTake}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs md:text-sm rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Practice</span>
              </button>
              <button
                onClick={handleStartListenDemo}
                disabled={playbackPhase !== 'idle'}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs md:text-sm rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Listen to the reference tempo and rhythm before practicing"
              >
                <span>🎧</span>
                <span>Listen Demo</span>
              </button>
            </div>
          )}

          {/* Option 1: Metronome ON/OFF with Tempo Adjustment */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-slate-700">
            {/* Metronome Beat Toggle */}
            <button
              onClick={() => {
                const next = !isMetronomeMuted;
                setIsMetronomeMuted(next);
                audioEngineRef.current?.setMetronomeMuted(next);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                !isMetronomeMuted
                  ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 line-through'
              }`}
              title="Turn metronome on or off"
            >
              <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Metronome: {!isMetronomeMuted ? 'ON' : 'OFF'}</span>
            </button>

            {/* Interactive Metronome Tempo Adjustment Controller */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                onClick={() => handleBpmChange(currentBpm - 1)}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-black text-sm border border-slate-300 dark:border-slate-600 cursor-pointer active:scale-95"
                title="Decrease tempo by 1 BPM"
              >
                -
              </button>

              <div className="flex items-center gap-0.5 px-1 font-mono font-black text-xs text-amber-700 dark:text-amber-300 justify-center">
                <span>♩ =</span>
                <input
                  type="number"
                  min="30"
                  max="260"
                  value={currentBpm}
                  onChange={(e) => handleBpmChange(parseInt(e.target.value) || 120)}
                  className="w-9 bg-transparent text-center font-mono font-black text-xs text-amber-700 dark:text-amber-300 focus:outline-hidden focus:bg-white dark:focus:bg-slate-700 rounded px-0.5 border border-transparent hover:border-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-slate-500 font-sans font-semibold">BPM</span>
              </div>

              <button
                onClick={() => handleBpmChange(currentBpm + 1)}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-black text-sm border border-slate-300 dark:border-slate-600 cursor-pointer active:scale-95"
                title="Increase tempo by 1 BPM"
              >
                +
              </button>
            </div>
          </div>

          {/* Option 2: Reference MIDI ON/OFF Toggle */}
          <div className="pl-2 border-l border-slate-300 dark:border-slate-700">
            <button
              onClick={() => {
                const next = !isAudioMuted;
                setIsAudioMuted(next);
                audioEngineRef.current?.setAudioBackingMuted(next);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                !isAudioMuted
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 line-through'
              }`}
              title="Turn reference MIDI playback on or off"
            >
              <Music className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Reference MIDI: {!isAudioMuted ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Complete Standalone Button: Record Take (Video or Audio) */}
        <div className="flex items-center gap-2.5">
          {playbackPhase !== 'idle' && isRecordingTake ? (
            <button
              onClick={handleFinishPlayback}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop & Save Take</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              {/* Take Type Mode Selector (Video / Audio) */}
              <div className="flex p-0.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setRecordingMode('audio')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recordingMode === 'audio'
                      ? 'bg-amber-500 text-amber-950 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Audio Only Take"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Audio</span>
                </button>
                <button
                  onClick={() => setRecordingMode('video')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recordingMode === 'video'
                      ? 'bg-amber-500 text-amber-950 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Video + Audio Take"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Video</span>
                </button>
              </div>

              {/* Standalone Record Take Button */}
              <button
                onClick={handleStartRecordingTake}
                disabled={playbackPhase !== 'idle' && !isRecordingTake}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:opacity-40 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                title="Start recording a performance take"
              >
                <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
                <span>Record Take ({recordingMode === 'video' ? 'Video' : 'Audio'})</span>
              </button>
            </div>
          )}
        </div>
      </footer>

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
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
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
        <div className="fixed bottom-6 right-6 bg-emerald-950 border-2 border-emerald-500 text-emerald-200 px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5">
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
