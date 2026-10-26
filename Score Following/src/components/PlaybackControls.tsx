import React, { useRef, useMemo, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Upload, 
  Volume2, 
  VolumeX, 
  Sliders,
  CheckSquare,
  Square,
  Volume1,
  Layers
} from 'lucide-react';
import type { ScoreData, PracticePart } from '../utils/scoreParser';

interface PlaybackControlsProps {
  viewedScoreData: ScoreData | null;
  isPlaying: boolean;
  playbackProgress: number; // current time in seconds
  metronomeMuted: boolean;
  metronomeVolume: number;
  backingVolume: number;
  soundfontCatalog: 'FluidR3_GM' | 'MusyngKite';
  countInEnabled: boolean;

  backingTrackMode: 'solo' | 'custom';
  selectedPracticePart: PracticePart | null;
  allPracticeParts: PracticePart[];
  customMutedPartIds: Record<string, boolean>;

  isLoadingInstruments: boolean;
  loadingProgress: number;
  zipParsingStatus: string;

  onFileUpload: (file: File) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onMetronomeMuteToggle: () => void;
  onMetronomeVolumeChange: (val: number) => void;
  onBackingVolumeChange: (val: number) => void;
  onSoundfontCatalogChange: (catalog: 'FluidR3_GM' | 'MusyngKite') => void;
  onCountInToggle: () => void;
  onBackingTrackModeChange: (mode: 'solo' | 'custom') => void;
  onCustomMuteToggle: (audioPartId: string) => void;
  onCustomMuteGroupToggle: (group: string, mute: boolean) => void;
  onCustomMuteAllToggle: (mute: boolean) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  viewedScoreData,
  isPlaying,
  playbackProgress,
  metronomeMuted,
  metronomeVolume,
  backingVolume,
  soundfontCatalog,
  countInEnabled,
  backingTrackMode,
  selectedPracticePart,
  allPracticeParts,
  customMutedPartIds,
  isLoadingInstruments,
  loadingProgress,
  zipParsingStatus,
  onFileUpload,
  onPlayPause,
  onStop,
  onMetronomeMuteToggle,
  onMetronomeVolumeChange,
  onBackingVolumeChange,
  onSoundfontCatalogChange,
  onCountInToggle,
  onBackingTrackModeChange,
  onCustomMuteToggle,
  onCustomMuteGroupToggle,
  onCustomMuteAllToggle
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isCountIn = useMemo(() => {
    if (!isPlaying || !countInEnabled) return false;
    if (playbackProgress < 0) return true;
    if (!viewedScoreData || !selectedPracticePart) return false;
    const part = viewedScoreData.parts.find(p => p.id === selectedPracticePart.partIdInFile || selectedPracticePart.audioPartId.endsWith('::' + p.id) || p.id.endsWith('::' + selectedPracticePart.partIdInFile));
    if (!part || part.notes.length === 0) return false;
    return playbackProgress < part.notes[0].time;
  }, [isPlaying, countInEnabled, playbackProgress, viewedScoreData, selectedPracticePart]);

  const getCountInBeat = () => {
    if (!viewedScoreData || !viewedScoreData.initialTimeSignature) return 4;
    const numerator = viewedScoreData.initialTimeSignature.numerator;
    const denominator = viewedScoreData.initialTimeSignature.denominator;
    const initialBpm = viewedScoreData.tempos[0]?.bpm ?? 120;
    const beatDuration = (4.0 / denominator) * (60.0 / initialBpm);

    if (playbackProgress < 0) {
      const elapsed = Math.abs(playbackProgress);
      const beatIndex = Math.floor(elapsed / beatDuration);
      return Math.min(numerator, beatIndex + 1);
    } else {
      const elapsed = playbackProgress;
      const beatIndex = Math.floor(elapsed / beatDuration);
      return Math.max(1, numerator - beatIndex);
    }
  };

  // Group practice parts by instrument group
  const groupedParts = useMemo(() => {
    const groups: Record<string, PracticePart[]> = {};
    allPracticeParts.forEach((part) => {
      if (!groups[part.group]) {
        groups[part.group] = [];
      }
      groups[part.group].push(part);
    });
    return groups;
  }, [allPracticeParts]);

