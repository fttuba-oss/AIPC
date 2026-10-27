import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Connect } from 'vite';
import type { ScoreFile } from '../../contracts';
import { body, HttpError, json, report, sessionFor, teacherOnly, type SessionResolver } from '../../server/http';

/** Developer A owns this handler and storage/scores exclusively. */
export function scoreApiMiddleware(options: { storageRoot?: string; resolveSession?: SessionResolver } = {}): Connect.NextHandleFunction {
  const directory = path.join(options.storageRoot ?? path.resolve('storage'), 'scores');
  fs.mkdirSync(directory, { recursive: true });
  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!/^\/api\/storage\/scores(?:\/|$)/.test(url.pathname)) return next();
    try {
      const session = sessionFor(req, options.resolveSession);
      if (url.pathname === '/api/storage/scores' && req.method === 'GET') {
        const scores = fs.readdirSync(directory).filter(f => f.endsWith('.json')).map(file => {
          const { xml: _xml, ...meta } = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')); return meta;
        });
        return json(res, 200, scores);
      }
      if (url.pathname === '/api/storage/scores' && req.method === 'POST') {
        teacherOnly(session);
        const input = await body(req);
        if (typeof input.xml !== 'string' || !/<score-partwise[\s>]/.test(input.xml) || typeof input.title !== 'string' || !input.title.trim()) throw new HttpError(400, 'A title and MusicXML score are required.');
        const id = `score_${randomUUID()}`;
        const score: ScoreFile = { id, title: input.title.trim(), composer: typeof input.composer === 'string' ? input.composer : undefined, fileName: typeof input.fileName === 'string' ? input.fileName : undefined, xmlPath: `/api/storage/scores/${id}/xml`, uploadedAt: new Date().toISOString() };
        fs.writeFileSync(path.join(directory, `${id}.json`), JSON.stringify({ ...score, xml: input.xml }));
        return json(res, 201, score);
      }
      const match = url.pathname.match(/^\/api\/storage\/scores\/([\w-]+)\/xml$/);
      if (match && req.method === 'GET') {
        const file = path.join(directory, `${match[1]}.json`);
        if (!fs.existsSync(file)) throw new HttpError(404, 'Score not found.');
        res.setHeader('Content-Type', 'application/xml; charset=utf-8'); return res.end(JSON.parse(fs.readFileSync(file, 'utf8')).xml);
      }
      throw new HttpError(404, 'Score endpoint not found.');
    } catch (error) { report(res, error); }
  };
}
