// MCP server — lets ChatGPT, Claude or any MCP client use the same data tools as the site's AI chat.
//
//   POST /mcp                                     Streamable HTTP (JSON responses, stateless)
//   /.well-known/oauth-protected-resource[/mcp]   RFC 9728
//   /.well-known/oauth-authorization-server       RFC 8414
//   /oauth/register | /oauth/authorize | /oauth/token | /oauth/revoke
//
// Who the caller is comes only from the OAuth token (see services/mcp-auth.js), and every tool goes
// through executeToolCall with the same per-role scoping as the site chat.

const express = require('express');
const auth = require('../services/mcp-auth');
const { executeToolCall, toolsForRole, resolveKidId } = require('../services/chat-center');
const docsService = require('../services/docs');
const therapyService = require('../services/therapy');

const router = express.Router();
const form = express.urlencoded({ extended: false, limit: '20kb' });

const SITE = 'https://startdoing.co.il/therapy';
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'doing-aba', title: 'Doing — ABA therapy centre', version: '1.0.0' };

function baseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ==================== discovery ====================

function protectedResource(req, res) {
  const base = baseUrl(req);
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
    scopes_supported: [auth.SCOPE],
    resource_name: SERVER_INFO.title,
  });
}
router.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'], protectedResource);

function authServerMetadata(req, res) {
  const base = baseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [auth.SCOPE],
  });
}
router.get([
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-authorization-server/mcp',
  '/.well-known/openid-configuration',
], authServerMetadata);

// ==================== OAuth endpoints ====================

function oauthError(res, err) {
  if (err instanceof auth.OAuthError) {
    return res.status(err.status).json({ error: err.code, error_description: err.message });
  }
  console.error('[mcp-auth] error:', err);
  return res.status(500).json({ error: 'server_error' });
}

router.post('/oauth/register', async (req, res) => {
  try { res.status(201).json(await auth.registerClient(req.body)); } catch (err) { oauthError(res, err); }
});

router.post('/oauth/token', form, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await auth.exchangeToken(req)); } catch (err) { oauthError(res, err); }
});

router.post('/oauth/revoke', form, async (req, res) => {
  try { await auth.revokeToken(req.body.token); } catch (err) { console.error('[mcp-auth] revoke:', err); }
  res.status(200).end();
});

