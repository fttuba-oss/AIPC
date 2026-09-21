import React, { useState } from 'react';
import { Headphones, Sparkles, Send } from 'lucide-react';
import { InstrumentMascot, MascotMood } from './InstrumentMascot';

export interface ChatActionOption {
  key: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'amber';
}

export interface ChatMessage {
  id: string;
  sender: 'mascot' | 'student';
  text: string;
  timestamp: string;
  highlight?: boolean;
  actionOptions?: ChatActionOption[];
}

interface StudentChatCompanionProps {
  instrumentName?: string;
  messages: ChatMessage[];
  onQuickAction: (actionKey: string) => void;
  onSendMessage?: (text: string) => void;
  isListening?: boolean;
  mood?: MascotMood;
  activeSectionName?: string;
  recordingMode?: 'audio' | 'video';
  videoPreviewRef?: React.RefObject<HTMLVideoElement | null>;
  cameraStatus?: 'idle' | 'starting' | 'active' | 'denied';
  cameraStream?: MediaStream | null;
}

export const StudentChatCompanion: React.FC<StudentChatCompanionProps> = ({
  instrumentName = 'Trumpet',
  messages,
  onQuickAction,
  onSendMessage,
  isListening = false,
  mood = 'idle',
  activeSectionName = 'Section 1',
  recordingMode = 'audio',
  videoPreviewRef,
  cameraStatus = 'idle',
  cameraStream,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    if (recordingMode === 'video' && videoPreviewRef?.current && cameraStream) {
      if (videoPreviewRef.current.srcObject !== cameraStream) {
        videoPreviewRef.current.srcObject = cameraStream;
        videoPreviewRef.current.play().catch(e => console.warn('Preview play warning:', e));
      }
    }
  }, [recordingMode, cameraStream, videoPreviewRef]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage?.(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-amber-50/70 to-orange-50/60 dark:from-slate-900 dark:to-slate-800/80 rounded-2xl border border-amber-200/80 dark:border-slate-700/80 p-4 shadow-sm relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 dark:border-slate-700/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-black text-sm tracking-wider text-amber-950 dark:text-amber-200">
            Toots
          </span>
          <span className="text-[10px] font-bold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-wider">
            (AIPC Companion)
          </span>
        </div>
      </div>

      {/* Video Preview (When Video Recording) */}
      {recordingMode === 'video' && (
        <div className="w-full aspect-4/3 max-h-48 bg-slate-900 rounded-xl overflow-hidden border-2 border-amber-400 shadow-md relative shrink-0 my-2.5 flex items-center justify-center">
          <video
            ref={videoPreviewRef}
            muted
            autoPlay
            playsInline
            className="w-full h-full object-cover -scale-x-100"
          />

          {cameraStatus === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-amber-300 text-xs font-bold gap-2">
              <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Starting camera preview...</span>
            </div>
          )}

          {cameraStatus === 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-rose-300 text-xs font-bold p-3 text-center gap-1">
              <span>⚠️ Camera Access Needed</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Please allow camera permissions in browser. Visual practice fallback is enabled.
              </span>
            </div>
          )}

          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-white/20">
            <span
              className={`w-2 h-2 rounded-full ${
                cameraStatus === 'active'
                  ? 'bg-emerald-500 animate-pulse'
                  : cameraStatus === 'starting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span>
              {cameraStatus === 'active'
                ? 'Camera Active'
                : cameraStatus === 'starting'
                ? 'Starting...'
                : 'Camera Offline'}
            </span>
          </div>
        </div>
      )}

      {/* Large-Print Speech Bubble Stream */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-2.5 min-h-[140px] max-h-[420px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'mascot' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs transition-all ${
                msg.sender === 'mascot'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-amber-200/90 dark:border-slate-700 font-medium'
                  : 'bg-amber-600 text-white font-semibold'
              } ${msg.highlight ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
            >
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{msg.sender === 'mascot' ? 'Toots (AIPC Companion)' : 'You'}</span>
                <span className="text-slate-400 text-[9px] ml-auto font-normal">{msg.timestamp}</span>
              </div>
              <div className="text-xs sm:text-sm">{msg.text}</div>

              {/* Friction-Free Inline Action Options right inside the bubble */}
              {msg.actionOptions && msg.actionOptions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-slate-700/60 flex flex-wrap gap-1.5">
                  {msg.actionOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => onQuickAction(opt.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer ${
                        opt.variant === 'primary'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/30'
                          : opt.variant === 'success'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30'
                          : opt.variant === 'amber'
                          ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 font-black shadow-amber-900/30'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {opt.icon && <span className="text-sm">{opt.icon}</span>}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips (Touch-First for iPad) */}
      <div className="pt-2.5 border-t border-amber-200/60 dark:border-slate-700/60 shrink-0 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <span>Tap to Ask Companion:</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onQuickAction('listen_demo')}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-100/70 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-amber-200 dark:border-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <span>👂</span>
            <span>Play it for me</span>
          </button>

          <button
            onClick={() => onQuickAction('ready_to_play')}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <span>🎺</span>
            <span>I'm ready to play!</span>
          </button>

          <button
            onClick={() => onQuickAction('what_to_do')}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-100/70 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-amber-200 dark:border-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <span>💡</span>
            <span>What do I do?</span>
          </button>

          <button
            onClick={() => onQuickAction('slower_tempo')}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-100/70 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-amber-200 dark:border-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <span>🐢</span>
            <span>Slower tempo</span>
          </button>
        </div>

        {/* Freeform Student Chat Input Box */}
        {onSendMessage && (
          <form onSubmit={handleSend} className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Toots a question..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 transition cursor-pointer"
              title="Send to Companion"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
