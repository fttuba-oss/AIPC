import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { ZoomIn, ZoomOut, Target, Layers } from 'lucide-react';
import {
  parseScorePlayback,
  secondsToBeats,
  beatToSeconds,
  getTargetPartAndNotes,
  type ScorePlaybackData
} from '../utils/scorePlaybackParser';

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
  viewMode?: 'focus' | 'full';
  onViewModeChange?: (mode: 'focus' | 'full') => void;
  noteEvaluations?: Record<number, 'Perfect' | 'Great' | 'Good' | 'Early' | 'Late' | 'Miss'>;
  problemMeasures?: number[];
  onClearEvaluations?: () => void;
  isCoachModeActive?: boolean;
  coachActiveNoteIndex?: number | null;
  onScoreParsed?: (scoreData: ScorePlaybackData) => void;
  onSeek?: (seconds: number, beat?: number, measureNumber?: number) => void;
}

export const StudentScoreViewer: React.FC<StudentScoreViewerProps> = ({
  xmlUrl,
  xmlContent,
  startMeasure,
  endMeasure,
  sectionStartMeasure = startMeasure,
  sectionEndMeasure = endMeasure,
  totalMeasures,
  instrumentPartName = 'Trumpet 1',
  playbackProgress = 0,
  isPlaying = false,
  viewMode: propViewMode,
  onViewModeChange,
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

  const [zoom, setZoom] = useState<number>(1.1);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScorePlaybackData | null>(null);
  
  // Active activeViewMode: controlled prop or internal fallback
  const [internalViewMode, setInternalViewMode] = useState<'focus' | 'full'>('focus');
  const activeViewMode = propViewMode ?? internalViewMode;
  const setViewMode = (mode: 'focus' | 'full') => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };

  const cursorBeatRef = useRef<number>(-1);
  const cachedNotesRef = useRef<any[]>([]);
  const lastActivePartYRef = useRef<number | null>(null);

  /**
   * Position the glowing custom tracker overlay over the current notehead
   */
  const positionCustomCursor = useCallback((osmd: OpenSheetMusicDisplay) => {
    const cursorEl = customCursorRef.current;
    if (!cursorEl || !osmd.cursor || !wrapperRef.current) return;

    cursorEl.style.display = 'block';

    const gNotes = osmd.cursor.GNotesUnderCursor?.();
    const wrapRect = wrapperRef.current.getBoundingClientRect();

    if (gNotes && gNotes.length > 0) {
      const activeNote = gNotes[0] as any;
      let noteheadEls: HTMLElement[] | null = null;
      try {
        noteheadEls = activeNote.getNoteheadSVGs?.();
      } catch {
        // ignore
      }

      if (!noteheadEls || noteheadEls.length === 0) {
        try {
          const g = activeNote.getSVGGElement?.() as SVGGElement | null;
          if (g) noteheadEls = [g as unknown as HTMLElement];
        } catch {
          // ignore
        }
      }

      if (noteheadEls && noteheadEls.length > 0) {
        const noteRect = noteheadEls[0].getBoundingClientRect();
        const left = noteRect.left - wrapRect.left - 8;
        const top = (noteRect.top - wrapRect.top) + noteRect.height / 2 - 28;

        lastActivePartYRef.current = top;

        cursorEl.style.left = `${left}px`;
        cursorEl.style.top = `${top}px`;
        cursorEl.style.display = 'block';
        return;
      }
    }

    // Fallback using OSMD's internal cursor element
    const cursorBbox = (osmd.cursor as any).cursorElement?.getBoundingClientRect();
    if (cursorBbox && cursorBbox.width > 0) {
      const left = cursorBbox.left - wrapRect.left - 4;
      const top = lastActivePartYRef.current !== null ? lastActivePartYRef.current : (cursorBbox.top - wrapRect.top);
      cursorEl.style.left = `${left}px`;
      cursorEl.style.top = `${top}px`;
      cursorEl.style.display = 'block';
    }
  }, []);

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
    osmd.cursor.show();
    osmd.cursor.reset();

    const isFull = activeViewMode === 'full';
    const isFocus = activeViewMode === 'focus' || isCoachModeActive;

    // In focus mode without an explicit target bar override, osmd.cursor.reset() is already
    // positioned at the very first note of the focused section.
    if (isFocus && !targetMeasureOverride) {
      cursorBeatRef.current = (osmd.cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? (osmd.cursor.Iterator as any).currentTimeStamp?.RealValue ?? 0) * 4;
      osmd.cursor.update();
      positionCustomCursor(osmd);
      return;
    }

    const measureStartBeats = currentScoreData?.measureStartBeats || [];
    const targetM = targetMeasureOverride ?? (isFull ? 1 : startMeasure);
    const targetStartBeat = currentScoreData?.measureStartBeatByNumber?.[targetM] ?? measureStartBeats[targetM - 1] ?? ((targetM - 1) * 4);

    let safety = 0;
    while (safety < 3000 && !osmd.cursor.Iterator.EndReached) {
      const currentBeat = (osmd.cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? (osmd.cursor.Iterator as any).currentTimeStamp?.RealValue ?? 0) * 4;
      if (currentBeat >= targetStartBeat - 0.01) {
        break;
      }
      osmd.cursor.next();
      safety++;
    }
    cursorBeatRef.current = (osmd.cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? (osmd.cursor.Iterator as any).currentTimeStamp?.RealValue ?? 0) * 4;
    osmd.cursor.update();
    positionCustomCursor(osmd);
  }, [activeViewMode, isCoachModeActive, startMeasure, positionCustomCursor]);

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
      drawTitle: activeViewMode === 'full',
      drawSubtitle: false,
      drawComposer: false,
      drawLyricist: false,
      drawPartNames: true,
      drawMetronomeMarks: true,
      autoBeam: true,
      followCursor: true,
      cursorsOptions: [{
        type: 0, // standard vertical line
        color: '#f59e0b', // amber cursor
        alpha: 0.85,
        follow: true,
      }],
    });

    // Apply strict engraving rules for accurate tuplet rendering
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
        await osmd.load(xmlText);
        osmd.zoom = zoom;

        // 1. First ensure OSMD is configured with full bounds so we parse the entire piece
        osmd.setOptions({
          drawFromMeasureNumber: 1,
          drawUpToMeasureNumber: Number.MAX_SAFE_INTEGER,
          drawTitle: activeViewMode === 'full',
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
          });
          (osmd as any).rules.MinMeasureToDrawNumber = startMeasure;
          (osmd as any).rules.MinMeasureToDrawIndex = minIdx;
          (osmd as any).rules.MaxMeasureToDrawNumber = endMeasure;
          (osmd as any).rules.MaxMeasureToDrawIndex = maxIdx;
          osmd.render();
        }

        // Initialize cursor and point directly to target bars
        if (osmd.cursor) {
          setTimeout(() => {
            if (osmdRef.current) {
              pointCursorToSectionStart(osmdRef.current, parsed);
            }
          }, 150);
        }

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
      });
      (osmd as any).rules.MinMeasureToDrawNumber = 1;
      (osmd as any).rules.MinMeasureToDrawIndex = 0;
      (osmd as any).rules.MaxMeasureToDrawNumber = Number.MAX_VALUE;
      (osmd as any).rules.MaxMeasureToDrawIndex = Number.MAX_VALUE;
    }

    try {
      osmd.render();
      refreshCachedNoteheads();
      pointCursorToSectionStart(osmd, scoreData);
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

  // 4. Synchronize cursor with playback
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !scoreData || !osmd.cursor || !isLoaded) return;

    // During count-in, playbackProgress is negative (e.g. -4, -3, -2, -1 s).
    // Ensure the tracker is immediately rewound to the start of the section and stays there during count-in!
    if (playbackProgress < 0) {
      pointCursorToSectionStart(osmd, scoreData);
      return;
    }

    if (!isPlaying && playbackProgress === 0 && (!noteEvaluations || Object.keys(noteEvaluations).length === 0)) {
      pointCursorToSectionStart(osmd, scoreData);
      return;
    }

    // Convert transport playbackProgress seconds to score quarter-note beats
    const targetBeat = secondsToBeats(playbackProgress, scoreData.tempos);

    // Seek backward: reset cursor to beginning of active section view
    if (targetBeat < cursorBeatRef.current - 0.05) {
      pointCursorToSectionStart(osmd, scoreData);
    }

    // Advance forward: step until next visible beat would overshoot
    let safety = 0;
    while (safety < 3000 && !osmd.cursor.Iterator.EndReached) {
      const peek = osmd.cursor.Iterator.clone();
      peek.moveToNextVisibleVoiceEntry(false);
      const nextBeat = (peek.CurrentSourceTimestamp?.RealValue ?? (peek as any).currentTimeStamp?.RealValue ?? 99999) * 4;

      if (nextBeat <= targetBeat + 0.02) {
        osmd.cursor.next();
        cursorBeatRef.current = (osmd.cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? (osmd.cursor.Iterator as any).currentTimeStamp?.RealValue ?? 0) * 4;
        safety++;
      } else {
        break;
      }
    }

    osmd.cursor.update();
    positionCustomCursor(osmd);
  }, [playbackProgress, isPlaying, scoreData, isLoaded, pointCursorToSectionStart, positionCustomCursor, noteEvaluations]);

  // 5. Notehead coloring and halos
  useEffect(() => {
    let notes = cachedNotesRef.current;
    const svgRoot = containerRef.current?.querySelector('svg');
    if (!svgRoot) return;

    const existingOverlay = svgRoot.querySelector('#coach-note-overlays');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    const existingBadges = svgRoot.querySelector('#coach-state-badges');
    if (existingBadges) {
      existingBadges.remove();
    }

    if (!notes || notes.length === 0) {
      refreshCachedNoteheads();
      notes = cachedNotesRef.current;
    }
    console.log('[StudentScoreViewer noteEvaluations effect]', {
      cachedNotesCount: notes?.length,
      noteEvaluations,
      hasSvgRoot: !!svgRoot,
      startMeasure,
      endMeasure,
    });

    if (!notes || notes.length === 0) return;

    // Clean up any existing halos across the SVG
    svgRoot.querySelectorAll('.coach-note-halo').forEach(el => el.remove());

    const { targetNotes } = getTargetPartAndNotes(scoreData, instrumentPartName, [startMeasure, endMeasure]);

    notes.forEach((gn: any, idx: number) => {
      let evalKey = idx;
      if (targetNotes.length > 0 && gn?.sourceNote) {
        const gnBeat = (gn.sourceNote.getAbsoluteTimestamp?.()?.RealValue ?? 0) * 4;
        const foundIdx = targetNotes.findIndex(
          tn => gnBeat >= tn.beat - 0.05 && gnBeat < tn.beat + (tn.durationBeats || 0.25) - 0.05
        );
        if (foundIdx !== -1) {
          evalKey = foundIdx;
        }
      }

      const rating = noteEvaluations ? noteEvaluations[evalKey] : undefined;

      let color = '';
      if (rating === 'Perfect' || rating === 'Great' || rating === 'Good') {
        color = '#10b981'; // Emerald Green (On Time)
      } else if (rating === 'Early' || rating === 'Late') {
        color = '#f59e0b'; // Amber (Early / Late)
      } else if (rating === 'Miss') {
        color = '#ef4444'; // Red (Missed)
      }

      // 1. Built-in OSMD note coloring method
      if (typeof gn.setColor === 'function') {
        try {
          gn.setColor(color || '#000000');
        } catch {
          // ignore
        }
      }

      // 2. Direct SVG coloring for notehead, stem, and accidental paths
      const vfEl = typeof gn.getSVGGElement === 'function' ? gn.getSVGGElement() : null;
      if (vfEl) {
        try {
          const targetFill = color || '#000000';
          vfEl.querySelectorAll('path').forEach((p: Element) => {
            p.setAttribute('fill', targetFill);
            (p as any).style.fill = targetFill;
          });
        } catch {
          // ignore
        }

        // 3. Glowing halo badge directly behind the notehead inside vfEl
        if (color) {
          try {
            const noteheadEl = vfEl.querySelector('.vf-notehead') || vfEl;
            const bbox = (noteheadEl as SVGGraphicsElement)?.getBBox?.() || vfEl.getBBox?.();

            if (bbox && bbox.width > 0 && bbox.height > 0) {
              const pad = 4;
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('class', 'coach-note-halo');
              rect.setAttribute('x', String(bbox.x - pad));
              rect.setAttribute('y', String(bbox.y - pad));
              rect.setAttribute('width', String(bbox.width + (pad * 2)));
              rect.setAttribute('height', String(bbox.height + (pad * 2)));
              rect.setAttribute('rx', '8');
              rect.setAttribute('fill', color);
              rect.setAttribute('fill-opacity', '0.35');
              rect.setAttribute('stroke', color);
              rect.setAttribute('stroke-width', '2');
              vfEl.insertBefore(rect, vfEl.firstChild);
            }
          } catch {
            // ignore
          }
        }
      }
    });
  }, [noteEvaluations, isCoachModeActive, refreshCachedNoteheads, scoreData, instrumentPartName, startMeasure, endMeasure]);

  /**
   * Click handler on sheet music to jump playhead
   */
  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const osmd = osmdRef.current;
    if (!osmd || !osmd.GraphicSheet || !scoreData || !onSeek) return;

    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) return;

    const pt = svgElement.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    const ctm = svgElement.getScreenCTM();
    if (!ctm) return;

    const transformed = pt.matrixTransform(ctm.inverse());
    if (!transformed) return;

    const clickX = transformed.x;
    const clickY = transformed.y;

    const measureList = osmd.GraphicSheet.MeasureList;
    if (!measureList) return;

    const uip = 10 * (osmd as any).zoom;
    let clickedMeasureNumber = -1;

    for (let i = 0; i < measureList.length; i++) {
      const measureArray = measureList[i];
      if (!measureArray) continue;

      for (let j = 0; j < measureArray.length; j++) {
        const gm = measureArray[j];
        if (!gm) continue;

        const bbox = (gm as any).boundingBox;
        if (!bbox) continue;

        const absX = bbox.absolutePosition.x * uip;
        const absY = (bbox.absolutePosition.y - 2) * uip;
        const width = bbox.Size.width * uip;
        const height = (bbox.Size.height + 4) * uip;

        if (clickX >= absX && clickX <= absX + width && clickY >= absY && clickY <= absY + height) {
          if (gm.parentSourceMeasure) {
            clickedMeasureNumber = gm.parentSourceMeasure.MeasureNumber;
          } else {
            clickedMeasureNumber = gm.MeasureNumber;
          }
          break;
        }
      }
      if (clickedMeasureNumber !== -1) break;
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

      const targetSeconds = beatToSeconds(clickedMeasureBeat, scoreData.tempos);
      onSeek(targetSeconds, clickedMeasureBeat, clickedMeasureNumber);

      // Immediately step cursor to clicked measure
      osmd.cursor.reset();
      let safety = 0;
      while (safety < 3000 && !osmd.cursor.Iterator.EndReached) {
        const currentBeat = (osmd.cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? (osmd.cursor.Iterator as any).currentTimeStamp?.RealValue ?? 0) * 4;
        if (currentBeat >= clickedMeasureBeat - 0.01) {
          break;
        }
        osmd.cursor.next();
        safety++;
      }
      cursorBeatRef.current = (osmd.cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? (osmd.cursor.Iterator as any).currentTimeStamp?.RealValue ?? 0) * 4;
      osmd.cursor.update();
      positionCustomCursor(osmd);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
      {/* Score Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>🎺</span>
            <span>{instrumentPartName}</span>
          </span>

          <span className="text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 font-semibold px-2 py-0.5 rounded-md text-[11px] border border-amber-300 dark:border-amber-800/50">
            {activeViewMode === 'full' ? `Full Piece (Bars 1–${totalMeasures || endMeasure})` : `Bars ${startMeasure}–${endMeasure}`}
          </span>

          {/* View Mode Toggle: Focus Section vs Full Score */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-700/80 p-0.5 rounded-lg text-[11px] font-semibold border border-slate-300 dark:border-slate-600">
            <button
              onClick={() => setViewMode('focus')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeViewMode === 'focus'
                  ? 'bg-amber-500 text-amber-950 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={`Focus and isolate Section (Bars ${sectionStartMeasure}–${sectionEndMeasure})`}
            >
              <Target className="w-3 h-3" />
              <span>Focus Bars {sectionStartMeasure}–{sectionEndMeasure}</span>
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeViewMode === 'full'
                  ? 'bg-amber-500 text-amber-950 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Practice the complete piece with free playhead navigation"
            >
              <Layers className="w-3 h-3" />
              <span>Full Piece</span>
            </button>
          </div>

          {isPlaying && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-300 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Tracking</span>
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(0.7, z - 0.1))}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-slate-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rhythm Diagnostics Status Bar (only shown when evaluations exist) */}
      {noteEvaluations && Object.keys(noteEvaluations).length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300/80 dark:border-amber-700/60 text-xs text-amber-950 dark:text-amber-200 shrink-0 select-none animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
              <span>{!isPlaying ? '❄️ Results Frozen on Score:' : '⚡ Live Rhythm Tracking:'}</span>
            </span>
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                <span>On-Time</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                <span>Early / Late</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" />
                <span>Missed</span>
              </span>
            </div>
            {problemMeasures && problemMeasures.length > 0 && (
              <span className="font-bold text-amber-800 dark:text-amber-300 bg-amber-200/80 dark:bg-amber-900/60 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700 text-[11px]">
                ⚠️ Rhythm Focus: Bar {problemMeasures.slice(0, 4).join(', ')}{problemMeasures.length > 4 ? ` (+${problemMeasures.length - 4} more)` : ''}
              </span>
            )}
          </div>
          {onClearEvaluations && (
            <button
              onClick={onClearEvaluations}
              className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-amber-300 dark:border-slate-600 transition shadow-2xs cursor-pointer active:scale-95"
            >
              Clear Results
            </button>
          )}
        </div>
      )}

      {/* Sheet Music Canvas Area with Score Following Tracker Overlay */}
      <div className="flex-1 overflow-auto p-3 sm:p-5 flex flex-col items-center justify-start min-h-[300px] bg-slate-100/70 dark:bg-slate-950/70">
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-xs max-w-md text-center my-auto">
            {errorMsg}
          </div>
        )}

        {/* Relative wrapper holding both OSMD SVG and custom glowing tracker cursor - Clean white sheet music paper */}
        <div
          ref={wrapperRef}
          className="relative w-full max-w-4xl mx-auto flex justify-center bg-white text-slate-900 rounded-2xl shadow-xl p-4 sm:p-6 border border-slate-200/80 my-2 min-h-[220px] transition-all"
          onClick={handleSvgClick}
        >
          {/* OSMD SVG Container - Managed by OSMD */}
          <div
            ref={containerRef}
            className="w-full flex justify-center cursor-pointer select-none bg-white rounded-xl"
          />

          {/* High-visibility glowing score tracker bar overlay - Sibling to containerRef */}
          <div
            ref={customCursorRef}
            style={{
              display: 'none',
              position: 'absolute',
              width: '6px',
              height: '56px',
              backgroundColor: 'rgba(245, 158, 11, 0.95)',
              borderRadius: '3px',
              boxShadow: '0 0 14px 4px rgba(245, 158, 11, 0.8), 0 0 4px 1px #fff',
              pointerEvents: 'none',
              transition: isPlaying ? 'left 0.06s linear, top 0.08s ease-out' : 'none',
              zIndex: 30,
            }}
          />
        </div>
      </div>
    </div>
  );
};
