import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';

interface ReflectionPromptBarProps {
  onSelectReflection: (reflectionKey: string) => void;
  onSkip: () => void;
}

export const ReflectionPromptBar: React.FC<ReflectionPromptBarProps> = ({
  onSelectReflection,
  onSkip,
}) => {
  const options = [
    { key: 'steady_beat', label: '👌 Beat felt steady', variant: 'border-emerald-500/40 hover:bg-emerald-950/40 text-emerald-300' },
    { key: 'still_rushed', label: '⚡ Felt a bit rushed', variant: 'border-amber-500/40 hover:bg-amber-950/40 text-amber-300' },
    { key: 'fingers_stumbled', label: '🖐️ Stumbled on a note', variant: 'border-purple-500/40 hover:bg-purple-950/40 text-purple-300' },
    { key: 'too_slow', label: '🐢 Felt stiff / too slow', variant: 'border-cyan-500/40 hover:bg-cyan-950/40 text-cyan-300' },
  ];

  return (
    <div className="w-full p-3.5 rounded-2xl bg-slate-800/95 border border-purple-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
          <MessageSquare className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-200">Quick Check-in: </span>
          <span className="text-xs text-slate-400">How did that attempt feel?</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-center">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onSelectReflection(opt.key)}
            className={`px-3 py-1.5 rounded-xl border bg-slate-900/80 text-xs font-bold transition cursor-pointer active:scale-95 ${opt.variant}`}
          >
            {opt.label}
          </button>
        ))}

        <button
          onClick={onSkip}
          className="px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          Skip
        </button>
      </div>
    </div>
  );
};
