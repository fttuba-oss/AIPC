import type { ExerciseTemplate, LibraryScore, PlanNote } from '../../contracts/portal';

async function json<T>(resp: Response): Promise<T> {
  if (!resp.ok) throw new Error(`Request failed (HTTP ${resp.status})`);
  return resp.json() as Promise<T>;
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Score library
export const fetchUploadedScores = async (): Promise<LibraryScore[]> =>
  json<LibraryScore[]>(await fetch('/api/storage/scores'));

export const uploadScore = async (input: { title?: string; composer?: string; fileName?: string; xml: string }): Promise<LibraryScore> =>
  json<LibraryScore>(await post('/api/storage/scores', input));

// Exercise templates
export const fetchExerciseTemplates = async (scoreId: string): Promise<ExerciseTemplate[]> =>
  json<ExerciseTemplate[]>(await fetch(`/api/storage/exercise-templates?scoreId=${encodeURIComponent(scoreId)}`));

export const saveExerciseTemplate = async (tpl: Partial<ExerciseTemplate>): Promise<ExerciseTemplate> =>
  json<ExerciseTemplate>(await post('/api/storage/exercise-templates', tpl));

export const deleteExerciseTemplate = async (id: string): Promise<void> => {
  await fetch(`/api/storage/exercise-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// Practice plan notes
export const fetchPlanNotes = async (): Promise<PlanNote[]> =>
  json<PlanNote[]>(await fetch('/api/storage/plan-notes'));

export const savePlanNote = async (note: Partial<PlanNote>): Promise<PlanNote> =>
  json<PlanNote>(await post('/api/storage/plan-notes', note));

export const deletePlanNote = async (id: string): Promise<void> => {
  await fetch(`/api/storage/plan-notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
};
