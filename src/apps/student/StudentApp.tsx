import { useEffect, useState } from 'react';
import type { AppSession, PracticeGateway, ScoreSelection } from '../../contracts';
import { ScoreViewer } from '../../modules/score';
import { PracticePlanManager, httpPracticeGateway } from '../../modules/practice';
import { AppShell } from '../AppShell';
const tabs = [{ id: 'plans', label: 'Practice plan manager' }, { id: 'viewer', label: 'Score viewer' }];
export function StudentApp({ session, practiceGateway = httpPracticeGateway }: { session: AppSession; practiceGateway?: PracticeGateway }) {
 const [active, setActive] = useState('plans');
 const [selection, setSelection] = useState<ScoreSelection | null>(null);
 useEffect(() => { setSelection(null); setActive('plans'); }, [session.userId]);
 const openScore = (value: ScoreSelection) => { setSelection(value); setActive('viewer'); };
 if (session.role !== 'student') return <p role="alert">Student access required.</p>;
 return <AppShell session={session} tabs={tabs} active={active} onNavigate={setActive}>
 {active === 'plans' && <PracticePlanManager key={session.userId} session={session} gateway={practiceGateway} onOpenScore={openScore} />}
 {active === 'viewer' && <ScoreViewer selection={selection} />}</AppShell>;
}
