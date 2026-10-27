/** Shared integration contracts. Coordinate changes here; domain internals remain private. */
export type Role = 'teacher' | 'student';
export interface AppSession { userId: string; role: Role; displayName: string }
export interface ScoreReference { id: string; title: string; xmlPath: string; composer?: string }
export interface ScoreFile extends ScoreReference { uploadedAt: string; builtin?: boolean; fileName?: string }
export interface ScoreSelection { score: ScoreReference; range?: [number, number]; instrumentName?: string }
export interface Student { id: string; name: string; instrument: string }
export type PlanStatus = 'assigned' | 'in_progress' | 'completed';
export interface PracticePlan {
  id: string;
  teacherId?: string;
  title: string;
  score: ScoreReference;
  studentId: string;
  studentName: string;
  instrumentName: string;
  range: [number, number];
  notes: string;
  assignedAt: string;
  status: PlanStatus;
}
export type PlanDraft = Omit<PracticePlan, 'id' | 'assignedAt' | 'status'>;
export interface PracticeGateway {
  students(): Promise<Student[]>;
  plans(filter?: { studentId?: string; teacherId?: string }): Promise<PracticePlan[]>;
  dispatch(draft: PlanDraft): Promise<PracticePlan>;
  setStatus(id: string, studentId: string, status: PlanStatus): Promise<PracticePlan>;
}
export interface ScoreGateway {
  list(): Promise<ScoreFile[]>;
  upload(input: { title: string; composer?: string; fileName: string; xml: string }): Promise<ScoreFile>;
}
