import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X, Minus, Plus } from 'lucide-react';
import { snapRect, snapZoneAt, type SnapZone, type WinRect, type WinState } from './useWindowManager';

// Windows opened as real browser windows, so we can focus / close them from elsewhere.
const popupWindows = new Map<string, Window>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => popupWindows.forEach(w => w.close()));
}
export const focusPopout = (id: string) => popupWindows.get(id)?.focus();

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: { dir: Dir; cls: string; cursor: string }[] = [
  { dir: 'n', cls: 'top-0 left-3 right-3 h-1.5', cursor: 'ns-resize' },
  { dir: 's', cls: 'bottom-0 left-3 right-3 h-1.5', cursor: 'ns-resize' },
  { dir: 'e', cls: 'right-0 top-3 bottom-3 w-1.5', cursor: 'ew-resize' },
  { dir: 'w', cls: 'left-0 top-3 bottom-3 w-1.5', cursor: 'ew-resize' },
  { dir: 'ne', cls: 'top-0 right-0 w-3 h-3', cursor: 'nesw-resize' },
  { dir: 'nw', cls: 'top-0 left-0 w-3 h-3', cursor: 'nwse-resize' },
  { dir: 'se', cls: 'bottom-0 right-0 w-3 h-3', cursor: 'nwse-resize' },
  { dir: 'sw', cls: 'bottom-0 left-0 w-3 h-3', cursor: 'nesw-resize' },
];
const MIN_W = 340;
const MIN_H = 220;

export interface FloatingWindowProps {
  id: string;
  title: string;
  state: WinState;
  isFront: boolean;
  highlight: boolean;
  onFocus: () => void;
  onRect: (rect: WinRect) => void;
  onClose: () => void;
  onMaximize: () => void;
  onShade: () => void;
  onSnapPreview: (zone: SnapZone) => void;
  onPopChange: (popped: boolean) => void;
  onNotify: (text: string) => void;
  children: React.ReactNode;
}

/**
 * A macOS-style window floating over the score: drag the title bar, resize from any edge,
 * snap to the screen edges, or pop it out into a real browser window (e.g. on a second screen).
 */
