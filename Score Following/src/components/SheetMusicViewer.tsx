import React, { useEffect, useRef, useState, useMemo } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Eye, Layers, Music } from 'lucide-react';
import { type ScoreData } from '../utils/scoreParser';

interface SheetMusicViewerProps {
  xmlData: string | Uint8Array | null;
  scoreData: ScoreData | null;
  playbackProgress: number; // current time in seconds (Tone.Transport.seconds at baseline 60bpm)
  isPlaying: boolean;
  selectedPartId: string;
  onOsmdInit: (osmd: OpenSheetMusicDisplay) => void;
  onSeek?: (seconds: number) => void;
  backingTrackMode?: 'solo' | 'custom';
  customMutedPartIds?: Record<string, boolean>;
  viewedFileId?: string;
  countInEnabled: boolean;
}

/**
 * Traverses rendered SVG text elements and hides instrument-change/doubling instructions
 * that do not pertain to the currently selected practice part.
 */
const cleanUpForeignInstrumentTexts = (
  container: HTMLDivElement | null,
  selectedPartId: string,
  scoreData: ScoreData | null,
  viewMode: 'single' | 'full'
) => {
  if (!container || viewMode !== 'single' || !scoreData || !selectedPartId) return;

  const selectedPart = scoreData.parts.find(p => p.id === selectedPartId);
  if (!selectedPart) return;

  const normalizedPartName = selectedPart.name.toLowerCase();

  // Common instrument keywords to match and distinguish
  const instrumentKeywords = [
    'flute', 'piccolo', 'oboe', 'bassoon', 'clarinet', 'sax', 
    'horn', 'trumpet', 'cornet', 'trombone', 'euphonium', 
    'baritone', 'tuba', 'timpani', 'percussion', 'snare', 'drum'
  ];

  // Identify which keywords describe our selected instrument
  const selectedKeywords = instrumentKeywords.filter(keyword => 
    normalizedPartName.includes(keyword)
  );

  // If the selected instrument has no matching keywords, don't filter to avoid false positives
  if (selectedKeywords.length === 0) return;

  // Foreign keywords are those belonging to other instruments
  const foreignKeywords = instrumentKeywords.filter(keyword => 
    !selectedKeywords.includes(keyword)
  );

  const textElements = container.getElementsByTagName('text');
  for (let i = 0; i < textElements.length; i++) {
    const el = textElements[i];
    const text = el.textContent?.trim();
    if (!text) continue;

    const lowerText = text.toLowerCase();

    // Check if the text contains any keyword of a foreign instrument
    const containsForeign = foreignKeywords.some(keyword => lowerText.includes(keyword));

    if (containsForeign) {
      const containsOwn = selectedKeywords.some(keyword => lowerText.includes(keyword));

      // Instrument switches typically start with 'on', 'to', or contain 'change to'
      const isDoublingInstruction = 
        lowerText.startsWith('on ') || 
        lowerText.startsWith('to ') || 
        lowerText.includes('change to') ||
        lowerText.includes('doubling');

      if (!containsOwn || isDoublingInstruction) {
        el.style.display = 'none';
      }
    }
  }
};

