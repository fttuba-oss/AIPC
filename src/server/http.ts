import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppSession } from '../contracts';
export type SessionResolver = (req: IncomingMessage) => AppSession | null;
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function json(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value));
}
export async function body(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 20 * 1024 * 1024) throw new HttpError(413, 'Request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
}
export function sessionFor(req: IncomingMessage, resolve?: SessionResolver) {
  if (!resolve) return null; // Explicit unauthenticated local demo mode.
  const session = resolve(req);
  if (!session) throw new HttpError(401, 'Sign in to continue.');
  return session;
}
export function teacherOnly(session: AppSession | null) {
  if (session && session.role !== 'teacher') throw new HttpError(403, 'Teacher access required.');
}
export function report(res: ServerResponse, error: unknown) {
  if (error instanceof HttpError) json(res, error.status, { error: error.message });
  else { console.error(error); json(res, 500, { error: 'Storage request failed.' }); }
}
