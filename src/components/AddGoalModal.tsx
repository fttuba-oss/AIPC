import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { PotentialPracticeCategory, PracticeArea } from '../types/portal';
import { CATEGORY_DEFINITIONS } from '../utils/instrumentProfiles';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddArea: (newArea: PracticeArea) => void;
  initialMeasure?: number;
  maxMeasures?: number;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  isOpen,
  onClose,
  onAddArea,
  initialMeasure = 1,
  maxMeasures = 100
}) => {
  const [startMeasure, setStartMeasure] = useState<number>(initialMeasure);
  const [endMeasure, setEndMeasure] = useState<number>(initialMeasure);
  const [category, setCategory] = useState<PotentialPracticeCategory>('custom');
  const [goalText, setGoalText] = useState<string>(CATEGORY_DEFINITIONS['custom'].defaultGoal);
  const [targetTempo, setTargetTempo] = useState<number | undefined>(undefined);
  const [teacherNote, setTeacherNote] = useState<string>('');

  if (!isOpen) return null;

  const handleCategorySelect = (cat: PotentialPracticeCategory) => {
    setCategory(cat);
    setGoalText(CATEGORY_DEFINITIONS[cat].defaultGoal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `custom-${category}-${startMeasure}-${endMeasure}-${Date.now().toString(36)}`;
    const newArea: PracticeArea = {
      id,
      category,
      startMeasure: Math.min(startMeasure, endMeasure),
      endMeasure: Math.max(startMeasure, endMeasure),
      detectedReason: 'Teacher manually identified this area',
      defaultGoal: goalText,
      status: 'accepted',
      teacherGoal: goalText,
      teacherNote,
      targetTempo,
      isCustom: true
    };

    onAddArea(newArea);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Plus className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-wide">Add Teacher Goal</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Measure Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                From Bar:
              </label>
              <input
                type="number"
                min={1}
                max={maxMeasures}
                value={startMeasure}
                onChange={(e) => setStartMeasure(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                To Bar:
              </label>
              <input
                type="number"
                min={1}
                max={maxMeasures}
                value={endMeasure}
                onChange={(e) => setEndMeasure(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Practice Area Category:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(CATEGORY_DEFINITIONS).map(cat => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/30'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                    <span className="font-medium">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal Description */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Learning Goal:
            </label>
            <input
              type="text"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              placeholder="e.g. Secure clean note transitions and even pulse"
              required
            />
          </div>

          {/* Optional: Target Tempo & Teacher Note */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Tempo (Optional):
              </label>
              <input
                type="number"
                value={targetTempo || ''}
                onChange={(e) => setTargetTempo(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="e.g. 108"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Teacher Note (Optional):
              </label>
              <input
                type="text"
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                placeholder="e.g. Focus on air support"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all"
            >
              Add Goal to Practice Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
