import type { Connect } from 'vite';
import fs from 'node:fs';
import { defaultStorageManager } from '../storage/localStorageManager';

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function parseRawBuffer(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

function sendJson(res: any, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data, null, 2));
}

export function storageApiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const fullUrl = req.url || '';
    const method = req.method || 'GET';

    // Allow both /api/storage/... and shorthand /api/... endpoints
    let normalizedUrl = fullUrl;
    if (fullUrl.startsWith('/api/') && !fullUrl.startsWith('/api/storage/') && !fullUrl.startsWith('/api/suggest-changes')) {
      normalizedUrl = fullUrl.replace('/api/', '/api/storage/');
    }

    if (!normalizedUrl.startsWith('/api/storage')) {
      return next();
    }

    try {
      const parsedUrl = new URL(normalizedUrl, 'http://localhost');
      const pathname = parsedUrl.pathname;

      // 1. Students Roster
      if (pathname === '/api/storage/students') {
        if (method === 'GET') {
          return sendJson(res, 200, defaultStorageManager.getStudents());
        }
      }

      // 2. Exercises Endpoints
      if (pathname === '/api/storage/exercises') {
        if (method === 'GET') {
          const studentId = parsedUrl.searchParams.get('studentId') || undefined;
          return sendJson(res, 200, defaultStorageManager.getExercises(studentId));
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const saved = defaultStorageManager.saveExercise(body);
          return sendJson(res, 201, saved);
        }
      }

      if (pathname.startsWith('/api/storage/exercises/')) {
        const id = pathname.replace('/api/storage/exercises/', '');
        if (method === 'GET') {
          const ex = defaultStorageManager.getExerciseById(id);
          if (!ex) return sendJson(res, 404, { error: 'Exercise not found' });
          return sendJson(res, 200, ex);
        }
        if (method === 'DELETE') {
          const deleted = defaultStorageManager.deleteExercise(id);
          return sendJson(res, 200, { success: deleted });
        }
      }

      // 3. Submissions Endpoints
      if (pathname === '/api/storage/submissions') {
        if (method === 'GET') {
          const studentId = parsedUrl.searchParams.get('studentId') || undefined;
          const exerciseId = parsedUrl.searchParams.get('exerciseId') || undefined;
          return sendJson(res, 200, defaultStorageManager.getSubmissions(studentId, exerciseId));
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const saved = defaultStorageManager.saveSubmission(body);
          return sendJson(res, 201, saved);
        }
      }

      if (pathname.startsWith('/api/storage/submissions/')) {
        const remaining = pathname.replace('/api/storage/submissions/', '');
        if (remaining.endsWith('/feedback') && method === 'POST') {
          const id = remaining.replace('/feedback', '');
          const body = await parseJsonBody(req);
          const updated = defaultStorageManager.updateSubmissionFeedback(id, body.feedback || '');
          if (!updated) return sendJson(res, 404, { error: 'Submission not found' });
          return sendJson(res, 200, updated);
        } else {
          const id = remaining;
          if (method === 'GET') {
            const sub = defaultStorageManager.getSubmissionById(id);
            if (!sub) return sendJson(res, 404, { error: 'Submission not found' });
            return sendJson(res, 200, sub);
          }
        }
      }

      // 4. Media Recordings Upload & Streaming
      if (pathname === '/api/storage/recordings') {
        if (method === 'POST') {
          const filename = parsedUrl.searchParams.get('filename') || req.headers['x-filename'] || `take_${Date.now()}.webm`;
          const buffer = await parseRawBuffer(req);
          const url = defaultStorageManager.saveRecording(filename.toString(), buffer);
          return sendJson(res, 201, { success: true, url, filename });
        }
      }

      if (pathname.startsWith('/api/storage/recordings/')) {
        const filename = pathname.replace('/api/storage/recordings/', '');
        const filePath = defaultStorageManager.getRecordingPath(filename);
        if (!filePath) {
          res.statusCode = 404;
          return res.end('Recording not found');
        }

        const stat = fs.statSync(filePath);
        res.statusCode = 200;
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', filename.endsWith('.webm') ? 'audio/webm' : 'application/octet-stream');
        const stream = fs.createReadStream(filePath);
        return stream.pipe(res);
      }

      // 5. Score library
      if (pathname === '/api/storage/scores') {
        if (method === 'GET') return sendJson(res, 200, defaultStorageManager.getScores());
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (!body.xml) return sendJson(res, 400, { error: 'Missing score xml' });
          return sendJson(res, 201, defaultStorageManager.saveScore(body));
        }
      }
      const scoreXmlMatch = pathname.match(/^\/api\/storage\/scores\/([^/]+)\/xml$/);
      if (scoreXmlMatch && method === 'GET') {
        const xml = defaultStorageManager.getScoreXml(decodeURIComponent(scoreXmlMatch[1]));
        if (xml === null) return sendJson(res, 404, { error: 'Score not found' });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        return res.end(xml);
      }

      // 6. Exercise templates (per score)
      if (pathname === '/api/storage/exercise-templates') {
        if (method === 'GET') {
          const scoreId = parsedUrl.searchParams.get('scoreId') || undefined;
          return sendJson(res, 200, defaultStorageManager.getExerciseTemplates(scoreId));
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          return sendJson(res, 201, defaultStorageManager.saveExerciseTemplate(body));
        }
      }
      if (pathname.startsWith('/api/storage/exercise-templates/') && method === 'DELETE') {
        const id = decodeURIComponent(pathname.replace('/api/storage/exercise-templates/', ''));
        return sendJson(res, 200, { success: defaultStorageManager.deleteExerciseTemplate(id) });
      }

      // 7. Practice plan notes (free text to students)
      if (pathname === '/api/storage/plan-notes') {
        if (method === 'GET') return sendJson(res, 200, defaultStorageManager.getPlanNotes());
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (!body.text || !String(body.text).trim()) return sendJson(res, 400, { error: 'Missing note text' });
          return sendJson(res, 201, defaultStorageManager.savePlanNote(body));
        }
      }
      if (pathname.startsWith('/api/storage/plan-notes/') && method === 'DELETE') {
        const id = decodeURIComponent(pathname.replace('/api/storage/plan-notes/', ''));
        return sendJson(res, 200, { success: defaultStorageManager.deletePlanNote(id) });
      }

      // Not handled
      return sendJson(res, 404, { error: 'Not Found' });
    } catch (err: any) {
      console.error('Error handling storage API request:', err);
      return sendJson(res, 500, { error: err?.message || 'Internal Server Error' });
    }
  };
}
