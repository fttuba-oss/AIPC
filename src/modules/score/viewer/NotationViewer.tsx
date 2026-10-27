import React, { useEffect, useRef, useState, useCallback } from 'react';
import { buildTrackerAnchors, trackerPositionAt, type TrackerAnchor, type TrackerMeasure } from '../engine/scoreTracker';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { ZoomIn, ZoomOut, Target, Layers } from 'lucide-react';
import {
  parseScorePlayback,
  secondsToBeats,
  beatToSeconds,
  getTargetPartAndNotes,
  type ScorePlaybackData
} from '../engine/scorePlaybackParser';

interface StudentScoreViewerProps {
  xmlUrl?: string;
  xmlContent?: string | null;
  startMeasure: number;
  endMeasure: number;
  sectionStartMeasure?: number;
  sectionEndMeasure?: number;
  totalMeasures?: number;
  instrumentPartName?: string;
  playbackProgress?: number; // Current playback time in score seconds
  isPlaying?: boolean;
  getPlaybackTime?: () => number | null;
  viewMode?: 'focus' | 'full';
  onViewModeChange?: (mode: 'focus' | 'full') => void;
  highlightedPartName?: string;
  hiddenInstrumentNames?: string[];
  /** Staves to draw, by part id (null/undefined = every part). */
  visiblePartIds?: string[] | null;
  /** The part the student is practising (drives target notes and evaluation). */
  instrumentPartId?: string | null;
  noteEvaluations?: Record<number, 'Perfect' | 'Great' | 'Good' | 'Early' | 'Late' | 'Miss'>;
  problemMeasures?: number[];
  onClearEvaluations?: () => void;
  isCoachModeActive?: boolean;
  coachActiveNoteIndex?: number | null;
  onScoreParsed?: (scoreData: ScorePlaybackData) => void;
  onSeek?: (seconds: number, beat?: number, measureNumber?: number) => void;
}

