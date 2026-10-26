import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Read-only score viewer, engraved with Verovio (SVG, proper conductor-score spacing).
 * MusicXML is only the source; what the teacher sees is a typeset score.
 */
export interface ConductorScoreViewerProps {
  xmlContent: string | null;
  scoreTitle: string;
  passageRange: [number, number]; // e.g. [47, 48]
  onPassageChange: (range: [number, number]) => void;
  scoreViewMode: string;
  onScoreViewModeChange?: (mode: string) => void;
}

interface MeasureBox {
  measureNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Notation size as a percentage of Verovio's default; the number of bars per system follows from it. */
const MIN_SCALE = 8;
const MAX_SCALE = 100;
const READ_SCALE = 40;
const SCALE_STEP = 5;

// Show/hide instruments based on the selected view (full score or a single instrument family)
const FAMILY_MATCHERS: Record<string, string[]> = {
  woodwinds: ['flute', 'piccolo', 'oboe', 'clarinet', 'sax', 'bassoon'],
  brass: ['trumpet', 'cornet', 'horn', 'trombone', 'euph', 'baritone', 'tuba'],
  flute: ['flute', 'piccolo'],
  oboe: ['oboe', 'bassoon'],
  clarinet: ['clarinet'],
  saxophone: ['sax'],
  trumpet: ['trumpet', 'cornet'],
  horn: ['horn'],
  trombone: ['trombone'],
  euphonium_tuba: ['euph', 'tuba'],
  percussion: ['timpani', 'perc', 'glock', 'drum', 'cymbal', 'tam-tam', 'tam tam', 'bells', 'xylophone', 'marimba', 'vibraphone', 'triangle', 'tambourine'],
};

/** Keep only the parts for the chosen view (all parts for the full score or if nothing matches). */
function filterParts(xml: string, mode: string): { xml: string; measureNumbers: number[] } {
  // Some exports double-escape ampersands in part names ("1st &amp;amp; 2nd Flutes")
  const doc = new DOMParser().parseFromString(xml.replace(/&amp;amp;/g, '&amp;'), 'application/xml');
  const patterns = FAMILY_MATCHERS[mode];
  if (mode !== 'full' && patterns) {
    const scoreParts = Array.from(doc.getElementsByTagName('score-part'));
    const nameOf = (sp: Element) =>
      `${sp.getElementsByTagName('part-name')[0]?.textContent || ''} ${sp.getElementsByTagName('instrument-name')[0]?.textContent || ''}`.toLowerCase();
    const keep = scoreParts.filter(sp => patterns.some(p => nameOf(sp).includes(p))).map(sp => sp.getAttribute('id'));
    if (keep.length > 0) {
      scoreParts.forEach(sp => { if (!keep.includes(sp.getAttribute('id'))) sp.parentNode?.removeChild(sp); });
      Array.from(doc.getElementsByTagName('part')).forEach(p => {
        if (!keep.includes(p.getAttribute('id'))) p.parentNode?.removeChild(p);
      });
      // groups that no longer make sense after removing parts
      Array.from(doc.getElementsByTagName('part-group')).forEach(g => g.parentNode?.removeChild(g));
    }
  }
  const firstPart = doc.getElementsByTagName('part')[0];
  const measureNumbers = firstPart
    ? Array.from(firstPart.getElementsByTagName('measure')).map((m, i) => parseInt(m.getAttribute('number') || '', 10) || i + 1)
    : [];
  return { xml: new XMLSerializer().serializeToString(doc), measureNumbers };
}

// One WASM toolkit for the whole app
let toolkitPromise: Promise<any> | null = null;
function getToolkit(): Promise<any> {
  if (!toolkitPromise) {
    toolkitPromise = Promise.all([import('verovio/wasm'), import('verovio/esm')]).then(
      async ([wasm, esm]) => {
        const module = await (wasm as any).default();
        return new (esm as any).VerovioToolkit(module);
      }
    );
  }
  return toolkitPromise;
}

export const ConductorScoreViewer: React.FC<ConductorScoreViewerProps> = ({
  xmlContent,
  passageRange,
  onPassageChange,
  scoreViewMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const toolkitRef = useRef<any>(null);
  const measureNumbersRef = useRef<number[]>([]);
  const loadedKeyRef = useRef<string | null>(null);

  const [scale, setScale] = useState<number>(READ_SCALE);
  // Overview: pick the size at which one whole system (every part) fits the view height.
  const [overview, setOverview] = useState<boolean>(false);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const overviewRef = useRef(overview);
  overviewRef.current = overview;

  const [measureBoxes, setMeasureBoxes] = useState<MeasureBox[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [isRendered, setIsRendered] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  /** Lay the score out for the current width and scale, draw it, and map bars to screen boxes. */
  const layoutAndDraw = useCallback((tk: any) => {
    const wrapper = scrollWrapperRef.current;
    const host = containerRef.current;
    if (!wrapper || !host) return;
    const s = scaleRef.current;
    const width = Math.max(300, wrapper.clientWidth - 12);
    tk.setOptions({
      scale: s,
      pageWidth: Math.round(width * 100 / s),
      pageHeight: 60000,
      adjustPageHeight: true,
      breaks: 'auto',
      header: 'none',
      footer: 'none',
      pageMarginLeft: 30,
      pageMarginRight: 30,
      pageMarginTop: 30,
      pageMarginBottom: 30,
      justifyVertically: false,
      svgViewBox: false,
    });
    tk.redoLayout();
    // Very long scores spill onto further pages; stack them so it reads as one continuous score
    const pages: string[] = [];
    for (let p = 1; p <= tk.getPageCount(); p++) pages.push(`<div style="display:block;line-height:0">${tk.renderToSVG(p)}</div>`);
    host.innerHTML = pages.join('');

    const hostRect = host.getBoundingClientRect();
    const nums = measureNumbersRef.current;
    const els = host.querySelectorAll('g.measure');
    // The printed bar number comes from the engraved score itself (Verovio keeps MusicXML's "number")
    const numberOf = (el: Element, i: number): number => {
      try {
        const n = parseInt(String(tk.getElementAttr(el.id)?.n ?? ''), 10);
        if (n) return n;
      } catch { /* fall back */ }
      return nums[i] ?? i + 1;
    };
    const boxes: MeasureBox[] = [];
    els.forEach((el, i) => {
      const r = (el as SVGGraphicsElement).getBoundingClientRect();
      boxes.push({
        measureNumber: numberOf(el as Element, i),
        x: r.left - hostRect.left,
        y: r.top - hostRect.top,
        width: r.width,
        height: r.height,
      });
    });
    setMeasureBoxes(boxes);

    // Overview: rescale once so the first system fits the view height
    if (overviewRef.current && boxes.length > 0) {
      const topY = boxes[0].y;
      const sysH = Math.max(...boxes.filter(b => Math.abs(b.y - topY) < 4).map(b => b.height));
      const avail = wrapper.clientHeight - 40;
      const next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * avail / sysH)));
      if (Math.abs(next - s) > 1) {
        scaleRef.current = next;
        setScale(next);
      }
    }
  }, []);

