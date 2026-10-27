import type { AppSession, PracticeGateway, ScoreSelection } from '../../contracts';
import { usePlans } from './usePlans';
export function StudentProgressDashboard({ session, gateway, onOpenScore }: { session: AppSession; gateway: PracticeGateway; onOpenScore: (selection: ScoreSelection) => void }) {
  const { plans, error, refresh } = usePlans(gateway, { teacherId: session.userId });
  const done = plans.filter(plan => plan.status === 'completed').length;
  return <section className="module-panel"><h2>Student progress dashboard</h2><p>Student updates refresh every 3 seconds. {done} of {plans.length} assignments completed.</p><button onClick={() => void refresh()}>Refresh progress</button>
    {error && <p role="alert">{error}</p>}
    <ul className="module-list">{plans.map(plan => <li key={plan.id}><div><strong>{plan.studentName} · {plan.title}</strong><p>{plan.score.title} · Bars {plan.range.join('–')}</p><span className={`status ${plan.status}`}>{plan.status === 'completed' ? 'Done' : plan.status === 'in_progress' ? 'In progress' : 'Not done'}</span></div><button onClick={() => onOpenScore({ score: plan.score, range: plan.range, instrumentName: plan.instrumentName })}>Open score</button></li>)}</ul>
    {!plans.length && !error && <p>No practice plans dispatched yet.</p>}
  </section>;
}
