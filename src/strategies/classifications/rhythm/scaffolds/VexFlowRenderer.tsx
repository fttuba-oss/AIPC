import React, { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Tuplet, Dot, Beam, BarlineType, StaveTie, Fraction } from 'vexflow';
import { DURATION_MAP, type Measure, type TimeSignature } from './rhythmEngine';

export interface BarlineClickEvent {
  measureIndex: number;
  timeSignature: TimeSignature;
  anchorX: number;
  anchorY: number;
  screenX: number;
  screenY: number;
}

interface VexFlowRendererProps {
  measures: Measure[];
  activeNoteIndex: number | null;
  noteTapsRecord?: Record<number, 'Perfect' | 'Great' | 'Good' | 'Early' | 'Late' | 'Miss'>;
  selectedNoteIndex?: number | null;
  startMeasureNumber?: number;
  hideMeasureNumbers?: boolean;
  onNoteClick?: (index: number) => void;
  onBarlineClick?: (event: BarlineClickEvent) => void;
  activeBarlineIndex?: number | null;
}

/**
 * Build proper beat-group Fraction array for Beam.generateBeams() depending on time signature.
 */
function getBeamGroups(beatsPerMeasure: number, beatValue: number): Fraction[] {
  // Compound meters (6/8, 9/8, 12/8): beam in groups of 3 eighth notes (dotted quarter)
  if (beatValue === 8 && beatsPerMeasure % 3 === 0) {
    const numGroups = beatsPerMeasure / 3;
    return Array.from({ length: numGroups }, () => new Fraction(3, 8));
  }
  // Mixed 5/8 (3 + 2)
  if (beatValue === 8 && beatsPerMeasure === 5) {
    return [new Fraction(3, 8), new Fraction(2, 8)];
  }
  // Mixed 7/8 (2 + 2 + 3)
  if (beatValue === 8 && beatsPerMeasure === 7) {
    return [new Fraction(2, 8), new Fraction(2, 8), new Fraction(3, 8)];
  }
  // 4/4 standard beam by half bars (2/4 + 2/4) or quarter beats
  if (beatValue === 4 && beatsPerMeasure === 4) {
    return [new Fraction(2, 4), new Fraction(2, 4)];
  }
  return Array.from({ length: beatsPerMeasure }, () => new Fraction(1, beatValue));
}

