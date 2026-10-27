import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ScoreSelection } from '../../contracts';
import { createMemoryPracticeGateway, fixtureScore } from '../../contracts/testing';
import { PracticePlanDispatcher, PracticePlanManager, StudentProgressDashboard } from './index';
import '../../index.css';
import '../../shared/styles.css';
const gateway = createMemoryPracticeGateway();
const teacher = { userId: 'fixture_teacher', displayName: 'Demo teacher', role: 'teacher' as const };
const student = { userId: 'fixture_student', displayName: 'Demo student', role: 'student' as const };
function PracticeWorkbench() {
 const [opened, setOpened] = useState<ScoreSelection | null>(null);
 return <main className="role-app app-content"><h1>Practice developer workbench</h1><p role="status">{opened ? `Viewer callback: ${opened.score.title}, bars ${opened.range?.join('–')}` : 'Score viewer is replaced by a callback recorder.'}</p><PracticePlanDispatcher scores={[fixtureScore]} session={teacher} gateway={gateway} /><PracticePlanManager session={student} gateway={gateway} onOpenScore={setOpened} /><StudentProgressDashboard session={teacher} gateway={gateway} onOpenScore={setOpened} /></main>;
}
createRoot(document.getElementById('root')!).render(<PracticeWorkbench />);
