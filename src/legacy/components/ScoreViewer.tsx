import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { 
  ZoomIn, ZoomOut, RotateCcw, 
  Layers, Eye
} from 'lucide-react';
import { PracticeArea } from '../../contracts/portal';
import { CATEGORY_DEFINITIONS } from '../../modules/score/engine/instrumentProfiles';

interface ScoreViewerProps {
  xmlContent: string | null;
  practiceAreas: PracticeArea[];
  selectedAreaId: string | null;
  selectedSectionId?: string | null;
  onSelectArea: (areaId: string) => void;
  onMeasureClick?: (measureNumber: number) => void;
  selectedPartId?: string;
  onPartChange?: (partId: string) => void;
  availableParts?: { id: string; name: string }[];
}

interface MeasureBox {
  measureNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({
  xmlContent,
  practiceAreas,
  selectedAreaId,
  onSelectArea,
  onMeasureClick,
  selectedPartId,
  onPartChange,
  availableParts = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [measureBoxes, setMeasureBoxes] = useState<MeasureBox[]>([]);
  const [isRendered, setIsRendered] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Compute measure bounding boxes from OSMD GraphicSheet after render
  const extractMeasureBoxes = useCallback((osmd: OpenSheetMusicDisplay) => {
    try {
      const boxes: MeasureBox[] = [];
      const graphicSheet = osmd.GraphicSheet;
      if (!graphicSheet || !graphicSheet.MeasureList) return;

      const scale = 10.0; // OSMD internal coordinate multiplier to CSS pixels

      graphicSheet.MeasureList.forEach((measureRow, rowIdx) => {
        if (!measureRow || measureRow.length === 0) return;
        
        // Use first staff/part in the row or selected part
        const gm = measureRow[0];
        if (!gm || !gm.PositionAndShape) return;

        const mNum = gm.MeasureNumber || (rowIdx + 1);
        const pos = gm.PositionAndShape.AbsolutePosition;
        const size = gm.PositionAndShape.Size;

        // If multiple staves, expand height to cover the full measure bracket
        let totalHeight = size.height * scale;
        if (measureRow.length > 1) {
          const lastGm = measureRow[measureRow.length - 1];
          if (lastGm && lastGm.PositionAndShape) {
            const bottomY = (lastGm.PositionAndShape.AbsolutePosition.y + lastGm.PositionAndShape.Size.height) * scale;
            totalHeight = Math.max(totalHeight, bottomY - (pos.y * scale));
          }
        }

        boxes.push({
          measureNumber: mNum,
          x: pos.x * scale,
          y: pos.y * scale,
          width: Math.max(size.width * scale, 40),
          height: Math.max(totalHeight, 80)
        });
      });

      setMeasureBoxes(boxes);
    } catch (err) {
      console.warn('Failed to extract measure coordinates:', err);
    }
  }, []);

  // Initialize and Render OSMD
  useEffect(() => {
    if (!containerRef.current || !xmlContent) return;

    let isMounted = true;
    setIsRendered(false);
    setRenderError(null);

    const container = containerRef.current;
    container.innerHTML = '';

    try {
      const osmd = new OpenSheetMusicDisplay(container, {
        autoResize: true,
        backend: 'svg',
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
        drawCredits: false,
        drawPartNames: true,
        drawMeasureNumbers: true,
        drawMetronomeMarks: true,
        coloringMode: 0,
        autoBeam: true,
        renderSingleHorizontalStaffline: false
      });

      // Engraving rules ensuring 100% accurate score rendering matching original XML:
      // 1. Never suppress consecutive triplet/tuplet numbers (OSMD defaults suppress after 2 repetitions)
      osmd.EngravingRules.TupletNumberLimitConsecutiveRepetitions = false;
      osmd.EngravingRules.TupletNumberAlwaysDisableAfterFirstMax = false;
      osmd.EngravingRules.TupletNumberUseShowNoneXMLValue = false;
      
      // 2. Respect XML tuplet brackets and formatting
      osmd.EngravingRules.TupletsBracketedUseXMLValue = true;
      osmd.EngravingRules.TripletsBracketed = false;
      osmd.EngravingRules.TupletsRatioedUseXMLValue = true;

      osmd.setLogLevel('warn');
      osmd.zoom = zoom;

      osmd.load(xmlContent)
        .then(() => {
          if (!isMounted) return;
          // If specific part selected
          if (selectedPartId && osmd.Sheet && osmd.Sheet.Instruments) {
            osmd.Sheet.Instruments.forEach((inst) => {
              inst.Visible = inst.IdString === selectedPartId || osmd.Sheet.Instruments.length === 1;
            });
          }
          osmd.render();
          osmdRef.current = osmd;
          setIsRendered(true);
          extractMeasureBoxes(osmd);
        })
        .catch(err => {
          if (isMounted) {
            console.error('OSMD load error:', err);
            setRenderError(err.message || 'Error rendering score.');
          }
        });
    } catch (err: any) {
      setRenderError(err.message || 'Failed to initialize sheet renderer.');
    }

    return () => {
      isMounted = false;
    };
  }, [xmlContent, selectedPartId, extractMeasureBoxes]);

  // Handle Zoom change
  const handleZoomChange = (delta: number) => {
    const newZoom = Math.min(Math.max(zoom + delta, 0.6), 1.8);
    setZoom(newZoom);
    if (osmdRef.current) {
      osmdRef.current.zoom = newZoom;
      osmdRef.current.render();
      extractMeasureBoxes(osmdRef.current);
    }
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    if (osmdRef.current) {
      osmdRef.current.zoom = 1.0;
      osmdRef.current.render();
      extractMeasureBoxes(osmdRef.current);
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to active area when selected, centering it in the visible area
  useEffect(() => {
    if (measureBoxes.length === 0 || !scrollContainerRef.current) return;

    let targetMeasureNumber: number | null = null;
    if (selectedAreaId) {
      const activeArea = practiceAreas.find(a => a.id === selectedAreaId);
      if (activeArea) {
        targetMeasureNumber = activeArea.startMeasure;
      }
    }

    if (targetMeasureNumber === null) return;

    const targetBox = measureBoxes.find(b => b.measureNumber === targetMeasureNumber);
    if (targetBox && scrollContainerRef.current) {
      const containerHeight = scrollContainerRef.current.clientHeight;
      const targetTop = targetBox.y - (containerHeight / 3);
      scrollContainerRef.current.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: 'smooth'
      });
    }
  }, [selectedAreaId, measureBoxes, practiceAreas]);

  // Group practice areas that touch each measure box
  const getAreasForMeasure = (mNum: number) => {
    return practiceAreas.filter(
      a => a.status !== 'removed' && mNum >= a.startMeasure && mNum <= a.endMeasure
    );
  };

  return (
    <div className="relative flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl backdrop-blur-sm">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            Interactive Score
          </span>

          {availableParts.length > 1 && (
            <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-700/60">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedPartId}
                onChange={(e) => onPartChange?.(e.target.value)}
                className="bg-slate-800/90 text-xs text-slate-200 border border-slate-700/80 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 transition-colors"
              >
                {availableParts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Legend / Category Badges */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto">
          {Object.values(CATEGORY_DEFINITIONS).slice(0, 5).map(cat => (
            <div 
              key={cat.id} 
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap"
              style={{ 
                backgroundColor: cat.highlightColor, 
                borderColor: cat.borderColor,
                color: '#e2e8f0'
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.badgeText }} />
              {cat.shortLabel}
            </div>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
          <button
            onClick={() => handleZoomChange(-0.15)}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-300 px-1.5">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoomChange(0.15)}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 rounded transition-colors ml-0.5 border-l border-slate-700/60"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Score Canvas & Highlight Overlay */}
      <div 
        ref={scrollContainerRef} 
        className="relative flex-1 overflow-auto p-6 flex justify-center bg-white/95 text-slate-900 rounded-b-2xl scroll-smooth"
      >
        {renderError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-rose-600">
            <p className="font-semibold mb-1">Failed to render sheet music</p>
            <p className="text-xs text-rose-500 font-mono">{renderError}</p>
          </div>
        ) : (
          <div className="relative inline-block min-w-[760px] max-w-[960px]">
            {/* OSMD SVG Render Output */}
            <div ref={containerRef} className="score-container select-none" />

            {/* Visual Highlight Ribbon Layer */}
            {isRendered && measureBoxes.length > 0 && (
              <div 
                className="absolute inset-0 pointer-events-none z-10"
                style={{ width: '100%', height: '100%' }}
              >
                {measureBoxes.map(box => {
                  const matchingAreas = getAreasForMeasure(box.measureNumber);
                  if (matchingAreas.length === 0) return null;

                  const isSelected = matchingAreas.some(a => a.id === selectedAreaId);
                  const primaryArea = matchingAreas[0];
                  const meta = CATEGORY_DEFINITIONS[primaryArea.category];

                  return (
                    <div
                      key={`box-${box.measureNumber}`}
                      onClick={() => {
                        onSelectArea(primaryArea.id);
                        onMeasureClick?.(box.measureNumber);
                      }}
                      className={`absolute pointer-events-auto cursor-pointer transition-all duration-200 rounded-lg group ${
                        isSelected 
                          ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20' 
                          : 'hover:opacity-90'
                      }`}
                      style={{
                        left: `${box.x - 4}px`,
                        top: `${box.y - 4}px`,
                        width: `${box.width + 8}px`,
                        height: `${box.height + 8}px`,
                        backgroundColor: isSelected 
                          ? meta.highlightColor.replace('0.22', '0.38') 
                          : meta.highlightColor,
                        border: `1.5px dashed ${isSelected ? '#6366f1' : meta.borderColor}`
                      }}
                    >
                      {/* Measure Flag Badge on Top */}
                      <div className="absolute -top-3 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm flex items-center gap-1"
                        style={{ backgroundColor: isSelected ? '#4f46e5' : '#1e293b' }}
                      >
                        <span>m.{box.measureNumber}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      </div>

                      {/* Hover Tooltip showing Category & Goal */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 text-white text-[11px] p-2 rounded-lg shadow-xl border border-slate-700 pointer-events-none z-30">
                        <div className="font-semibold text-indigo-300">{meta.name}</div>
                        <div className="text-slate-300 text-[10px] mt-0.5 line-clamp-2">{primaryArea.teacherGoal}</div>
                        <div className="text-[9px] text-slate-400 mt-1 font-mono">Click to view/edit goal</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
