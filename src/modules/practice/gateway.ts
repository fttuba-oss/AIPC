import type { PracticeGateway } from '../../contracts';
async function request<T>(path: string, method = 'GET', value?: unknown): Promise<T> {
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (value !== undefined && method !== 'GET') options.body = JSON.stringify(value);
  const response = await fetch(`/api/practice${path}`, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Practice request failed.');
  return result;
}
export const httpPracticeGateway: PracticeGateway = {
  students: () => request('/students'),
  plans: (filter = {}) => request(`/plans?${new URLSearchParams(Object.entries(filter).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))}`),
  dispatch: draft => request('/plans', 'POST', draft),
  setStatus: (id, studentId, status) => request(`/plans/${encodeURIComponent(id)}/status`, 'PATCH', { studentId, status }),
};
