import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, MoreHorizontal, ChevronUp, X } from 'lucide-react';

export type MobilePanel = 'practice' | 'roles' | 'more' | null;
export const MOBILE_PRACTICE_QUERY = '(max-width: 1023px), (any-pointer: coarse) and (max-width: 1400px)';
function usePracticeMedia(query: string) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setMobile(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return mobile;
}
export function useMobilePracticeLayout() { return usePracticeMedia(MOBILE_PRACTICE_QUERY); }
export function useCompactPortraitScore() { return usePracticeMedia('(max-width: 560px) and (orientation: portrait)'); }

export function MobilePracticeHeader({ title, part, section, onRoles, blocked }: {
  title: string; part: string; section: string; onRoles: () => void; blocked: boolean;
}) {
  return <header className="aipc-mobile-heading" inert={blocked}>
    <strong className="aipc-mobile-brand">AIPC</strong>
    <span className="aipc-mobile-piece" title={`${title} · ${part}`}>{title} · {part}</span>
    <button type="button" className="aipc-mobile-role-button" onClick={onRoles} aria-label="Open role map">
      <span className="aipc-mobile-section">{section}</span><span>Role map</span>
    </button>
  </header>;
}

export function MobilePracticeToolbar(p: {
  playing: boolean; preparing: boolean; bpm: number; backing: string; mutedClick: boolean; blocked: boolean;
  onPlay: () => void; onRestart: () => void; onTempo: (bpm: number) => void;
  onClick: () => void; onPractice: () => void; onMore: () => void;
}) {
  return <footer className="aipc-mobile-transport" aria-label="Mobile playback controls" inert={p.blocked}>
    <button type="button" aria-label={p.playing ? 'Pause practice' : 'Start practice'} disabled={p.preparing} onClick={p.onPlay} className="aipc-mobile-play">{p.playing ? <Pause size={20} /> : <Play size={20} />}</button>
    <button type="button" aria-label="Restart from beginning" onClick={p.onRestart}><RotateCcw size={20} /></button>
    <div className="aipc-mobile-tempo">
      <button type="button" aria-label="Decrease tempo" onClick={() => p.onTempo(p.bpm - 1)}>−</button>
      <span aria-live="off">{p.bpm}<span className="aipc-mobile-bpm-unit"> BPM</span></span>
      <button type="button" aria-label="Increase tempo" onClick={() => p.onTempo(p.bpm + 1)}>+</button>
    </div>
    <button type="button" role="switch" aria-label="Metronome click" aria-checked={!p.mutedClick} onClick={p.onClick} className="aipc-mobile-click"><span>Click</span><span className={`aipc-mini-switch ${p.mutedClick ? '' : 'is-on'}`} aria-hidden="true" /></button>
    <button type="button" aria-label={`Practise with: ${p.backing}`} aria-haspopup="dialog" onClick={p.onPractice} className="aipc-mobile-practice"><span>Practise with<span className="aipc-mobile-backing"> · {p.backing}</span></span><ChevronUp size={16} /></button>
    <button type="button" aria-label="More practice controls" aria-haspopup="dialog" onClick={p.onMore}><MoreHorizontal size={22} /></button>
  </footer>;
}

export function ResponsivePracticePanel({ mobile, panel, onClose, children, more }: {
  mobile: boolean; panel: MobilePanel; onClose: () => void; children: React.ReactNode; more: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const open = mobile && panel !== null;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[data-close-practice]')?.focus());
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]') || []).filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, onClose]);
  return <>
    {open && <button type="button" tabIndex={-1} aria-label="Close practice settings" className="aipc-mobile-backdrop" onClick={onClose} />}
    <div ref={root} className={`aipc-mixer-shell py-3 pr-3 shrink-0 h-full ${open ? 'is-open' : ''}`}
      role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined}
      aria-label={open ? panel === 'more' ? 'More practice controls' : panel === 'roles' ? 'Your role map' : 'Practice settings' : undefined}
      inert={mobile && !open}>
      <div className="aipc-mobile-sheet-heading"><strong>{panel === 'more' ? 'More controls' : panel === 'roles' ? 'Your role map' : 'Practise with'}</strong><button data-close-practice type="button" onClick={onClose}>Done <X size={17} /></button></div>
      <div className="aipc-mixer-border h-full rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs" hidden={mobile && panel === 'more'}>{children}</div>
      {mobile && panel === 'more' && <div className="aipc-mobile-more">{more}</div>}
    </div>
  </>;
}
