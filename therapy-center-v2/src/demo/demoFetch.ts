/**
 * Offline demo mode (build with `npm run build:demo`).
 * Every API call is answered in the browser by the same in-memory fake centre the
 * dev server uses (mock/mockCore.ts). Requests to the real server or to Firebase
 * are refused outright, so the demo can never read or write real data.
 */
import { handleMock, sseBody } from '../../mock/mockCore';

export const IS_DEMO = import.meta.env.VITE_DEMO === '1';

const BLOCKED = /run\.app|googleapis\.com\/(?!css)|firebaseio|firestore|cloudfunctions/;

if (IS_DEMO) {
  try { if (!localStorage.getItem('admin_key')) localStorage.setItem('admin_key', '1234'); } catch { /* storage blocked */ }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, location.href);
    const apiAt = url.pathname.indexOf('/api/');

    if (apiAt >= 0) {
      const path = url.pathname.slice(apiAt);
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      let body: Record<string, unknown> = {};
      if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { /* not JSON */ } }
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const r = handleMock(method, path, url.searchParams, body, headers);
      await new Promise(res => setTimeout(res, 120)); // feel like a network
      if (r.sse) return new Response(sseBody(r.sse), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    }
    if (BLOCKED.test(url.href)) {
      return new Response(JSON.stringify({ error: 'לא זמין בגרסת ההדגמה' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  };
}
