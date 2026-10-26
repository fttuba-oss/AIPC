import React, { useState, useEffect } from 'react';
import { 
  Calendar, Music, Users, BookOpen, Clock, ArrowRight, 
  Sparkles, CheckCircle2, Play, Plus, Download, ChevronRight,
  Filter, Search, ExternalLink
} from 'lucide-react';
import type { StoredExercise, StudentProfile } from '../types/portal';
import { fetchExercisesFromStorage, fetchStudentsFromStorage } from '../utils/studentRecordingManager';

export interface PracticePlansTabProps {
  onOpenScoreForPassage: (pieceId: string, range: [number, number]) => void;
  onLaunchPractice: (exercise: StoredExercise) => void;
  onViewSubmissions: (planTitle?: string) => void;
  onOpenExportModal: () => void;
  onCreateNewPlan: () => void;
}

export const PracticePlansTab: React.FC<PracticePlansTabProps> = ({
  onOpenScoreForPassage,
  onLaunchPractice,
  onViewSubmissions,
  onOpenExportModal,
  onCreateNewPlan,
}) => {
  const [exercises, setExercises] = useState<StoredExercise[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allEx, roster] = await Promise.all([
        fetchExercisesFromStorage(),
        fetchStudentsFromStorage(),
      ]);
      setExercises(allEx || []);
      setStudents(roster || []);
    } catch (e) {
      console.error('Failed to load practice plans:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Curated master plan templates and real batch plans
  const masterPlans = React.useMemo(() => {
    const plans: Array<{
      id: string;
      title: string;
      pieceTitle: string;
      pieceId: string;
      passageRange: [number, number];
      targetGroup: string;
      studentCount: number;
      primaryGoal: string;
      exercises: string[];
      assignedDate: string;
      status: 'active' | 'completed';
      sampleExercise?: StoredExercise;
    }> = [
      {
        id: 'plan_danxia_flutes_27_28',
        title: 'Danxia Flute & Clarinet Syncopation Rehearsal',
        pieceTitle: 'Beautiful Danxia (Li Wei, 2023)',
        pieceId: 'danxia',
        passageRange: [27, 28],
        targetGroup: 'Flutes & Clarinets',
        studentCount: 14,
        primaryGoal: 'Lock into 8th/16th subdivision clicks and anchor syncopations without rushing bar 28.',
        exercises: ['Syncopation builder (72 → 96 bpm)', 'Articulation control (Staccato quavers)', 'Dynamic contrast (p to mp)'],
        assignedDate: 'Sep 21, 2026',
        status: 'active',
      },
      {
        id: 'plan_whales_woodwinds_47_48',
        title: 'Galante Syncopation Builder & Rhythmic Pulse',
        pieceTitle: 'Sailing with Whales (Rossano Galante)',
        pieceId: 'whales',
        passageRange: [47, 48],
        targetGroup: 'Woodwinds Section',
        studentCount: 18,
        primaryGoal: 'Keep the off-beat quavers steady against the pulse without anticipating beat 3.',
        exercises: ['Syncopation builder (72 → 96 bpm)', 'Off-beat anchor drill', 'Ensemble minus-one run'],
        assignedDate: 'Sep 18, 2026',
        status: 'active',
      },
      {
        id: 'plan_neruda_brass_6_10',
        title: 'Neruda Rapid Tonguing & Rhythm Precision',
        pieceTitle: 'Trumpet Concerto in E-flat (J.B.G. Neruda)',
        pieceId: 'neruda',
        passageRange: [6, 10],
        targetGroup: 'Brass Section',
        studentCount: 10,
        primaryGoal: 'Keep 16th-note double tonguing crisp, light, and forward-placed.',
        exercises: ['Rapid double tonguing drill', 'Subdivision lock', 'Tempo acceleration ladder'],
        assignedDate: 'Sep 15, 2026',
        status: 'active',
      }
    ];

    // Merge any dynamically created batch exercises from storage
    exercises.forEach(ex => {
      if (ex.id.startsWith('batch_')) {
        const sec = ex.section;
        plans.unshift({
          id: ex.id,
          title: ex.title,
          pieceTitle: ex.scoreTitle,
          pieceId: ex.scorePath.includes('danxia') ? 'danxia' : ex.scorePath.includes('neruda') ? 'neruda' : 'whales',
          passageRange: [sec.startMeasure, sec.endMeasure],
          targetGroup: ex.instrumentName,
          studentCount: ex.instrumentName.includes('Band') ? 28 : ex.instrumentName.includes('Woodwinds') ? 18 : 14,
          primaryGoal: sec.goals?.[0]?.goal || 'Rehearsal precision drill',
          exercises: sec.goals?.map(g => g.goal) || ['Syncopation builder'],
          assignedDate: new Date(ex.assignedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'active',
          sampleExercise: ex
        });
      }
    });

    return plans;
  }, [exercises]);

  const filteredPlans = masterPlans.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.pieceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.targetGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f5f5f7] overflow-y-auto select-none p-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Practice Plans & Repertoire Assignments
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Assigned practice modules, targeted rehearsal passages, and section drills across the NUS Wind Symphony.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-colors cursor-pointer"
            title="Export / Print comprehensive practice plan"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Plan</span>
          </button>

          <button
            onClick={onCreateNewPlan}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Plan</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Active Practice Plans
          </div>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>{masterPlans.length}</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              In Rotation
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Targeted Musicians
          </div>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>28 Musicians</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              4 Sections
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Submissions Received
          </div>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>12 Takes</span>
            <button
              onClick={() => onViewSubmissions()}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Review inbox →
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search plans by title, piece, section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 shadow-2xs transition-colors"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredPlans.length} plans
        </div>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {filteredPlans.map(plan => (
          <div
            key={plan.id}
            className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Bars {plan.passageRange[0]}–{plan.passageRange[1]}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {plan.targetGroup} · {plan.studentCount} students
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Assigned: {plan.assignedDate}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {plan.title}
                </h3>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Music className="w-3.5 h-3.5 text-blue-600" />
                  <span>{plan.pieceTitle}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">Practice Goal: </strong>
                  {plan.primaryGoal}
                </div>

                {/* Exercises list */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {plan.exercises.map((ex, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs"
                    >
                      🎯 {ex}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions Right Side */}
              <div className="flex md:flex-col gap-2 shrink-0 self-end md:self-start">
                <button
                  onClick={() => {
                    const fallbackEx: StoredExercise = plan.sampleExercise || {
                      id: `plan_ex_${plan.id}`,
                      title: plan.title,
                      scoreTitle: plan.pieceTitle,
                      scorePath: plan.pieceId === 'danxia' 
                        ? '/beautiful_danxia_flutes.musicxml' 
                        : plan.pieceId === 'neruda' 
                        ? '/neruda_trumpet_concerto_excerpt.musicxml' 
                        : '/sailing_with_whales_trumpet1.musicxml',
                      instrumentId: 'woodwinds',
                      instrumentName: plan.targetGroup,
                      studentId: 'stud_sarah',
                      studentName: 'Sarah Lin',
                      assignedDate: new Date().toISOString(),
                      status: 'assigned',
                      section: {
                        sectionNumber: 1,
                        title: `Rehearsal Passage (Bars ${plan.passageRange[0]}–${plan.passageRange[1]})`,
                        startMeasure: plan.passageRange[0],
                        endMeasure: plan.passageRange[1],
                        goals: [
                          {
                            category: 'complex_rhythm',
                            measureRange: `Bars ${plan.passageRange[0]}–${plan.passageRange[1]}`,
                            startMeasure: plan.passageRange[0],
                            endMeasure: plan.passageRange[1],
                            goal: plan.primaryGoal,
                            targetTempo: 96,
                          }
                        ]
                      }
                    };
                    onLaunchPractice(fallbackEx);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-blue-200/80 shadow-2xs"
                  title="Test how students practice this plan with minus-one backing track"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Test as Student</span>
                </button>

                <button
                  onClick={() => onOpenScoreForPassage(plan.pieceId, plan.passageRange)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200/90 transition-colors cursor-pointer shadow-2xs"
                  title="Open this score passage in the Conductor Sheet Music Canvas"
                >
                  <Music className="w-3.5 h-3.5 text-slate-500" />
                  <span>Open in Score</span>
                </button>

                <button
                  onClick={() => onViewSubmissions(plan.title)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200/90 transition-colors cursor-pointer shadow-2xs"
                  title="View recorded student takes for this plan"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Submissions</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