// Sign-in attempts per IP — admin codes are short, so guessing must be slow.
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
function tooManyFailures(ip) {
  const a = attempts.get(ip);
  if (!a || a.resetAt < Date.now()) return false;
  return a.count >= MAX_FAILURES;
}
function recordFailure(ip) {
  const a = attempts.get(ip);
  if (!a || a.resetAt < Date.now()) attempts.set(ip, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
  else a.count += 1;
}
const clientIp = (req) => (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

// Validates the authorize request; returns { client, params } or sends an error page.
async function checkAuthorizeRequest(src, res) {
  const params = {
    client_id: src.client_id, redirect_uri: src.redirect_uri, response_type: src.response_type,
    state: src.state, code_challenge: src.code_challenge, code_challenge_method: src.code_challenge_method,
    scope: src.scope, resource: src.resource,
  };
  const client = await auth.getClient(params.client_id);
  if (!client) { res.status(400).send(page({ error: 'החיבור לא מוכר (client_id שגוי). נסו להוסיף את החיבור מחדש.' })); return null; }
  if (!client.redirectUris.includes(params.redirect_uri)) { res.status(400).send(page({ error: 'כתובת החזרה לא תואמת לחיבור.' })); return null; }

  const redirectError = (error, description) => {
    const u = new URL(params.redirect_uri);
    u.searchParams.set('error', error);
    if (description) u.searchParams.set('error_description', description);
    if (params.state) u.searchParams.set('state', params.state);
    res.redirect(u.toString());
    return null;
  };
  if (params.response_type !== 'code') return redirectError('unsupported_response_type');
  if (!params.code_challenge || params.code_challenge_method !== 'S256') return redirectError('invalid_request', 'PKCE S256 is required');
  return { client, params };
}

router.get('/oauth/authorize', asyncHandler(async (req, res) => {
  const ok = await checkAuthorizeRequest(req.query, res);
  if (!ok) return;
  res.send(page({ params: ok.params, clientName: ok.client.clientName }));
}));

router.post('/oauth/authorize', form, asyncHandler(async (req, res) => {
  const ok = await checkAuthorizeRequest(req.body, res);
  if (!ok) return;
  const { client, params } = ok;
  const ip = clientIp(req);
  if (tooManyFailures(ip)) {
    return res.status(429).send(page({ params, clientName: client.clientName, error: 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.' }));
  }
  const identity = await auth.identityFromCredential(req.body.credential);
  if (!identity) {
    recordFailure(ip);
    return res.status(401).send(page({ params, clientName: client.clientName, error: 'הקוד או הקישור לא זוהו. בדקו ונסו שוב.' }));
  }
  const { label, ...stored } = identity;
  if (!auth.isAllowed(await auth.contextForIdentity(stored))) {
    recordFailure(ip);
    return res.status(403).send(page({ params, clientName: client.clientName, error: 'החיבור פתוח כרגע רק למנהלת המערכת.' }));
  }
  const code = await auth.createAuthCode({
    client, redirectUri: params.redirect_uri, codeChallenge: params.code_challenge, identity: stored, resource: params.resource,
  });
  console.log(`[mcp-auth] ${identity.authType} signed in for client ${client.id} (${client.clientName})`);
  const u = new URL(params.redirect_uri);
  u.searchParams.set('code', code);
  if (params.state) u.searchParams.set('state', params.state);
  res.redirect(u.toString());
}));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page({ params, clientName, error }) {
  const hidden = params
    ? Object.entries(params).filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')
    : '';
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>חיבור ל-Doing</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
    font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  .card { background: #fff; border-radius: 18px; padding: 28px 24px; width: 100%; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,.18); }
  h1 { margin: 0 0 6px; font-size: 1.35rem; color: #2d3748; }
  .sub { color: #64748b; font-size: .92rem; margin: 0 0 18px; line-height: 1.5; }
  label { display: block; font-weight: 600; color: #334155; margin-bottom: 6px; font-size: .92rem; }
  input[type=text], input[type=password] { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 1rem; direction: ltr; text-align: left; }
  input:focus { outline: 2px solid #7c3aed; border-color: transparent; }
  button { margin-top: 14px; width: 100%; padding: 12px; border: 0; border-radius: 10px; background: #7c3aed; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
  ul { margin: 14px 0 0; padding-inline-start: 18px; color: #64748b; font-size: .85rem; line-height: 1.6; }
  .err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 10px; margin-bottom: 14px; font-size: .9rem; }
  .note { margin-top: 16px; font-size: .78rem; color: #94a3b8; line-height: 1.5; }
</style></head><body>
<main class="card">
  <h1>חיבור ל-Doing</h1>
  <p class="sub">${clientName ? `<b>${esc(clientName)}</b> מבקש גישה לנתוני הטיפול שלך.` : 'חיבור עוזר AI לנתוני הטיפול.'}
    העוזר יראה בדיוק מה שאת/ה רואה באתר — לא יותר.</p>
  ${error ? `<div class="err">${esc(error)}</div>` : ''}
  ${params ? `<form method="post" action="/oauth/authorize" autocomplete="off">
    ${hidden}
    <label for="credential">${auth.SUPER_ADMIN_ONLY ? 'קוד גישה' : 'קוד גישה או קישור אישי'}</label>
    <input id="credential" name="credential" type="password" required autofocus>
    <button type="submit">התחברות</button>
  </form>
  ${auth.SUPER_ADMIN_ONLY ? '<ul><li>קוד הגישה שבו נכנסים לאתר. החיבור פתוח כרגע רק למנהלת המערכת.</li></ul>' : `<ul>
    <li>מנהלת — קוד הגישה שבו נכנסים לאתר</li>
    <li>מטפל/ת — הקישור האישי שקיבלת (…/therapy/t/…)</li>
    <li>הורים — קישור ההורים של הילד/ה (…/therapy/p/…)</li>
  </ul>`}
  <p class="note">החיבור תקף עד 90 יום. אפשר לנתק אותו בכל עת מתוך הגדרות העוזר.</p>` : ''}
</main></body></html>`;
}

// ==================== MCP ====================

const INSTRUCTIONS = `Data access to "Doing", an Israeli ABA (Applied Behavior Analysis) therapy-centre system. Content is in Hebrew.
- Kids are identified by Hebrew name or ID; every kid tool accepts kidName or kidId. Use list_kids (or search) when unsure of the spelling.
- Access is scoped to the signed-in person: an admin sees their centre's kids, a therapist only kids linked to them, parents only their own child (kid tools default to that child).
- Session forms = per-session therapy notes; get_daily_reports = school day reports (marks: "+" did it right away, "-" did not, with the help given; "ר" as on the paper form); get_daily_agenda = the day plan (סדר יום); get_summary_data = everything for a periodic summary in one call.
- Never invent kid-specific data — fetch it. Don't show internal IDs to the user.
- update_board_layout replaces the whole reward board: get_board_layout first, then send the complete modified layout.
- Documents: save_document puts a markdown document (meeting prep, guidance, notes, a summary) into Doing — on a kid's notebook page, or as a general centre document when no kid is given. It is private to the centre's admins unless the user asks to share it with the team or the parents. When the user asks to "send / save / put this in Doing", use save_document with the finished text, not a description of it. Use update_document (mode "append") to add to an existing one.`;

// OpenAI connectors (deep research / company knowledge) look for `search` and `fetch`.
const EXTRA_TOOLS = [
  {
    name: 'search',
    description: 'Search the kids you have access to by name. Returns matching kids (or all of them when nothing matches); pass a result id to fetch for an overview.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Kid name (Hebrew) or part of it' } }, required: ['query'] },
  },
  {
    name: 'fetch',
    description: "Overview of one kid by search-result id: profile, active goals and the latest session forms.",
    input_schema: { type: 'object', properties: { id: { type: 'string', description: 'id from search, e.g. "kid:<kidId>"' } }, required: ['id'] },
  },
];

// Documents — Michal's meeting prep / guidance / notes, sent from the assistant into Doing (services/docs.js).
const KID_REF = {
  kidId: { type: 'string', description: 'Kid ID (if known)' },
  kidName: { type: 'string', description: 'Kid name in Hebrew (if ID not known)' },
};
const DOC_TYPE = { type: 'string', enum: docsService.TYPES, description: 'meeting-prep = הכנה לפגישה, guidance = הדרכה, note = הערה, summary = סיכום, other' };
const DOC_VIS = { type: 'string', enum: docsService.VISIBILITY, description: 'private (default) = centre admins only; team = + the kid’s therapists; parents = + the kid’s parents. Only share when the user asks.' };
const DOC_TOOLS = [
  {
    name: 'save_document',
    admin: true,
    description: 'Save a new document into Doing: meeting prep, guidance, notes, a summary — written in markdown (Hebrew). With a kid it goes on that kid’s notebook page; without one it is a general centre document. Private by default. Returns the document id and a link.',
    input_schema: {
      type: 'object',
      properties: {
        ...KID_REF,
        title: { type: 'string', description: 'Short title, e.g. "הכנה לפגישת צוות 12.11"' },
        content: { type: 'string', description: 'The full document in markdown' },
        type: DOC_TYPE,
        visibility: DOC_VIS,
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'update_document',
    admin: true,
    description: 'Change an existing Doing document: replace its content (default) or append to it (mode "append"), and/or change its title, type or visibility.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document id (from save_document or list_documents)' },
        title: { type: 'string' },
        content: { type: 'string', description: 'Markdown — replaces the content, or is added at the end with mode "append"' },
        mode: { type: 'string', enum: ['replace', 'append'] },
        type: DOC_TYPE,
        visibility: DOC_VIS,
      },
      required: ['id'],
    },
  },
  {
    name: 'list_documents',
    description: 'List the documents in Doing for a kid (or the general centre documents when general=true): id, title, type, visibility, dates. Use get_document to read one.',
    input_schema: {
      type: 'object',
      properties: { ...KID_REF, general: { type: 'boolean', description: 'true = general centre documents instead of a kid’s' } },
    },
  },
  {
    name: 'get_document',
    description: 'Read one Doing document in full (markdown).',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];
const docToolsFor = (ctx) => DOC_TOOLS.filter((t) => !t.admin || ctx.authType === 'admin');

const WRITE_TOOLS = new Set(['create_kid', 'update_board_layout', 'save_document', 'update_document']);

function sourceOf(ctx) {
  return ctx.authType === 'therapist' ? 'therapist' : ctx.authType === 'parent' ? 'parent' : 'admin';
}

function toolList(ctx) {
  return [...toolsForRole(sourceOf(ctx)), ...docToolsFor(ctx), ...EXTRA_TOOLS].map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
    annotations: WRITE_TOOLS.has(t.name)
      ? { readOnlyHint: false, destructiveHint: t.name === 'update_board_layout', openWorldHint: false }
      : { readOnlyHint: true, openWorldHint: false },
  }));
}

function docUrl(ctx, doc) {
  if (ctx.authType === 'parent') return `${SITE}/p/${encodeURIComponent(doc.kidId)}/docs/${doc.id}`;
  if (ctx.authType === 'therapist') return `${SITE}/t/${ctx.practitionerId}/docs/${doc.id}`;
  return `${SITE}/docs/${doc.id}`;
}

// Which assistant wrote it — from the OAuth client's registered name.
const clientNames = new Map();
async function sourceForClient(clientId) {
  if (!clientNames.has(clientId)) {
    const c = await auth.getClient(clientId);
    clientNames.set(clientId, (c && c.clientName) || '');
  }
  const n = clientNames.get(clientId).toLowerCase();
  return { source: /chatgpt|openai/.test(n) ? 'chatgpt' : /claude|anthropic/.test(n) ? 'claude' : 'mcp', name: clientNames.get(clientId) || 'MCP' };
}

async function runDocTool(ctx, name, input) {
  const kidIdFor = async () => {
    if (ctx.authType === 'parent') return ctx.kidViewId;
    if (!input.kidId && !input.kidName) return null;
    const r = await resolveKidId({ kidId: input.kidId, kidName: input.kidName }, ctx.adminId);
    if (r.error) throw new docsService.DocError(404, r.error);
    return r.kidId;
  };
  try {
    switch (name) {
      case 'save_document': {
        const kidId = await kidIdFor();
        const { source, name: clientName } = await sourceForClient(ctx.clientId);
        const doc = await docsService.createDoc(ctx, { ...input, kidId }, { source, createdBy: { type: 'mcp', name: `${ctx.adminName || 'מנהלת'} דרך ${clientName}` } });
        return { saved: true, id: doc.id, title: doc.title, kidId: doc.kidId, visibility: doc.visibility, url: docUrl(ctx, doc) };
      }
      case 'update_document': {
        const doc = await docsService.updateDoc(ctx, input.id, input, { mode: input.mode === 'append' ? 'append' : 'replace' });
        return { updated: true, id: doc.id, title: doc.title, visibility: doc.visibility, url: docUrl(ctx, doc) };
      }
      case 'list_documents': {
        const docs = input.general ? await docsService.listGeneral(ctx) : await docsService.listForKid(ctx, await kidIdFor() || '');
        return docs.map(({ content, ...d }) => ({ ...d, length: content.length }));
      }
      case 'get_document': {
        const doc = await docsService.getDoc(ctx, input.id);
        return { ...doc, url: docUrl(ctx, doc) };
      }
    }
  } catch (err) {
    if (err instanceof docsService.DocError) return { error: err.message };
    throw err;
  }
  return null;
}

function kidUrl(ctx, kidId) {
  const id = encodeURIComponent(kidId);
  if (ctx.authType === 'parent') return `${SITE}/p/${id}`;
  if (ctx.authType === 'therapist') return `${SITE}/t/${ctx.practitionerId}/kid/${id}`;
  return `${SITE}/kid/${id}`;
}

const scopeOpts = (ctx) => ({
  practitionerId: ctx.practitionerId || null,
  parentKidId: ctx.authType === 'parent' ? ctx.kidViewId : null,
});

// Admins: a raw kidId must belong to their centre (name lookups are already scoped by adminId).
async function adminMayAccess(ctx, kidId) {
  if (ctx.authType !== 'admin' || ctx.isSuperAdmin || !kidId || /[֐-׿]/.test(kidId)) return true;
  const kid = await therapyService.getKidById(kidId);
  return !kid || !kid.adminId || kid.adminId === ctx.adminId;
}

async function runTool(ctx, name, args) {
  const allowed = toolsForRole(sourceOf(ctx)).some((t) => t.name === name);
  const input = { ...(args || {}) };

  if (name === 'search') {
    const all = await executeToolCall('list_kids', {}, ctx.adminId, scopeOpts(ctx));
    if (!Array.isArray(all)) return all;
    const norm = (s) => String(s || '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const q = norm(input.query);
    const hits = q ? all.filter((k) => norm(k.name).includes(q) || q.includes(norm(k.name))) : [];
    return { results: (hits.length ? hits : all).map((k) => ({ id: `kid:${k.id}`, title: k.name, url: kidUrl(ctx, k.id) })) };
  }

  if (name === 'fetch') {
    const kidId = String(input.id || '').replace(/^kid:/, '');
    if (!kidId) return { error: 'id is required' };
    if (!(await adminMayAccess(ctx, kidId))) return { error: 'אין לך גישה לילד/ה זה/זו' };
    const opts = scopeOpts(ctx);
    const profile = await executeToolCall('get_kid_profile', { kidId }, ctx.adminId, opts);
    if (profile.error) return profile;
    const [goals, forms] = await Promise.all([
      executeToolCall('get_goals', { kidId, activeOnly: true }, ctx.adminId, opts),
      executeToolCall('get_session_forms', { kidId, limit: 5 }, ctx.adminId, opts),
    ]);
    return {
      id: `kid:${kidId}`,
      title: profile.name,
      text: JSON.stringify({ profile, activeGoals: goals, latestSessionForms: forms }, null, 1),
      url: kidUrl(ctx, kidId),
      metadata: { type: 'kid' },
    };
  }

  if (docToolsFor(ctx).some((t) => t.name === name)) return runDocTool(ctx, name, input);

  if (!allowed) return null;
  if (ctx.authType === 'parent' && !input.kidId && !input.kidName) input.kidId = ctx.kidViewId;
  if (!(await adminMayAccess(ctx, input.kidId))) return { error: 'אין לך גישה לילד/ה זה/זו' };
  return executeToolCall(name, input, ctx.adminId, scopeOpts(ctx));
}

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function handleRpc(ctx, msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg && msg.id, -32600, 'Invalid Request');
  }
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null; // notifications/initialized, cancelled, … — nothing to answer
  const p = msg.params || {};

  switch (msg.method) {
    case 'initialize':
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return rpcResult(msg.id, {});
    case 'tools/list':
      return rpcResult(msg.id, { tools: toolList(ctx) });
    case 'tools/call': {
      const started = Date.now();
      let result;
      try {
        result = await runTool(ctx, p.name, p.arguments);
      } catch (err) {
        console.error(`[mcp] tool ${p.name} failed:`, err);
        result = { error: err.message || 'Tool failed' };
      }
      if (result === null) return rpcError(msg.id, -32602, `Unknown tool: ${p.name}`);
      const who = ctx.authType === 'therapist' ? `therapist:${ctx.practitionerId}` : ctx.authType === 'parent' ? `parent:${ctx.kidViewId}` : `admin:${ctx.adminId}`;
      console.log(`[mcp] ${who} ${p.name} ${JSON.stringify(p.arguments || {}).slice(0, 150)} → ${Date.now() - started}ms${result && result.error ? ` error=${result.error}` : ''}`);
      return rpcResult(msg.id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: !!(result && result.error),
      });
    }
    case 'resources/list':
      return rpcResult(msg.id, { resources: [] });
    case 'resources/templates/list':
      return rpcResult(msg.id, { resourceTemplates: [] });
    case 'prompts/list':
      return rpcResult(msg.id, { prompts: [] });
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

router.post('/mcp', asyncHandler(async (req, res) => {
  const token = (/^Bearer (.+)$/i.exec(req.headers.authorization || '') || [])[1];
  const ctx = await auth.contextForAccessToken(token);
  if (!ctx) {
    res.set('WWW-Authenticate', `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource/mcp"${token ? ', error="invalid_token"' : ''}`);
    return res.status(401).json(rpcError(null, -32001, 'Unauthorized'));
  }

  const body = req.body;
  const batch = Array.isArray(body);
  const messages = batch ? body : [body];
  if (!messages.length) return res.status(400).json(rpcError(null, -32600, 'Empty batch'));

  const replies = (await Promise.all(messages.map((m) => handleRpc(ctx, m)))).filter(Boolean);
  if (!replies.length) return res.status(202).end();
  res.json(batch ? replies : replies[0]);
}));

// Stateless server: no server-initiated stream, no sessions to delete.
router.get('/mcp', (_req, res) => res.set('Allow', 'POST').status(405).json(rpcError(null, -32000, 'Method not allowed')));
router.delete('/mcp', (_req, res) => res.set('Allow', 'POST').status(405).end());

module.exports = router;
