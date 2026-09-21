import type { Connect } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { KnowledgeSimulatorService } from '../service/KnowledgeSimulatorService';

const SUGGESTIONS_FILE = path.resolve(process.cwd(), 'scratch', 'suggested_changes.json');

function readSuggestions(): any[] {
  try {
    if (!fs.existsSync(SUGGESTIONS_FILE)) {
      return [];
    }
    const content = fs.readFileSync(SUGGESTIONS_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch {
    return [];
  }
}

function writeSuggestions(items: any[]): void {
  try {
    const dir = path.dirname(SUGGESTIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write suggestions:', e);
  }
}

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

function sendJson(res: any, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data, null, 2));
}

export function knowledgeApiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url || '';
    const method = req.method || 'GET';

    if (!url.startsWith('/knowledge') && !url.startsWith('/simulations') && !url.startsWith('/api/suggest-changes')) {
      return next();
    }

    try {
      // Suggest Changes API endpoints for Coding Agent Collaboration
      if (url.startsWith('/api/suggest-changes')) {
        if (method === 'GET') {
          return sendJson(res, 200, readSuggestions());
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const current = readSuggestions();
          const newItem = {
            id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            targetTag: body.targetTag || 'element',
            targetSelector: body.targetSelector || '',
            originalText: body.originalText || '',
            suggestedChange: body.suggestedChange || '',
            category: body.category || 'copy',
            componentContext: body.componentContext || '',
            pageUrl: body.pageUrl || '',
            appMode: body.appMode || '',
            status: 'pending'
          };
          current.push(newItem);
          writeSuggestions(current);
          return sendJson(res, 201, { success: true, item: newItem, total: current.length });
        }
        if (method === 'DELETE') {
          const parsedUrl = new URL(url, 'http://localhost');
          const id = parsedUrl.searchParams.get('id');
          let current = readSuggestions();
          if (id) {
            current = current.filter(item => item.id !== id);
          } else {
            current = [];
          }
          writeSuggestions(current);
          return sendJson(res, 200, { success: true, total: current.length });
        }
      }
      // 1. GET /knowledge/domains
      if (method === 'GET' && url === '/knowledge/domains') {
        return sendJson(res, 200, KnowledgeSimulatorService.getDomains());
      }

      // 2. GET /knowledge/domains/:domainId
      if (method === 'GET' && url.startsWith('/knowledge/domains/')) {
        const domainId = url.replace('/knowledge/domains/', '').split('?')[0];
        const domain = KnowledgeSimulatorService.getDomain(domainId);
        if (!domain) {
          return sendJson(res, 404, { error: `Domain '${domainId}' not found.` });
        }
        return sendJson(res, 200, domain);
      }

      // 3. GET /knowledge/layers
      if (method === 'GET' && url === '/knowledge/layers') {
        return sendJson(res, 200, KnowledgeSimulatorService.getLayers());
      }

      // 4. GET /knowledge/layers/:layerId
      if (method === 'GET' && url.startsWith('/knowledge/layers/')) {
        const layerId = url.replace('/knowledge/layers/', '').split('?')[0] as any;
        const layer = KnowledgeSimulatorService.getLayer(layerId);
        if (!layer) {
          return sendJson(res, 404, { error: `Layer '${layerId}' not found.` });
        }
        return sendJson(res, 200, layer);
      }

      // 5. GET /knowledge/records/:recordId
      if (method === 'GET' && url.startsWith('/knowledge/records/')) {
        const recordId = url.replace('/knowledge/records/', '').split('?')[0];
        const record = KnowledgeSimulatorService.getRecord(recordId);
        if (!record) {
          return sendJson(res, 404, { error: `Record '${recordId}' not found.` });
        }
        return sendJson(res, 200, record);
      }

      // 6. GET /simulations/problem-signatures
      if (method === 'GET' && url.startsWith('/simulations/problem-signatures')) {
        return sendJson(res, 200, KnowledgeSimulatorService.getProblemSignatures());
      }

      // 7. POST /simulations/start
      if (method === 'POST' && url === '/simulations/start') {
        const body = await parseJsonBody(req);
        const sim = KnowledgeSimulatorService.startSimulation(body);
        return sendJson(res, 201, sim);
      }

      // 8. POST /simulations/:simulationId/apply-intervention
      if (method === 'POST' && url.includes('/apply-intervention')) {
        const match = url.match(/\/simulations\/([^/]+)\/apply-intervention/);
        if (match) {
          const simId = match[1];
          const body = await parseJsonBody(req);
          const sim = KnowledgeSimulatorService.applyIntervention(simId, body);
          return sendJson(res, 200, sim);
        }
      }

      // 9. POST /simulations/:simulationId/record-response
      if (method === 'POST' && url.includes('/record-response')) {
        const match = url.match(/\/simulations\/([^/]+)\/record-response/);
        if (match) {
          const simId = match[1];
          const body = await parseJsonBody(req);
          const sim = KnowledgeSimulatorService.recordResponse(simId, body);
          return sendJson(res, 200, sim);
        }
      }

      // 10. GET /simulations/:simulationId/trace
      if (method === 'GET' && url.includes('/trace')) {
        const match = url.match(/\/simulations\/([^/]+)\/trace/);
        if (match) {
          const simId = match[1];
          const sim = KnowledgeSimulatorService.getSimulationTrace(simId);
          if (!sim) {
            return sendJson(res, 404, { error: `Simulation '${simId}' not found.` });
          }
          return sendJson(res, 200, sim);
        }
      }

      // 11. Notes: GET & POST /knowledge/notes
      if (url.startsWith('/knowledge/notes')) {
        if (method === 'GET') {
          return sendJson(res, 200, KnowledgeSimulatorService.getNotes());
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const note = KnowledgeSimulatorService.saveNote(
            body.targetId || 'global',
            body.author || 'Pedagogical Designer',
            body.noteText || '',
            body.tags
          );
          return sendJson(res, 201, note);
        }
      }

      // 12. GET /simulations/:simulationId/coding-instructions
      if (method === 'GET' && url.includes('/coding-instructions')) {
        const match = url.match(/\/simulations\/([^/]+)\/coding-instructions/);
        if (match) {
          const simId = match[1];
          const instructions = KnowledgeSimulatorService.generateCodingInstructions(simId);
          return sendJson(res, 200, instructions);
        }
      }

      return next();
    } catch (err: any) {
      return sendJson(res, 400, { error: err.message || 'Internal simulation error' });
    }
  };
}