/** Show only the chosen parts' staves (all of them when ids is null or matches nothing). */
function applyVisibleParts(osmd: OpenSheetMusicDisplay, ids: string[] | null | undefined) {
  const instruments = osmd.Sheet?.Instruments;
  if (!instruments) return;
  const matches = ids ? instruments.filter((i: any) => ids.includes(String(i.IdString ?? i.Id))) : [];
  instruments.forEach((i: any) => { i.Visible = !ids || matches.length === 0 ? true : matches.includes(i); });
}
export const StudentScoreViewer: React.FC<StudentScoreViewerProps> = ({
  xmlUrl,
  xmlContent,
  startMeasure,
  endMeasure,
  sectionStartMeasure = startMeasure,
  sectionEndMeasure = endMeasure,
  totalMeasures,
  instrumentPartName = 'Flute 2',
  playbackProgress = 0,
  isPlaying = false,
  getPlaybackTime,
  viewMode: propViewMode,
  onViewModeChange,
  highlightedPartName,
  hiddenInstrumentNames = [],
  visiblePartIds = null,
  instrumentPartId = null,
  noteEvaluations,
  problemMeasures = [],
  onClearEvaluations,
  isCoachModeActive = false,
  coachActiveNoteIndex: _coachActiveNoteIndex = null,
  onScoreParsed,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const customCursorRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);

  const [zoom, setZoom] = useState<number>(0.90);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScorePlaybackData | null>(null);
  const visiblePartsRef = useRef<string[] | null>(visiblePartIds);
  visiblePartsRef.current = visiblePartIds;
  
  // Active activeViewMode: controlled prop or internal fallback
  const [internalViewMode, setInternalViewMode] = useState<'focus' | 'full'>('focus');
  const activeViewMode = propViewMode ?? internalViewMode;
  const setViewMode = (mode: 'focus' | 'full') => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };

  const cursorBeatRef = useRef<number>(-1);
  const cachedNotesRef = useRef<any[]>([]);
  const trackerAnchorsRef = useRef<TrackerAnchor[]>([]);
  const playbackRef = useRef({ playbackProgress, getPlaybackTime });
  playbackRef.current = { playbackProgress, getPlaybackTime };
  const lastTrackerSystemRef = useRef<number | null>(null);

  const drawTracker = useCallback((beat: number, follow = false) => {
    const el = customCursorRef.current;
    const position = trackerPositionAt(trackerAnchorsRef.current, beat);
    if (!el || !position) return;
    el.style.display = 'block';
    el.style.transform = `translate3d(${position.x}px, ${position.top}px, 0)`;
    el.style.height = `${position.height}px`;
    if (follow && lastTrackerSystemRef.current !== position.system && wrapperRef.current) {
      // Scroll only when entering a system; never restart a smooth scroll every frame.
      let viewport = wrapperRef.current.parentElement;
      while (viewport && !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)) viewport = viewport.parentElement;
      if (viewport) {
        const y = wrapperRef.current.getBoundingClientRect().top + position.top;
        const box = viewport.getBoundingClientRect();
        if (y < box.top + 16 || y + position.height > box.bottom - 24) {
          viewport.scrollTo({ top: viewport.scrollTop + y - box.top - 48,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        }
      }
    }
    lastTrackerSystemRef.current = position.system;
  }, []);

  /** Cache engraving geometry after layout; the animation loop performs no SVG measurements. */
  const rebuildTrackerAnchors = useCallback(() => {
    const osmd = osmdRef.current;
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!osmd || !wrapper || !container) return;
    const wrap = wrapper.getBoundingClientRect();
    const svgs = Array.from(container.querySelectorAll('svg'));
    const systems = new Map<object, number>();
    const rows: TrackerMeasure[] = [];
    for (const measureRow of osmd.GraphicSheet?.MeasureList || []) {
      const visible = measureRow.filter((m: any) => m && (typeof m.isVisible !== 'function' || m.isVisible()) && m.getVFStave?.()?.width > 0);
      if (!visible.length) continue;
      // In a full-score view, unrelated instruments must not drag the selected
      // player's tracker into the middle of a silent bar. Geometry can span all
      // staves, but attack positions come from the practice part when it is visible.
      const selected = instrumentPartId ? visible.filter((measure: any) =>
        String(measure.ParentStaff?.ParentInstrument?.IdString ?? measure.ParentStaff?.ParentInstrument?.Id) === instrumentPartId) : [];
      const trackingMeasures = new Set(selected.length ? selected : visible);
      const first: any = visible[0];
      const source = osmd.Sheet.SourceMeasures.find(m => m.MeasureNumber === first.MeasureNumber);
      const system = first.ParentMusicSystem;
      const pageNumber = system.Parent?.PageNumber || 1;
      const svg = svgs[pageNumber - 1] || svgs[0];
      const matrix = svg?.getScreenCTM();
      if (!source || !matrix) continue;
      if (!systems.has(system)) systems.set(system, systems.size);
      const project = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(matrix);
      let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
      const entries = new Map<number, number>();
      for (const m of visible as any[]) {
        const stave = m.getVFStave();
        left = Math.min(left, project(stave.x, 0).x - wrap.left);
        top = Math.min(top, project(stave.x, stave.getYForLine(0)).y - wrap.top - 12);
        bottom = Math.max(bottom, project(stave.x, stave.getYForLine(4)).y - wrap.top + 12);
        right = Math.max(right, project(stave.x + stave.width - 3, stave.y).x - wrap.left);
        if (!trackingMeasures.has(m)) continue;
        for (const se of m.staffEntries || []) {
          const beat = se.getAbsoluteTimestamp().RealValue * 4;
          let x = project(se.PositionAndShape.AbsolutePosition.x * 10, 0).x - wrap.left;
          let noteLeft = Infinity;
          let hasNote = false;
          for (const voice of se.graphicalVoiceEntries || []) {
            for (const note of voice.notes || []) {
              if (!note.sourceNote || note.sourceNote.isRest()) continue;
              hasNote = true;
              try {
                for (const head of note.getNoteheadSVGs?.() || []) {
                  const rect = head.getBoundingClientRect();
                  if (rect.width) noteLeft = Math.min(noteLeft, rect.left - wrap.left);
                }
              } catch { /* Engraving still settling: use the staff-entry fallback. */ }
            }
          }
          // Rests are not attacks. In particular a whole-bar rest is centred on the
          // page but its bar's beat one remains at the left boundary.
          if (!hasNote) continue;
          if (Number.isFinite(noteLeft)) x = noteLeft;
          entries.set(beat, Math.min(entries.get(beat) ?? Infinity, x));
        }
      }
      if (!Number.isFinite(top) || !Number.isFinite(left)) continue;
      rows.push({ beat: source.AbsoluteTimestamp.RealValue * 4,
        endBeat: (source.AbsoluteTimestamp.RealValue + source.Duration.RealValue) * 4,
        left, right, top, height: bottom - top, system: systems.get(system)!,
        entries: Array.from(entries, ([beat, x]) => ({ beat, x, isNote: true })).sort((a, b) => a.beat - b.beat) });
    }
    trackerAnchorsRef.current = buildTrackerAnchors(rows);
    const data = playbackRef.current;
    const seconds = data.getPlaybackTime?.() ?? data.playbackProgress;
    drawTracker(seconds < 0
      ? (scoreData?.measureStartBeatByNumber?.[startMeasure] ?? scoreData?.measureStartBeats[startMeasure - 1] ?? 0)
      : secondsToBeats(seconds, scoreData?.tempos || []));
  }, [drawTracker, scoreData, startMeasure, instrumentPartId]);

  // Retain click/seek integration without showing OSMD's separate cursor.
  const positionCustomCursor = useCallback((osmd: OpenSheetMusicDisplay, isIdle = false) => {
    osmd.cursor?.hide();
    const beat = isIdle
      ? (scoreData?.measureStartBeatByNumber?.[startMeasure] ?? scoreData?.measureStartBeats[startMeasure - 1] ?? 0)
      : secondsToBeats(Math.max(0, playbackRef.current.getPlaybackTime?.() ?? playbackRef.current.playbackProgress), scoreData?.tempos || []);
    drawTracker(beat);
  }, [drawTracker, scoreData, startMeasure]);

  /**
   * Cache rendered graphical note references filtered to the active measure range.
   * Ensures noteEvaluations[idx] maps 1:1 to cachedNotesRef.current[idx].
   */
  const refreshCachedNoteheads = useCallback(() => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    const measureList = osmd.GraphicSheet?.MeasureList;
    if (!measureList) return;

    const playableNotes: any[] = [];

    measureList.forEach((mArray) => {
      mArray.forEach(m => {
        if (!m) return;
        m.staffEntries?.forEach(se => {
          se.graphicalVoiceEntries?.forEach(gve => {
            gve.notes?.forEach(gn => {
              if (gn && gn.sourceNote && !gn.sourceNote.isRest()) {
                const noteMeasure = gn.sourceNote.SourceMeasure?.MeasureNumber;
                if (activeViewMode === 'full' && noteMeasure !== undefined) {
                  if (noteMeasure < startMeasure || noteMeasure > endMeasure) {
                    return;
                  }
                }
                playableNotes.push(gn);
              }
            });
          });
        });
      });
    });

    cachedNotesRef.current = playableNotes;
  }, [startMeasure, endMeasure, activeViewMode]);

  /**
   * Move cursor to the start of the targeted section
   */
  const pointCursorToSectionStart = useCallback((osmd: OpenSheetMusicDisplay, currentScoreData: ScorePlaybackData | null, targetMeasureOverride?: number) => {
    if (!osmd.cursor) return;
    osmd.cursor.hide();
    osmd.cursor.reset();

    const isFull = activeViewMode === 'full';
    const isFocus = activeViewMode === 'focus' || isCoachModeActive;

    const targetM = targetMeasureOverride ?? startMeasure;

    let safety = 0;
    while (safety < 50000 && !osmd.cursor.Iterator.EndReached) {
      const curM = osmd.cursor.Iterator.CurrentMeasure?.MeasureNumber;
      if (curM !== undefined && curM >= targetM) {
        break;
      }
      osmd.cursor.next();
      safety++;
    }
    cursorBeatRef.current = (osmd.cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? (osmd.cursor.Iterator as any).currentTimeStamp?.RealValue ?? 0) * 4;
    osmd.cursor.update();
    positionCustomCursor(osmd, true);
  }, [startMeasure, positionCustomCursor]);

  // 1. Initialize and render OSMD
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    containerRef.current.innerHTML = '';
    cursorBeatRef.current = -1;
    if (customCursorRef.current) {
      customCursorRef.current.style.display = 'none';
    }

    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawLyricist: false,
      drawPartNames: true,
      drawMetronomeMarks: true,
      newSystemFromXML: true,
      newSystemFromNewPageInXML: true,
      autoBeam: true,
      followCursor: false,
      cursorsOptions: [{
        type: 0, // standard vertical line
        color: '#0071e3', // OSMD cursor stays hidden; one custom tracker is drawn
        alpha: 0,
        follow: false,
      }],
    });

    // Apply strict engraving rules for accurate tuplet rendering and system line breaks
    osmd.EngravingRules.NewSystemAtXMLNewSystemAttribute = true;
    osmd.EngravingRules.NewSystemAtXMLNewPageAttribute = true;
    osmd.EngravingRules.StretchLastSystemLine = true;
    osmd.EngravingRules.PageTopMargin = 0;
    (window as any).osmd = osmd;
    osmd.EngravingRules.PageBottomMargin = 0;
    osmd.EngravingRules.PageLeftMargin = 4;
    osmd.EngravingRules.PageRightMargin = 4;
    osmd.EngravingRules.MinimumDistanceBetweenSystems = 2.8;
    osmd.EngravingRules.MinSkyBottomDistBetweenSystems = 1.8;
    osmd.EngravingRules.StaffDistance = 4.8;
    osmd.EngravingRules.BetweenStaffDistance = 3.6;
    osmd.EngravingRules.TupletNumberLimitConsecutiveRepetitions = false;
    osmd.EngravingRules.TupletNumberAlwaysDisableAfterFirstMax = false;
    osmd.EngravingRules.TupletNumberUseShowNoneXMLValue = false;
    osmd.EngravingRules.TupletsBracketedUseXMLValue = true;
    osmd.EngravingRules.TripletsBracketed = false;
    osmd.EngravingRules.TupletsRatioedUseXMLValue = true;
    osmd.EngravingRules.VoiceSpacingMultiplierVexflow = 0.95;

    osmdRef.current = osmd;

    const loadXml = async (): Promise<string> => {
      if (xmlContent) return xmlContent;
      if (xmlUrl) {
        const res = await fetch(xmlUrl);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.text();
      }
      throw new Error('No score XML provided');
    };

    loadXml()
      .then(async (xmlText) => {
        if (!isMounted) return;
        await osmd.load(xmlText.replace(/&amp;amp;/g, '&amp;'));
        osmd.zoom = zoom;
        applyVisibleParts(osmd, visiblePartsRef.current);

        // 1. First ensure OSMD is configured with full bounds so we parse the entire piece
        osmd.setOptions({
          drawFromMeasureNumber: 1,
          drawUpToMeasureNumber: Number.MAX_SAFE_INTEGER,
          drawTitle: false,
          newSystemFromXML: true,
        });
        (osmd as any).rules.MinMeasureToDrawNumber = 1;
        (osmd as any).rules.MinMeasureToDrawIndex = 0;
        (osmd as any).rules.MaxMeasureToDrawNumber = Number.MAX_VALUE;
        (osmd as any).rules.MaxMeasureToDrawIndex = Number.MAX_VALUE;

        osmd.render();

        // 2. Parse complete score data for the entire piece (all measures, notes, tempos)
        let parsed: ScorePlaybackData | null = null;
        try {
          parsed = parseScorePlayback(osmd, xmlText);
          setScoreData(parsed);
          if (onScoreParsed) {
            onScoreParsed(parsed);
          }
        } catch (parseErr) {
          console.warn('[StudentScoreViewer] Failed to parse playback score data:', parseErr);
        }

        // 3. If initially in focus mode, re-render to display only the focused section
        const shouldFocus = activeViewMode === 'focus' || isCoachModeActive;
        if (shouldFocus) {
          const sourceMeasures = osmd.Sheet?.SourceMeasures || [];
          const startIdx = sourceMeasures.findIndex(m => m.MeasureNumber >= startMeasure);
          const endIdx = sourceMeasures.findIndex(m => m.MeasureNumber > endMeasure);
          const minIdx = startIdx !== -1 ? startIdx : 0;
          const maxIdx = endIdx !== -1 ? endIdx - 1 : sourceMeasures.length - 1;

          osmd.setOptions({
            drawFromMeasureNumber: startMeasure,
            drawUpToMeasureNumber: endMeasure,
            drawTitle: false,
            newSystemFromXML: true,
          });
          (osmd as any).rules.MinMeasureToDrawNumber = startMeasure;
          (osmd as any).rules.MinMeasureToDrawIndex = minIdx;
          (osmd as any).rules.MaxMeasureToDrawNumber = endMeasure;
          (osmd as any).rules.MaxMeasureToDrawIndex = maxIdx;
          osmd.render();
        }

        // Layout effects position the tracker from the current audio/seek clock.
        // A delayed reset here used to overwrite a user's first seek into a rest bar.

        refreshCachedNoteheads();
        setIsLoaded(true);
        setErrorMsg(null);
      })
      .catch(err => {
        console.error('Error loading score in StudentScoreViewer:', err);
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to load score');
        }
      });

    return () => {
      isMounted = false;
      if (osmdRef.current) {
        try {
          osmdRef.current.clear();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [xmlUrl, xmlContent]);

  // Part visibility changed (the student ticked/unticked an eye): redraw with those staves only
  const visibleKey = visiblePartIds ? visiblePartIds.join('|') : '*';
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !isLoaded) return;
    try {
      applyVisibleParts(osmd, visiblePartsRef.current);
      osmd.render();
      refreshCachedNoteheads();
    } catch (e) {
      console.warn('[StudentScoreViewer] Could not apply part visibility:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, isLoaded]);
  // 2. Measure range and View Mode updates (Brings up the targeted bars immediately!)
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !isLoaded) return;

    const shouldFocus = activeViewMode === 'focus' || isCoachModeActive;
    if (shouldFocus) {
      const sourceMeasures = osmd.Sheet?.SourceMeasures || [];
      const startIdx = sourceMeasures.findIndex(m => m.MeasureNumber >= startMeasure);
      const endIdx = sourceMeasures.findIndex(m => m.MeasureNumber > endMeasure);
      const minIdx = startIdx !== -1 ? startIdx : 0;
      const maxIdx = endIdx !== -1 ? endIdx - 1 : sourceMeasures.length - 1;

      osmd.setOptions({
        drawFromMeasureNumber: startMeasure,
        drawUpToMeasureNumber: endMeasure,
        drawTitle: false,
      });
      (osmd as any).rules.MinMeasureToDrawNumber = startMeasure;
      (osmd as any).rules.MinMeasureToDrawIndex = minIdx;
      (osmd as any).rules.MaxMeasureToDrawNumber = endMeasure;
      (osmd as any).rules.MaxMeasureToDrawIndex = maxIdx;
    } else {
      osmd.setOptions({
        drawFromMeasureNumber: 1,
        drawUpToMeasureNumber: Number.MAX_SAFE_INTEGER,
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
      });
      (osmd as any).rules.MinMeasureToDrawNumber = 1;
      (osmd as any).rules.MinMeasureToDrawIndex = 0;
      (osmd as any).rules.MaxMeasureToDrawNumber = Number.MAX_VALUE;
      (osmd as any).rules.MaxMeasureToDrawIndex = Number.MAX_VALUE;
    }

    try {
      osmd.render();
      refreshCachedNoteheads();
      pointCursorToSectionStart(osmd, scoreData, startMeasure);
    } catch (e) {
      console.warn('[StudentScoreViewer] Re-render error on section update:', e);
    }
  }, [startMeasure, endMeasure, activeViewMode, isCoachModeActive, isLoaded, refreshCachedNoteheads, pointCursorToSectionStart, scoreData]);

  // 3. Zoom updates
  useEffect(() => {
    if (osmdRef.current && isLoaded) {
      osmdRef.current.zoom = zoom;
      osmdRef.current.render();
      refreshCachedNoteheads();
      if (osmdRef.current.cursor) {
        positionCustomCursor(osmdRef.current);
      }
    }
  }, [zoom, isLoaded, refreshCachedNoteheads, positionCustomCursor]);

  // Rebuild cached coordinates after notation, zoom, visibility or container-size changes.
  useEffect(() => {
    if (!isLoaded) return;
    let pending = 0;
    const schedule = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(rebuildTrackerAnchors);
    };
    const resize = new ResizeObserver(schedule);
    if (wrapperRef.current) resize.observe(wrapperRef.current);
    const mutations = new MutationObserver(schedule);
    if (containerRef.current) mutations.observe(containerRef.current, { childList: true, subtree: true });
    schedule();
    return () => { cancelAnimationFrame(pending); resize.disconnect(); mutations.disconnect(); };
  }, [isLoaded, zoom, visibleKey, activeViewMode, endMeasure, rebuildTrackerAnchors]);

  // One animation loop reads the audio clock directly, independent of React's update cadence.
  useEffect(() => {
    if (!isLoaded || !scoreData) return;
    let frame = 0;
    const tick = () => {
      const data = playbackRef.current;
      const seconds = data.getPlaybackTime?.() ?? data.playbackProgress;
      const beat = seconds < 0
        ? (scoreData.measureStartBeatByNumber?.[startMeasure] ?? scoreData.measureStartBeats[startMeasure - 1] ?? 0)
        : secondsToBeats(seconds, scoreData.tempos);
      drawTracker(beat, isPlaying && seconds >= 0);
      if (isPlaying) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, isLoaded, scoreData, startMeasure, drawTracker]);

  // Idle seeks and a stopped transport should update immediately and remain motionless.
  useEffect(() => {
    if (!isPlaying && scoreData) drawTracker(secondsToBeats(Math.max(0, playbackProgress), scoreData.tempos));
  }, [playbackProgress, isPlaying, scoreData, drawTracker]);

  /**
   * Click handler on sheet music to jump playhead
   */
  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const osmd = osmdRef.current;
    if (!osmd || !osmd.GraphicSheet || !scoreData || !onSeek) return;

    // Find the specific SVG element clicked (supporting multi-page scores and margin clicks)
    let targetSvg = (event.target as HTMLElement | SVGElement)?.closest('svg');
    const allSvgs = Array.from(containerRef.current?.querySelectorAll('svg') || []);

    if (!targetSvg && allSvgs.length > 0) {
      let closestDist = Infinity;
      for (const svg of allSvgs) {
        const rect = svg.getBoundingClientRect();
        if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
          targetSvg = svg;
          break;
        }
        const dist = Math.min(Math.abs(event.clientY - rect.top), Math.abs(event.clientY - rect.bottom));
        if (dist < closestDist) {
          closestDist = dist;
          targetSvg = svg;
        }
      }
    }
    if (!targetSvg) targetSvg = containerRef.current?.querySelector('svg') || null;
    if (!targetSvg) return;

    const clickedPageIndex = allSvgs.indexOf(targetSvg);
    const clickedPageNumber = clickedPageIndex >= 0 ? clickedPageIndex + 1 : 1;

    const pt = targetSvg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    const svgRect = targetSvg.getBoundingClientRect();
    const ctm = targetSvg.getScreenCTM();
    if (!ctm) return;

    const transformed = pt.matrixTransform(ctm.inverse());
    if (!transformed) return;

    const clickX = transformed.x;
    const clickY = transformed.y;

    const measureList = osmd.GraphicSheet.MeasureList;
    if (!measureList) return;

    const uip = 10 * ((osmd as any).zoom || 1.0);
    let clickedMeasureNumber = -1;

    interface CandidateMeasure {
      measureNumber: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }
    const candidates: CandidateMeasure[] = [];

    for (let i = 0; i < measureList.length; i++) {
      const measureArray = measureList[i];
      if (!measureArray) continue;

      for (let j = 0; j < measureArray.length; j++) {
        const gm = measureArray[j];
        if (!gm) continue;
        const isVis = typeof gm.isVisible === 'function' ? gm.isVisible() : true;
        if (!isVis) continue;
        const pageNum = (gm as any).ParentMusicSystem?.ParentPage?.PageNumber || (gm as any).ParentMusicSystem?.Parent?.PageNumber;
        if (pageNum !== undefined && pageNum !== clickedPageNumber) continue;

        const mNum = gm.parentSourceMeasure?.MeasureNumber ?? gm.MeasureNumber;
        const vfStave = (gm as any).getVFStave?.();

        if (vfStave && typeof vfStave.x === 'number' && typeof vfStave.y === 'number') {
          candidates.push({
            measureNumber: mNum,
            x: vfStave.x,
            y: vfStave.y,
            width: vfStave.width,
            height: vfStave.height || 50,
          });
        } else {
          const ps = (gm as any).PositionAndShape;
          if (ps && ps.AbsolutePosition && ps.Size) {
            candidates.push({
              measureNumber: mNum,
              x: ps.AbsolutePosition.x * uip,
              y: ps.AbsolutePosition.y * uip,
              width: ps.Size.width * uip,
              height: ps.Size.height * uip,
            });
          }
        }
      }
    }

    // 1. Direct hit-test against candidate staves with vertical padding for note stems, accidentals & ledger lines
    for (const c of candidates) {
      if (clickX >= c.x - 2 && clickX <= c.x + c.width + 2 && clickY >= c.y - 35 && clickY <= c.y + c.height + 35) {
        clickedMeasureNumber = c.measureNumber;
        break;
      }
    }

    // 2. System horizontal span fallback (for clicks in inter-system margins)
    if (clickedMeasureNumber === -1) {
      let bestDistY = Infinity;
      for (const c of candidates) {
        if (clickX >= c.x - 4 && clickX <= c.x + c.width + 4) {
          const centerY = c.y + (c.height / 2);
          const distY = Math.abs(clickY - centerY);
          if (distY < bestDistY && distY < 250) {
            bestDistY = distY;
            clickedMeasureNumber = c.measureNumber;
          }
        }
      }
    }

    // 3. Closest candidate fallback (for margin clicks)
    if (clickedMeasureNumber === -1) {
      let bestDist = Infinity;
      for (const c of candidates) {
        const dx = Math.max(0, c.x - clickX, clickX - (c.x + c.width));
        const dy = Math.max(0, c.y - clickY, clickY - (c.y + c.height));
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          clickedMeasureNumber = c.measureNumber;
        }
      }
    }

    if (clickedMeasureNumber !== -1) {
      let clickedMeasureBeat = 0;
      const measureStartBeats = scoreData?.measureStartBeats || [];
      if (clickedMeasureNumber > 0 && measureStartBeats[clickedMeasureNumber - 1] !== undefined) {
        clickedMeasureBeat = measureStartBeats[clickedMeasureNumber - 1];
      } else {
        for (let i = 0; i < measureList.length; i++) {
          const firstGM = measureList[i]?.[0] as any;
          if (
            firstGM &&
            (firstGM.parentSourceMeasure?.MeasureNumber === clickedMeasureNumber ||
              firstGM.MeasureNumber === clickedMeasureNumber)
          ) {
            if (firstGM.parentSourceMeasure) {
              clickedMeasureBeat = firstGM.parentSourceMeasure.AbsoluteTimestamp.RealValue * 4;
            }
            break;
          }
        }
      }

      console.log('[handleSvgClick] Final clickedMeasureNumber:', clickedMeasureNumber, 'clickedMeasureBeat:', clickedMeasureBeat);

      const targetSeconds = beatToSeconds(clickedMeasureBeat, scoreData.tempos);
      onSeek(targetSeconds, clickedMeasureBeat, clickedMeasureNumber);

      // Seek to the requested musical boundary, not the engraving iterator's next
      // event (which can lie in the middle of a rest bar).
      drawTracker(clickedMeasureBeat);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fdfcf9] rounded-2xl overflow-hidden relative select-none">
      {/* Rhythm Diagnostics Status Bar (only shown when evaluations exist) */}
      {noteEvaluations && Object.keys(noteEvaluations).length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-blue-50/80 border-b border-blue-100 text-xs text-blue-900 shrink-0 select-none animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold flex items-center gap-1.5 text-blue-950">
              <span>{!isPlaying ? 'Results on Score:' : 'Live Rhythm Tracking:'}</span>
            </span>
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                <span>On-Time</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shadow-xs" />
                <span>Early / Late</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shadow-xs" />
                <span>Missed</span>
              </span>
            </div>
          </div>
          {onClearEvaluations && (
            <button
              onClick={onClearEvaluations}
              className="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-slate-50 text-slate-600 rounded-md border border-slate-200 transition shadow-2xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Sheet Music Canvas Area */}
      <div className="flex-1 overflow-auto px-2 py-1 flex flex-col items-center justify-start min-h-[300px] bg-[#fdfcf9]">
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs max-w-md text-center my-auto">
            {errorMsg}
          </div>
        )}

        {/* Relative wrapper holding both OSMD SVG and custom glowing tracker cursor - Clean sheet music surface */}
        <div
          ref={wrapperRef}
          className="relative w-full max-w-[1010px] mx-auto flex flex-col items-center bg-[#fdfcf9] text-slate-900 min-h-[220px] cursor-pointer select-none"
          onClick={handleSvgClick}
        >

          {/* OSMD SVG Container */}
          <div
            ref={containerRef}
            className="w-full flex justify-center cursor-pointer select-none bg-transparent"
          />

          {/* Shared Playback Tracker Cursor - Crisp blue vertical line spanning staves */}
          <div
            ref={customCursorRef}
            data-score-cursor="true"
            data-score-tracker="smooth"
            aria-hidden="true"
            style={{
              display: 'none',
              position: 'absolute',
              left: 0,
              top: 0,
              width: '2px',
              willChange: 'transform',
              height: '120px',
              backgroundColor: '#0071e3',
              borderRadius: '1.25px',
              pointerEvents: 'none',
              transition: 'none',
              zIndex: 25,
            }}
          />
        </div>
      </div>
    </div>
  );
};
