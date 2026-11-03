import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import type { PracticeMode, TextureRole, PracticeLine, TextureSpan, PartRoleSegment } from '../../utils/practiceTexture';
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
  selectedRoles: PracticeLine[];
  onRoleToggle: (role: PracticeLine) => void;
  texture?: TextureSpan;
  hasTexture: boolean;
  percussionPartIds: string[];
  percussionRange: { start: number; end: number };
  textureSections: TextureSpan[];
  roleSegments: PartRoleSegment[];
  onSectionSeek: (measure: number) => void;
  measure: number;
  onPreview: (role: PracticeLine) => void;
  previewRole: PracticeLine | null;
  canPreview: boolean;
  activeTexturePartIds: string[];
  ownPartResting: boolean;
  expandRoleMap?: boolean;
  extractionReviewBars: number[];
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
const roleName = (role: PracticeLine, texture?: TextureSpan) => role === 'percussion' ? 'Percussion rhythm section' : role === 'melody' ? 'Melody'
  : role === 'accompaniment' ? 'Accompaniment' : texture?.secondaryLabel || 'Countermelody';

export const EnsembleMixerPanel: React.FC<EnsembleMixerPanelProps> = (p) => {
  const roleMapRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (p.expandRoleMap && roleMapRef.current) {
      roleMapRef.current.open = true;
      const frame = requestAnimationFrame(() => roleMapRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
      return () => cancelAnimationFrame(frame);
    }
  }, [p.expandRoleMap, p.roleSegments.length]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ownName = p.parts?.find(part => part.id === p.myPartId)?.name || p.userInstrument;
  const names = (role: PracticeLine) => p.tracks.filter(t => t.id !== p.myPartId && p.activeTexturePartIds.includes(t.id) && (role === 'percussion' ? p.percussionPartIds : p.texture?.[role] || []).includes(t.id)).map(t => t.name);
  const backingNames = p.tracks.filter(t => t.id !== p.myPartId && !t.isMuted).map(t => t.name);
  const heard = p.mode === 'own' ? [] : p.mode === 'lines' ? availablePracticeRoles(p.selectedRoles, p.texture, p.myPartId ?? null)
    .filter(role => role === 'percussion' ? p.percussionPartIds.some(id => id !== p.myPartId) : p.hasTexture)
    .map(r => roleName(r, p.texture)) : backingNames;
  const roleSegment = p.roleSegments.find(s => p.measure >= s.start && p.measure <= s.end);
  const nextRoleSegment = roleSegment && p.roleSegments[p.roleSegments.indexOf(roleSegment) + 1];
  const ownRole = roles.find(r => p.myPartId && p.texture?.[r].includes(p.myPartId));
  return <aside aria-label="Practice accompaniment" className="w-80 xl:w-96 bg-white flex flex-col h-full shrink-0 text-slate-900">
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div><h2 className="text-xl font-bold">Practise with</h2>
        <label htmlFor="my-part" className="block text-xs text-slate-500 mt-3 mb-1">Your part</label>
        {p.parts?.length ? <select id="my-part" value={p.myPartId ?? ''} onChange={e => p.onMyPartChange?.(e.target.value)} className="w-full rounded-lg bg-slate-100 p-2 text-sm">
          {p.parts.map(part => <option key={part.id} value={part.id}>{part.name}</option>)}
        </select> : <p>{ownName}</p>}
      </div>
      {p.extractionReviewBars.length > 0 && <details className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
        <summary className="cursor-pointer font-medium">Source notation needs review</summary>
        <p className="mt-2">Bars {p.extractionReviewBars.join(', ')} contain extra chord tones within a player’s line. The original notes have been preserved.</p>
      </details>}
      <label className="flex items-start gap-3 cursor-pointer border-b border-slate-100 pb-4">
        <input aria-label="Hear my part" type="checkbox" className="mt-1 accent-blue-600" checked={!p.isMinusOneActive} onChange={e => p.onToggleMinusOne(!e.target.checked)} />
        <span><span className="font-semibold text-sm">Hear my part</span><span className="block text-xs text-slate-500 mt-1">Turn off to play it yourself.</span></span>
      </label>
      <div className="rounded-lg bg-slate-50 p-3 text-xs" aria-live="polite">
        <p className="font-semibold">Bar {p.measure}{p.texture ? ` · ${p.texture.label}` : ''}</p>
        {roleSegment ? <><p className="mt-1 text-slate-700 font-medium">Your role: {roleSegment.label} · Bars {roleSegment.start}–{roleSegment.end}</p>
          {nextRoleSegment && <p className="mt-1 text-slate-500">Next: {nextRoleSegment.label} · Bars {nextRoleSegment.start}–{nextRoleSegment.end}</p>}</>
          : ownRole && <p className="mt-1 text-slate-600">{p.ownPartResting ? 'Your part rests in this bar' : `Your role: ${roleName(ownRole, p.texture)}`}</p>}
        {p.roleSegments.length > 0 && <details ref={roleMapRef} className="mt-3"><summary className="cursor-pointer text-blue-700">View my role map</summary>
          <div className="mt-2 max-h-52 overflow-y-auto space-y-1">{p.roleSegments.map(segment => <button key={segment.start} type="button" onClick={() => p.onSectionSeek(segment.start)} aria-current={segment === roleSegment ? 'true' : undefined}
            className={`block w-full rounded p-2 text-left ${segment === roleSegment ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100'}`}>Bars {segment.start}–{segment.end} · {segment.label}</button>)}</div>
          <p className="mt-2 text-slate-500">Phrase-level roles; pickups and overlapping lines can share a bar.</p>
        </details>}
      </div>
      <fieldset className="space-y-4"><legend className="sr-only">Practice options</legend>
        {(['own', 'lines', 'instruments'] as PracticeMode[]).map(mode => <div key={mode}>
          <label className="flex items-center gap-3 font-semibold text-sm cursor-pointer">
            <input type="radio" name="practice-mode" value={mode} checked={p.mode === mode} disabled={mode === 'lines' && !p.hasTexture && !p.percussionPartIds.length} onChange={() => p.onModeChange(mode)} className="accent-blue-600" />
            {mode === 'own' ? 'My part only' : mode === 'lines' ? 'With a musical line' : 'Choose instruments'}
          </label>
          {mode === 'own' && p.mode === mode && <p className="ml-6 mt-2 text-xs text-slate-500">Your reference sound, with optional metronome.</p>}
          {mode === 'lines' && !p.hasTexture && <p className="ml-6 mt-2 text-xs text-slate-500">Musical-line analysis is not available for this score yet. {p.percussionPartIds.length ? 'You can use the percussion rhythm section.' : 'Choose instruments below.'}</p>}
          {mode === 'lines' && p.mode === mode && <div className="mt-3 space-y-2">
            {p.hasTexture && <label className="block text-xs font-semibold text-slate-600">Practice section
              <select aria-label="Practice section" value={p.texture?.start ?? ''} onChange={e => p.onSectionSeek(+e.target.value)} className="mt-1 block w-full rounded-lg bg-slate-100 p-2 text-slate-900">
                {p.textureSections.map(section => <option key={section.start} value={section.start}>{section.label} · Bars {section.start}–{section.end}</option>)}
              </select>
            </label>}
            <p className="text-xs text-slate-500">Previews play this whole section without moving your tracker.</p>
            {(['percussion', ...roles] as PracticeLine[]).map(role => {
              const instruments = names(role); const isOwnRole = role !== 'percussion' && role === ownRole;
              const unavailable = isOwnRole || (role !== 'percussion' && !p.hasTexture) || (role === 'percussion' && !p.percussionPartIds.some(id => id !== p.myPartId));
              const range = role === 'percussion' ? p.percussionRange : p.texture;
              const selected = !unavailable && p.selectedRoles.includes(role);
              return <div key={role} className={`rounded-xl border p-3 ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className={`flex items-center gap-2 text-sm font-semibold ${unavailable ? 'text-slate-400' : 'cursor-pointer'}`}><input type="checkbox" disabled={unavailable} className="accent-blue-600" checked={selected} onChange={() => p.onRoleToggle(role)} />{roleName(role, p.texture)}</label>
                  <button type="button" disabled={unavailable || !p.canPreview || instruments.length === 0} onClick={() => p.onPreview(role)} aria-label={`Preview ${roleName(role, p.texture)}`} className="text-xs text-blue-700 disabled:text-slate-400 flex items-center gap-1"><Volume2 size={13} />{p.previewRole === role ? 'Stop' : 'Preview section'}</button>
                </div>
                {isOwnRole && <p className="mt-2 text-xs font-medium text-slate-500">You play this line. Use “Hear my part” for your reference.</p>}
                {role === 'percussion' && <p className="mt-2 text-xs text-slate-500">Practise with the percussion pulse.</p>}
                {range && <p className="mt-2 text-xs font-medium text-slate-500">{p.previewRole === role ? 'Previewing' : 'Section'}: Bars {range.start}–{range.end}</p>}
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{(role === 'accompaniment'
                  ? [...new Set(p.tracks.filter(t => instruments.includes(t.name)).map(t => t.section === 'Percussion' ? 'Percussion' : accompanimentFamily(t.name)))].join(' · ')
                  : instruments.join(' · ')) || 'No other parts in this line here'}</p>
                {role === 'accompaniment' && instruments.length > 0 && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Show instruments</summary><p className="mt-1 leading-relaxed">{instruments.join(' · ')}</p></details>}
              </div>;
            })}
            <p className="text-xs text-slate-500">{p.hasTexture ? 'Musical lines follow changing instruments. ' : ''}Your part is controlled separately.</p>
            {p.hasTexture && <p className="text-xs text-slate-500">Musical-line roles use the saved score analysis. Supporting lines may include replies and decorations.</p>}
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
