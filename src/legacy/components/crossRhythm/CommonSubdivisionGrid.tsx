import React from 'react';
import { Layers, Volume2, VolumeX, Sparkles, Play, Pause, Headphones } from 'lucide-react';
import { playOrchestralWoodblockNote } from '../../strategies/classifications/rhythm/scaffolds/woodblockSoundfontEngine';

interface CommonSubdivisionGridProps {
  ratio?: [number, number]; // e.g. [3, 2] or [4, 3]
  bpm?: number;
  onBpmChange?: (bpm: number) => void;
  currentPhase?: number;     // 0.0 to 1.0 (if controlled externally)
  isPlaying?: boolean;
  slotVolume?: number;      // 0.0 to 1.0
  onVolumeChange?: (vol: number) => void;
  className?: string;
  highlightSlots?: number[]; // 1-based slots to highlight (e.g. [1, 4, 5])
  slotLabels?: Record<number, { title: string; subtitle?: string; badge?: string }>;
  patternName?: string;
}

export type ListeningMode = 'target' | 'layerA' | 'layerB' | 'composite';

export const CommonSubdivisionGrid: React.FC<CommonSubdivisionGridProps> = ({
  ratio = [3, 2],
  bpm = 80,
  onBpmChange,
  currentPhase: externalPhase,
  isPlaying = false,
  slotVolume = 1.0,
  onVolumeChange,
  className = '',
  highlightSlots,
  slotLabels,
  patternName,
}) => {
  const [m, n] = ratio;
  const totalSlots = m * n;

  const [internalPhase, setInternalPhase] = React.useState(0);
  const [listeningMode, setListeningMode] = React.useState<ListeningMode>('target');
  const [isGridAudioLooping, setIsGridAudioLooping] = React.useState(false);
  const animFrameRef = React.useRef<number | null>(null);
  const lastTimeRef = React.useRef<number | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const lastTriggeredSlotRef = React.useRef<number>(-1);

  // Cycle duration in seconds (for one beat or measure cycle)
  const cycleSeconds = (60 / bpm); // one quarter beat cycle

  const effectiveIsPlaying = isPlaying || isGridAudioLooping;

  // Sound synthesis helper
  // Web Audio click synthesis for grid listening

  const playSlotClick = (
    freq: number,
    type: OscillatorType = 'triangle',
    duration = 0.05,
    gainLevel = 0.22,
    isGreenBox = false
  ) => {
    if (slotVolume <= 0) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;

      const now = ctx.currentTime;

      if (isGreenBox) {
        // Green boxes: LOWEST pitch (150-160 Hz resonant bass) and LOUDEST volume (prominent grounding accent)
        osc.frequency.setValueAtTime(freq * 1.35, now);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.025);

        const targetGain = Math.min(0.85, gainLevel * slotVolume);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(targetGain, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      } else {
        // Non-green boxes (subdivisions): HIGHER pitch and significantly softer volume
        osc.frequency.setValueAtTime(freq, now);

        const targetGain = gainLevel * slotVolume;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(targetGain, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.01);
      }
    } catch (e) {
      console.warn('Grid audio click error', e);
    }
  };

  // Animation and phase advancement
  React.useEffect(() => {
    if (!effectiveIsPlaying || externalPhase !== undefined) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const loop = (time: number) => {
      if (lastTimeRef.current !== null) {
        const deltaSec = (time - lastTimeRef.current) / 1000;
        setInternalPhase((prev) => (prev + deltaSec / cycleSeconds) % 1.0);
      }
      lastTimeRef.current = time;
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [effectiveIsPlaying, externalPhase, cycleSeconds]);

  const currentPhase = externalPhase !== undefined ? externalPhase : internalPhase;

  // Active slot index (0-indexed internally, converted to 1-based for display)
  const activeSlot = Math.floor(currentPhase * totalSlots) % totalSlots;
  const activeSlot1Based = activeSlot + 1;

  // Determine attack slots (0-indexed internally)
  const layerASlots = new Set<number>();
  for (let k = 0; k < m; k++) {
    layerASlots.add(k * n);
  }

  const layerBSlots = new Set<number>();
  for (let j = 0; j < n; j++) {
    layerBSlots.add(j * m);
  }

  const highlightSlotsSet = highlightSlots ? new Set<number>(highlightSlots) : null;

  // Trigger grid audio clicks when entering new slot
  React.useEffect(() => {
    if (!effectiveIsPlaying) {
      lastTriggeredSlotRef.current = -1;
      return;
    }

    if (activeSlot !== lastTriggeredSlotRef.current) {
      lastTriggeredSlotRef.current = activeSlot;

      if (listeningMode === 'layerA') {
        if (layerASlots.has(activeSlot)) {
          const isGreenBox = activeSlot === 0;
          if (isGreenBox) {
            // Green Box: LOWEST (160 Hz) and LOUDEST (0.75)
            playSlotClick(160, 'triangle', 0.09, 0.75, true);
          } else {
            // Amber Boxes: higher pitch (780 Hz) and softer (0.22)
            playSlotClick(780, 'triangle', 0.04, 0.22, false);
          }
        }
      } else if (listeningMode === 'layerB') {
        if (layerBSlots.has(activeSlot)) {
          const isGreenBox = activeSlot === 0;
          if (isGreenBox) {
            // Green Box: LOWEST (160 Hz) and LOUDEST (0.75)
            playSlotClick(160, 'triangle', 0.09, 0.75, true);
          } else {
            // Cyan Box: higher pitch (540 Hz) and softer (0.22)
            playSlotClick(540, 'sine', 0.045, 0.22, false);
          }
        }
      } else if (listeningMode === 'composite') {
        const isHitA = layerASlots.has(activeSlot);
        const isHitB = layerBSlots.has(activeSlot);
        const isGreenBox = isHitA && isHitB;
        if (isGreenBox) {
          // Green Box Coincidence Downbeat: LOWEST (150 Hz) and LOUDEST (0.80)
          playSlotClick(150, 'triangle', 0.10, 0.80, true);
        } else if (isHitA) {
          // Layer A offbeat tick: higher (780 Hz) and softer (0.20)
          playSlotClick(780, 'triangle', 0.04, 0.20, false);
        } else if (isHitB) {
          // Layer B offbeat tick: higher (540 Hz) and softer (0.20)
          playSlotClick(540, 'sine', 0.045, 0.20, false);
        }
      } else if (listeningMode === 'target') {
        if (highlightSlotsSet?.has(activeSlot + 1) && audioCtxRef.current) {
          const now = audioCtxRef.current.currentTime;
          const isSlot1 = activeSlot + 1 === 1;
          if (isSlot1) {
            // Slot 1 (Downbeat Coincidence): Deep resonant Low Orchestral Woodblock
            playOrchestralWoodblockNote(audioCtxRef.current, now, 0.12, 'low', null, 0.90 * slotVolume);
          } else if (activeSlot + 1 === 4) {
            // Note 2 (Slot 4 Midpoint): Crisp High Orchestral Woodblock
            playOrchestralWoodblockNote(audioCtxRef.current, now, 0.08, 'high', null, 0.80 * slotVolume);
          } else if (activeSlot + 1 === 5) {
            // Note 3 (Slot 5 Triplet Offbeat): Bright High Orchestral Woodblock
            playOrchestralWoodblockNote(audioCtxRef.current, now, 0.08, 'high', null, 0.80 * slotVolume);
          } else {
            playOrchestralWoodblockNote(audioCtxRef.current, now, 0.08, 'high', null, 0.75 * slotVolume);
          }
        }
      }
    }
  }, [activeSlot, effectiveIsPlaying, listeningMode, slotVolume]);

  const toggleGridAudio = () => {
    if (!isGridAudioLooping) {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setIsGridAudioLooping(true);
    } else {
      setIsGridAudioLooping(false);
    }
  };

  return (
    <div className={`flex flex-col bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md ${className}`}>
      {/* Header & Volume */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide">
            Common Subdivision Matrix <span className="text-indigo-400 font-mono">({totalSlots} Slots)</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Interactive Tempo Controls */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            <span className="text-xs text-slate-400">Tempo:</span>
            {onBpmChange && (
              <button
                onClick={() => onBpmChange(Math.max(40, bpm - 5))}
                className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                title="Slower (-5 BPM)"
              >
                -
              </button>
            )}
            <span className="text-xs font-mono font-bold text-indigo-300 min-w-[50px] text-center">
              {bpm} BPM
            </span>
            {onBpmChange && (
              <button
                onClick={() => onBpmChange(Math.min(220, bpm + 5))}
                className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                title="Faster (+5 BPM)"
              >
                +
              </button>
            )}
          </div>

          {onVolumeChange && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400">Grid Vol:</span>
              <button
                onClick={() => onVolumeChange(slotVolume > 0 ? (slotVolume > 0.5 ? 0.5 : (slotVolume > 0.2 ? 0.2 : 0)) : 1.0)}
                className="text-xs font-mono font-bold text-indigo-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {slotVolume > 0 ? `${Math.round(slotVolume * 100)}%` : 'MUTED'}
                {slotVolume > 0 ? <Volume2 className="w-3 h-3 text-indigo-400" /> : <VolumeX className="w-3 h-3 text-rose-400" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step-by-Step Reference Listening Scaffolding */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Headphones className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-bold text-slate-300">Step-by-Step Reference Listening:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setListeningMode('layerA'); if (!effectiveIsPlaying) toggleGridAudio(); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
              listeningMode === 'layerA' && effectiveIsPlaying
                ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-bold ring-1 ring-amber-500/40'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Listen strictly to Layer A (3:2 Pulse)"
          >
            <span>🎧 Layer A ({m})</span>
          </button>

          <button
            onClick={() => { setListeningMode('layerB'); if (!effectiveIsPlaying) toggleGridAudio(); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
              listeningMode === 'layerB' && effectiveIsPlaying
                ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 font-bold ring-1 ring-cyan-500/40'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Listen strictly to Layer B (Duple Pulse)"
          >
            <span>🎧 Layer B ({n})</span>
          </button>

          <button
            onClick={() => { setListeningMode('composite'); if (!effectiveIsPlaying) toggleGridAudio(); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
              listeningMode === 'composite' && effectiveIsPlaying
                ? 'bg-purple-600/30 border-purple-500 text-purple-300 font-bold ring-1 ring-purple-500/40'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Listen to both layers interlocked"
          >
            <span>🎧 Composite</span>
          </button>

          <button
            onClick={() => { setListeningMode('target'); if (!effectiveIsPlaying) toggleGridAudio(); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
              listeningMode === 'target' && effectiveIsPlaying
                ? 'bg-pink-600/30 border-pink-500 text-pink-300 font-bold ring-1 ring-pink-500/40'
                : 'bg-slate-800/80 border-slate-700 text-pink-300 hover:text-white'
            }`}
            title="Listen to target whale attacks [1, 4, 5]"
          >
            <span>🎯 Target [1, 4, 5]</span>
          </button>

          <button
            onClick={toggleGridAudio}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1 ml-1 ${
              isGridAudioLooping
                ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white'
            }`}
          >
            {isGridAudioLooping ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
            <span>{isGridAudioLooping ? 'Pause Grid' : 'Play Grid'}</span>
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[480px]">
          {/* Slot Number Headers (1-based: 1, 2, 3, ...) */}
          <div className="grid grid-flow-col auto-cols-fr gap-1.5 mb-2">
            <div className="w-24 text-xs font-semibold text-slate-400 flex items-center">Slot:</div>
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const slotNumber = idx + 1;
              const isActive = effectiveIsPlaying && activeSlot === idx;
              const isHighlighted = highlightSlotsSet?.has(slotNumber);

              return (
                <div
                  key={`header-${idx}`}
                  className={`text-center py-1 text-xs font-mono rounded transition-all duration-75 ${
                    isActive 
                      ? 'bg-indigo-500 text-white font-bold shadow-lg scale-105 ring-2 ring-indigo-300' 
                      : isHighlighted
                      ? 'bg-purple-950/80 text-purple-300 font-bold border border-purple-500/40'
                      : 'bg-slate-800/70 text-slate-400'
                  }`}
                >
                  {slotNumber}
                </div>
              );
            })}
          </div>

          {/* Row 1: Layer A Attacks (m attacks) - Clean, NO words */}
          <div className="grid grid-flow-col auto-cols-fr gap-1.5 mb-2">
            <div className="w-24 text-xs font-medium text-amber-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              Layer A ({m}):
            </div>
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const isHit = layerASlots.has(idx);
              const isCoincidence = idx === 0;
              const isActive = effectiveIsPlaying && activeSlot === idx;

              return (
                <div
                  key={`layerA-${idx}`}
                  onClick={() => {
                    if (isHit) {
                      playSlotClick(isCoincidence ? 160 : 780, 'triangle', isCoincidence ? 0.09 : 0.04, isCoincidence ? 0.75 : 0.22, isCoincidence);
                    }
                  }}
                  className={`h-9 rounded-lg flex items-center justify-center transition-all duration-100 ${
                    isHit
                      ? isCoincidence
                        ? 'bg-emerald-600 shadow-md shadow-emerald-900/50 ring-1 ring-emerald-400 cursor-pointer hover:brightness-110 active:scale-95'
                        : 'bg-amber-600 shadow-sm cursor-pointer hover:brightness-110 active:scale-95'
                      : 'bg-slate-800/30 border border-slate-700/30'
                  } ${isActive && isHit ? 'scale-110 brightness-125 ring-2 ring-amber-300' : ''}`}
                  title={isHit ? (isCoincidence ? 'Green Box: Lowest Pitch & Loudest Downbeat' : 'Layer A Attack') : undefined}
                >
                  {isHit && (
                    <div className="w-3 h-3 rounded-full bg-white/90 shadow-xs" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 2: Layer B Attacks (n attacks) - Clean, NO words */}
          <div className="grid grid-flow-col auto-cols-fr gap-1.5 mb-2">
            <div className="w-24 text-xs font-medium text-cyan-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
              Layer B ({n}):
            </div>
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const isHit = layerBSlots.has(idx);
              const isCoincidence = idx === 0;
              const isActive = effectiveIsPlaying && activeSlot === idx;

              return (
                <div
                  key={`layerB-${idx}`}
                  onClick={() => {
                    if (isHit) {
                      playSlotClick(isCoincidence ? 160 : 540, isCoincidence ? 'triangle' : 'sine', isCoincidence ? 0.09 : 0.045, isCoincidence ? 0.75 : 0.22, isCoincidence);
                    }
                  }}
                  className={`h-9 rounded-lg flex items-center justify-center transition-all duration-100 ${
                    isHit
                      ? isCoincidence
                        ? 'bg-emerald-600 shadow-md shadow-emerald-900/50 ring-1 ring-emerald-400 cursor-pointer hover:brightness-110 active:scale-95'
                        : 'bg-cyan-600 shadow-sm cursor-pointer hover:brightness-110 active:scale-95'
                      : 'bg-slate-800/30 border border-slate-700/30'
                  } ${isActive && isHit ? 'scale-110 brightness-125 ring-2 ring-cyan-300' : ''}`}
                  title={isHit ? (isCoincidence ? 'Green Box: Lowest Pitch & Loudest Downbeat' : 'Layer B Attack') : undefined}
                >
                  {isHit && (
                    <div className="w-3 h-3 rounded-full bg-white/90 shadow-xs" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 3: Composite Pulse Rhythm */}
          <div className="grid grid-flow-col auto-cols-fr gap-1.5 mb-2">
            <div className="w-24 text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Composite:
            </div>
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const isHitA = layerASlots.has(idx);
              const isHitB = layerBSlots.has(idx);
              const isCoincidence = isHitA && isHitB;
              const isAny = isHitA || isHitB;
              const isActive = effectiveIsPlaying && activeSlot === idx;

              return (
                <div
                  key={`composite-${idx}`}
                  onClick={() => {
                    if (isCoincidence) {
                      playSlotClick(150, 'triangle', 0.10, 0.80, true);
                    } else if (isHitA) {
                      playSlotClick(780, 'triangle', 0.04, 0.20, false);
                    } else if (isHitB) {
                      playSlotClick(540, 'sine', 0.045, 0.20, false);
                    }
                  }}
                  className={`h-6 rounded flex items-center justify-center transition-all ${
                    isCoincidence
                      ? 'bg-emerald-500/80 ring-1 ring-emerald-300 cursor-pointer hover:brightness-110 active:scale-95'
                      : isAny
                      ? 'bg-purple-600/70 cursor-pointer hover:brightness-110 active:scale-95'
                      : 'bg-slate-800/20'
                  } ${isActive ? 'ring-2 ring-indigo-400' : ''}`}
                  title={isCoincidence ? 'Green Box: Coincidence Downbeat (Lowest & Loudest)' : isAny ? 'Subdivision Hit' : undefined}
                >
                  {isCoincidence ? (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  ) : isAny ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-200" />
                  ) : (
                    <span className="text-slate-600 text-xs">·</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 4: Custom Target Rhythm Pattern (Clean, NO words in pink boxes) */}
          {highlightSlotsSet && (
            <div className="grid grid-flow-col auto-cols-fr gap-1.5 pt-2 border-t border-slate-800/80">
              <div className="w-24 text-xs font-bold text-pink-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block animate-pulse"></span>
                {patternName || 'Target Attacks'}:
              </div>
              {Array.from({ length: totalSlots }).map((_, idx) => {
                const slotNumber = idx + 1;
                const isTargetHit = highlightSlotsSet.has(slotNumber);
                const isActive = effectiveIsPlaying && activeSlot === idx;

                return (
                  <div
                    key={`target-${idx}`}
                    onClick={() => {
                      if (isTargetHit) {
                        if (slotNumber === 1) {
                          playSlotClick(160, 'triangle', 0.09, 0.75, true);
                        } else if (slotNumber === 4) {
                          playSlotClick(580, 'sine', 0.045, 0.25, false);
                        } else if (slotNumber === 5) {
                          playSlotClick(750, 'triangle', 0.045, 0.25, false);
                        } else {
                          playSlotClick(700, 'triangle', 0.04, 0.22, false);
                        }
                      }
                    }}
                    className={`h-9 rounded-lg flex items-center justify-center transition-all duration-100 ${
                      isTargetHit
                        ? 'bg-gradient-to-b from-pink-600 to-purple-600 shadow-md shadow-pink-900/40 ring-1 ring-pink-400 cursor-pointer hover:brightness-110 active:scale-95'
                        : 'bg-slate-800/30 border border-slate-700/30'
                    } ${isActive && isTargetHit ? 'scale-110 brightness-125 ring-2 ring-pink-300' : ''}`}
                    title={isTargetHit ? `Slot ${slotNumber} Attack` : undefined}
                  >
                    {isTargetHit ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs ring-1 ring-pink-300" />
                    ) : (
                      <span className="text-slate-600 text-xs">·</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend & Target Attacks Key */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Coincidence (Slot 1)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Layer A ({m})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> Layer B ({n})
          </span>
          <span className="flex items-center gap-1.5 text-pink-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" /> Target Attacks: Slots 1, 4, 5
          </span>
        </div>
      </div>
    </div>
  );
};
