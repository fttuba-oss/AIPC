import React, { useState } from 'react';
import { Volume2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import type { PracticeMode, TextureRole, TextureSpan } from '../../utils/practiceTexture';
import { availablePracticeRoles } from '../../utils/practiceTexture';

export interface InstrumentTrack {
  id: string; name: string;
  section: 'Woodwinds' | 'Saxophones' | 'Brass' | 'Percussion' | 'Other';
  volume: number; isMuted: boolean; isVisible: boolean; isUserPart?: boolean;
}
interface EnsembleMixerPanelProps {
  onPlayAllParts: () => void;
  onClearParts: () => void;
  automaticBalance: boolean;
  onAutomaticBalanceChange: (enabled: boolean) => void;
  userInstrument: string;
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
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  selectedRoles: TextureRole[];
  onRoleToggle: (role: TextureRole) => void;
  texture?: TextureSpan;
  hasTexture: boolean;
  measure: number;
  onPreview: (role: TextureRole) => void;
  previewRole: TextureRole | null;
  canPreview: boolean;
  activeTexturePartIds: string[];
  ownPartResting: boolean;
}
const roles: TextureRole[] = ['melody', 'countermelody', 'accompaniment'];
const accompanimentFamily = (name: string): string => {
  if (/bassoon|bass clarinet|baritone sax|tuba|string bass/i.test(name)) return 'Bass instruments';
  if (/horn/i.test(name)) return 'Horns';
  if (/trombone/i.test(name)) return 'Trombones';
  if (/trumpet/i.test(name)) return 'Trumpets';
  if (/clarinet/i.test(name)) return 'Clarinets';
  if (/sax/i.test(name)) return 'Saxophones';
  return name;
};
const roleName = (role: TextureRole, texture?: TextureSpan) => role === 'melody' ? 'Melody'
  : role === 'accompaniment' ? 'Accompaniment' : texture?.secondaryLabel || 'Countermelody';

export const EnsembleMixerPanel: React.FC<EnsembleMixerPanelProps> = (p) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ownName = p.parts?.find(part => part.id === p.myPartId)?.name || p.userInstrument;
  const names = (role: TextureRole) => p.tracks.filter(t => t.id !== p.myPartId && p.activeTexturePartIds.includes(t.id) && p.texture?.[role].includes(t.id)).map(t => t.name);
  const backingNames = p.tracks.filter(t => t.id !== p.myPartId && !t.isMuted).map(t => t.name);
  const heard = p.mode === 'own' ? [] : p.mode === 'lines' ? availablePracticeRoles(p.selectedRoles, p.texture, p.myPartId ?? null).map(r => roleName(r, p.texture)) : backingNames;
  const ownRole = roles.find(r => p.myPartId && p.texture?.[r].includes(p.myPartId));
  return <aside aria-label="Practice accompaniment" className="w-80 xl:w-96 bg-white flex flex-col h-full shrink-0 text-slate-900">
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div><h2 className="text-xl font-bold">Practise with</h2>
        <label htmlFor="my-part" className="block text-xs text-slate-500 mt-3 mb-1">Your part</label>
        {p.parts?.length ? <select id="my-part" value={p.myPartId ?? ''} onChange={e => p.onMyPartChange?.(e.target.value)} className="w-full rounded-lg bg-slate-100 p-2 text-sm">
          {p.parts.map(part => <option key={part.id} value={part.id}>{part.name}</option>)}
        </select> : <p>{ownName}</p>}
      </div>
      <label className="flex items-start gap-3 cursor-pointer border-b border-slate-100 pb-4">
        <input aria-label="Hear my part" type="checkbox" className="mt-1 accent-blue-600" checked={!p.isMinusOneActive} onChange={e => p.onToggleMinusOne(!e.target.checked)} />
        <span><span className="font-semibold text-sm">Hear my part</span><span className="block text-xs text-slate-500 mt-1">Turn off to play it yourself.</span></span>
      </label>
      <div className="rounded-lg bg-slate-50 p-3 text-xs" aria-live="polite">
        <p className="font-semibold">Bar {p.measure}{p.texture ? ` · ${p.texture.label}` : ''}</p>
        {ownRole && <p className="mt-1 text-slate-600">{p.ownPartResting ? 'Your part rests in this bar' : `Your role: ${roleName(ownRole, p.texture)}`}</p>}
      </div>
      <fieldset className="space-y-4"><legend className="sr-only">Practice options</legend>
        {(['own', 'lines', 'instruments'] as PracticeMode[]).map(mode => <div key={mode}>
          <label className="flex items-center gap-3 font-semibold text-sm cursor-pointer">
            <input type="radio" name="practice-mode" value={mode} checked={p.mode === mode} disabled={mode === 'lines' && !p.hasTexture} onChange={() => p.onModeChange(mode)} className="accent-blue-600" />
            {mode === 'own' ? 'My part only' : mode === 'lines' ? 'With a musical line' : 'Choose instruments'}
          </label>
          {mode === 'own' && p.mode === mode && <p className="ml-6 mt-2 text-xs text-slate-500">Your reference sound, with optional metronome.</p>}
          {mode === 'lines' && !p.hasTexture && <p className="ml-6 mt-2 text-xs text-slate-500">Musical-line analysis is not available for this score yet. Choose instruments below.</p>}
          {mode === 'lines' && p.mode === mode && <div className="mt-3 space-y-2">
            {roles.map(role => {
              const instruments = names(role); const isOwnRole = role === ownRole;
              const selected = !isOwnRole && p.selectedRoles.includes(role);
              return <div key={role} className={`rounded-xl border p-3 ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className={`flex items-center gap-2 text-sm font-semibold ${isOwnRole ? 'text-slate-400' : 'cursor-pointer'}`}><input type="checkbox" disabled={isOwnRole} className="accent-blue-600" checked={selected} onChange={() => p.onRoleToggle(role)} />{roleName(role, p.texture)}</label>
                  <button type="button" disabled={isOwnRole || !p.canPreview || instruments.length === 0} onClick={() => p.onPreview(role)} aria-label={`Preview ${roleName(role, p.texture)}`} className="text-xs text-blue-700 disabled:text-slate-400 flex items-center gap-1"><Volume2 size={13} />{p.previewRole === role ? 'Stop' : 'Preview'}</button>
                </div>
                {isOwnRole && <p className="mt-2 text-xs font-medium text-slate-500">You play this line. Use “Hear my part” for your reference.</p>}
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{(role === 'accompaniment'
                  ? [...new Set(p.tracks.filter(t => instruments.includes(t.name)).map(t => t.section === 'Percussion' ? 'Percussion' : accompanimentFamily(t.name)))].join(' · ')
                  : instruments.join(' · ')) || 'No other parts in this line here'}</p>
                {role === 'accompaniment' && instruments.length > 0 && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Show instruments</summary><p className="mt-1 leading-relaxed">{instruments.join(' · ')}</p></details>}
              </div>;
            })}
            <p className="text-xs text-slate-500">Follows the musical line when instruments change. Your part is controlled separately.</p>
            <p className="text-xs text-slate-500">Based on the saved score analysis. Supporting lines may include replies and decorations.</p>
          </div>}
          {mode === 'instruments' && p.mode === mode && <div className="mt-3 space-y-3">
            <div className="flex gap-2"><button type="button" onClick={p.onPlayAllParts} aria-pressed={backingNames.length > 0 && backingNames.length === p.tracks.filter(t => t.id !== p.myPartId).length} className="flex-1 rounded-lg bg-blue-50 text-blue-700 p-2 text-xs font-semibold">Whole band</button><button type="button" onClick={p.onClearParts} className="rounded-lg border border-slate-200 p-2 text-xs">Clear selection</button></div>
            <p className="text-xs text-slate-500">Selected instruments stay with you throughout the piece.</p>
            {(['Woodwinds', 'Saxophones', 'Brass', 'Percussion', 'Other'] as const).map(section => {
              const tracks = p.tracks.filter(t => t.section === section && t.id !== p.myPartId);
              if (!tracks.length) return null;
              return <div key={section}><button type="button" aria-expanded={!collapsed[section]} onClick={() => setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))} className="flex justify-between w-full text-sm font-semibold py-2">{section}{collapsed[section] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
                {!collapsed[section] && tracks.map(t => <div key={t.id} className="py-2 border-t border-slate-100">
                  <label className="flex gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!t.isMuted} onChange={() => p.onTrackMuteToggle(t.id)} className="accent-blue-600" />{t.name}</label>
                  {!t.isMuted && <div className="flex items-center gap-2 ml-5 mt-2"><button type="button" aria-label={`${t.isVisible ? 'Hide' : 'Show'} ${t.name} staff`} onClick={() => p.onTrackVisibilityToggle(t.id)}>{t.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}</button><input aria-label={`${t.name} volume`} type="range" min="0" max="100" value={t.volume} onChange={e => p.onTrackVolumeChange(t.id, +e.target.value)} className="w-full accent-blue-600" /></div>}
                </div>)}
              </div>;
            })}
          </div>}
        </div>)}
      </fieldset>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.automaticBalance} onChange={e => p.onAutomaticBalanceChange(e.target.checked)} className="accent-blue-600" />Automatic balance</label>
      <div className="rounded-xl bg-blue-50 p-3 text-xs space-y-2"><p><strong>You play:</strong> {ownName}</p><p><strong>You hear:</strong> {!p.isReferenceMidiActive ? 'Reference audio off' : [...(!p.isMinusOneActive ? ['Your part'] : []), ...heard].join(' + ') || 'No reference parts selected'}</p></div>
    </div>
    <div className="p-4 border-t border-slate-100 space-y-3">
      <label className="flex items-center justify-between text-xs"><span>Reference audio</span><input type="checkbox" checked={p.isReferenceMidiActive} onChange={e => p.onToggleReferenceMidi(e.target.checked)} className="accent-blue-600" /></label>
      <label className="flex items-center gap-2 text-xs"><Volume2 size={16} /><span className="sr-only">Reference volume</span><input type="range" min="0" max="100" value={p.masterVolume} onChange={e => p.onMasterVolumeChange(+e.target.value)} className="w-full accent-blue-600" /></label>
    </div>
  </aside>;
};
