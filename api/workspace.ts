import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

type VercelReq = IncomingMessage & {
  body?: unknown;
};

const TMP_STORE_PATH = path.join(os.tmpdir(), 'claimback-workspace.json');

function sendJson(res: ServerResponse, code: number, payload: unknown) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readTmpWorkspace() {
  try {
    if (!fs.existsSync(TMP_STORE_PATH)) return null;
    return JSON.parse(fs.readFileSync(TMP_STORE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function parseRequestBody(req: VercelReq): Promise<Record<string, unknown> | null> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

export default async function handler(req: VercelReq, res: ServerResponse) {
  if (req.method === 'GET') {
    sendJson(res, 200, { ok: true, workspace: readTmpWorkspace() });
    return;
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body || !Array.isArray(body.purchases) || !Array.isArray(body.claims)) {
      sendJson(res, 400, { ok: false, error: 'Invalid workspace payload' });
      return;
    }

    const saved = {
      purchases: body.purchases,
      deadlineMeta: body.deadlineMeta || {},
      customDeadlines: body.customDeadlines || [],
      claims: body.claims,
      updatedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(saved, null, 2), 'utf8');
    } catch {
      // Ephemeral fallback if filesystem restricted; client localStorage remains primary
    }

    sendJson(res, 200, { ok: true, updatedAt: saved.updatedAt });
    return;
  }

  sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
}
