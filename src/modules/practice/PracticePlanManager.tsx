import { useState } from 'react';
import type { AppSession, PracticeGateway, PracticePlan, ScoreSelection } from '../../contracts';
import { usePlans } from './usePlans';
export function PracticePlanManager({ session, gateway, onOpenScore }: { session: AppSession; gateway: PracticeGateway; onOpenScore: (selection: ScoreSelection) => void }) {
  const { plans, error, refresh } = usePlans(gateway, { studentId: session.userId });
  const [failure, setFailure] = useState(''), [busy, setBusy] = useState<string | null>(null);
  async function toggle(plan: PracticePlan) {
    setBusy(plan.id); setFailure('');
    try { await gateway.setStatus(plan.id, session.userId, plan.status === 'completed' ? 'assigned' : 'completed'); await refresh(); }
    catch (e) { setFailure(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }
  return <section className="module-panel"><h2>Practice plan manager</h2><p>All your assigned plans. Mark each one done when you finish, or mark it not done to revisit it.</p>
    {(failure || error) && <p role="alert">{failure || error}</p>}
    <ul className="module-list">{plans.map(plan => <li key={plan.id}><div><strong>{plan.title}</strong><p>{plan.score.title} · Bars {plan.range.join('–')} · {new Date(plan.assignedAt).toLocaleDateString()}</p><p className="plan-notes">{plan.notes}</p><span className={`status ${plan.status}`}>{plan.status === 'completed' ? 'Done' : 'Not done'}</span></div><div className="card-actions"><button onClick={() => onOpenScore({ score: plan.score, range: plan.range, instrumentName: plan.instrumentName })}>Open score</button><button disabled={busy !== null} onClick={() => void toggle(plan)}>{busy === plan.id ? 'Saving…' : plan.status === 'completed' ? 'Mark not done' : 'Mark done'}</button></div></li>)}</ul>
    {!plans.length && !error && <p>No practice plans assigned to you yet.</p>}
  </section>;
}
