import { useCallback, useEffect, useRef, useState } from 'react';

export type WinId = 'exercises' | 'plans' | 'recordings';

export interface WinRect { x: number; y: number; w: number; h: number }

export interface WinState {
  open: boolean;
  rect: WinRect;
  z: number;
  maximized: boolean;
  restore?: WinRect;
  shaded: boolean;
}

/** Width of the slim left rail and height of the top toolbar; windows live in the area they leave. */
export const RAIL_W = 68;
export const TOP_H = 56;
const EDGE = 10;
const KEY = 'aipc.windows.v3';
const ORDER: WinId[] = ['exercises', 'plans', 'recordings'];

const viewport = () => ({ vw: window.innerWidth, vh: window.innerHeight });

/** The usable desk area (right of the rail, below the toolbar). */
export const deskRect = (): WinRect => {
  const { vw, vh } = viewport();
  return { x: RAIL_W + 8, y: TOP_H + 4, w: vw - RAIL_W - 16, h: vh - TOP_H - 12 };
};

function defaults(): Record<WinId, WinState> {
  const { vw, vh } = viewport();
  const h = vh - TOP_H - 20;
  const mk = (rect: WinRect, open: boolean, z: number): WinState => ({ open, rect, z, maximized: false, shaded: false });
  return {
    exercises: mk({ x: Math.max(RAIL_W + 8, vw - 520 - 14), y: TOP_H + 8, w: Math.min(520, vw - RAIL_W - 16), h }, true, 1),
    plans: mk({ x: RAIL_W + 8, y: TOP_H + 48, w: Math.min(560, vw - RAIL_W - 16), h: Math.min(600, h) }, false, 2),
    recordings: mk({ x: Math.max(RAIL_W + 24, (vw - 1120) / 2), y: TOP_H + 24, w: Math.min(1120, vw - RAIL_W - 16), h: Math.min(760, h) }, false, 4),
  };
}

/** Keep a window reachable: never larger than the screen, never fully off-screen. */
function clampRect(r: WinRect): WinRect {
  const { vw, vh } = viewport();
  const w = Math.min(Math.max(r.w, 320), vw - RAIL_W - 16);
  const h = Math.min(Math.max(r.h, 200), vh - TOP_H - 8);
  return {
    w, h,
    x: Math.min(Math.max(r.x, RAIL_W - w + 120), vw - 120),
    y: Math.min(Math.max(r.y, TOP_H - 8), vh - 60),
  };
}

function load(): Record<WinId, WinState> {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Record<WinId, WinState>> | null;
    if (!saved) return base;
    for (const id of ORDER) {
      if (saved[id]) base[id] = { ...base[id], ...saved[id]!, rect: clampRect(saved[id]!.rect || base[id].rect) };
    }
  } catch { /* fall back to defaults */ }
  return base;
}

export type SnapZone = 'left' | 'right' | 'top' | null;

export function snapZoneAt(clientX: number, clientY: number): SnapZone {
  const { vw } = viewport();
  if (clientY <= EDGE) return 'top';
  if (clientX <= RAIL_W + EDGE && clientX >= 0) return 'left';
  if (clientX >= vw - EDGE) return 'right';
  return null;
}

export function snapRect(zone: Exclude<SnapZone, null>): WinRect {
  const d = deskRect();
  const half = Math.floor((d.w - 8) / 2);
  if (zone === 'left') return { x: d.x, y: d.y, w: half, h: d.h };
  if (zone === 'right') return { x: d.x + d.w - half, y: d.y, w: half, h: d.h };
  return { ...d };
}

export function useWindowManager() {
  const [wins, setWins] = useState<Record<WinId, WinState>>(load);
  const [popped, setPopped] = useState<Partial<Record<WinId, boolean>>>({});
  const [highlight, setHighlight] = useState<WinId | null>(null);
  const zRef = useRef(Math.max(...ORDER.map(id => wins[id].z)) + 1);

  // Persist layout so windows come back where the teacher left them
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(wins)); } catch { /* storage unavailable */ }
  }, [wins]);

  // Re-clamp windows if the screen gets smaller
  useEffect(() => {
    const onResize = () => setWins(prev => {
      const next = { ...prev };
      for (const id of ORDER) next[id] = { ...prev[id], rect: clampRect(prev[id].rect) };
      return next;
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const patch = useCallback((id: WinId, p: Partial<WinState>) =>
    setWins(prev => ({ ...prev, [id]: { ...prev[id], ...p } })), []);

  const focus = useCallback((id: WinId) => patch(id, { z: ++zRef.current }), [patch]);

  const flash = useCallback((id: WinId) => {
    setHighlight(id);
    setTimeout(() => setHighlight(h => (h === id ? null : h)), 900);
  }, []);

  /**
   * Rail behaviour: closed -> open; open but behind others -> bring to front (and pulse);
   * open and in front -> close. Always gives a way to "find" a window.
   */
  const toggle = useCallback((id: WinId) => {
    setWins(prev => {
      const w = prev[id];
      const topZ = Math.max(...ORDER.filter(k => prev[k].open).map(k => prev[k].z), 0);
      if (w.open && w.z === topZ) return { ...prev, [id]: { ...w, open: false } };
      return { ...prev, [id]: { ...w, open: true, shaded: false, z: ++zRef.current } };
    });
    flash(id);
  }, [flash]);

  const open = useCallback((id: WinId) => { patch(id, { open: true, shaded: false, z: ++zRef.current }); flash(id); }, [patch, flash]);
  const close = useCallback((id: WinId) => patch(id, { open: false }), [patch]);
  const setRect = useCallback((id: WinId, rect: WinRect) => patch(id, { rect: clampRect(rect), maximized: false, restore: undefined }), [patch]);
  const toggleShade = useCallback((id: WinId) => setWins(prev => ({ ...prev, [id]: { ...prev[id], shaded: !prev[id].shaded } })), []);

  const toggleMaximize = useCallback((id: WinId) => setWins(prev => {
    const w = prev[id];
    if (w.maximized && w.restore) return { ...prev, [id]: { ...w, rect: w.restore, maximized: false, restore: undefined } };
    return { ...prev, [id]: { ...w, restore: w.rect, rect: deskRect(), maximized: true, z: ++zRef.current } };
  }), []);

  /** Tidy: lay open windows side by side along the right edge, no overlap where space allows. */
  const arrange = useCallback(() => setWins(prev => {
    const d = deskRect();
    const next = { ...prev };
    let cursor = d.x + d.w;
    ORDER.filter(id => prev[id].open).forEach((id, i) => {
      const w = Math.min(prev[id].rect.w, 560);
      let x = cursor - w;
      if (x < d.x) x = d.x + i * 28; // out of room: cascade
      next[id] = { ...prev[id], maximized: false, restore: undefined, shaded: false, rect: { x, y: d.y + (x === d.x + i * 28 ? i * 28 : 0), w, h: d.h - (x === d.x + i * 28 ? i * 28 : 0) } };
      cursor = x - 10;
    });
    return next;
  }), []);

  const resetLayout = useCallback(() => setWins(defaults()), []);

  return { wins, popped, setPopped, highlight, toggle, open, close, focus, setRect, toggleShade, toggleMaximize, arrange, resetLayout };
}
