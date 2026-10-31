import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.resolve(__dirname, '.claimback-workspace.json');

function readServerWorkspace() {
  try {
    if (!fs.existsSync(STORE_PATH)) return null;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeServerWorkspace(payload: unknown) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/workspace', (_req, res) => {
    const existing = readServerWorkspace();
    res.json({ ok: true, workspace: existing });
  });

  app.put('/api/workspace', (req, res) => {
    const body = req.body;
    if (!body || !Array.isArray(body.purchases) || !Array.isArray(body.claims)) {
      res.status(400).json({ ok: false, error: 'Invalid workspace payload' });
      return;
    }
    const saved = {
      purchases: body.purchases,
      deadlineMeta: body.deadlineMeta || {},
      customDeadlines: body.customDeadlines || [],
      claims: body.claims,
      updatedAt: new Date().toISOString(),
    };
    writeServerWorkspace(saved);
    res.json({ ok: true, updatedAt: saved.updatedAt });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CLAIMBACK dynamic server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
