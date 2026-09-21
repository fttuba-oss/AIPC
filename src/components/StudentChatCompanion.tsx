import React, { useState } from 'react';
import { Sparkles, Send, MessageSquare, X, Video, ChevronRight } from 'lucide-react';

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
  mood?: string;
  activeSectionName?: string;
  recordingMode?: 'audio' | 'video';
  videoPreviewRef?: React.RefObject<HTMLVideoElement | null>;
  cameraStatus?: 'idle' | 'starting' | 'active' | 'denied';
  cameraStream?: MediaStream | null;
}

export const StudentChatCompanion: React.FC<StudentChatCompanionProps> = ({
  instrumentName: _instrumentName = 'Trumpet',
  messages,
  onQuickAction,
  onSendMessage,
  isListening: _isListening = false,
  mood: _mood,
  activeSectionName = 'Section 1',
  recordingMode = 'audio',
  videoPreviewRef,
  cameraStatus = 'idle',
  cameraStream,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isDrawerOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isDrawerOpen]);

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

  const latestMessage = messages[messages.length - 1];

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Horizontal Companion Dock (Clean ergonomic bar beneath score) */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-md flex items-center justify-between gap-3 shrink-0 select-none transition-all">
        {/* Left: Toots Avatar & Latest Insight Speech Bubble */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Mascot Avatar Chip */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 shrink-0 group cursor-pointer active:scale-95 transition-transform"
            title="Open Companion Chat Drawer"
          >
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm shadow-md ring-2 ring-amber-300/70 dark:ring-amber-500/50 group-hover:scale-105 transition-transform">
              🎺
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="font-black text-xs text-slate-800 dark:text-amber-200 leading-tight flex items-center gap-1">
                <span>Toots</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </span>
              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400/90 uppercase tracking-tight">
                Coach
              </span>
            </div>
          </button>

          {/* Latest Speech Bubble */}
          {latestMessage ? (
            <div
              onClick={() => setIsDrawerOpen(true)}
              className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                latestMessage.sender === 'mascot'
                  ? 'bg-amber-50/90 dark:bg-slate-800/90 border-amber-200/90 dark:border-slate-700/80 hover:border-amber-300 dark:hover:border-slate-600'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
              }`}
              title="Click to view conversation history"
            >
              <span className="font-bold text-[10px] text-amber-700 dark:text-amber-400 shrink-0 hidden sm:inline">
                {latestMessage.sender === 'mascot' ? 'Toots:' : 'You:'}
              </span>
              <span className="truncate text-slate-800 dark:text-slate-100 font-medium text-xs">
                {latestMessage.text}
              </span>

              {/* Inline Action Options inside the latest message if present */}
              {latestMessage.actionOptions && latestMessage.actionOptions.length > 0 && (
                <div
                  className="flex items-center gap-1.5 ml-auto shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {latestMessage.actionOptions.slice(0, 2).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => onQuickAction(opt.key)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap ${
                        opt.variant === 'primary'
                          ? 'bg-purple-600 hover:bg-purple-500 text-white'
                          : opt.variant === 'success'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : opt.variant === 'amber'
                          ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 font-black'
                          : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {opt.icon && <span className="mr-0.5">{opt.icon}</span>}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">
              Ready to practice {activeSectionName}!
            </div>
          )}
        </div>

        {/* Right: Quick Action Chips & Chat Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Action Pills */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              onClick={() => onQuickAction('listen_demo')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 transition active:scale-95 cursor-pointer flex items-center gap-1 whitespace-nowrap shadow-2xs"
            >
              <span>👂</span>
              <span>Demo</span>
            </button>
            <button
              onClick={() => onQuickAction('ready_to_play')}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-black rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <span>🎺</span>
              <span>Ready!</span>
            </button>
            <button
              onClick={() => onQuickAction('what_to_do')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 transition active:scale-95 cursor-pointer flex items-center gap-1 whitespace-nowrap shadow-2xs"
            >
              <span>💡</span>
              <span>Tip</span>
            </button>
            <button
              onClick={() => onQuickAction('slower_tempo')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 transition active:scale-95 cursor-pointer flex items-center gap-1 whitespace-nowrap shadow-2xs"
            >
              <span>🐢</span>
              <span>Slower</span>
            </button>
          </div>

          {/* Video PiP Thumbnail (when video recording is enabled) */}
          {recordingMode === 'video' && (
            <div
              onClick={() => setIsDrawerOpen(true)}
              className="w-14 h-9 bg-slate-950 rounded-lg overflow-hidden border border-amber-400 relative shrink-0 cursor-pointer shadow-xs"
              title="Camera Preview (Click to expand)"
            >
              <video
                ref={videoPreviewRef}
                muted
                autoPlay
                playsInline
                className="w-full h-full object-cover -scale-x-100"
              />
              <span
                className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                  cameraStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </div>
          )}

          {/* Chat History & Questions Drawer Trigger Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 dark:bg-amber-500/20 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs"
            title="Open conversation and ask questions"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Chat</span>
            <span className="bg-amber-500 text-amber-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {messages.length}
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Full Conversation Slide-Over Drawer (Clean on-demand focus) */}
      {/* ------------------------------------------------------------------ */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Drawer Container */}
          <aside className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center text-base shadow-sm ring-2 ring-amber-300">
                  🎺
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Toots</span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                      AIPC Coach
                    </span>
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {activeSectionName} Companion
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close chat drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Preview in Drawer if Video Mode is Active */}
            {recordingMode === 'video' && (
              <div className="p-3 bg-slate-950 border-b border-slate-800 shrink-0">
                <div className="w-full aspect-4/3 max-h-40 bg-slate-900 rounded-xl overflow-hidden border border-amber-400/80 shadow-inner relative flex items-center justify-center">
                  <video
                    ref={videoPreviewRef}
                    muted
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-white/20">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        cameraStatus === 'active'
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span>{cameraStatus === 'active' ? 'Camera Live' : 'Initializing...'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Full Speech Bubble Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'mascot' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs transition-all ${
                      msg.sender === 'mascot'
                        ? 'bg-amber-50/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-amber-200/90 dark:border-slate-700 font-medium'
                        : 'bg-amber-600 text-white font-semibold'
                    } ${msg.highlight ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
                  >
                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{msg.sender === 'mascot' ? 'Toots' : 'You'}</span>
                      <span className="text-slate-400 text-[9px] ml-auto font-normal">
                        {msg.timestamp}
                      </span>
                    </div>
                    <div>{msg.text}</div>

                    {/* Action options */}
                    {msg.actionOptions && msg.actionOptions.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-slate-700/60 flex flex-wrap gap-1.5">
                        {msg.actionOptions.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              onQuickAction(opt.key);
                              setIsDrawerOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer ${
                              opt.variant === 'primary'
                                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                : opt.variant === 'success'
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : opt.variant === 'amber'
                                ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 font-black'
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

            {/* Quick Action Grid */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 shrink-0 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    onQuickAction('listen_demo');
                    setIsDrawerOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  <span>👂</span>
                  <span>Play Demo</span>
                </button>

                <button
                  onClick={() => {
                    onQuickAction('ready_to_play');
                    setIsDrawerOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <span>🎺</span>
                  <span>I'm ready!</span>
                </button>

                <button
                  onClick={() => {
                    onQuickAction('what_to_do');
                    setIsDrawerOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  <span>💡</span>
                  <span>What do I do?</span>
                </button>

                <button
                  onClick={() => {
                    onQuickAction('slower_tempo');
                    setIsDrawerOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition active:scale-95 cursor-pointer"
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
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-amber-950 font-bold transition cursor-pointer shadow-xs active:scale-95"
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