export const VexFlowRenderer: React.FC<VexFlowRendererProps> = ({
  measures,
  activeNoteIndex,
  noteTapsRecord,
  selectedNoteIndex = null,
  startMeasureNumber,
  hideMeasureNumbers = false,
  onNoteClick,
  onBarlineClick,
  activeBarlineIndex = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Responsive width tracking via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setContainerWidth(w);
      }
    };
    updateWidth();
    const t = setTimeout(updateWidth, 60);

    const ro = new ResizeObserver(() => {
      updateWidth();
    });
    ro.observe(containerRef.current);
    window.addEventListener('resize', updateWidth);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || measures.length === 0) {
      return;
    }

    // Clear previous SVG
    containerRef.current.innerHTML = '';
    setErrorMsg(null);

    try {
      // Dynamically measure container width to prevent any horizontal scrolling
      const measuredWidth = containerWidth || (containerRef.current ? containerRef.current.clientWidth : 0) || 720;
      const startX = 15;
      const endMargin = 15;
      const usableWidth = Math.max(280, measuredWidth - startX - endMargin);

      // Determine bars per line so notes have sufficient room and never overflow:
      // If usableWidth < 460px: 1 bar per line
      // Otherwise: 2 bars per line
      const barsPerLine = usableWidth < 460 ? 1 : 2;
      const measureWidth = Math.floor(usableWidth / barsPerLine);
      const totalWidth = startX + (barsPerLine * measureWidth) + endMargin;
      const numLines = Math.ceil(measures.length / barsPerLine);
      const totalHeight = 25 + (numLines * 130);

      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(totalWidth, totalHeight);

      // Set responsive SVG attributes so it never overflows its container
      const svgEl = containerRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.maxWidth = '100%';
        svgEl.style.height = 'auto';
        svgEl.style.display = 'block';
        svgEl.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
      }
      
      const context = renderer.getContext();
      context.setFont('Arial', 10);

      let noteGlobalIndex = 0;
      let lastTimeSigStr = '';

      // Flat map: each StaveNote → its global index in the pattern
      const noteGlobalIndexMap: { staveNote: StaveNote; globalIdx: number }[] = [];

      // Build data first to resolve ties across systems correctly
      const allMeasureData: {
        mIndex: number;
        stave: Stave;
        vexNotes: StaveNote[];
        noteColorList: string[];
        noteIsRestList: boolean[];
        tiedFlags: boolean[];
        tupletsToCreate: { startIdx: number; count: number; numNotes: number; notesOccupied: number }[];
        beatsPerMeasure: number;
        beatValue: number;
      }[] = [];

      measures.forEach((measure, mIndex) => {
        const { beatsPerMeasure, beatValue } = measure.timeSignature;
        const measureNotes = measure.notes;

        const lineIndex = Math.floor(mIndex / barsPerLine);
        const mWithinLine = mIndex % barsPerLine;
        
        const isLineFirst = mWithinLine === 0;
        const isAbsoluteFirst = mIndex === 0;
        
        const xPos = startX + (mWithinLine * measureWidth);
        const yPos = 15 + (lineIndex * 130);
        
        const stave = new Stave(xPos, yPos, measureWidth);
        
        stave.setNumLines(5);
        stave.setConfigForLine(0, { visible: false });
        stave.setConfigForLine(1, { visible: false });
        stave.setConfigForLine(2, { visible: true }); // Middle line
        stave.setConfigForLine(3, { visible: false });
        stave.setConfigForLine(4, { visible: false });

        if (isLineFirst) stave.addClef('percussion');
        
        // Add time signature if it's the absolute first bar or if it changes
        const timeSigStr = `${beatsPerMeasure}/${beatValue}`;
        if (isAbsoluteFirst || timeSigStr !== lastTimeSigStr) {
          stave.addTimeSignature(timeSigStr);
          lastTimeSigStr = timeSigStr;
        }

        if (!hideMeasureNumbers && startMeasureNumber !== undefined) {
          const displayMeasureNum = startMeasureNumber + mIndex;
          stave.setMeasure(displayMeasureNum);
        }

        if (mIndex === measures.length - 1) stave.setEndBarType(BarlineType.DOUBLE);

        stave.setContext(context).draw();

        const vexNotes: StaveNote[] = [];
        const tupletsToCreate: { startIdx: number; count: number; numNotes: number; notesOccupied: number }[] = [];
        let tupletStartIdx: number | null = null;
        let tupletAccumBeats = 0;
        let tupletNoteCount = 0;

        // Detect tuplets dynamically based on accumulated beats (e.g. 1 beat in 4/4)
        measureNotes.forEach((note, nIdx) => {
          const isTriplet = note.duration.includes('t');
          const noteBeats = DURATION_MAP[note.duration] || 0.3333;

          if (isTriplet) {
            if (tupletStartIdx === null) {
              tupletStartIdx = nIdx;
              tupletAccumBeats = 0;
              tupletNoteCount = 0;
            }
            tupletAccumBeats += noteBeats;
            tupletNoteCount++;

            const isLastNote = nIdx === measureNotes.length - 1;
            const nextNoteIsTriplet = !isLastNote && measureNotes[nIdx + 1].duration.includes('t');

            if (tupletAccumBeats >= 0.95 || !nextNoteIsTriplet || isLastNote) {
              tupletsToCreate.push({
                startIdx: tupletStartIdx,
                count: tupletNoteCount,
                numNotes: 3,
                notesOccupied: 2
              });
              tupletStartIdx = null;
              tupletAccumBeats = 0;
              tupletNoteCount = 0;
            }
          } else {
            if (tupletStartIdx !== null && tupletNoteCount > 0) {
              tupletsToCreate.push({
                startIdx: tupletStartIdx,
                count: tupletNoteCount,
                numNotes: 3,
                notesOccupied: 2
              });
            }
            tupletStartIdx = null;
            tupletAccumBeats = 0;
            tupletNoteCount = 0;
          }
        });

        const noteColorList: string[] = [];
        const noteIsRestList: boolean[] = [];
        const tiedFlags: boolean[] = [];

        measureNotes.forEach((note) => {
          let vexDuration = note.duration;
          const isDotted = vexDuration.includes('d');

          // Strip 't' and 'd' for vexflow duration
          vexDuration = vexDuration.replace(/[^0-9]/g, '');
          if (!vexDuration) vexDuration = '4';

          if (note.isRest) {
            if (isDotted) {
              vexDuration = vexDuration + 'rd';
            } else {
              vexDuration = vexDuration + 'r';
            }
          }

          const staveNote = new StaveNote({
            keys: ['b/4'],
            duration: vexDuration,
            clef: 'treble'
          });

          noteGlobalIndexMap.push({ staveNote, globalIdx: noteGlobalIndex });

          const tapRating = noteTapsRecord?.[noteGlobalIndex];
          let noteColor = '';
          if (tapRating) {
            switch (tapRating) {
              case 'Perfect': noteColor = '#10b981'; break;
              case 'Great': case 'Good': noteColor = '#3b82f6'; break;
              case 'Early': case 'Late': noteColor = '#f59e0b'; break;
              case 'Miss':  noteColor = '#ef4444'; break;
            }
          }

          if (noteColor && !note.isRest) {
            staveNote.setStyle({ fillStyle: noteColor, strokeStyle: noteColor });
          }

          noteColorList.push(noteColor);
          noteIsRestList.push(note.isRest);
          tiedFlags.push(!!note.tied);

          if (isDotted) Dot.buildAndAttach([staveNote], { all: true });

          vexNotes.push(staveNote);
          noteGlobalIndex++;
        });

        allMeasureData.push({
          mIndex, stave, vexNotes, noteColorList, noteIsRestList, tiedFlags, tupletsToCreate, beatsPerMeasure, beatValue
        });
      });

      // Format and draw notes
      allMeasureData.forEach((md) => {
        const { stave, vexNotes, noteColorList, noteIsRestList, tupletsToCreate, beatsPerMeasure, beatValue } = md;

        if (vexNotes.length === 0) return;

        // 1. Create Tuplet objects first so formatting accounts for tuplets
        const vexTuplets: Tuplet[] = [];
        tupletsToCreate.forEach((t) => {
          const tripletNotes = vexNotes.slice(t.startIdx, t.startIdx + t.count);
          if (tripletNotes.length === t.count && tripletNotes.length > 0) {
            try {
              const tuplet = new Tuplet(tripletNotes, {
                numNotes: t.numNotes,
                notesOccupied: t.notesOccupied,
                bracketed: true
              });
              vexTuplets.push(tuplet);
            } catch (err) {
              console.warn('Error creating Tuplet:', err);
            }
          }
        });

        // 2. Beams: Beam tuplet groups strictly per tuplet if they contain >= 2 beamable notes
        const beams: Beam[] = [];
        const beamedIndices = new Set<number>();

        tupletsToCreate.forEach((t) => {
          const tripletNotes = vexNotes.slice(t.startIdx, t.startIdx + t.count);
          const beamable = tripletNotes.filter(n => {
            const dur = n.getDuration();
            return (dur === '8' || dur === '16' || dur === '32') && !dur.includes('r');
          });
          const nonRests = tripletNotes.filter(n => !n.getDuration().includes('r'));
          if (beamable.length > 1 && beamable.length === nonRests.length) {
            try {
              beams.push(new Beam(beamable));
              for (let i = t.startIdx; i < t.startIdx + t.count; i++) {
                beamedIndices.add(i);
              }
            } catch (err) {
              console.warn('Could not beam tuplet:', err);
            }
          }
        });

        // For remaining notes not in a beamed tuplet, generate beams with standard groups
        const remainingNotes: StaveNote[] = [];
        vexNotes.forEach((n, idx) => {
          if (!beamedIndices.has(idx)) {
            remainingNotes.push(n);
          }
        });

        if (remainingNotes.length > 0) {
          try {
            const autoBeams = Beam.generateBeams(remainingNotes, {
              groups: getBeamGroups(beatsPerMeasure, beatValue),
              stem_direction: -1,
              stemDirection: -1
            } as any);
            beams.push(...autoBeams);
          } catch (e) {
            // Safe fallback if remaining notes cannot form auto beams
          }
        }

        const voice = new Voice({
          num_beats: beatsPerMeasure,
          numBeats: beatsPerMeasure,
          beat_value: beatValue,
          beatValue: beatValue
        } as any);
        voice.setStrict(false);
        voice.addTickables(vexNotes);

        const noteWidth = stave.getNoteEndX() - stave.getNoteStartX() - 15;
        new Formatter().joinVoices([voice]).format([voice], noteWidth);

        voice.draw(context, stave);
        beams.forEach((beam) => beam.setContext(context).draw());
        vexTuplets.forEach((tuplet) => tuplet.setContext(context).draw());

        const svgRoot = containerRef.current?.querySelector('svg');
        if (svgRoot) {
          const noteHeadY = stave.getYForLine(2);
          vexNotes.forEach((sn, localIdx) => {
            const color = noteColorList[localIdx];
            if (!color || noteIsRestList[localIdx]) return;

            const nx = sn.getAbsoluteX() + 5;

            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', String(nx));
            dot.setAttribute('cy', String(noteHeadY));
            dot.setAttribute('r', '5');
            dot.setAttribute('fill', color);
            dot.setAttribute('opacity', '0.9');
            dot.setAttribute('pointer-events', 'none');
            svgRoot.appendChild(dot);
          });
        }
      });

      // Ties Draw Pass
      allMeasureData.forEach((md, dataIdx) => {
        const { vexNotes, noteIsRestList, tiedFlags } = md;

        tiedFlags.forEach((isTied, localIdx) => {
          if (!isTied || noteIsRestList[localIdx]) return;

          const firstNote = vexNotes[localIdx];
          let secondNote: StaveNote | null = null;
          let isSecondNoteRest = false;

          if (localIdx < vexNotes.length - 1) {
            secondNote = vexNotes[localIdx + 1];
            isSecondNoteRest = noteIsRestList[localIdx + 1];
          } else {
            const nextMd = allMeasureData[dataIdx + 1];
            if (nextMd && nextMd.vexNotes.length > 0) {
              secondNote = nextMd.vexNotes[0];
              isSecondNoteRest = nextMd.noteIsRestList[0];
            }
          }

          if (secondNote && !noteIsRestList[localIdx] && !isSecondNoteRest) {
            const tie = new StaveTie({
              first_note: firstNote,
              firstNote: firstNote,
              last_note: secondNote,
              lastNote: secondNote,
              first_indices: [0],
              firstIndices: [0],
              last_indices: [0],
              lastIndices: [0]
            } as any);
            tie.setContext(context).draw();
          }
        });
      });

      // Post-draw: create invisible click-target rectangles
      const svgRoot = containerRef.current?.querySelector('svg');
      if (svgRoot) {
        noteGlobalIndexMap.forEach(({ staveNote, globalIdx }) => {
          const nx = staveNote.getAbsoluteX();
          const md = allMeasureData.find(m => m.vexNotes.includes(staveNote));
          const noteHeadY = md ? md.stave.getYForLine(2) : 40;

          if (globalIdx === selectedNoteIndex) {
            const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            highlight.setAttribute('x', String(nx - 8));
            highlight.setAttribute('y', String(noteHeadY - 14));
            highlight.setAttribute('width', '26');
            highlight.setAttribute('height', '28');
            highlight.setAttribute('rx', '6');
            highlight.setAttribute('fill', 'rgba(168, 85, 247, 0.15)');
            highlight.setAttribute('stroke', '#a855f7');
            highlight.setAttribute('stroke-width', '2');
            highlight.setAttribute('pointer-events', 'none');
            svgRoot.appendChild(highlight);
          }

          if (onNoteClick) {
            const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hitRect.setAttribute('x', String(nx - 15));
            hitRect.setAttribute('y', String(noteHeadY - 20));
            hitRect.setAttribute('width', '40');
            hitRect.setAttribute('height', '40');
            hitRect.setAttribute('fill', '#000');
            hitRect.setAttribute('fill-opacity', '0');
            hitRect.setAttribute('pointer-events', 'all');
            hitRect.setAttribute('cursor', 'pointer');
            hitRect.setAttribute('data-note-index', String(globalIdx));
            hitRect.addEventListener('click', (e) => {
              console.log('hitRect click detected! globalIdx:', globalIdx);
              e.stopPropagation();
              onNoteClick(globalIdx);
            });
            svgRoot.appendChild(hitRect);
          }
        });

        // 2. Barline click targets (for changing meter midway)
        if (onBarlineClick) {
          allMeasureData.forEach(({ mIndex, stave }) => {
            const isAbsoluteFirst = mIndex === 0;
            const barlineX = isAbsoluteFirst ? stave.getX() + 32 : stave.getX();
            const barlineTopY = stave.getYForLine(0) - 15;
            const barlineHeight = (stave.getYForLine(4) - stave.getYForLine(0)) + 30;
            const isActive = activeBarlineIndex === mIndex;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'barline-trigger');
            g.setAttribute('cursor', 'pointer');
            g.setAttribute('style', 'pointer-events: all;');

            // Visual barline highlight
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(barlineX));
            line.setAttribute('y1', String(barlineTopY));
            line.setAttribute('x2', String(barlineX));
            line.setAttribute('y2', String(barlineTopY + barlineHeight));
            line.setAttribute('stroke', isActive ? '#a855f7' : '#9333ea');
            line.setAttribute('stroke-width', isActive ? '4' : '2.5');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('stroke-dasharray', isAbsoluteFirst ? 'none' : '4 3');
            line.setAttribute('opacity', isActive ? '1' : '0');
            line.setAttribute('style', 'transition: opacity 0.15s ease;');
            g.appendChild(line);

            // Small badge showing time signature tag on hover / active
            const badge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            badge.setAttribute('transform', `translate(${barlineX - 16}, ${barlineTopY - 14})`);
            badge.setAttribute('opacity', isActive ? '1' : '0');
            badge.setAttribute('style', 'transition: opacity 0.15s ease;');

            const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            badgeBg.setAttribute('width', '32');
            badgeBg.setAttribute('height', '15');
            badgeBg.setAttribute('rx', '4');
            badgeBg.setAttribute('fill', '#9333ea');
            badgeBg.setAttribute('stroke', '#c084fc');
            badgeBg.setAttribute('stroke-width', '1');
            badge.appendChild(badgeBg);

            const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            badgeText.setAttribute('x', '16');
            badgeText.setAttribute('y', '11');
            badgeText.setAttribute('text-anchor', 'middle');
            badgeText.setAttribute('fill', '#ffffff');
            badgeText.setAttribute('font-size', '8.5');
            badgeText.setAttribute('font-weight', 'bold');
            badgeText.setAttribute('font-family', 'sans-serif');
            const mTs = measures[mIndex].timeSignature;
            badgeText.textContent = `${mTs.beatsPerMeasure}/${mTs.beatValue}`;
            badge.appendChild(badgeText);
            g.appendChild(badge);

            // Hit target rectangle
            const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hitRect.setAttribute('x', String(barlineX - 16));
            hitRect.setAttribute('y', String(barlineTopY - 16));
            hitRect.setAttribute('width', '32');
            hitRect.setAttribute('height', String(barlineHeight + 20));
            hitRect.setAttribute('fill', '#000');
            hitRect.setAttribute('fill-opacity', '0');
            g.appendChild(hitRect);

            g.addEventListener('mouseenter', () => {
              if (activeBarlineIndex !== mIndex) {
                line.setAttribute('opacity', '0.75');
                badge.setAttribute('opacity', '0.95');
              }
            });

            g.addEventListener('mouseleave', () => {
              if (activeBarlineIndex !== mIndex) {
                line.setAttribute('opacity', '0');
                badge.setAttribute('opacity', '0');
              }
            });

            g.addEventListener('click', (e) => {
              e.stopPropagation();
              const clientRect = containerRef.current?.getBoundingClientRect();
              const screenX = (clientRect?.left || 0) + barlineX;
              const screenY = (clientRect?.top || 0) + barlineTopY;
              onBarlineClick({
                measureIndex: mIndex,
                timeSignature: measures[mIndex].timeSignature,
                anchorX: barlineX,
                anchorY: barlineTopY,
                screenX,
                screenY
              });
            });

            svgRoot.appendChild(g);
          });
        }
      }

    } catch (err: any) {
      console.error('VexFlow rendering error:', err);
      setErrorMsg('Notation render error. Check pattern formatting.');
    }
  }, [measures, activeNoteIndex, noteTapsRecord, selectedNoteIndex, startMeasureNumber, onNoteClick, onBarlineClick, activeBarlineIndex, containerWidth]);

  return (
    <div className="relative w-full max-w-full overflow-hidden p-2 sm:p-3 flex flex-col items-center">
      {errorMsg ? (
        <div className="text-red-400 py-10 font-semibold">{errorMsg}</div>
      ) : (
        <div ref={containerRef} className="vexflow-container w-full max-w-full overflow-hidden flex justify-center" />
      )}
    </div>
  );
};
