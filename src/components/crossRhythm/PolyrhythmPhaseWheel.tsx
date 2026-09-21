import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Eye, EyeOff, RotateCw } from 'lucide-react';

interface PolyrhythmPhaseWheelProps {
  ratio?: [number, number]; // [m, n], default [3, 2]
  bpm?: number;
  isPlaying?: boolean;
  externalPhase?: number; // 0.0 to 1.0 if controlled externally
  cursorVisible?: boolean;
  coincidenceFlash?: boolean;
  onAttackHit?: (layer: 'A' | 'B' | 'both', nodeIndex: number) => void;
  className?: string;
}

export const PolyrhythmPhaseWheel: React.FC<PolyrhythmPhaseWheelProps> = ({
  ratio = [3, 2],
  bpm = 80,
  isPlaying = false,
  externalPhase,
  cursorVisible = true,
  coincidenceFlash = true,
  onAttackHit,
  className = '',
}) => {
  const [internalPhase, setInternalPhase] = useState(0);
  const [muteA, setMuteA] = useState(false);
  const [muteB, setMuteB] = useState(false);
  const [activeFlashes, setActiveFlashes] = useState<{ layer: 'A' | 'B' | 'both'; index: number }[]>([]);

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const lastTriggeredPhase = useRef<number>(-1);

  const [m, n] = ratio;
  // Cycle duration in seconds: in m:n polyrhythm, one cycle corresponds to e.g. n beats at current BPM
  // E.g. for 3:2 across 2 quarter-note beats, 1 cycle = (2 * 60 / bpm) seconds.
  const cycleSeconds = (n * 60) / bpm;

  const currentPhase = externalPhase !== undefined ? externalPhase : internalPhase;

  // Animation loop when playing internally
  useEffect(() => {
    if (!isPlaying || externalPhase !== undefined) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const loop = (time: number) => {
      if (lastTimeRef.current !== null) {
        const deltaSec = (time - lastTimeRef.current) / 1000;
        setInternalPhase((prev) => {
          const next = (prev + deltaSec / cycleSeconds) % 1.0;
          return next;
        });
      }
      lastTimeRef.current = time;
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, cycleSeconds, externalPhase]);

  // Check for attack hit flashes as phase advances
  useEffect(() => {
    if (!isPlaying) return;

    // Layer A nodes at phase = k / m
    // Layer B nodes at phase = j / n
    const threshold = 0.035;

    // Check Layer A
    for (let k = 0; k < m; k++) {
      const nodePhase = k / m;
      const dist = Math.abs(currentPhase - nodePhase);
      if (dist < threshold && Math.abs(lastTriggeredPhase.current - nodePhase) > threshold) {
        const isCoincidence = k === 0;
        const hitType = isCoincidence ? 'both' : 'A';
        setActiveFlashes((prev) => [...prev.slice(-4), { layer: hitType, index: k }]);
        if (onAttackHit) onAttackHit(hitType, k);
        lastTriggeredPhase.current = nodePhase;
      }
    }

    // Check Layer B
    for (let j = 0; j < n; j++) {
      const nodePhase = j / n;
      const dist = Math.abs(currentPhase - nodePhase);
      if (dist < threshold && Math.abs(lastTriggeredPhase.current - nodePhase) > threshold) {
        if (j !== 0) { // j === 0 already handled as coincidence
          setActiveFlashes((prev) => [...prev.slice(-4), { layer: 'B', index: j }]);
          if (onAttackHit) onAttackHit('B', j);
          lastTriggeredPhase.current = nodePhase;
        }
      }
    }

    // Clear flash after 220ms
    const timer = setTimeout(() => {
      setActiveFlashes([]);
    }, 220);
    return () => clearTimeout(timer);
  }, [currentPhase, isPlaying, m, n, onAttackHit]);

  // Wheel Geometry
  const size = 320;
  const center = size / 2;
  const radiusA = 120; // Outer ring: Layer A
  const radiusB = 80;  // Inner ring: Layer B

  // Angle for phase: 0 phase = top (12 o'clock, -90 deg)
  const cursorAngleDeg = currentPhase * 360 - 90;
  const cursorAngleRad = (cursorAngleDeg * Math.PI) / 180;
  const cursorX = center + (radiusA + 16) * Math.cos(cursorAngleRad);
  const cursorY = center + (radiusA + 16) * Math.sin(cursorAngleRad);

  return (
    <div className={`flex flex-col items-center bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md ${className}`}>
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RotateCw className="w-5 h-5 text-amber-400 animate-spin-slow" />
          <h3 className="text-base font-semibold text-white tracking-wide">
            Polyrhythm Phase Wheel <span className="text-amber-400 font-mono">({m}:{n})</span>
          </h3>
        </div>
        <div className="text-xs text-slate-400 font-mono bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
          Cycle: {cycleSeconds.toFixed(2)}s @ {bpm} BPM
        </div>
      </div>

      {/* SVG Wheel Canvas */}
      <div className="relative my-2">
        <svg width={size} height={size} className="overflow-visible select-none">
          <defs>
            {/* Gradients */}
            <linearGradient id="ringAGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="ringBGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
            </linearGradient>
            <radialGradient id="centerGlow">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Center ambient glow */}
          <circle cx={center} cy={center} r={radiusA + 20} fill="url(#centerGlow)" />

          {/* Concentric Ring A (Outer: m nodes) */}
          <circle
            cx={center}
            cy={center}
            r={radiusA}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={muteA ? "1.5" : "3"}
            strokeDasharray={muteA ? "4,4" : undefined}
            opacity={muteA ? 0.35 : 0.85}
          />

          {/* Concentric Ring B (Inner: n nodes) */}
          <circle
            cx={center}
            cy={center}
            r={radiusB}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={muteB ? "1.5" : "3"}
            strokeDasharray={muteB ? "4,4" : undefined}
            opacity={muteB ? 0.35 : 0.85}
          />

          {/* Coincidence Sector Guide line from center to top (Phase 0) */}
          <line
            x1={center}
            y1={center}
            x2={center}
            y2={center - radiusA - 14}
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="3,3"
            opacity="0.6"
          />

          {/* Ring A Nodes (m equidistant points) */}
          {Array.from({ length: m }).map((_, idx) => {
            const angleDeg = (idx / m) * 360 - 90;
            const rad = (angleDeg * Math.PI) / 180;
            const x = center + radiusA * Math.cos(rad);
            const y = center + radiusA * Math.sin(rad);
            const isCoincidence = idx === 0;
            const isFlashing = activeFlashes.some(f => (f.layer === 'A' || f.layer === 'both') && f.index === idx);

            return (
              <g key={`node-a-${idx}`}>
                {/* Attack connection tick */}
                <line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#f59e0b"
                  strokeWidth="1"
                  opacity="0.15"
                />
                {/* Glow ring on hit */}
                {isFlashing && (
                  <circle
                    cx={x}
                    cy={y}
                    r={isCoincidence ? "16" : "12"}
                    fill="none"
                    stroke={isCoincidence ? "#10b981" : "#f59e0b"}
                    strokeWidth="3"
                    className="animate-ping opacity-75"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isCoincidence ? "8" : "6"}
                  fill={isCoincidence ? "#10b981" : "#f59e0b"}
                  filter={isFlashing ? "url(#glow)" : undefined}
                  className="transition-all duration-100"
                />
                <text
                  x={center + (radiusA + 18) * Math.cos(rad)}
                  y={center + (radiusA + 18) * Math.sin(rad) + 4}
                  textAnchor="middle"
                  fill={isCoincidence ? "#34d399" : "#fbbf24"}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  A{idx + 1}
                </text>
              </g>
            );
          })}

          {/* Ring B Nodes (n equidistant points) */}
          {Array.from({ length: n }).map((_, idx) => {
            const angleDeg = (idx / n) * 360 - 90;
            const rad = (angleDeg * Math.PI) / 180;
            const x = center + radiusB * Math.cos(rad);
            const y = center + radiusB * Math.sin(rad);
            const isCoincidence = idx === 0;
            const isFlashing = activeFlashes.some(f => (f.layer === 'B' || f.layer === 'both') && f.index === idx);

            return (
              <g key={`node-b-${idx}`}>
                {/* Glow ring on hit */}
                {isFlashing && !isCoincidence && (
                  <circle
                    cx={x}
                    cy={y}
                    r="12"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="3"
                    className="animate-ping opacity-75"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isCoincidence ? "7" : "5"}
                  fill={isCoincidence ? "#10b981" : "#06b6d4"}
                  filter={isFlashing ? "url(#glow)" : undefined}
                  className="transition-all duration-100"
                />
                <text
                  x={center + (radiusB - 18) * Math.cos(rad)}
                  y={center + (radiusB - 18) * Math.sin(rad) + 4}
                  textAnchor="middle"
                  fill={isCoincidence ? "#34d399" : "#38bdf8"}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  B{idx + 1}
                </text>
              </g>
            );
          })}

          {/* Central Coincidence Marker */}
          <circle cx={center} cy={center} r="6" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <circle cx={center} cy={center} r="2" fill="#94a3b8" />

          {/* Phase 0 Coincidence Label */}
          <text
            x={center}
            y={center - radiusA - 20}
            textAnchor="middle"
            fill="#34d399"
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.05em"
          >
            PHASE 0 (COINCIDENCE)
          </text>

          {/* Rotating Radial Sweep Cursor Line */}
          {cursorVisible && (
            <g>
              <line
                x1={center}
                y1={center}
                x2={cursorX}
                y2={cursorY}
                stroke="#ec4899"
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="url(#glow)"
                opacity={isPlaying ? 1 : 0.4}
              />
              <circle
                cx={cursorX}
                cy={cursorY}
                r="4"
                fill="#f43f5e"
                filter="url(#glow)"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Interactive Controls & Layer Legend */}
      <div className="w-full grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800 text-xs">
        {/* Layer A Legend & Mute */}
        <button
          onClick={() => setMuteA(!muteA)}
          className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
            muteA 
              ? 'bg-slate-800/40 border-slate-700/50 text-slate-500 line-through' 
              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-sm"></span>
            <span className="font-semibold">Layer A: {m} Pulses</span>
          </div>
          {muteA ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
        </button>

        {/* Layer B Legend & Mute */}
        <button
          onClick={() => setMuteB(!muteB)}
          className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
            muteB 
              ? 'bg-slate-800/40 border-slate-700/50 text-slate-500 line-through' 
              : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shadow-sm"></span>
            <span className="font-semibold">Layer B: {n} Pulses</span>
          </div>
          {muteB ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
        </button>
      </div>

      {/* Coincidence Info */}
      <div className="w-full mt-2 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/90 font-medium">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        Green Node: Both streams hit simultaneously (Phase 0)
      </div>
    </div>
  );
};