export const SheetMusicViewer: React.FC<SheetMusicViewerProps> = ({
  xmlData,
  scoreData,
  playbackProgress,
  isPlaying,
  selectedPartId,
  onOsmdInit,
  onSeek,
  backingTrackMode,
  customMutedPartIds,
  viewedFileId,
  countInEnabled
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const customCursorRef = useRef<HTMLDivElement>(null);
  const lastActivePartYRef = useRef<number | null>(null);

  // Reset the last Y position of the active part when selectedPartId or viewedFileId changes
  useEffect(() => {
    lastActivePartYRef.current = null;
  }, [selectedPartId, viewedFileId]);

  // Tracks the current cursor beat so we know direction (forward vs backward)
  // Initialized to -1 so any positive time triggers a forward advance from beat 0
  const cursorBeatRef = useRef<number>(-1);

  const [viewMode, setViewMode] = useState<'single' | 'full'>('single');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep refs of latest values so the OSMD.render override doesn't capture stale closures
  const selectedPartIdRef = useRef(selectedPartId);
  const viewModeRef = useRef(viewMode);
  const scoreDataRef = useRef(scoreData);

  useEffect(() => {
    selectedPartIdRef.current = selectedPartId;
    viewModeRef.current = viewMode;
    scoreDataRef.current = scoreData;
  }, [selectedPartId, viewMode, scoreData]);

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Convert playback seconds → quarter-note beats using the score's tempo map.
   * This is the inverse of beatToSeconds() in scoreParser.ts.
   * scoreData.tempos entries are: { beat (quarter notes), bpm, timeInSeconds }
   */
  const secondsToBeats = (secs: number, scoreData: ScoreData): number => {
    const tempos = scoreData.tempos;
    if (!tempos || tempos.length === 0) return secs * 2; // fallback 120bpm
    let active = tempos[0];
    for (let i = 1; i < tempos.length; i++) {
      if (tempos[i].timeInSeconds <= secs) active = tempos[i];
      else break;
    }
    return active.beat + ((secs - active.timeInSeconds) / 60) * active.bpm;
  };

  /**
   * Convert quarter-note beats → seconds using the score's tempo map.
   */
  const beatsToSeconds = (beats: number, scoreData: ScoreData): number => {
    const tempos = scoreData.tempos;
    if (!tempos || tempos.length === 0) return beats / 2; // fallback 120bpm
    let active = tempos[0];
    for (let i = 1; i < tempos.length; i++) {
      if (tempos[i].beat <= beats) {
        active = tempos[i];
      } else {
        break;
      }
    }
    return active.timeInSeconds + ((beats - active.beat) / active.bpm) * 60;
  };

  /**
   * Click handler on the sheet music container to detect clicks on measures
   * and jump the playhead position accordingly.
   */
  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const osmd = osmdRef.current;
    if (!osmd || !osmd.GraphicSheet || !scoreData || !onSeek) return;

    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) return;

    // Convert mouse event client coordinates to SVG coordinates
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
        const graphicalMeasure = measureArray[j];
        if (!graphicalMeasure) continue;

        const bbox = (graphicalMeasure as any).boundingBox;
        if (!bbox) continue;

        // Bounding box dimensions in OSMD units. Translate to SVG pixels.
        const absX = bbox.absolutePosition.x * uip;
        // Apply vertical cushion (2 units above and below)
        const absY = (bbox.absolutePosition.y - 2) * uip;
        const width = bbox.Size.width * uip;
        const height = (bbox.Size.height + 4) * uip;

        if (
          clickX >= absX &&
          clickX <= absX + width &&
          clickY >= absY &&
          clickY <= absY + height
        ) {
          if (graphicalMeasure.parentSourceMeasure) {
            clickedMeasureNumber = graphicalMeasure.parentSourceMeasure.MeasureNumber;
          } else {
            clickedMeasureNumber = graphicalMeasure.MeasureNumber;
          }
          break;
        }
      }
      if (clickedMeasureNumber !== -1) break;
    }

    if (clickedMeasureNumber !== -1) {
      // Find the start beat of the clicked measure
      let clickedMeasureBeat = 0;
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

      const targetSeconds = beatsToSeconds(clickedMeasureBeat, scoreData);
      console.log(`[Score Click] Clicked measure: ${clickedMeasureNumber} (start beat: ${clickedMeasureBeat}) -> seeking to ${targetSeconds.toFixed(3)}s`);
      onSeek(targetSeconds);
    }
  };

  /**
   * Position the custom green cursor overlay over the current note for the
   * selected instrument part. Uses DOM bounding rects for pixel-accurate placement.
   */
  const positionCustomCursor = (osmd: OpenSheetMusicDisplay) => {
    const cursorEl = customCursorRef.current;
    if (!cursorEl || !osmd.cursor) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const gNotes = osmd.cursor.GNotesUnderCursor?.();
    if (!gNotes || gNotes.length === 0) {
      cursorEl.style.display = 'none';
      return;
    }

    // Prefer the note from the selected instrument
    const activePartNote = gNotes.find((gn: any) => {
      const instId = gn.sourceNote?.ParentVoiceEntry?.ParentVoice?.Parent?.IdString;
      return instId === selectedPartId;
    });

    const wrapRect = wrapper.getBoundingClientRect();

    if (activePartNote) {
      const vfNote = activePartNote as any;
      let noteheadEls: HTMLElement[] | null = null;
      try { noteheadEls = vfNote.getNoteheadSVGs?.(); } catch { /* ignore */ }
      if (!noteheadEls || noteheadEls.length === 0) {
        try {
          const g = vfNote.getSVGGElement?.() as SVGGElement | null;
          if (g) noteheadEls = [g as unknown as HTMLElement];
        } catch { /* ignore */ }
      }
      if (noteheadEls && noteheadEls.length > 0) {
        const noteRect = noteheadEls[0].getBoundingClientRect();
        const left = noteRect.left - wrapRect.left - 11;
        const top = (noteRect.top - wrapRect.top) + noteRect.height / 2 - 27.5;
        
        lastActivePartYRef.current = top;

        cursorEl.style.left  = `${left}px`;
        cursorEl.style.top   = `${top}px`;
        cursorEl.style.display = 'block';
        return;
      }
    }

    // If we didn't find the active part note, but we have a last known Y position,
    // we align horizontally with the current note, but keep the vertical Y position.
    if (lastActivePartYRef.current !== null) {
      const fallbackNote = gNotes[0] as any;
      let noteheadEls: HTMLElement[] | null = null;
      try { noteheadEls = fallbackNote.getNoteheadSVGs?.(); } catch { /* ignore */ }
      if (!noteheadEls || noteheadEls.length === 0) {
        try {
          const g = fallbackNote.getSVGGElement?.() as SVGGElement | null;
          if (g) noteheadEls = [g as unknown as HTMLElement];
        } catch { /* ignore */ }
      }
      if (noteheadEls && noteheadEls.length > 0) {
        const noteRect = noteheadEls[0].getBoundingClientRect();
        const left = noteRect.left - wrapRect.left - 11;
        
        cursorEl.style.left  = `${left}px`;
        cursorEl.style.top   = `${lastActivePartYRef.current}px`;
        cursorEl.style.display = 'block';
        return;
      }
    }

    // Ultimate fallback if no last known Y is available: use the first visible note
    const fallbackNote = gNotes[0] as any;
    let noteheadEls: HTMLElement[] | null = null;
    try { noteheadEls = fallbackNote.getNoteheadSVGs?.(); } catch { /* ignore */ }
    if (!noteheadEls || noteheadEls.length === 0) {
      try {
        const g = fallbackNote.getSVGGElement?.() as SVGGElement | null;
        if (g) noteheadEls = [g as unknown as HTMLElement];
      } catch { /* ignore */ }
    }
    if (noteheadEls && noteheadEls.length > 0) {
      const noteRect = noteheadEls[0].getBoundingClientRect();
      cursorEl.style.left  = `${noteRect.left - wrapRect.left - 11}px`;
      cursorEl.style.top   = `${(noteRect.top - wrapRect.top) + noteRect.height / 2 - 27.5}px`;
      cursorEl.style.display = 'block';
    } else {
      cursorEl.style.display = 'none';
    }
  };

  /** Show/hide instruments based on selected part, custom mix, and view mode */
  const applyPartVisibility = (
    osmd: OpenSheetMusicDisplay,
    mode: 'single' | 'full',
    partId: string,
    backingMode?: 'solo' | 'custom',
    mutedIds?: Record<string, boolean>,
    fileId?: string
  ) => {
    if (!osmd.Sheet || osmd.Sheet.Instruments.length === 0) return;
    const targetId = partId || osmd.Sheet.Instruments[0].IdString || osmd.Sheet.Instruments[0].Id.toString();
    osmd.Sheet.Instruments.forEach((inst) => {
      const id = inst.IdString || inst.Id.toString();
      if (mode === 'full') {
        inst.Visible = true;
      } else {
        // mode === 'single'
        if (backingMode === 'custom' && mutedIds && fileId) {
          const audioPartId = `${fileId}::${id}`;
          const isMuted = !!mutedIds[audioPartId];
          // Staff is visible if not custom-muted (checked in mix) OR it's the active practice instrument
          inst.Visible = !isMuted || id === targetId;
        } else {
          inst.Visible = id === targetId;
        }
      }
    });
  };

  // --------------------------------------------------------------------------
  // Effect 1: Initialize OSMD when a new score file is loaded
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || !xmlData) return;

    setErrorMsg(null);
    cursorBeatRef.current = -1;
    if (customCursorRef.current) customCursorRef.current.style.display = 'none';
    containerRef.current.innerHTML = '';

    try {
      const osmd = new OpenSheetMusicDisplay(containerRef.current, {
        autoResize: true,
        drawTitle: false,
        drawSubtitle: false,
        drawComposer: false,
        drawMetronomeMarks: true,
        coloringEnabled: true,
        autoBeam: true,
        cursorsOptions: [{ type: 1, color: '#e85d75', alpha: 0, follow: true }],
      });

      // Override render to run post-render cleanup to filter out texts of hidden parts
      const originalRender = osmd.render.bind(osmd);
      osmd.render = () => {
        originalRender();
        try {
          cleanUpForeignInstrumentTexts(
            containerRef.current,
            selectedPartIdRef.current,
            scoreDataRef.current,
            viewModeRef.current
          );
        } catch (err) {
          console.error('Error during OSMD post-render cleanup:', err);
        }
      };

      osmdRef.current = osmd;

      osmd.load(xmlData as any).then(() => {
        applyPartVisibility(osmd, viewMode, selectedPartId, backingTrackMode, customMutedPartIds, viewedFileId);
        osmd.render();
        osmd.cursor.show();
        osmd.cursor.reset();
        cursorBeatRef.current = 0;



        setTimeout(() => {
          if (osmdRef.current) {
            osmd.cursor.update();
            positionCustomCursor(osmd);
          }
        }, 200);
        onOsmdInit(osmd);
      }).catch(err => {
        console.error('Error rendering MusicXML', err);
        setErrorMsg('Failed to render Sheet Music. Make sure the file is a valid MusicXML.');
      });
    } catch (err: any) {
      console.error('Error initializing OSMD', err);
      setErrorMsg(err.message || 'Error initializing OpenSheetMusicDisplay.');
    }

    return () => { osmdRef.current = null; };
  }, [xmlData]);

  // --------------------------------------------------------------------------
  // Effect 2: Re-render when part selection, view mode, or custom mix changes
  // --------------------------------------------------------------------------
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !osmd.Sheet) return;

    applyPartVisibility(osmd, viewMode, selectedPartId, backingTrackMode, customMutedPartIds, viewedFileId);
    osmd.render();
    osmd.cursor.show();
    osmd.cursor.reset();
    cursorBeatRef.current = 0;

    setTimeout(() => {
      if (osmdRef.current) {
        osmd.cursor.update();
        positionCustomCursor(osmd);
      }
    }, 200);
  }, [selectedPartId, viewMode, backingTrackMode, customMutedPartIds, viewedFileId]);

  // --------------------------------------------------------------------------
  // Effect 3: Synchronize the visual cursor to the current playback position
  // --------------------------------------------------------------------------
  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !scoreData || !osmd.cursor) return;

    // Convert transport seconds → score quarter-note beats
    // Clamp to 0 to keep the cursor stationary at the beginning during pre-start count-in
    const targetBeat = secondsToBeats(Math.max(0, playbackProgress), scoreData);

    // ── Seek backward: reset cursor to beginning ──────────────────────────
    if (targetBeat < cursorBeatRef.current - 0.05) {
      osmd.cursor.reset();
      cursorBeatRef.current = osmd.cursor.Iterator.currentTimeStamp.RealValue * 4;
    }

    // ── Advance forward: step until next visible beat would overshoot ─────
    // We use moveToNextVisibleVoiceEntry on a cloned iterator to peek ahead.
    // This matches what osmd.cursor.next() does internally, so the beat we
    // compare is exactly the beat the cursor would land on.
    let safety = 0;
    while (safety < 3000 && !osmd.cursor.Iterator.EndReached) {
      const peek = osmd.cursor.Iterator.clone();
      // moveToNextVisibleVoiceEntry(false) = next visible entry, including rests
      peek.moveToNextVisibleVoiceEntry(false);

      const nextBeat = peek.currentTimeStamp.RealValue * 4;

      if (nextBeat <= targetBeat) {
        osmd.cursor.next();
        // Read the ACTUAL cursor position after moving (not the peek's beat,
        // which may differ if cursor.next() skips additional invisible entries)
        cursorBeatRef.current = osmd.cursor.Iterator.currentTimeStamp.RealValue * 4;
        safety++;
      } else {
        break;
      }
    }

    // Always update the visual cursor overlay position
    osmd.cursor.update();
    positionCustomCursor(osmd);
  }, [playbackProgress, scoreData]);

  // --------------------------------------------------------------------------
  // Countdown State and Calculations
  // --------------------------------------------------------------------------
  const firstNoteTime = useMemo(() => {
    if (!scoreData || !selectedPartId) return 0;
    const part = scoreData.parts.find(p => p.id === selectedPartId || selectedPartId.endsWith('::' + p.id) || p.id.endsWith('::' + selectedPartId));
    if (!part || part.notes.length === 0) return 0;
    return part.notes[0].time;
  }, [scoreData, selectedPartId]);

  const isCountIn = isPlaying && (playbackProgress < 0 || (playbackProgress < firstNoteTime && countInEnabled));

  // Returns the current sequential beat (1, 2, 3...) the user is counting through
  const getCurrentCountBeat = (): number => {
    if (!scoreData || !scoreData.initialTimeSignature) return 1;
    const denominator = scoreData.initialTimeSignature.denominator;
    const initialBpm = scoreData.tempos[0]?.bpm ?? 120;
    const beatDuration = (4.0 / denominator) * (60.0 / initialBpm);
    if (playbackProgress < 0) {
      // Negative time: full bar count-in
      const numerator = scoreData.initialTimeSignature.numerator;
      const elapsed = Math.abs(playbackProgress);
      return Math.min(numerator, Math.floor(elapsed / beatDuration) + 1);
    } else {
      // Positive time: rests count-in — clamp so we never show beat > totalCountBeats
      const beat = Math.floor(playbackProgress / beatDuration) + 1;
      return Math.min(beat, totalCountBeats);
    }
  };

  // Total number of count-in beats to display (e.g. 3 for Clarinet 2 entering on beat 4)
  const totalCountBeats = useMemo((): number => {
    if (!scoreData || !scoreData.initialTimeSignature) {
      console.log(`[CountIn] No scoreData or initialTimeSignature`);
      return 4;
    }
    if (firstNoteTime <= 0) {
      // Full bar negative count-in: show all beats in the bar
      console.log(`[CountIn] firstNoteTime=${firstNoteTime}, using full bar: ${scoreData.initialTimeSignature.numerator}`);
      return scoreData.initialTimeSignature.numerator;
    }
    // Use the note's beat position (0-indexed quarter beats).
    const part = scoreData.parts.find(p => p.id === selectedPartId);
    if (part && part.notes.length > 0) {
      const beats = Math.round(part.notes[0].beat);
      console.log(`[CountIn] FOUND part: partId=${selectedPartId}, firstNoteBeat=${part.notes[0].beat}, firstNoteTime=${firstNoteTime}, totalCountBeats=${beats}`);
      return Math.max(1, beats);
    }
    // Part not found by exact ID — log all part IDs for debugging
    console.log(`[CountIn] Part NOT found for selectedPartId="${selectedPartId}". Available part IDs: ${scoreData.parts.map(p => p.id).join(', ')}`);
    return scoreData.initialTimeSignature.numerator;
  }, [scoreData, firstNoteTime, selectedPartId]);


  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4 w-full">

      {/* View mode toggle header */}
      <div className="flex justify-between items-center px-4 py-2 border border-white/5 rounded-xl bg-panel-light/30 w-full">
        <span className="text-text-secondary font-bold text-xs uppercase tracking-wider">Notation Viewer</span>
        {xmlData && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-brand/10 border-brand text-brand shadow shadow-brand/10'
                  : 'bg-[#1c1926]/40 border-transparent text-text-secondary hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Single Part
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border cursor-pointer ${
                viewMode === 'full'
                  ? 'bg-brand/10 border-brand text-brand shadow shadow-brand/10'
                  : 'bg-[#1c1926]/40 border-transparent text-text-secondary hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Full Score
            </button>
          </div>
        )}
      </div>

      {/* Beat counter banner — sits between toolbar and score, visible but non-blocking */}
      {isCountIn && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '20px 32px',
            background: 'linear-gradient(135deg, rgba(232,93,117,0.12) 0%, rgba(18,17,26,0.95) 100%)',
            border: '1px solid rgba(232,93,117,0.25)',
            borderRadius: '16px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        >
          {/* Label */}
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(232,93,117,0.7)' }}>
            Count In
          </div>

          {/* Beat circles row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {Array.from({ length: totalCountBeats }, (_, i) => {
              const beatNum = i + 1;
              const isActive = beatNum === getCurrentCountBeat();
              return (
                <div
                  key={beatNum}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {/* Beat number */}
                  <div
                    style={{
                      fontSize: isActive ? '72px' : '36px',
                      fontWeight: 900,
                      lineHeight: 1,
                      color: isActive ? '#e85d75' : 'rgba(255,255,255,0.2)',
                      textShadow: isActive ? '0 0 30px rgba(232,93,117,0.6), 0 0 60px rgba(232,93,117,0.3)' : 'none',
                      letterSpacing: '-0.02em',
                      transition: 'all 0.08s ease',
                      userSelect: 'none',
                    }}
                  >
                    {beatNum}
                  </div>
                  {/* Active dot */}
                  <div
                    style={{
                      width: isActive ? '8px' : '4px',
                      height: isActive ? '8px' : '4px',
                      borderRadius: '50%',
                      background: isActive ? '#e85d75' : 'rgba(255,255,255,0.15)',
                      boxShadow: isActive ? '0 0 10px rgba(232,93,117,0.8)' : 'none',
                      transition: 'all 0.08s ease',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score render canvas */}
      <div className="clean-panel p-6 shadow-xl w-full flex justify-center min-h-[400px]">
        {errorMsg && (
          <div className="m-auto text-center max-w-md">
            <p className="text-red-400 font-medium text-base mb-2">{errorMsg}</p>
            <p className="text-sm text-text-secondary">Try uploading another standard MusicXML file.</p>
          </div>
        )}

        {!xmlData && !errorMsg && (
          <div className="m-auto text-center py-20 text-text-muted">
            <Music className="w-12 h-12 mx-auto opacity-20 mb-4 text-brand" />
            <p className="text-base font-bold text-text-secondary uppercase tracking-wide">Sheet music will render here</p>
            <p className="text-xs text-text-muted mt-1">Upload a score above to load standard musical notation</p>
          </div>
        )}

        {/*
          wrapperRef is position:relative. Both the OSMD container and the cursor
          overlay are children, so the overlay can be absolutely positioned inside it.
          The cursor div is a sibling of containerRef so it survives innerHTML clears.
        */}
        <div
          ref={wrapperRef}
          className="relative w-full"
          style={{ display: xmlData && !errorMsg ? 'block' : 'none' }}
          onClick={handleSvgClick}
        >
          <div
            ref={containerRef}
            className="osmd-container w-full bg-white rounded-xl p-4 overflow-x-auto min-w-0 cursor-pointer"
          />

          {/* Coral cursor bar overlay — positioned by positionCustomCursor() */}
          <div
            ref={customCursorRef}
            style={{
              display: 'none',
              position: 'absolute',
              width: '7px',
              height: '55px',
              backgroundColor: '#e85d75',
              borderRadius: '3.5px',
              opacity: 0.85,
              pointerEvents: 'none',
              zIndex: 100,
            }}
          />
        </div>
      </div>
    </div>
  );
};
