import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppSession, PracticeGateway, ScoreGateway, Student } from '../contracts';
import { TeacherApp } from './teacher/TeacherApp';
import { StudentApp } from './student/StudentApp';
import { httpPracticeGateway } from '../modules/practice';
import '../index.css';
import '../shared/styles.css';
declare global { interface Window { __AIPC_SESSION__?: AppSession } }
export interface MountOptions { session: AppSession; practiceGateway?: PracticeGateway; scoreGateway?: ScoreGateway }
/** Login hosts supply a session; pair this with a server-side SessionResolver. */
export function mountTeacherApp(element: HTMLElement, options: MountOptions) {
 const root = createRoot(element); root.render(<StrictMode><TeacherApp {...options} /></StrictMode>); return () => root.unmount();
}
export function mountStudentApp(element: HTMLElement, options: Omit<MountOptions, 'scoreGateway'>) {
 const root = createRoot(element); root.render(<StrictMode><StudentApp {...options} /></StrictMode>); return () => root.unmount();
}
function StudentDemo() {
 const [students, setStudents] = useState<Student[]>([]), [studentId, setStudentId] = useState('');
 const [error, setError] = useState('');
 useEffect(() => { httpPracticeGateway.students().then(students => { setStudents(students); setStudentId(students[0]?.id ?? ''); }).catch(e => setError(String(e))); }, []);
 const student = students.find(s => s.id === studentId);
 return <><div className="demo-banner"><strong>Local demo</strong><label>Student<select aria-label="Demo student" value={studentId} onChange={e => setStudentId(e.target.value)}>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><a href="/teacher.html">Teacher workspace</a></div>{error && <p role="alert">{error}</p>}{student ? <StudentApp key={student.id} session={{ userId: student.id, displayName: student.name, role: 'student' }} /> : <p>Loading student roster…</p>}</>;
}
export function mountRoleEntry(role: 'teacher' | 'student') {
 document.documentElement.dataset.role = role;
 const element = document.getElementById('root')!;
 if (window.__AIPC_SESSION__) return role === 'teacher' ? mountTeacherApp(element, { session: window.__AIPC_SESSION__ }) : mountStudentApp(element, { session: window.__AIPC_SESSION__ });
 const root = createRoot(element);
 root.render(<StrictMode>{role === 'teacher' ? <><div className="demo-banner"><strong>Local demo</strong><a href="/student.html">Student workspace</a></div><TeacherApp session={{ role: 'teacher', userId: 'demo_teacher', displayName: 'Demo teacher' }} /></> : <StudentDemo />}</StrictMode>);
 return () => root.unmount();
}
