import type { Connect } from 'vite';
import { body, HttpError, json, report, sessionFor, teacherOnly, type SessionResolver } from '../../server/http';
import { PracticeRepository } from './repository';

export function practiceApiMiddleware(options: { storageRoot?: string; resolveSession?: SessionResolver } = {}): Connect.NextHandleFunction {
  const repository = new PracticeRepository(options.storageRoot);
  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!/^\/api\/practice(?:\/|$)/.test(url.pathname)) return next();
    try {
      const session = sessionFor(req, options.resolveSession);
      if (url.pathname === '/api/practice/students' && req.method === 'GET') {
        teacherOnly(session); return json(res, 200, repository.students());
      }
      if (url.pathname === '/api/practice/plans' && req.method === 'GET') {
        const studentId = session?.role === 'student' ? session.userId : url.searchParams.get('studentId') || undefined;
        const teacherId = session?.role === 'teacher' ? session.userId : url.searchParams.get('teacherId') || undefined;
        return json(res, 200, repository.plans({ studentId, teacherId }));
      }
      if (url.pathname === '/api/practice/plans' && req.method === 'POST') {
        teacherOnly(session);
        const input = await body(req);
        return json(res, 201, repository.dispatch({ ...input, teacherId: session?.userId ?? input.teacherId }));
      }
      const match = url.pathname.match(/^\/api\/practice\/plans\/([\w-]+)\/status$/);
      if (match && req.method === 'PATCH') {
        if (session && session.role !== 'student') throw new HttpError(403, 'Student access required.');
        const input = await body(req);
        return json(res, 200, repository.setStatus(match[1], session?.userId ?? input.studentId, input.status));
      }
      throw new HttpError(404, 'Practice endpoint not found.');
    } catch (error) { report(res, error); }
  };
}
