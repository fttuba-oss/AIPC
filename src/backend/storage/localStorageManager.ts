import fs from 'node:fs';
import path from 'node:path';

export interface StudentProfile {
  id: string;
  name: string;
  instrument: string;
  grade?: string;
  avatarUrl?: string;
}

export interface StoredExercise {
  id: string;
  title: string;
  scoreTitle: string;
  scorePath: string; // URL path like '/neruda_trumpet_concerto_excerpt.musicxml' or local storage file
  instrumentId: string;
  instrumentName: string;
  studentId: string;
  studentName: string;
  assignedDate: string;
  status: 'assigned' | 'in_progress' | 'completed';
  section: {
    id?: string;
    sectionNumber: number;
    title: string;
    startMeasure: number;
    endMeasure: number;
    goals: {
      areaId?: string;
      category: string;
      measureRange: string;
      startMeasure: number;
      endMeasure: number;
      goal: string;
      targetTempo?: number;
      teacherNote?: string;
    }[];
  };
  teacherGeneralNotes?: string;
}

export interface StoredSubmissionTake {
  id: string;
  takeNumber: number;
  timestamp: string;
  mode: 'audio' | 'video';
  mediaFile: string; // Relative filename or path
  durationSeconds: number;
  tempoUsed: number;
  selfRating?: number;
}

export interface StoredSubmission {
  id: string;
  exerciseId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  pieceName: string;
  instrumentName: string;
  submittedAt: string;
  sectionId: string;
  sectionName: string;
  measureRange: [number, number];
  timeSpentSeconds: number;
  takes: StoredSubmissionTake[];
  diagnosticResult?: {
    overallAccuracyPercent: number;
    summaryText: string;
    problemMeasureNumbers: number[];
    rushedCount: number;
    draggedCount: number;
    stableCount: number;
  };
  teacherFeedback?: string;
}

export class LocalStorageManager {
  private baseDir: string;
  private exercisesDir: string;
  private scoresDir: string;
  private submissionsDir: string;
  private recordingsDir: string;
  private studentsFile: string;
  private templatesDir: string;
  private notesDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.resolve(process.cwd(), 'storage');
    this.exercisesDir = path.join(this.baseDir, 'exercises');
    this.scoresDir = path.join(this.baseDir, 'scores');
    this.submissionsDir = path.join(this.baseDir, 'submissions');
    this.recordingsDir = path.join(this.submissionsDir, 'recordings');
    this.studentsFile = path.join(this.baseDir, 'students.json');
    this.templatesDir = path.join(this.baseDir, 'exercise-templates');
    this.notesDir = path.join(this.baseDir, 'plan-notes');

