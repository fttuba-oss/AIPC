import React, { useState, useRef } from 'react';
import { 
  Check, Edit3, Trash2, Plus, Sparkles, 
  Zap, Flame, ChevronsUp, 
  Clock, TrendingUp, PenTool, CheckCircle2, RotateCcw, FileText,
  ListChecks, Play
} from 'lucide-react';
import { PracticeArea, PotentialPracticeCategory, MusicalSection } from '../../contracts/portal';
import { CATEGORY_DEFINITIONS } from '../../modules/score/engine/instrumentProfiles';
import { TeacherHandoffModal } from '../strategies/components/TeacherHandoffModal';
import type { TeacherHandoffRecord } from '../strategies/classifications/rhythm/types/diagnosticProfile';

interface TeacherReviewPanelProps {
  sections: MusicalSection[];
  selectedAreaId: string | null;
  selectedSectionId: string | null;
  onSelectArea: (areaId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onAcceptGoal: (areaId: string) => void;
  onAcceptAllInSection: (sectionId: string) => void;
  onEditGoal: (areaId: string, updatedGoal: string, targetTempo?: number, teacherNote?: string) => void;
  onRemoveGoal: (areaId: string) => void;
  onRestoreGoal: (areaId: string) => void;
  onOpenAddModal: () => void;
  onGeneratePlan: () => void;
  onLaunchStudentPractice?: (section: MusicalSection) => void;
  acceptedCount: number;
  totalChallengesCount: number;
}

export const TeacherReviewPanel: React.FC<TeacherReviewPanelProps> = ({
  sections,
  selectedAreaId,
  selectedSectionId,
  onSelectArea,
  onSelectSection,
  onAcceptGoal,
  onAcceptAllInSection,
  onEditGoal,
  onRemoveGoal,
  onRestoreGoal,
  onOpenAddModal,
  onGeneratePlan,
  onLaunchStudentPractice,
  acceptedCount,
  totalChallengesCount
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted'>('all');
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const reviewContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll review container when selectedSectionId or selectedAreaId changes
  React.useEffect(() => {
    if (selectedAreaId) {
      const areaEl = document.getElementById(`challenge-card-${selectedAreaId}`);
      if (areaEl) {
        areaEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }
    if (selectedSectionId) {
      const secEl = document.getElementById(`section-card-${selectedSectionId}`);
      if (secEl) {
        secEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedSectionId, selectedAreaId]);

  // Form states for in-progress edit
  const [draftGoal, setDraftGoal] = useState<string>('');
  const [draftTempo, setDraftTempo] = useState<number | undefined>(undefined);
  const [draftNote, setDraftNote] = useState<string>('');

  // Diagnostic Handoff State
  const [selectedHandoff, setSelectedHandoff] = useState<TeacherHandoffRecord | null>(null);
  const [handoffsList, setHandoffsList] = useState<TeacherHandoffRecord[]>(() => {
    try {
      const raw = localStorage.getItem('aipc_teacher_handoff_records');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Periodically refresh handoffs from localStorage
  React.useEffect(() => {
    const checkHandoffs = () => {
      try {
        const raw = localStorage.getItem('aipc_teacher_handoff_records');
        if (raw) setHandoffsList(JSON.parse(raw));
      } catch {}
    };
    checkHandoffs();
    window.addEventListener('storage', checkHandoffs);
    return () => window.removeEventListener('storage', checkHandoffs);
  }, []);

  const handleStartEdit = (area: PracticeArea) => {
    setEditingAreaId(area.id);
    setDraftGoal(area.teacherGoal || area.defaultGoal);
    setDraftTempo(area.targetTempo);
    setDraftNote(area.teacherNote || '');
  };

  const handleSaveEdit = (areaId: string) => {
    onEditGoal(areaId, draftGoal, draftTempo, draftNote);
    setEditingAreaId(null);
  };

  const handleCancelEdit = () => {
    setEditingAreaId(null);
  };

  const getCategoryIcon = (category: PotentialPracticeCategory) => {
    switch (category) {
      case 'fast_notes': return <Zap className="w-3.5 h-3.5 text-cyan-400" />;
      case 'fast_tonguing': return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'extreme_register': return <ChevronsUp className="w-3.5 h-3.5 text-rose-400" />;
      case 'complex_rhythm': return <Clock className="w-3.5 h-3.5 text-purple-400" />;
      case 'leaps': return <TrendingUp className="w-3.5 h-3.5 text-blue-400" />;
      default: return <PenTool className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/95 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-white tracking-wide">Teacher Pedagogical Review</h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Segmented in practice chunks • Chronological challenges nested per section
          </p>
        </div>

        <div className="flex items-center gap-2">
          {handoffsList.length > 0 && (
            <button
              onClick={() => setSelectedHandoff(handoffsList[0])}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/40 transition-all shadow-sm cursor-pointer active:scale-95"
              title="View Autonomous Diagnostic Handoff Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{handoffsList.length} Diagnostic Handoff{handoffsList.length > 1 ? 's' : ''}</span>
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg text-xs font-medium border border-indigo-500/30 hover:border-indigo-500/60 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom Goal
          </button>
        </div>
      </div>


      {/* Section Checklist Horizontal Scroller / Bar */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ListChecks className="w-3 h-3 text-indigo-400" />
            Section Checklist ({sections.length} Chunks)
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {acceptedCount} of {totalChallengesCount} Goals Approved
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {sections.map(section => {
            const isSelected = selectedSectionId === section.id;
            const nonRemoved = section.challenges.filter(c => c.status !== 'removed');
            const approved = nonRemoved.filter(c => c.status === 'accepted' || c.status === 'edited');
            const isAllApproved = nonRemoved.length > 0 && approved.length === nonRemoved.length;

            return (
              <button
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                  isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400' 
                    : isAllApproved
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/40 hover:border-emerald-500'
                    : 'bg-slate-800/70 text-slate-300 border-slate-700/70 hover:bg-slate-700/70 hover:text-white'
                }`}
              >
                {isAllApproved ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                )}
                <span>Sec {section.sectionNumber}</span>
                <span className="text-[10px] opacity-75 font-mono">
                  (m.{section.startMeasure}–{section.endMeasure})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 text-xs">
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filter === 'all' 
                ? 'bg-slate-800 text-white border border-slate-700' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Challenges
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filter === 'pending' 
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('accepted')}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              filter === 'accepted' 
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Approved ({acceptedCount})
          </button>
        </div>
      </div>

      {/* Sections and Nested Challenges List */}
      <div ref={reviewContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 mb-2 text-slate-600" />
            <p className="text-xs font-medium">No sections detected in this piece</p>
          </div>
        ) : (
          sections.map(section => {
            const isSectionFocused = selectedSectionId === section.id;
            const nonRemoved = section.challenges.filter(c => c.status !== 'removed');
            const approved = nonRemoved.filter(c => c.status === 'accepted' || c.status === 'edited');
            const isAllApproved = nonRemoved.length > 0 && approved.length === nonRemoved.length;

            const visibleChallenges = section.challenges.filter(c => {
              if (filter === 'accepted') return c.status === 'accepted' || c.status === 'edited';
              if (filter === 'pending') return c.status === 'suggested';
              return true;
            });

            if (visibleChallenges.length === 0 && filter !== 'all') {
              return null;
            }

            return (
              <div 
                key={section.id} 
                id={`section-card-${section.id}`}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isSectionFocused 
                    ? 'bg-slate-800/80 border-indigo-500/80 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/40' 
                    : isAllApproved
                    ? 'bg-emerald-950/20 border-emerald-700/40'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                {/* Section Chunk Header */}
                <div 
                  onClick={() => onSelectSection(section.id)}
                  className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between cursor-pointer hover:bg-slate-950/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-white bg-indigo-600/30 px-2 py-0.5 rounded border border-indigo-500/40">
                      Section {section.sectionNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      Bars {section.startMeasure}–{section.endMeasure}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({section.totalMeasures} bars)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Accept All In Section Button */}
                    {nonRemoved.length > 0 && !isAllApproved && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcceptAllInSection(section.id);
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/30 px-2.5 py-1 rounded-md border border-emerald-500/30 transition-all"
                      >
                        <Check className="w-3 h-3" />
                        Accept Section
                      </button>
                    )}

                    {isAllApproved && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                        <Check className="w-3 h-3" /> Section Complete
                      </span>
                    )}

                    {/* Launch Student Practice Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLaunchStudentPractice?.(section);
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/35 px-2.5 py-1 rounded-md border border-amber-500/40 hover:border-amber-400 transition-all shadow-xs"
                      title="Launch Student Practice mode for this section"
                    >
                      <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span>Practice Section</span>
                    </button>
                  </div>
                </div>

                {/* Nested Chronological Challenges */}
                <div className="p-3 space-y-2.5">
                  {section.challenges.length === 0 ? (
                    <p className="text-xs text-slate-500 italic px-2 py-1">
                      No potential technical challenges flagged in this chunk.
                    </p>
                  ) : (
                    visibleChallenges.map(area => {
                      const meta = CATEGORY_DEFINITIONS[area.category];
                      const isSelected = area.id === selectedAreaId;
                      const isEditing = area.id === editingAreaId;
                      const isRemoved = area.status === 'removed';
                      const isApproved = area.status === 'accepted' || area.status === 'edited';

                      return (
                        <div
                          key={area.id}
                          id={`challenge-card-${area.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectArea(area.id);
                          }}
                          className={`rounded-xl border p-3 transition-all duration-200 ${
                            isRemoved 
                              ? 'opacity-40 bg-slate-900/30 border-slate-800' 
                              : isSelected
                              ? 'bg-slate-800 border-indigo-400 shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400'
                              : isApproved
                              ? 'bg-slate-900/80 border-emerald-600/30 hover:border-emerald-500/50'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Top Row: Chronological Measure & Category Tag */}
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700/60">
                                {area.startMeasure === area.endMeasure ? `Bar ${area.startMeasure}` : `Bars ${area.startMeasure}–${area.endMeasure}`}
                              </span>
                              <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-semibold ${meta.badgeBg} ${meta.badgeText} ${meta.borderColor}`}>
                                {getCategoryIcon(area.category)}
                                <span>{meta.name}</span>
                              </div>
                            </div>

                            {/* Status */}
                            <div>
                              {isRemoved ? (
                                <span className="text-[9px] text-rose-400 font-mono">Removed</span>
                              ) : isApproved ? (
                                <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  <Check className="w-2.5 h-2.5" /> Approved
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Detected Reason */}
                          <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                            {area.detectedReason}
                          </p>

                          {/* Inline Edit Form vs Normal View */}
                          {isEditing ? (
                            <div className="space-y-2 mt-2 pt-2 border-t border-slate-700/60" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-400 mb-1">
                                  Pedagogical Goal:
                                </label>
                                <textarea
                                  value={draftGoal}
                                  onChange={(e) => setDraftGoal(e.target.value)}
                                  rows={2}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                                    Target Tempo (BPM):
                                  </label>
                                  <input
                                    type="number"
                                    value={draftTempo ?? ''}
                                    onChange={(e) => setDraftTempo(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="Optional BPM"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                                    Teacher Note:
                                  </label>
                                  <input
                                    type="text"
                                    value={draftNote}
                                    onChange={(e) => setDraftNote(e.target.value)}
                                    placeholder="Private note"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(area.id)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold"
                                >
                                  Save Goal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {/* Goal Content */}
                              <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800/80 mb-2">
                                <div className="text-xs font-medium text-slate-200 flex items-start justify-between">
                                  <span>{area.teacherGoal || area.defaultGoal}</span>
                                </div>

                                {area.targetTempo && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                                    <span>Target Tempo: ♩ = {area.targetTempo} BPM</span>
                                  </div>
                                )}

                                {area.teacherNote && (
                                  <div className="mt-1 text-[10px] text-amber-300 italic border-t border-slate-800/60 pt-1">
                                    Note: {area.teacherNote}
                                  </div>
                                )}
                              </div>

                              {/* Card Action Buttons */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleStartEdit(area)}
                                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>

                                  {isRemoved ? (
                                    <button
                                      onClick={() => onRestoreGoal(area.id)}
                                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Restore</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onRemoveGoal(area.id)}
                                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Dismiss</span>
                                    </button>
                                  )}
                                </div>

                                {!isRemoved && !isApproved && (
                                  <button
                                    onClick={() => onAcceptGoal(area.id)}
                                    className="flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all shadow-xs"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Accept</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Generate Plan Button */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between">
        <div className="text-xs">
          <span className="font-semibold text-white">{acceptedCount}</span>
          <span className="text-slate-400"> of {totalChallengesCount} challenges approved</span>
        </div>

        <button
          onClick={onGeneratePlan}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
        >
          <FileText className="w-4 h-4" />
          <span>Generate Practice Plan</span>
        </button>
      </div>
      {/* Teacher Handoff Modal */}
      {selectedHandoff && (
        <TeacherHandoffModal
          record={selectedHandoff}
          isOpen={!!selectedHandoff}
          onClose={() => setSelectedHandoff(null)}
        />
      )}
    </div>
  );
};
