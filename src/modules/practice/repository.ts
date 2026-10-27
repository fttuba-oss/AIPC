import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PlanDraft, PlanStatus, PracticePlan, Student } from '../../contracts';
import { HttpError } from '../../server/http';

/** Developer B owns practice-plans and the roster. Existing exercises are read as legacy assignments. */
export class PracticeRepository {
  private directory: string;
  constructor(private root = path.resolve('storage')) {
    this.directory = path.join(root, 'practice-plans');
    fs.mkdirSync(this.directory, { recursive: true });
  }
  students(): Student[] {
    const file = path.join(this.root, 'students.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  }
  private file(id: string) {
    if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'Invalid plan id.');
    return path.join(this.directory, `${id}.json`);
  }
  plans(filter: { studentId?: string; teacherId?: string } = {}): PracticePlan[] {
    const plans: PracticePlan[] = fs.readdirSync(this.directory).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(this.directory, f), 'utf8')));
    const legacyDirectory = path.join(this.root, 'exercises');
    if (fs.existsSync(legacyDirectory)) for (const file of fs.readdirSync(legacyDirectory).filter(f => f.endsWith('.json'))) {
      const old = JSON.parse(fs.readFileSync(path.join(legacyDirectory, file), 'utf8'));
      if (!plans.some(plan => plan.id === old.id)) plans.push({ id: old.id, title: old.title, score: { id: old.scoreId ?? old.scorePath, title: old.scoreTitle, xmlPath: old.scorePath }, studentId: old.studentId, studentName: old.studentName, instrumentName: old.instrumentName, range: [old.section.startMeasure, old.section.endMeasure], notes: old.teacherGeneralNotes ?? old.section.goals?.map((g: { goal: string }) => g.goal).join('\n') ?? '', assignedAt: old.assignedDate, status: old.status });
    }
    return plans.filter(p => (!filter.studentId || p.studentId === filter.studentId) && (!filter.teacherId || p.teacherId === filter.teacherId || (!p.teacherId && filter.teacherId === 'demo_teacher'))).sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  }
  dispatch(input: PlanDraft): PracticePlan {
    if (!input || typeof input.title !== 'string' || !input.title.trim() || !input.score || typeof input.score.id !== 'string' || typeof input.score.title !== 'string' || typeof input.score.xmlPath !== 'string' || !input.score.xmlPath.startsWith('/') || input.score.xmlPath.startsWith('//')) throw new HttpError(400, 'A title and local score reference are required.');
    if (!Array.isArray(input.range) || input.range.length !== 2 || !input.range.every(n => Number.isSafeInteger(n) && n > 0) || input.range[1] < input.range[0]) throw new HttpError(400, 'Enter a valid measure range.');
    if (typeof input.notes !== 'string') throw new HttpError(400, 'Notes must be text.');
    const student = this.students().find(s => s.id === input.studentId);
    if (!student) throw new HttpError(400, 'Student not found in roster.');
    const plan: PracticePlan = { id: `plan_${randomUUID()}`, teacherId: input.teacherId, title: input.title.trim(), score: { id: input.score.id, title: input.score.title, xmlPath: input.score.xmlPath }, range: input.range, notes: input.notes, studentId: student.id, studentName: student.name, instrumentName: student.instrument, assignedAt: new Date().toISOString(), status: 'assigned' };
    fs.writeFileSync(this.file(plan.id), JSON.stringify(plan, null, 2)); return plan;
  }
  setStatus(id: string, studentId: string, status: PlanStatus) {
    this.file(id);
    if (!['assigned', 'in_progress', 'completed'].includes(status)) throw new HttpError(400, 'Invalid practice status.');
    const plan = this.plans({ studentId }).find(p => p.id === id);
    if (!plan) throw new HttpError(404, 'Plan not found for this student.');
    const updated = { ...plan, status };
    fs.writeFileSync(this.file(id), JSON.stringify(updated, null, 2)); return updated;
  }
}
