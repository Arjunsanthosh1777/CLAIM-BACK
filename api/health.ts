import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  const payload = {
    ok: true,
    service: 'claimback',
    runtime: 'vercel-serverless',
    timestamp: new Date().toISOString(),
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