export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  id, title, state, isFront, highlight, onFocus, onRect, onClose, onMaximize, onShade,
  onSnapPreview, onPopChange, onNotify, children,
}) => {
  const [liveRect, setLiveRect] = useState<WinRect | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [popContainer, setPopContainer] = useState<HTMLElement | null>(null);
  const popRef = useRef<Window | null>(null);
  const rect = liveRect || state.rect;

  // ---- Drag ----
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    onFocus();
    const start = { x: e.clientX, y: e.clientY, rect: state.rect };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    let current = start.rect;
    let zone: SnapZone = null;
    // Pointer has left the browser page: releasing here opens the window on the desktop.
    const isOutside = (ev: PointerEvent) =>
      ev.clientX < 0 || ev.clientX > window.innerWidth || ev.clientY > window.innerHeight;
    const move = (ev: PointerEvent) => {
      current = { ...start.rect, x: start.rect.x + ev.clientX - start.x, y: Math.max(0, start.rect.y + ev.clientY - start.y) };
      setLiveRect(current);
      const out = isOutside(ev);
      setLeaving(out);
      zone = out ? null : snapZoneAt(ev.clientX, ev.clientY);
      onSnapPreview(zone);
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      onSnapPreview(null);
      setLeaving(false);
      setLiveRect(null);
      if (isOutside(ev)) {
        // keep the grab point under the cursor on the new desktop window
        popOut({ left: Math.round(ev.screenX - (start.x - start.rect.x)), top: Math.round(ev.screenY - 20) });
        return;
      }
      onRect(zone ? snapRect(zone) : current);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  // ---- Resize ----
  const startResize = (dir: Dir) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const start = { x: e.clientX, y: e.clientY, rect: state.rect };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    let current = start.rect;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      let { x, y, w, h } = start.rect;
      if (dir.includes('e')) w = Math.max(MIN_W, start.rect.w + dx);
      if (dir.includes('s')) h = Math.max(MIN_H, start.rect.h + dy);
      if (dir.includes('w')) { w = Math.max(MIN_W, start.rect.w - dx); x = start.rect.x + (start.rect.w - w); }
      if (dir.includes('n')) { h = Math.max(MIN_H, start.rect.h - dy); y = start.rect.y + (start.rect.h - h); }
      current = { x, y, w, h };
      setLiveRect(current);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setLiveRect(null);
      onRect(current);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  // ---- Pop out into a real browser window ----
  const popOut = useCallback((pos?: { left: number; top: number }) => {
    const place = pos ? `,left=${pos.left},top=${pos.top}` : '';
    const win = window.open('', `aipc-${id}`, `popup=yes,width=${Math.round(state.rect.w)},height=${Math.round(state.rect.h)}${place}`);
    if (!win) {
      onNotify('Pop-up blocked – allow pop-ups for this site to open windows separately.');
      return;
    }
    win.document.title = `${title} – AIPC`;
    win.document.head.innerHTML = '';
    win.document.body.innerHTML = '';
    // Copy the app's styles so the content looks identical
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(n => win.document.head.appendChild(n.cloneNode(true)));
    win.document.body.style.margin = '0';
    const container = win.document.createElement('div');
    container.style.height = '100vh';
    win.document.body.appendChild(container);
    // Closing the browser window brings it back as a floating window
    win.addEventListener('pagehide', () => {
      popupWindows.delete(id);
      popRef.current = null;
      setPopContainer(null);
      onPopChange(false);
    });
    popupWindows.set(id, win);
    popRef.current = win;
    setPopContainer(container);
    onPopChange(true);
  }, [id, title, state.rect.w, state.rect.h, onNotify, onPopChange]);

  useEffect(() => () => { popRef.current?.close(); }, []);

  // Popped out: render the content in the other window only
  if (popContainer) {
    return createPortal(
      <div className="h-full flex flex-col bg-white overflow-hidden select-none relative">{children}</div>,
      popContainer
    );
  }

  const bodyHidden = state.shaded;

  return (
    <div
      onPointerDown={onFocus}
      style={{
        left: rect.x, top: rect.y, width: rect.w, height: bodyHidden ? 44 : rect.h,
        zIndex: 40 + state.z,
      }}
      className={`absolute flex flex-col rounded-[14px] overflow-hidden bg-white/90 backdrop-blur-2xl animate-fade-in ${
        isFront ? 'shadow-[0_24px_70px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.12)]' : 'shadow-[0_8px_30px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.1)]'
      } ${highlight ? 'ring-4 ring-blue-500/40' : ''} transition-[box-shadow] duration-200`}
      role="dialog"
      aria-label={title}
    >
      {/* Title bar */}
      <div
        onPointerDown={startDrag}
        onDoubleClick={onShade}
        className={`group h-11 shrink-0 flex items-center px-3.5 gap-3 cursor-grab active:cursor-grabbing border-b border-black/5 ${isFront ? 'bg-white/70' : 'bg-slate-50/70'}`}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label="Close window" title="Close"
            className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/10 flex items-center justify-center cursor-pointer">
            <X className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
          </button>
          <button onClick={onShade} aria-label="Roll up window" title="Roll up"
            className="w-3 h-3 rounded-full bg-[#febc2e] border border-black/10 flex items-center justify-center cursor-pointer">
            <Minus className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
          </button>
          <button onClick={onMaximize} aria-label="Fill screen" title={state.maximized ? 'Restore size' : 'Fill screen'}
            className="w-3 h-3 rounded-full bg-[#28c840] border border-black/10 flex items-center justify-center cursor-pointer">
            <Plus className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
          </button>
        </div>
        <div className={`flex-1 text-center text-[13px] font-semibold truncate select-none ${isFront ? 'text-slate-900' : 'text-slate-400'}`}>
          {title}
        </div>
        <button onClick={() => popOut()} aria-label="Open in separate window" title="Open in a separate window (second screen)"
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-black/5 cursor-pointer">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {leaving && createPortal(
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs shadow-xl pointer-events-none">
          Release to open in its own window
        </div>,
        document.body
      )}

      {/* Content */}
      <div className={`flex-1 min-h-0 relative bg-white ${bodyHidden ? 'hidden' : ''}`}>{children}</div>

      {/* Resize handles */}
      {!bodyHidden && !state.maximized && HANDLES.map(h => (
        <div key={h.dir} onPointerDown={startResize(h.dir)} className={`absolute z-10 ${h.cls}`} style={{ cursor: h.cursor }} />
      ))}
    </div>
  );
};