    this.initializeDirectories();
    this.seedDefaultData();
  }

  private initializeDirectories() {
    for (const dir of [this.baseDir, this.exercisesDir, this.scoresDir, this.submissionsDir, this.recordingsDir, this.templatesDir, this.notesDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private seedDefaultData() {
    // 1. Seed Student Roster
    if (!fs.existsSync(this.studentsFile)) {
      const defaultStudents: StudentProfile[] = [
        { id: 'stud_alex', name: 'Alex Morgan', instrument: 'Trumpet 1', grade: 'Grade 8' },
        { id: 'stud_chloe', name: 'Chloe Tan', instrument: 'Trumpet 1', grade: 'Grade 7' },
        { id: 'stud_liam', name: 'Liam Wong', instrument: 'Flute 1', grade: 'Grade 8' },
      ];
      fs.writeFileSync(this.studentsFile, JSON.stringify(defaultStudents, null, 2), 'utf-8');
    }

    // 2. Seed an initial exercise for Alex if empty
    const existingExercises = this.getExercises();
    if (existingExercises.length === 0) {
      const seedExercise: StoredExercise = {
        id: 'ex_neruda_sec2_alex',
        title: 'Neruda Concerto - Rapid Tonguing & Rhythm (Bars 6–10)',
        scoreTitle: 'Neruda: Concerto in E-flat (Trumpet)',
        scorePath: '/neruda_trumpet_concerto_excerpt.musicxml',
        instrumentId: 'trumpet',
        instrumentName: 'Trumpet',
        studentId: 'stud_alex',
        studentName: 'Alex Morgan',
        assignedDate: new Date().toISOString(),
        status: 'assigned',
        section: {
          id: 'sec_2',
          sectionNumber: 2,
          title: 'Section 2 (Bars 6–10)',
          startMeasure: 6,
          endMeasure: 10,
          goals: [
            {
              category: 'fast_tonguing',
              measureRange: 'Bars 6–8',
              startMeasure: 6,
              endMeasure: 8,
              goal: 'Keep 16th-note double tonguing crisp, light, and forward-placed.',
              targetTempo: 96,
              teacherNote: 'Focus on tip of tongue touch without tension in embouchure.'
            },
            {
              category: 'complex_rhythm',
              measureRange: 'Bars 9–10',
              startMeasure: 9,
              endMeasure: 10,
              goal: 'Lock into the metronome subdivision through syncopated entrances.',
              targetTempo: 96,
              teacherNote: 'Subdivide eighths in your head before entering on beat 2.'
            }
          ]
        },
        teacherGeneralNotes: 'Practice 15 minutes daily. First shadow finger with audio demo, then record your official take!'
      };
      this.saveExercise(seedExercise);
    }
  }

  // ==========================================================================
  // Students
  // ==========================================================================
  public getStudents(): StudentProfile[] {
    try {
      if (!fs.existsSync(this.studentsFile)) return [];
      const content = fs.readFileSync(this.studentsFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch (e) {
      console.error('Error reading students roster:', e);
      return [];
    }
  }

  // ==========================================================================
  // Exercises
  // ==========================================================================
  public getExercises(studentId?: string): StoredExercise[] {
    try {
      if (!fs.existsSync(this.exercisesDir)) return [];
      const files = fs.readdirSync(this.exercisesDir).filter(f => f.endsWith('.json'));
      const exercises: StoredExercise[] = [];
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(this.exercisesDir, file), 'utf-8');
          const ex = JSON.parse(content) as StoredExercise;
          if (!studentId || ex.studentId === studentId) {
            exercises.push(ex);
          }
        } catch (err) {
          console.error(`Failed to parse exercise file ${file}:`, err);
        }
      }
      return exercises.sort((a, b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime());
    } catch (e) {
      console.error('Error listing exercises:', e);
      return [];
    }
  }

  public getExerciseById(id: string): StoredExercise | null {
    const filePath = path.join(this.exercisesDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  public saveExercise(exercise: StoredExercise): StoredExercise {
    if (!exercise.id) {
      exercise.id = `ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    if (!exercise.assignedDate) {
      exercise.assignedDate = new Date().toISOString();
    }
    const filePath = path.join(this.exercisesDir, `${exercise.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(exercise, null, 2), 'utf-8');
    return exercise;
  }

  public deleteExercise(id: string): boolean {
    const filePath = path.join(this.exercisesDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // ==========================================================================
  // Score library (uploaded scores). Each score is stored as <id>.json with the
  // MusicXML text in the `xml` field.
  // ==========================================================================
  private safeId(id: string): string {
    return path.basename(String(id)).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  public getScores(): Record<string, any>[] {
    const items: Record<string, any>[] = [];
    for (const file of fs.readdirSync(this.scoresDir).filter(f => f.endsWith('.json'))) {
      try {
        const { xml: _xml, ...meta } = JSON.parse(fs.readFileSync(path.join(this.scoresDir, file), 'utf-8'));
        items.push(meta);
      } catch (err) {
        console.error(`Failed to parse score file ${file}:`, err);
      }
    }
    return items.sort((a, b) => String(a.uploadedAt).localeCompare(String(b.uploadedAt)));
  }

  public saveScore(input: { title?: string; composer?: string; fileName?: string; xml: string }): Record<string, any> {
    const id = `score_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const meta = {
      id,
      title: input.title || input.fileName || 'Untitled score',
      composer: input.composer,
      fileName: input.fileName,
      xmlPath: `/api/storage/scores/${id}/xml`,
      uploadedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(this.scoresDir, `${id}.json`), JSON.stringify({ ...meta, xml: input.xml }), 'utf-8');
    return meta;
  }

  public getScoreXml(id: string): string | null {
    const filePath = path.join(this.scoresDir, `${this.safeId(id)}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')).xml || null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Exercise templates (teacher-defined exercises per score)
  // ==========================================================================
  public getExerciseTemplates(scoreId?: string): Record<string, any>[] {
    const items: Record<string, any>[] = [];
    for (const file of fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.json'))) {
      try {
        const item = JSON.parse(fs.readFileSync(path.join(this.templatesDir, file), 'utf-8'));
        if (!scoreId || item.scoreId === scoreId) items.push(item);
      } catch (err) {
        console.error(`Failed to parse template file ${file}:`, err);
      }
    }
    return items.sort((a, b) => (a.startMeasure - b.startMeasure) || String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  public saveExerciseTemplate(item: Record<string, any>): Record<string, any> {
    if (!item.id) item.id = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    fs.writeFileSync(path.join(this.templatesDir, `${this.safeId(item.id)}.json`), JSON.stringify(item, null, 2), 'utf-8');
    return item;
  }

  public deleteExerciseTemplate(id: string): boolean {
    const filePath = path.join(this.templatesDir, `${this.safeId(id)}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }

  // ==========================================================================
  // Practice plan notes (free-text messages to students)
  // ==========================================================================
  public getPlanNotes(): Record<string, any>[] {
    const items: Record<string, any>[] = [];
    for (const file of fs.readdirSync(this.notesDir).filter(f => f.endsWith('.json'))) {
      try {
        items.push(JSON.parse(fs.readFileSync(path.join(this.notesDir, file), 'utf-8')));
      } catch (err) {
        console.error(`Failed to parse plan note ${file}:`, err);
      }
    }
    return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  public savePlanNote(item: Record<string, any>): Record<string, any> {
    if (!item.id) item.id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    fs.writeFileSync(path.join(this.notesDir, `${this.safeId(item.id)}.json`), JSON.stringify(item, null, 2), 'utf-8');
    return item;
  }

  public deletePlanNote(id: string): boolean {
    const filePath = path.join(this.notesDir, `${this.safeId(id)}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }

  // ==========================================================================
  // Submissions
  // ==========================================================================
  public getSubmissions(studentId?: string, exerciseId?: string): StoredSubmission[] {
    try {
      if (!fs.existsSync(this.submissionsDir)) return [];
      const files = fs.readdirSync(this.submissionsDir).filter(f => f.endsWith('.json'));
      const submissions: StoredSubmission[] = [];
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(this.submissionsDir, file), 'utf-8');
          const sub = JSON.parse(content) as StoredSubmission;
          if (studentId && sub.studentId !== studentId) continue;
          if (exerciseId && sub.exerciseId !== exerciseId) continue;
          submissions.push(sub);
        } catch (err) {
          console.error(`Failed to parse submission file ${file}:`, err);
        }
      }
      return submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    } catch (e) {
      console.error('Error reading submissions:', e);
      return [];
    }
  }

  public getSubmissionById(id: string): StoredSubmission | null {
    const filePath = path.join(this.submissionsDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  public saveSubmission(submission: StoredSubmission): StoredSubmission {
    if (!submission.id) {
      submission.id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    if (!submission.submittedAt) {
      submission.submittedAt = new Date().toISOString();
    }
    const filePath = path.join(this.submissionsDir, `${submission.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(submission, null, 2), 'utf-8');

    // Also update associated exercise status to completed/in_progress
    if (submission.exerciseId) {
      const exercise = this.getExerciseById(submission.exerciseId);
      if (exercise && exercise.status !== 'completed') {
        exercise.status = 'completed';
        this.saveExercise(exercise);
      }
    }

    return submission;
  }

  public updateSubmissionFeedback(id: string, feedback: string): StoredSubmission | null {
    const submission = this.getSubmissionById(id);
    if (!submission) return null;
    submission.teacherFeedback = feedback;
    return this.saveSubmission(submission);
  }

  // ==========================================================================
  // Media Recordings
  // ==========================================================================
  public saveRecording(filename: string, buffer: Buffer): string {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.recordingsDir, safeFilename);
    fs.writeFileSync(filePath, buffer);
    return `/api/storage/recordings/${safeFilename}`;
  }

  public getRecordingPath(filename: string): string | null {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.recordingsDir, safeFilename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }
}

export const defaultStorageManager = new LocalStorageManager();
