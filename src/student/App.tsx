import React, { useState, useEffect } from 'react';
import type { StoredExercise, StudentProfile, MusicalSection, PracticeArea } from '../types/portal';
import { StudentExerciseInbox } from './components/StudentExerciseInbox';
import { StudentPracticeView } from '../components/StudentPracticeView';
import { unpackMusicXml, parseMusicXmlToScore } from '../utils/scoreParser';

export const StudentApp: React.FC = () => {
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile>({
    id: 'stud_sarah',
    name: 'Sarah Lin',
    instrument: 'Flute 2',
    grade: 'Grade 8'
  });
  const [activeExercise, setActiveExercise] = useState<StoredExercise | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [activeMusicalSection, setActiveMusicalSection] = useState<MusicalSection | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState<boolean>(false);

  // Open a score straight from a practice plan: the whole piece, no preset goals
  const BUILTIN_PATHS: Record<string, string> = {
    danxia: '/beautiful_danxia_flutes.musicxml',
    whales: '/sailing-with-whales-rossano-galante.mxl',
    neruda: '/neruda_trumpet_concerto_excerpt.musicxml',
  };
  const openScoreFromPlan = async (scoreId: string, scoreTitle: string) => {
    const path = BUILTIN_PATHS[scoreId] || `/api/storage/scores/${encodeURIComponent(scoreId)}/xml`;
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await unpackMusicXml(await resp.arrayBuffer());
      const parsed = parseMusicXmlToScore(xml);
      const lastBar = Math.max(1, ...parsed.parts.map(p => p.measures[p.measures.length - 1]?.measureNumber || 1));
      setActiveExercise({
        id: `plan_${scoreId}`,
        title: scoreTitle,
        scoreTitle,
        scorePath: path,
        instrumentId: selectedStudent.instrument.toLowerCase(),
        instrumentName: selectedStudent.instrument,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        assignedDate: new Date().toISOString(),
        status: 'in_progress',
        section: { sectionNumber: 1, title: `Full score (Bars 1\u2013${lastBar})`, startMeasure: 1, endMeasure: lastBar, goals: [] },
      } as StoredExercise);
    } catch (err) {
      console.error('Could not open score from plan:', err);
    }
  };
  // When an exercise is selected, load its score XML and build a MusicalSection
  useEffect(() => {
    if (!activeExercise) {
      setXmlContent(null);
      setActiveMusicalSection(null);
      return;
    }

    const loadScore = async () => {
      setIsLoadingScore(true);
      try {
        const resp = await fetch(activeExercise.scorePath);
        if (!resp.ok) throw new Error(`Failed to fetch score file: ${resp.statusText}`);
        const text = await unpackMusicXml(await resp.arrayBuffer());
        setXmlContent(text);

        // Convert StoredExercise section to MusicalSection
        const exSec = activeExercise.section;
        const challenges: PracticeArea[] = (exSec.goals || []).map((g, idx) => ({
          id: g.areaId || `goal_${idx}_${Date.now()}`,
          category: (g.category as any) || 'custom',
          startMeasure: g.startMeasure,
          endMeasure: g.endMeasure,
          detectedReason: g.teacherNote || g.goal,
          defaultGoal: g.goal,
          status: 'accepted',
          teacherGoal: g.goal,
          teacherNote: g.teacherNote || '',
          targetTempo: g.targetTempo,
        }));

        const sectionObj: MusicalSection = {
          id: exSec.id || `sec_${exSec.sectionNumber}`,
          sectionNumber: exSec.sectionNumber,
          title: exSec.title || `Section ${exSec.sectionNumber} (Bars ${exSec.startMeasure}–${exSec.endMeasure})`,
          startMeasure: exSec.startMeasure,
          endMeasure: exSec.endMeasure,
          totalMeasures: exSec.endMeasure - exSec.startMeasure + 1,
          challenges,
          status: 'all_approved'
        };

        setActiveMusicalSection(sectionObj);
      } catch (err) {
        console.error('Error loading exercise score XML:', err);
      } finally {
        setIsLoadingScore(false);
      }
    };

    loadScore();
  }, [activeExercise]);

  if (activeExercise && activeMusicalSection && !isLoadingScore) {
    return (
      <StudentPracticeView
        xmlUrl={activeExercise.scorePath}
        xmlContent={xmlContent}
        pieceTitle={activeExercise.scoreTitle}
        instrumentName={activeExercise.instrumentName}
        sectionId={activeMusicalSection.id}
        sectionTitle={activeMusicalSection.title}
        measureRange={[activeMusicalSection.startMeasure, activeMusicalSection.endMeasure]}
        sections={[activeMusicalSection]}
        activeSection={activeMusicalSection}
        exerciseId={activeExercise.id}
        studentId={selectedStudent.id}
        studentName={selectedStudent.name}
        onExit={() => setActiveExercise(null)}
      />
    );
  }

  return (
    <StudentExerciseInbox
      selectedStudent={selectedStudent}
      onSelectStudent={(st) => setSelectedStudent(st)}
      onSelectExercise={(ex) => setActiveExercise(ex)}
      onOpenScore={openScoreFromPlan}
    />
  );
};

export default StudentApp;