  // Load the score for the chosen view (heavy: only when the score or the view changes)
  useEffect(() => {
    if (!xmlContent) return;
    let cancelled = false;
    const key = `${xmlContent.length}:${xmlContent.slice(0, 200)}:${scoreViewMode}`;
    if (loadedKeyRef.current === key && toolkitRef.current) return;
    setBusy(true);
    setRenderError(null);
    (async () => {
      try {
        const tk = await getToolkit();
        if (cancelled) return;
        const { xml, measureNumbers } = filterParts(xmlContent, scoreViewMode);
        measureNumbersRef.current = measureNumbers;
        // let the spinner paint before the (synchronous) engraving starts
        await new Promise(r => setTimeout(r, 30));
        if (cancelled) return;
        tk.setOptions({ inputFrom: 'musicxml' });
        if (!tk.loadData(xml)) throw new Error('Could not read this score.');
        toolkitRef.current = tk;
        loadedKeyRef.current = key;
        layoutAndDraw(tk);
        setIsRendered(true);
      } catch (e: any) {
        console.error('Failed to engrave score:', e);
        if (!cancelled) setRenderError(e?.message || 'Failed to engrave the score.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [xmlContent, scoreViewMode, layoutAndDraw]);

  // Re-engrave when the notation size changes (debounced)
  useEffect(() => {
    if (!toolkitRef.current || !loadedKeyRef.current) return;
    const t = setTimeout(() => {
      try { layoutAndDraw(toolkitRef.current); } catch (e) { console.warn('Re-layout failed:', e); }
    }, 200);
    return () => clearTimeout(t);
  }, [scale, layoutAndDraw]);

  // Re-flow when the available width changes
  useEffect(() => {
    const wrapper = scrollWrapperRef.current;
    if (!wrapper) return;
    let last = wrapper.clientWidth;
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      if (Math.abs(wrapper.clientWidth - last) < 8 || !toolkitRef.current) return;
      last = wrapper.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(() => { try { layoutAndDraw(toolkitRef.current); } catch { /* ignore */ } }, 250);
    });
    ro.observe(wrapper);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, [layoutAndDraw]);

  const handleMeasureClick = (measureNumber: number, extend: boolean) => {
    if (extend) {
      onPassageChange([Math.min(passageRange[0], measureNumber), Math.max(passageRange[1], measureNumber)]);
    } else {
      onPassageChange([measureNumber, measureNumber + 1]);
    }
  };

  const zoomBy = (delta: number) => {
    setOverview(false);
    overviewRef.current = false;
    setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)));
  };

  const readMode = () => {
    setOverview(false);
    overviewRef.current = false;
    setScale(READ_SCALE);
  };

  const overviewMode = () => {
    setOverview(true);
    overviewRef.current = true;
    if (toolkitRef.current) {
      try { layoutAndDraw(toolkitRef.current); } catch { /* ignore */ }
    }
  };

  /**
   * Page turn that respects the music: when whole systems fit the view, the turn lands on a system
   * boundary so no staff is cut in half. A single system taller than the view (e.g. a 31-part
   * conductor score) falls back to scrolling by most of a screen.
   */
  const turnPage = (dir: 1 | -1) => {
    const w = scrollWrapperRef.current;
    if (!w) return;
    const pad = 12;
    const tops = Array.from(new Set(measureBoxes.map(b => Math.round(b.y)))).sort((a, b) => a - b);
    const bottoms = tops.map(t => Math.max(...measureBoxes.filter(b => Math.round(b.y) === t).map(b => b.y + b.height)));
    const tallest = Math.max(0, ...tops.map((t, i) => bottoms[i] - t));
    const view = w.clientHeight;
    if (!tops.length || tallest > view - 24) {
      w.scrollBy({ top: dir * view * 0.85, behavior: 'smooth' });
      return;
    }
    const cur = w.scrollTop;
    let target: number;
    if (dir === 1) {
      const i = tops.findIndex((t, k) => bottoms[k] + pad > cur + view - 4);
      target = i < 0 ? cur : tops[i] + pad - 6;
      if (target <= cur + 4 && i + 1 < tops.length) target = tops[i + 1] + pad - 6;
    } else {
      const goal = cur - view + 40;
      const cand = tops.find(t => t + pad - 6 >= goal && t + pad - 6 < cur - 4);
      target = cand === undefined ? 0 : cand + pad - 6;
    }
    w.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    zoomBy(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
  };

  const inPassage = (n: number) => n >= passageRange[0] && n <= passageRange[1];

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden select-none relative">
      {/* Main sheet music canvas: the score gets the whole area */}
      <div
        ref={scrollWrapperRef}
        onWheel={onWheel}
        className="flex-1 overflow-auto relative px-1.5 pb-20 pt-3 bg-white"
      >
        {renderError && (
          <div className="absolute inset-x-6 top-6 text-sm text-rose-600">{renderError}</div>
        )}
        <div className="relative inline-block min-w-full">
          {/* Verovio SVG host */}
          <div ref={containerRef} className="sheet-music-canvas w-full" />

          {/* Selected passage: a soft wash over each selected bar, notes stay legible */}
          {isRendered && measureBoxes.filter(b => inPassage(b.measureNumber)).map((box, idx) => (
            <div
              key={`sel-${idx}`}
              style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
              className="absolute pointer-events-none z-10 bg-[#0071e3]/[0.09] border-x border-[#0071e3]/30"
            />
          ))}

          {/* Clickable measure hit targets */}
          {isRendered && measureBoxes.map((box, idx) => (
            <div
              key={`hit-${idx}`}
              onClick={(e) => handleMeasureClick(box.measureNumber, e.shiftKey)}
              style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
              className="absolute cursor-pointer hover:bg-blue-500/5 transition-colors z-0"
              title={`Bar ${box.measureNumber} \u2013 click to select, Shift+click to extend`}
            />
          ))}
        </div>
      </div>

      {busy && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-slate-900/85 text-white text-xs">Engraving score…</div>
        </div>
      )}

      {/* View controls: page turns, Read / Overview, zoom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/80 backdrop-blur-xl rounded-full p-1 shadow-[0_4px_20px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)]">
        <button onClick={() => turnPage(-1)} className="p-2 hover:bg-black/5 rounded-full text-slate-600 cursor-pointer" title="Previous page">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button onClick={() => turnPage(1)} className="p-2 hover:bg-black/5 rounded-full text-slate-600 cursor-pointer" title="Next page">
          <ChevronDown className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-black/10 mx-0.5" />
        <div className="flex bg-black/5 rounded-full p-0.5 text-[12px] font-medium">
          <button
            onClick={readMode}
            className={`px-3 py-1 rounded-full cursor-pointer transition-all ${!overview ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            title="Readable size, scroll through all parts"
          >
            Read
          </button>
          <button
            onClick={overviewMode}
            className={`px-3 py-1 rounded-full cursor-pointer transition-all ${overview ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            title="Fit every part in view"
          >
            Overview
          </button>
        </div>
        <div className="w-px h-5 bg-black/10 mx-0.5" />
        <button onClick={() => zoomBy(-SCALE_STEP)} className="p-2 hover:bg-black/5 rounded-full text-slate-600 cursor-pointer" title="Smaller notation (Ctrl + scroll)">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-[12px] font-medium text-slate-600 tabular-nums w-10 text-center">
          {scale}%
        </span>
        <button onClick={() => zoomBy(SCALE_STEP)} className="p-2 hover:bg-black/5 rounded-full text-slate-600 cursor-pointer" title="Larger notation (Ctrl + scroll)">
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
