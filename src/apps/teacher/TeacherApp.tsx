import { useState } from 'react';
import type { AppSession, PracticeGateway, ScoreGateway, ScoreSelection } from '../../contracts';
import { ScoreFilesManager, ScoreViewer, useScoreCatalog } from '../../modules/score';
import { PracticePlanDispatcher, StudentProgressDashboard, httpPracticeGateway } from '../../modules/practice';
import { AppShell } from '../AppShell';
const tabs = [{ id: 'files', label: 'Score files manager' }, { id: 'viewer', label: 'Score viewer' }, { id: 'dispatch', label: 'Practice plan dispatcher' }, { id: 'progress', label: 'Student progress dashboard' }];
export function TeacherApp({ session, practiceGateway = httpPracticeGateway, scoreGateway }: { session: AppSession; practiceGateway?: PracticeGateway; scoreGateway?: ScoreGateway }) {
 const [active, setActive] = useState('files');
 const [selection, setSelection] = useState<ScoreSelection | null>(null);
 const catalog = useScoreCatalog(scoreGateway);
 const openScore = (value: ScoreSelection) => { setSelection(value); setActive('viewer'); };
 if (session.role !== 'teacher') return <p role="alert">Teacher access required.</p>;
 return <AppShell session={session} tabs={tabs} active={active} onNavigate={setActive}>
 {active === 'files' && <ScoreFilesManager catalog={catalog} onOpenScore={openScore} />}
 {active === 'viewer' && <ScoreViewer selection={selection} />}
 {active === 'dispatch' && <>{catalog.error && <p role="alert">{catalog.error}</p>}<PracticePlanDispatcher scores={catalog.scores} session={session} gateway={practiceGateway} /></>}
 {active === 'progress' && <StudentProgressDashboard session={session} gateway={practiceGateway} onOpenScore={openScore} />}
 </AppShell>;
}