  const [activeTab, setActiveTab] = useState<'playback' | 'mixer'>('playback');

  return (
    <div className="clean-panel text-white p-6 flex flex-col gap-6 w-full">
      
      {/* File Upload Section & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-2 bg-[#0a090f] p-1.5 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('playback')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'playback'
                ? 'bg-brand text-white shadow shadow-brand/10'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Playback
          </button>
          <button
            onClick={() => setActiveTab('mixer')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'mixer'
                ? 'bg-brand text-white shadow shadow-brand/10'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Mixer
          </button>
        </div>

        <div>
          <input 
            type="file" 
            accept=".xml,.musicxml,.mxl,.zip" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
          />
          <button 
            onClick={triggerUploadClick}
            disabled={isLoadingInstruments}
            className="flex items-center gap-2 bg-[#1c1926] hover:bg-[#252133] border border-white/5 text-zinc-200 hover:text-white disabled:opacity-40 transition px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-brand" />
            Upload Score
          </button>
        </div>
      </div>

      {/* Loading overlay for Soundfonts / Zip extraction */}
      {isLoadingInstruments && zipParsingStatus && (
        <div className="bg-brand-bg border border-brand-border rounded-xl p-4 flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-brand">{zipParsingStatus}</span>
            <span className="text-brand font-mono">{Math.round(loadingProgress * 100)}%</span>
          </div>
          <div className="w-full bg-panel-light h-2 rounded-full overflow-hidden">
            <div 
              className="bg-brand h-full transition-all duration-300"
              style={{ width: `${loadingProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {viewedScoreData && (
        <>
          {activeTab === 'playback' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Player Progress & Volume Mixers (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Playback Progress */}
                <div className="flex justify-between items-center bg-[#1c1926] border border-white/5 rounded-xl px-4 py-3 text-xs min-h-[46px]">
                  <span className="text-text-secondary font-bold uppercase tracking-wider">Progress</span>
                  {isCountIn ? (
                    <span className="font-extrabold text-xs text-brand animate-pulse uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                      Count-in: {getCountInBeat()}
                    </span>
                  ) : (
                    <span className="font-mono text-base font-extrabold text-brand">
                      {formatTime(Math.max(0, playbackProgress))} / {formatTime(viewedScoreData.durationInSeconds)}
                    </span>
                  )}
                </div>

                {/* Main Circular Buttons */}
                <div className="flex items-center justify-center gap-4 py-1">
                  <button 
                    onClick={onPlayPause}
                    disabled={isLoadingInstruments}
                    className="w-14 h-14 rounded-full bg-brand hover:bg-brand-hover disabled:opacity-40 transition flex items-center justify-center shadow-lg shadow-brand/15 active:scale-95 cursor-pointer border border-brand/10 text-white"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 translate-x-0.5" />}
                  </button>
                  <button 
                    onClick={onStop}
                    className="w-12 h-12 rounded-full bg-panel-light hover:bg-[#252133] border border-white/5 text-zinc-300 transition flex items-center justify-center active:scale-95 cursor-pointer"
                    title="Stop and Rewind"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Volume Mixers */}
                <div className="flex flex-col gap-5 pt-3 border-t border-white/5">
                  {/* Backing Band Volume */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">Overall Volume</span>
                      <span className="text-xs font-extrabold text-brand">
                        {Math.round(((backingVolume + 40) / 46) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Volume1 className="w-4 h-4 text-text-secondary" />
                      <input 
                        type="range" 
                        min="-40" 
                        max="6" 
                        step="1"
                        value={backingVolume}
                        onChange={(e) => onBackingVolumeChange(parseInt(e.target.value))}
                        className="flex-grow"
                      />
                      <Volume2 className="w-4 h-4 text-brand" />
                    </div>
                  </div>

                  {/* Metronome Volume */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">Metronome Click</span>
                      <span className="text-xs font-extrabold text-brand">
                        {metronomeMuted ? 'Muted' : `${Math.round(((metronomeVolume + 40) / 46) * 100)}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={onMetronomeMuteToggle}
                        className="text-text-secondary hover:text-white transition cursor-pointer"
                      >
                        {metronomeMuted ? <VolumeX className="w-4 h-4 text-brand" /> : <Volume2 className="w-4 h-4 text-brand" />}
                      </button>
                      <input 
                        type="range" 
                        min="-40" 
                        max="6" 
                        step="1"
                        disabled={metronomeMuted}
                        value={metronomeVolume}
                        onChange={(e) => onMetronomeVolumeChange(parseInt(e.target.value))}
                        className="flex-grow"
                      />
                    </div>
                    {/* Count-in Toggle */}
                    <div className="flex justify-between items-center pt-3.5 border-t border-white/5 mt-1">
                      <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">1-Bar Count-in</span>
                      <button
                        onClick={onCountInToggle}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition border cursor-pointer ${
                          countInEnabled
                            ? 'bg-brand/10 border-brand text-brand hover:bg-brand/15 shadow shadow-brand/5'
                            : 'bg-[#1c1926]/40 border-transparent text-text-secondary hover:text-white hover:bg-[#1c1926]/60'
                        }`}
                      >
                        {countInEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Playback option tabs & explanation card (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* Backing Track Options and Quality selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Backing Track Options Toggle Tabs */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">MIDI Playback Option</span>
                    <div className="grid grid-cols-2 gap-2 bg-[#0a090f] p-1.5 rounded-xl border border-white/5">
                      <button
                        onClick={() => onBackingTrackModeChange('solo')}
                        className={`py-2.5 px-1 rounded-lg text-xs font-extrabold tracking-wide uppercase transition cursor-pointer border ${
                          backingTrackMode === 'solo'
                            ? 'bg-brand text-white border-transparent shadow shadow-brand/10'
                            : 'bg-transparent border-transparent text-text-secondary hover:text-white'
                        }`}
                      >
                        Solo
                      </button>
                      <button
                        onClick={() => onBackingTrackModeChange('custom')}
                        className={`py-2.5 px-1 rounded-lg text-xs font-extrabold tracking-wide uppercase transition cursor-pointer border ${
                          backingTrackMode === 'custom'
                            ? 'bg-brand text-white border-transparent shadow shadow-brand/10'
                            : 'bg-transparent border-transparent text-text-secondary hover:text-white'
                        }`}
                      >
                        Custom Mix
                      </button>
                    </div>
                  </div>

                  {/* Soundfont Quality Selector Tabs */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">MIDI Sound Quality</span>
                    <div className="grid grid-cols-2 gap-2 bg-[#0a090f] p-1.5 rounded-xl border border-white/5">
                      <button
                        onClick={() => onSoundfontCatalogChange('FluidR3_GM')}
                        className={`py-2.5 px-1 rounded-lg text-xs font-extrabold tracking-wide uppercase transition cursor-pointer border ${
                          soundfontCatalog === 'FluidR3_GM'
                            ? 'bg-brand text-white border-transparent shadow shadow-brand/10'
                            : 'bg-transparent border-transparent text-text-secondary hover:text-white'
                        }`}
                        title="Standard General MIDI (Fluid R3) - Lightweight, faster load times"
                      >
                        Standard
                      </button>
                      <button
                        onClick={() => onSoundfontCatalogChange('MusyngKite')}
                        className={`py-2.5 px-1 rounded-lg text-xs font-extrabold tracking-wide uppercase transition cursor-pointer border ${
                          soundfontCatalog === 'MusyngKite'
                            ? 'bg-brand text-white border-transparent shadow shadow-brand/10'
                            : 'bg-transparent border-transparent text-text-secondary hover:text-white'
                        }`}
                        title="Musyng Kite - Ultra High Quality, rich, natural acoustics"
                      >
                        High Quality
                      </button>
                    </div>
                  </div>

                </div>

                {/* Explanation text panels */}
                <div className="flex-grow flex flex-col justify-center">
                  {backingTrackMode === 'solo' && (
                    <div className="bg-[#1c1926] border border-brand-border p-5 rounded-2xl flex gap-3.5">
                      <div className="bg-brand-bg p-2.5 rounded-xl text-brand h-fit border border-brand-border">
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-white uppercase tracking-wider">Solo Instrument Active</span>
                        <p className="text-xs text-text-secondary leading-relaxed mt-1.5">
                          Only your selected practice instrument will be played:
                          <span className="text-brand font-bold ml-1">
                            {selectedPracticePart ? selectedPracticePart.name : 'Selected instrument'}
                          </span>. All other band staves are muted.
                        </p>
                      </div>
                    </div>
                  )}

                  {backingTrackMode === 'custom' && (
                    <div className="bg-[#1c1926] border border-white/5 p-5 rounded-2xl flex gap-3.5">
                      <div className="bg-brand-bg p-2.5 rounded-xl text-brand h-fit border border-brand-border">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-white uppercase tracking-wider">Custom Mix Active</span>
                        <p className="text-xs text-text-secondary leading-relaxed mt-1.5">
                          You are in Custom Mix mode. Switch to the <span onClick={() => setActiveTab('mixer')} className="text-brand font-bold cursor-pointer underline hover:text-brand-hover">Mixer tab</span> above to customize volume toggles for individual band sections and instruments.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {activeTab === 'mixer' && (
            <div className="bg-[#1c1926] border border-white/5 p-4 rounded-xl flex flex-col gap-4 max-h-[360px] overflow-y-auto custom-scrollbar">
              
              {/* Mixer header and buttons */}
              <div className="flex justify-between items-center border-b border-white/5 pb-2 text-xs">
                <span className="text-text-secondary font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand" /> Backing Mix Panel
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => onCustomMuteAllToggle(false)}
                    className="text-brand hover:text-brand-hover font-bold cursor-pointer text-xs"
                  >
                    Enable All
                  </button>
                  <span className="text-text-muted">|</span>
                  <button
                    onClick={() => onCustomMuteAllToggle(true)}
                    className="text-text-secondary hover:text-zinc-350 font-bold cursor-pointer text-xs"
                  >
                    Mute All
                  </button>
                </div>
              </div>

              {/* Grouped instrument sections */}
              <div className="flex flex-col gap-5">
                {Object.entries(groupedParts).map(([group, parts]) => {
                  const allInGroupMuted = parts.every(p => customMutedPartIds[p.audioPartId]);
                  const groupChecked = !allInGroupMuted;

                  return (
                    <div key={group} className="flex flex-col gap-2">
                      {/* Group Header Checkbox */}
                      <div className="flex items-center justify-between bg-[#0a090f] px-3 py-2 rounded-lg border border-white/5">
                        <button
                          onClick={() => onCustomMuteGroupToggle(group, groupChecked)}
                          className="flex items-center gap-2 hover:text-brand transition text-xs font-bold text-zinc-200 cursor-pointer"
                        >
                          {groupChecked ? (
                            <CheckSquare className="w-4 h-4 text-brand fill-brand/10" />
                          ) : (
                            <Square className="w-4 h-4 text-text-muted" />
                          )}
                          {group}s
                        </button>
                        <span className="text-[9px] text-text-muted uppercase font-bold tracking-widest">
                          Section
                        </span>
                      </div>

                      {/* Individual parts inside group */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-2">
                        {parts.map((part) => {
                          const isPlaying = !customMutedPartIds[part.audioPartId];
                          const isPracticeInstrument = selectedPracticePart?.audioPartId === part.audioPartId;

                          return (
                            <button
                              key={part.audioPartId}
                              onClick={() => onCustomMuteToggle(part.audioPartId)}
                              className={`flex items-center justify-between text-left p-2.5 rounded-lg text-xs transition cursor-pointer border ${
                                isPlaying
                                  ? 'bg-brand/5 border-brand/35 text-white'
                                  : 'bg-transparent border-transparent text-text-secondary hover:text-zinc-300'
                              }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                {isPlaying ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-brand shrink-0" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                )}
                                <span className="truncate">{part.name}</span>
                              </span>
                              {isPracticeInstrument && (
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-brand bg-brand-bg border border-brand-border px-1 rounded">
                                  Solo
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
};
