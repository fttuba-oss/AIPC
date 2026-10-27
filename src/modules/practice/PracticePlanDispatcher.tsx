import { useEffect, useState, type FormEvent } from 'react';
import type { AppSession, PracticeGateway, ScoreReference, Student } from '../../contracts';

export function PracticePlanDispatcher({ scores, session, gateway }: { scores: ScoreReference[]; session: AppSession; gateway: PracticeGateway }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scoreId, setScoreId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [start, setStart] = useState(1), [end, setEnd] = useState(2);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const score = scores.find(s => s.id === scoreId) ?? scores[0];
  useEffect(() => { let active = true; gateway.students().then(value => { if (active) setStudents(value); }).catch(e => { if (active) setMessage(String(e)); }); return () => { active = false; }; }, [gateway]);
  async function send(e: FormEvent) {
    e.preventDefault(); if (!score || !selected.length) return;
    setBusy(true); setMessage('');
    let sent = 0;
    try {
      for (const studentId of selected) {
        const student = students.find(s => s.id === studentId)!;
        await gateway.dispatch({ teacherId: session.userId, title, score, studentId, studentName: student.name, instrumentName: student.instrument, range: [start, end], notes });
        sent++; setSelected(previous => previous.filter(id => id !== studentId));
      }
      setMessage(`Practice plan sent to ${sent} student${sent === 1 ? '' : 's'}.`);
    } catch (e) { setMessage(`${sent} sent. ${e instanceof Error ? e.message : String(e)} Remaining students are still selected.`); }
    finally { setBusy(false); }
  }
  return <section className="module-panel"><h2>Practice plan dispatcher</h2><p>Choose a score, define the task, and assign it to students.</p>
    <form onSubmit={e => void send(e)} className="plan-form"><label>Score<select aria-label="Plan score" value={score?.id ?? ''} onChange={e => setScoreId(e.target.value)} disabled={busy}>{scores.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    {!scores.length && <p>No scores available. Upload a score in the score files manager.</p>}
    <label>Plan title<input required value={title} onChange={e => setTitle(e.target.value)} disabled={busy} /></label>
    <div className="range-fields"><label>From bar<input type="number" min="1" required value={start} onChange={e => setStart(Number(e.target.value))} disabled={busy} /></label><label>To bar<input type="number" min={start} required value={end} onChange={e => setEnd(Number(e.target.value))} disabled={busy} /></label></div>
    <label>Instructions<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} disabled={busy} /></label>
    <fieldset disabled={busy}><legend>Assign to students</legend>{students.map(student => <label className="student-choice" key={student.id}><input type="checkbox" checked={selected.includes(student.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, student.id] : ids.filter(id => id !== student.id))} />{student.name} · {student.instrument}</label>)}</fieldset>
    <button className="primary" disabled={busy || !score || !selected.length}>{busy ? 'Sending…' : 'Dispatch practice plan'}</button><p role="status">{message}</p></form>
  </section>;
}
