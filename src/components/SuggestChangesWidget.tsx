import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, MousePointer, Copy, Check, Save, 
  Trash2, X, Eye, EyeOff, MessageSquarePlus, 
  ListOrdered, ChevronUp, ChevronDown, GripVertical 
} from 'lucide-react';

export interface SuggestionItem {
  id: string;
  timestamp: string;
  targetTag: string;
  targetSelector: string;
  originalText: string;
  suggestedChange: string;
  category: 'copy' | 'bug' | 'ui' | 'feature';
  componentContext?: string;
  pageUrl?: string;
  appMode?: string;
  status?: string;
}

interface HighlightBox {
  top: number;
  left: number;
  width: number;
  height: number;
  tag: string;
  selector: string;
  textSnippet: string;
}

interface SuggestChangesWidgetProps {
  appMode?: string;
}

export const SuggestChangesWidget: React.FC<SuggestChangesWidgetProps> = ({ appMode = 'portal' }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [hoveredBox, setHoveredBox] = useState<HighlightBox | null>(null);
  
  // Selected target for modal
  const [targetNode, setTargetNode] = useState<HTMLElement | null>(null);
  const [targetOriginalTextBackup, setTargetOriginalTextBackup] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedSelector, setSelectedSelector] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const [suggestedChange, setSuggestedChange] = useState<string>('');
  const [category, setCategory] = useState<'copy' | 'bug' | 'ui' | 'feature'>('copy');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isLivePreviewing, setIsLivePreviewing] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Suggestions list & sync
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load existing suggestions from API on mount
  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/suggest-changes');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
        }
      }
    } catch {
      // API fallback: no-op
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Toast notification timer
  useEffect(() => {
    if (copiedNotification) {
      const timer = setTimeout(() => setCopiedNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [copiedNotification]);

  // Draggable position state & persistence
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('suggest_changes_widget_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ startX: number; startY: number; initialPosX: number; initialPosY: number }>({
    startX: 0,
    startY: 0,
    initialPosX: 0,
    initialPosY: 0,
  });
  const widgetRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<{ x: number; y: number } | null>(position);
  positionRef.current = position;

  // Enforce window boundaries on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (!prev || !widgetRef.current) return prev;
        const widgetWidth = widgetRef.current.offsetWidth || 280;
        const widgetHeight = widgetRef.current.offsetHeight || 50;
        const clampedX = Math.max(8, Math.min(window.innerWidth - widgetWidth - 8, prev.x));
        const clampedY = Math.max(8, Math.min(window.innerHeight - widgetHeight - 8, prev.y));
        if (clampedX !== prev.x || clampedY !== prev.y) {
          const updated = { x: clampedX, y: clampedY };
          try {
            localStorage.setItem('suggest_changes_widget_pos', JSON.stringify(updated));
          } catch {}
          return updated;
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const isClickable = target.closest('button, input, textarea, a, select');
    const isDragHandle = target.closest('[data-drag-handle]');
    if (isClickable && !isDragHandle) return;

    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();

    dragStartPosRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: rect.left,
      initialPosY: rect.top,
    };
    isDraggingRef.current = true;
    setIsDragging(true);

    if (!positionRef.current) {
      setPosition({ x: rect.left, y: rect.top });
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - dragStartPosRef.current.startX;
    const deltaY = e.clientY - dragStartPosRef.current.startY;

    const widgetWidth = widgetRef.current?.offsetWidth || 280;
    const widgetHeight = widgetRef.current?.offsetHeight || 50;

    const newX = dragStartPosRef.current.initialPosX + deltaX;
    const newY = dragStartPosRef.current.initialPosY + deltaY;

    const clampedX = Math.max(8, Math.min(window.innerWidth - widgetWidth - 8, newX));
    const clampedY = Math.max(8, Math.min(window.innerHeight - widgetHeight - 8, newY));

    const newPos = { x: clampedX, y: clampedY };
    setPosition(newPos);
    positionRef.current = newPos;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      if (positionRef.current) {
        try {
          localStorage.setItem('suggest_changes_widget_pos', JSON.stringify(positionRef.current));
        } catch {}
      }
    }
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPosition(null);
    positionRef.current = null;
    try {
      localStorage.removeItem('suggest_changes_widget_pos');
    } catch {}
  };

  // Compute a descriptive selector for an element
  const getElementSelector = (el: HTMLElement): string => {
    const parts: string[] = [];
    let current: HTMLElement | null = el;
    let depth = 0;

    while (current && current !== document.body && depth < 3) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }
      if (current.dataset.component) {
        part += `[data-component="${current.dataset.component}"]`;
      } else if (current.className && typeof current.className === 'string') {
        const firstClass = current.className.split(' ').filter(c => c && !c.includes(':'))[0];
        if (firstClass) part += `.${firstClass}`;
      }
      parts.unshift(part);
      current = current.parentElement;
      depth++;
    }
    return parts.join(' > ');
  };

  // Inspect mode event listeners
  useEffect(() => {
    if (!isInspecting) {
      setHoveredBox(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore widget elements
      if (target.closest('#suggest-changes-widget-root') || target.closest('#suggest-changes-highlight-layer')) {
        setHoveredBox(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const text = (target.innerText || target.textContent || '').trim();
      const selector = getElementSelector(target);

      setHoveredBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        tag: target.tagName.toLowerCase(),
        selector,
        textSnippet: text.slice(0, 80)
      });
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('#suggest-changes-widget-root') || target.closest('#suggest-changes-highlight-layer')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const text = (target.innerText || target.textContent || '').trim();
      const selector = getElementSelector(target);

      setTargetNode(target);
      setTargetOriginalTextBackup(text);
      setSelectedTag(target.tagName.toLowerCase());
      setSelectedSelector(selector);
      setOriginalText(text);
      setSuggestedChange(text); // Pre-fill with current text for easy editing
      setIsInspecting(false);
      setHoveredBox(null);
      setIsModalOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInspecting(false);
        setHoveredBox(null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInspecting]);

  // Global shortcut (Alt + S)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setIsInspecting(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Handle live preview of text change
  const handleLivePreviewToggle = () => {
    if (!targetNode) return;
    if (isLivePreviewing) {
      targetNode.innerText = targetOriginalTextBackup;
      setIsLivePreviewing(false);
    } else {
      targetNode.innerText = suggestedChange;
      setIsLivePreviewing(true);
    }
  };

  // Revert DOM node on close
  const handleCloseModal = () => {
    if (targetNode && isLivePreviewing) {
      targetNode.innerText = targetOriginalTextBackup;
    }
    setIsLivePreviewing(false);
    setIsModalOpen(false);
  };

  // Format markdown prompt for the coding agent
  const generateAgentPrompt = (item: {
    category: string;
    targetTag: string;
    targetSelector: string;
    originalText: string;
    suggestedChange: string;
  }): string => {
    return [
      `### Browser UI Change Suggestion`,
      `- **Category**: ${item.category.toUpperCase()}`,
      `- **Target Element**: \`<${item.targetTag}>\` (\`${item.targetSelector}\`)`,
      `- **Current Text / State**:\n> "${item.originalText}"`,
      `- **Requested Change / Replacement**:\n> "${item.suggestedChange}"`,
      `- **App View**: \`${appMode}\``,
      `\nPlease inspect the corresponding component and apply this change.`
    ].join('\n');
  };

  // Copy current suggestion prompt to clipboard
  const handleCopyPrompt = async () => {
    const prompt = generateAgentPrompt({
      category,
      targetTag: selectedTag,
      targetSelector: selectedSelector,
      originalText,
      suggestedChange
    });

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedNotification('Prompt copied to clipboard! Paste into chat.');
    } catch {
      setCopiedNotification('Failed to copy to clipboard.');
    }
  };

  // Save to queue
  const handleSaveToQueue = async () => {
    setIsSaving(true);
    const payload = {
      targetTag: selectedTag,
      targetSelector: selectedSelector,
      originalText,
      suggestedChange,
      category,
      appMode,
      pageUrl: window.location.href
    };

    try {
      const res = await fetch('/api/suggest-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setSuggestions(prev => [...prev, data.item]);
        }
        setCopiedNotification('Saved to suggestions queue!');
        handleCloseModal();
      }
    } catch (err) {
      console.error(err);
      setCopiedNotification('Failed to save to queue.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete single item from queue
  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/suggest-changes?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuggestions(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear entire queue
  const handleClearAll = async () => {
    if (!window.confirm('Clear all suggestions from the queue?')) return;
    try {
      const res = await fetch('/api/suggest-changes', { method: 'DELETE' });
      if (res.ok) {
        setSuggestions([]);
        setCopiedNotification('Queue cleared.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy batch prompt of all suggestions
  const handleCopyAllBatchPrompt = async () => {
    if (suggestions.length === 0) return;

    const batchPrompt = [
      `### Batch Browser Suggestions for Coding Agent (${suggestions.length} items)`,
      `Please apply the following changes requested directly from the browser:`,
      '',
      ...suggestions.map((s, idx) => (
        `#### ${idx + 1}. [${s.category.toUpperCase()}] <${s.targetTag}> in \`${s.targetSelector}\`\n` +
        `- **Current Text**: "${s.originalText}"\n` +
        `- **Requested Change**: "${s.suggestedChange}"\n` +
        `- **Context / Mode**: \`${s.appMode || 'portal'}\`\n`
      )),
      '---',
      'Please update the codebase according to these suggestions.'
    ].join('\n');

    try {
      await navigator.clipboard.writeText(batchPrompt);
      setCopiedNotification(`Copied all ${suggestions.length} suggestions to clipboard!`);
    } catch {
      setCopiedNotification('Failed to copy batch prompt.');
    }
  };

  return (
    <>
      {/* Visual Highlight Overlay Layer when inspecting */}
      {isInspecting && hoveredBox && (
        <div
          id="suggest-changes-highlight-layer"
          className="fixed pointer-events-none z-[9999] transition-all duration-75 border-2 border-dashed border-indigo-400 bg-indigo-500/15 rounded shadow-lg backdrop-blur-[0.5px]"
          style={{
            top: `${hoveredBox.top}px`,
            left: `${hoveredBox.left}px`,
            width: `${hoveredBox.width}px`,
            height: `${hoveredBox.height}px`,
          }}
        >
          <div className="absolute -top-7 left-0 bg-indigo-600 text-white text-[11px] font-mono px-2 py-0.5 rounded shadow-md whitespace-nowrap flex items-center gap-1.5 pointer-events-none">
            <span className="font-bold">&lt;{hoveredBox.tag}&gt;</span>
            <span className="text-indigo-200 truncate max-w-[200px]">{hoveredBox.selector}</span>
          </div>
        </div>
      )}

      {/* Floating Widget Bar - Draggable anywhere on screen */}
      <div
        ref={widgetRef}
        id="suggest-changes-widget-root"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
        className={`fixed ${!position ? 'bottom-20 right-4' : ''} z-[9998] flex flex-col items-end gap-2 font-sans select-none touch-none ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
      >
        {/* Toast Alert */}
        {copiedNotification && (
          <div className="absolute -top-10 right-0 whitespace-nowrap bg-emerald-600 text-white text-xs px-3.5 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none">
            <Check className="w-4 h-4 text-emerald-200" />
            <span className="font-medium">{copiedNotification}</span>
          </div>
        )}

        {/* Main Floating Bar */}
        <div className="bg-white/95 border border-slate-200 text-slate-700 rounded-2xl shadow-sm backdrop-blur-md px-2.5 py-2 flex items-center gap-1.5 text-xs">
          {/* Drag Handle */}
          <div
            data-drag-handle
            onDoubleClick={handleResetPosition}
            title="Drag to move widget anywhere (Double-click to reset position)"
            className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-md transition-colors flex items-center shrink-0"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            title={isExpanded ? "Collapse Widget" : "Expand Widget"}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {isExpanded ? (
            <>
              {/* Inspector Button */}
              <button
                onClick={() => setIsInspecting(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all shadow-sm cursor-pointer ${
                  isInspecting 
                    ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/50' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Click any element on screen to suggest a change (Shortcut: Alt + S)"
              >
                {isInspecting ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Inspect</span>
                  </>
                ) : (
                  <>
                    <MousePointer className="w-3.5 h-3.5" />
                    <span>Suggest Changes</span>
                  </>
                )}
              </button>

              {/* Suggestions Queue Badge */}
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium border border-slate-700 transition-colors relative cursor-pointer"
                title="View recorded suggestions queue"
              >
                <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
                <span>Queue</span>
                {suggestions.length > 0 && (
                  <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {suggestions.length}
                  </span>
                )}
              </button>

              <span className="text-[10px] text-slate-400 border-l border-slate-700/80 pl-2 hidden sm:inline">
                Alt+S
              </span>
            </>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-1.5 font-medium text-slate-600 hover:text-blue-600 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Suggest</span>
              {suggestions.length > 0 && (
                <span className="bg-indigo-500 text-white text-[10px] px-1.5 rounded-full">
                  {suggestions.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Suggestion Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900/40 via-slate-800 to-slate-900 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-base">Suggest Change for Coding Agent</h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Target Details */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Target Element:</span>
                  <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-indigo-300 font-semibold">
                    &lt;{selectedTag}&gt;
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Selector:</span>
                  <span className="font-mono text-slate-300 truncate max-w-[280px]" title={selectedSelector}>
                    {selectedSelector}
                  </span>
                </div>
              </div>

              {/* Category Pills */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Category</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['copy', 'bug', 'ui', 'feature'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-1.5 px-2 rounded-lg font-medium text-center capitalize transition-colors cursor-pointer ${
                        category === cat 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {cat === 'copy' && '✍️ Copy'}
                      {cat === 'bug' && '🐛 Bug'}
                      {cat === 'ui' && '🎨 UI/Style'}
                      {cat === 'feature' && '💡 Feature'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Original Text */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Current Text / Content</label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 font-mono text-[11px] max-h-24 overflow-y-auto break-words">
                  {originalText || <span className="italic text-slate-500">(Empty or Non-text element)</span>}
                </div>
              </div>

              {/* Suggested Edit / Instructions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Your Suggested Change / Instructions</label>
                  {targetNode && (
                    <button
                      type="button"
                      onClick={handleLivePreviewToggle}
                      className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        isLivePreviewing 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Preview this replacement directly on the webpage"
                    >
                      {isLivePreviewing ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{isLivePreviewing ? 'Revert Preview' : 'Live Preview'}</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={suggestedChange}
                  onChange={(e) => setSuggestedChange(e.target.value)}
                  placeholder="Describe your change or write the exact text replacement..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y text-xs font-sans"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-850 px-5 py-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-3.5 py-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {/* Copy Prompt to Clipboard */}
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-medium transition-colors cursor-pointer"
                  title="Copies a formatted markdown prompt to paste into Antigravity chat"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy for Agent</span>
                </button>

                {/* Save to Backend Queue */}
                <button
                  type="button"
                  onClick={handleSaveToQueue}
                  disabled={isSaving || !suggestedChange.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium shadow-md transition-colors cursor-pointer"
                  title="Saves to scratch/suggested_changes.json"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save to Queue'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Drawer / Queue Viewer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 text-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white">Suggested Changes Queue ({suggestions.length})</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {suggestions.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <MessageSquarePlus className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="font-medium">No suggestions queued yet</p>
                  <p className="text-[11px]">Use "Suggest Changes" (Alt + S) to inspect and add changes.</p>
                </div>
              ) : (
                suggestions.map((item, idx) => (
                  <div 
                    key={item.id} 
                    className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-3 space-y-2 relative group hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-400">#{idx + 1}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 uppercase border border-indigo-800/50">
                          {item.category}
                        </span>
                        <span className="font-mono text-[11px] text-slate-300">
                          &lt;{item.targetTag}&gt;
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {item.originalText && (
                      <div className="bg-slate-950/70 rounded p-2 text-[11px] font-mono text-slate-400 truncate">
                        <span className="text-slate-500 font-sans mr-1">Orig:</span>
                        "{item.originalText}"
                      </div>
                    )}

                    <div className="text-slate-100 bg-indigo-950/20 border border-indigo-500/20 rounded p-2">
                      <span className="text-indigo-400 font-semibold mr-1">Change:</span>
                      {item.suggestedChange}
                    </div>

                    <div className="text-[10px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-700/40">
                      <span>Mode: {item.appMode || 'portal'}</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {suggestions.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-3 py-2 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllBatchPrompt}
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl shadow-md transition-colors cursor-pointer"
                  title="Copy all suggestions as a single prompt for the coding agent"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy All for Agent</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SuggestChangesWidget;
