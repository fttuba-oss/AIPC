/** In-memory contract adapters for independent UI development; never used in production. */
import type { PlanDraft, PlanStatus, PracticeGateway, PracticePlan, ScoreFile, ScoreGateway, Student } from './index';
export const fixtureScore: ScoreFile = { id: 'fixture', title: 'Trumpet Concerto in E-flat', xmlPath: '/neruda_trumpet_concerto_excerpt.musicxml', builtin: true, uploadedAt: '2026-01-01' };
export const fixtureStudents: Student[] = [{ id: 'fixture_student', name: 'Demo student', instrument: 'Trumpet' }];
export function createMemoryPracticeGateway(): PracticeGateway {
 let plans: PracticePlan[] = [];
 return {
  async students() { return structuredClone(fixtureStudents); },
  async plans(filter = {}) { return structuredClone(plans.filter(p => (!filter.studentId || p.studentId === filter.studentId) && (!filter.teacherId || p.teacherId === filter.teacherId))); },
  async dispatch(draft: PlanDraft) { const plan: PracticePlan = { ...structuredClone(draft), id: crypto.randomUUID(), assignedAt: new Date().toISOString(), status: 'assigned' }; plans.push(plan); return structuredClone(plan); },
  async setStatus(id: string, studentId: string, status: PlanStatus) { const plan = plans.find(p => p.id === id && p.studentId === studentId); if (!plan) throw new Error('Plan not found.'); plan.status = status; return structuredClone(plan); },
 };
}
export function createMemoryScoreGateway(): ScoreGateway {
 const scores = [fixtureScore];
 return {
  async list() { return [...scores]; },
  async upload(input) { const score = { id: crypto.randomUUID(), title: input.title, xmlPath: URL.createObjectURL(new Blob([input.xml], { type: 'application/xml' })), uploadedAt: new Date().toISOString() }; scores.push(score); return score; },
 };
}
