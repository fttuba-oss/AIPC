import React from 'react';
import { Headphones, Gauge, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { FirstLineRecommendation } from '../classifications/rhythm/selector/FirstLineRouter';

interface LearnerChoiceViewProps {
  recommendation: FirstLineRecommendation;
  targetBpm: number;
  measureRange: [number, number];
  onSelectOption: (strategyId: string) => void;
  onExploreOther: () => void;
}

export const LearnerChoiceView: React.FC<LearnerChoiceViewProps> = ({
  recommendation,
  targetBpm,
  measureRange,
  onSelectOption,
  onExploreOther,
}) => {
  const isOptionARecommended = recommendation.recommendedChoice === 'DI-REF-SHADOW-01';
  const reducedBpm = Math.max(48, Math.round(targetBpm - Math.min(20, targetBpm * 0.20)));

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Title & Introduction */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AIPC Practice Pathway Selection</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white">
          How would you like to tackle this rhythm?
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          For Bars {measureRange[0]}–{measureRange[1]}, choose the approach that best fits how you learn today. You can always switch later!
        </p>
      </div>

      {/* AIPC Nudge Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/40 flex items-start gap-3.5 shadow-lg">
        <div className="w-8 h-8 rounded-xl bg-purple-500/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-purple-300" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-purple-300 uppercase tracking-wider">
              AIPC Recommendation
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 font-bold">
              {isOptionARecommended ? 'Option A Suggested' : 'Option B Suggested'}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {recommendation.rationale}
          </p>
        </div>
      </div>

      {/* The Two Choice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Option A: Reference Audio + Shadow Fingering */}
        <div 
          onClick={() => onSelectOption('DI-REF-SHADOW-01')}
          className={`group relative p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 ${
            isOptionARecommended 
              ? 'bg-purple-950/30 border-purple-500/60 hover:border-purple-400 hover:bg-purple-900/40 shadow-xl shadow-purple-950/50' 
              : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800/90'
          }`}
        >
          {isOptionARecommended && (
            <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Recommended</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform">
              <Headphones className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-purple-400 font-mono tracking-wider">
                OPTION A &middot; DI-REF-SHADOW-01
              </span>
              <h3 className="text-base font-extrabold text-white group-hover:text-purple-300 transition-colors">
                Listen & Shadow-Finger
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Listen to the reference model and shadow-finger silently on your instrument as the cursor moves across each note. Followed immediately by an active playing attempt!
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">🎧 Aural Reference</span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">👀 Cursor Tracking</span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">🎯 Target Tempo ({targetBpm} BPM)</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onSelectOption('DI-REF-SHADOW-01'); }}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 ${
              isOptionARecommended
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/40'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
            }`}
          >
            <span>Choose Option A</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Option B: Tempo Reduction + Strong Click */}
        <div 
          onClick={() => onSelectOption('DI-SLOW-CLICK-01')}
          className={`group relative p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 ${
            !isOptionARecommended 
              ? 'bg-cyan-950/30 border-cyan-500/60 hover:border-cyan-400 hover:bg-cyan-900/40 shadow-xl shadow-cyan-950/50' 
              : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800/90'
          }`}
        >
          {!isOptionARecommended && (
            <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Recommended</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
              <Gauge className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-400 font-mono tracking-wider">
                OPTION B &middot; DI-SLOW-CLICK-01
              </span>
              <h3 className="text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                Slow Down & Lock the Beat
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Drop the tempo to a comfortable {reducedBpm} BPM with a strong, accented metronome click on every beat. Widen your timing window to lock in the groove!
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">🐢 -20 BPM ({reducedBpm} BPM)</span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">🔔 Accented Beat Click</span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">🪜 Step Ladder Progression</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onSelectOption('DI-SLOW-CLICK-01'); }}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 ${
              !isOptionARecommended
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/40'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
            }`}
          >
            <span>Choose Option B</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Direct link to browse other catalogue strategies */}
      <div className="text-center pt-2">
        <button
          onClick={onExploreOther}
          className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4 transition cursor-pointer"
        >
          Or browse all 21 specialized rhythm strategies &rarr;
        </button>
      </div>
    </div>
  );
};
