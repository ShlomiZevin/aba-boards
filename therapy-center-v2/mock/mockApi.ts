/**
 * Dev-server adapter for the in-memory mock API (see mockCore.ts).
 * v2's dev server never proxies to the real server (which uses the production
 * Firestore), so nothing done locally can reach real data. Login key: 1234.
 */
import type { Connect } from 'vite';
import { handleMock, sseBody } from './mockCore';

export function mockApi(): Connect.NextHandleFunction {
  return (req, res, next) => {
    // Dev-only shortcut for screenshots: /__mock-login?to=/therapy/kids stores the mock key, then redirects.
    if (req.url && req.url.startsWith('/__mock-login')) {
      const to = new URL(req.url, 'http://mock').searchParams.get('to') || '/therapy/';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<script>localStorage.setItem('admin_key','1234');location.replace(${JSON.stringify(to)});</script>`);
      return;
    }
    if (!req.url || !req.url.startsWith('/api/')) return next();
    const url = new URL(req.url, 'http://mock');
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      let body: Record<string, any> = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { /* multipart or empty */ }
      const r = handleMock(req.method || 'GET', url.pathname, url.searchParams, body, req.headers as Record<string, any>);
      if (r.sse) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(sseBody(r.sse));
        return;
      }
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Mock-Api': '1' });
      res.end(JSON.stringify(r.json));
    });
  };
}
