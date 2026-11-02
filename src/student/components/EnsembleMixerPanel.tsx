import React, { useState } from 'react';
import { 
  Volume2, VolumeX, Eye, EyeOff, ChevronDown, ChevronUp, 
  Music, Sliders, Headphones 
} from 'lucide-react';

export interface InstrumentTrack {
  id: string;
  name: string;
  section: 'Woodwinds' | 'Saxophones' | 'Brass' | 'Percussion' | 'Other';
  volume: number; // 0 to 100
  isMuted: boolean;
  isVisible: boolean; // whether rendered in sheet music
  isUserPart?: boolean;
}

interface EnsembleMixerPanelProps {
  onPlayAllParts: () => void;
  automaticBalance: boolean;
  onAutomaticBalanceChange: (enabled: boolean) => void;
  userInstrument: string; // e.g. 'Flute 2'
  /** Parts of this score, for the 'I'm practising' picker. */
  parts?: { id: string; name: string }[];
  myPartId?: string | null;
  onMyPartChange?: (id: string) => void;
  tracks: InstrumentTrack[];
  onTrackVolumeChange: (id: string, volume: number) => void;
  onTrackMuteToggle: (id: string) => void;
  onTrackVisibilityToggle: (id: string) => void;
  isReferenceMidiActive: boolean;
  onToggleReferenceMidi: (active: boolean) => void;
  isMinusOneActive: boolean;
  onToggleMinusOne: (active: boolean) => void;
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
}

export const EnsembleMixerPanel: React.FC<EnsembleMixerPanelProps> = ({
  onPlayAllParts,
  automaticBalance,
  onAutomaticBalanceChange,
  userInstrument,
  parts = [],
  myPartId = null,
  onMyPartChange,
  tracks,
  onTrackVolumeChange,
  onTrackMuteToggle,
  onTrackVisibilityToggle,
  isReferenceMidiActive,
  onToggleReferenceMidi,
  isMinusOneActive,
  onToggleMinusOne,
  masterVolume,
  onMasterVolumeChange,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    Woodwinds: false,
    Saxophones: true,
    Brass: true,
    Percussion: true,
    Other: true,
  });

  const toggleSection = (sec: string) => {
    setCollapsedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const sections: ('Woodwinds' | 'Saxophones' | 'Brass' | 'Percussion' | 'Other')[] = [
    'Woodwinds', 'Saxophones', 'Brass', 'Percussion', 'Other'
  ];

  return (
    <aside className="w-64 bg-white/95 border-l border-slate-200/90 flex flex-col h-full shrink-0 shadow-xs select-none">
      {/* Panel Title matching mock-up */}
      <div className="h-14 px-5 flex items-center justify-between shrink-0">
        <h2 className="text-[16px] font-bold text-slate-900 tracking-tight">Parts</h2>
      </div>

      {/* Which part am I practising? */}
      {parts.length > 0 && onMyPartChange && (
        <div className="px-5 pb-3 shrink-0">
          <label htmlFor="my-part" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            I'm practising
          </label>
          <select
            id="my-part"
            value={myPartId ?? ''}
            onChange={(e) => onMyPartChange(e.target.value)}
            className="w-full bg-slate-100 hover:bg-slate-200/70 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-900 outline-hidden cursor-pointer transition-colors"
          >
            {parts.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label className="flex items-center justify-between mt-3 text-[13px] text-slate-700 cursor-pointer">
            <span>Mute my part while I play</span>
            <button
              role="switch"
              aria-checked={isMinusOneActive}
              onClick={() => onToggleMinusOne(!isMinusOneActive)}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${isMinusOneActive ? 'bg-[#10b981]' : 'bg-slate-300'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${isMinusOneActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </label>
        </div>
      )}

      <div className="px-5 pb-3 space-y-2">
        <button type="button" onClick={onPlayAllParts}
          aria-pressed={tracks.some(track => track.id !== myPartId) && tracks.filter(track => track.id !== myPartId).every(track => !track.isMuted)}
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Play with whole band
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={automaticBalance}
            onChange={event => onAutomaticBalanceChange(event.target.checked)} />
          Automatic balance
        </label>
        <p className="text-[11px] text-slate-500">Reduces doubled lines and dense passages. Use Play to start; “Mute my part” still applies.</p>
      </div>
      <div className="px-5 pb-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Practise with</div>
      {/* Scrollable Instrument Track Hierarchy */}
      <div className="flex-1 overflow-y-auto px-4 py-1 space-y-3.5">
        {sections.map(secName => {
          const secTracks = tracks.filter(t => t.section === secName && !(parts.length > 0 && t.id === myPartId));
          if (secTracks.length === 0) return null;
          const isFolded = collapsedSections[secName];

          return (
            <div key={secName} className="space-y-1">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(secName)}
                className="w-full flex items-center justify-between py-1 px-1 text-left rounded-md hover:bg-slate-50 transition-colors group cursor-pointer"
              >
                <span className="text-[13.5px] font-bold text-slate-900 tracking-tight">{secName}</span>
                {isFolded ? (
                  <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-900 transition-transform" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-600 group-hover:text-slate-900 transition-transform" />
                )}
              </button>

              {/* Tracks in section */}
              {!isFolded && (
                <div className="space-y-1.5 pt-0.5">
                  {secTracks.map(track => {
                    const isChecked = !track.isMuted;

                    return (
                      <div
                        key={track.id}
                        className="flex items-center gap-2 py-0.5 px-1 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onTrackMuteToggle(track.id)}
                          className="w-4 h-4 rounded text-[#0071e3] accent-[#0071e3] border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                          title={isChecked ? "Mute track" : "Include track"}
                        />

                        {/* Track Name */}
                        <span className={`text-[13px] truncate flex-1 min-w-[70px] ${
                          isChecked ? 'text-slate-900 font-semibold' : 'text-slate-600 font-normal'
                        }`}>
                          {track.name}
                        </span>

                        {/* If checked, show Eye, Volume Slider, and Speaker matching mockup */}
                        {isChecked ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Eye icon for sheet music visibility */}
                            <button
                              onClick={() => onTrackVisibilityToggle(track.id)}
                              className={`p-0.5 rounded transition-colors cursor-pointer ${
                                track.isVisible ? 'text-slate-700 hover:text-slate-950' : 'text-slate-400 hover:text-slate-600'
                              }`}
                              title={track.isVisible ? 'Hide staff in score' : 'Show staff in score'}
                            >
                              {track.isVisible ? <Eye className="w-4 h-4 text-slate-700" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                            </button>

                            {/* Volume Slider */}
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={track.volume}
                              onChange={(e) => onTrackVolumeChange(track.id, Number(e.target.value))}
                              className="w-14 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0071e3]"
                              title={`Volume: ${track.volume}%`}
                            />

                            {/* Speaker icon */}
                            <Volume2 className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom of Right Panel: Reference MIDI & Volume */}
      <div className="p-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
        {/* Reference MIDI switch */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-900">Reference MIDI</span>
          <button
            onClick={() => onToggleReferenceMidi(!isReferenceMidiActive)}
            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
              isReferenceMidiActive ? 'bg-[#10b981]' : 'bg-slate-300'
            }`}
            title="Toggle Reference MIDI"
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                isReferenceMidiActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Master Volume Slider with Speaker Icon */}
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-4 h-4 text-slate-600 shrink-0" />
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0071e3]"
            title={`Reference MIDI Volume: ${masterVolume}%`}
          />
        </div>
      </div>
    </aside>
  );
};
