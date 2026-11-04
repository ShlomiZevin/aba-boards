// OAuth 2.1 for the MCP server (ChatGPT / Claude connectors).
//
// The connector registers itself (dynamic client registration), sends the user to /oauth/authorize,
// and the user proves who they are with the same credential the site uses: an admin access code,
// a therapist's personal link (/t/<id>) or a parent link (/p/<kidId>). The token we issue carries
// that identity, so the MCP sees exactly what the person sees on the site — no more.
//
// Firestore: mcpClients/{clientId}, mcpAuthCodes/{sha256(code)}, mcpTokens/{sha256(token)}.
// Codes and tokens are stored only as hashes; TTL policies on expiresAt clean them up.

const crypto = require('crypto');
const { getDb } = require('./firebase');

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const SCOPE = 'aba';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newSecret = () => crypto.randomBytes(32).toString('base64url');

class OAuthError extends Error {
  constructor(code, description, status = 400) {
    super(description);
    this.code = code;
    this.status = status;
  }
}

// ---------- clients (RFC 7591) ----------

function validRedirectUri(uri) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch { return false; }
}

async function registerClient(body = {}) {
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length || redirectUris.length > 10 || !redirectUris.every(validRedirectUri)) {
    throw new OAuthError('invalid_redirect_uri', 'redirect_uris must be https (or http on localhost)');
  }
  const authMethod = ['client_secret_post', 'client_secret_basic'].includes(body.token_endpoint_auth_method)
    ? body.token_endpoint_auth_method : 'none';
  const clientId = `mcp_${crypto.randomBytes(12).toString('hex')}`;
  const clientSecret = authMethod === 'none' ? null : newSecret();
  const now = Math.floor(Date.now() / 1000);
  const client = {
    clientName: String(body.client_name || '').slice(0, 100) || 'MCP client',
    redirectUris,
    authMethod,
    secretHash: clientSecret ? sha256(clientSecret) : null,
    createdAt: new Date(),
  };
  await getDb().collection('mcpClients').doc(clientId).set(client);
  console.log(`[mcp-auth] registered client ${clientId} (${client.clientName})`);
  return {
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: now,
    client_name: client.clientName,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: authMethod,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: SCOPE,
  };
}

async function getClient(clientId) {
  if (!clientId || typeof clientId !== 'string' || clientId.length > 100) return null;
  const doc = await getDb().collection('mcpClients').doc(clientId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// Client authentication at the token endpoint (public clients send only client_id).
async function authenticateClient(req) {
  let clientId = req.body.client_id;
  let secret = req.body.client_secret;
  const basic = /^Basic (.+)$/i.exec(req.headers.authorization || '');
  if (basic) {
    const [id, sec] = Buffer.from(basic[1], 'base64').toString().split(':');
    clientId = decodeURIComponent(id || '');
    secret = decodeURIComponent(sec || '');
  }
  const client = await getClient(clientId);
  if (!client) throw new OAuthError('invalid_client', 'Unknown client', 401);
  if (client.authMethod !== 'none') {
    if (!secret || sha256(secret) !== client.secretHash) throw new OAuthError('invalid_client', 'Bad client secret', 401);
  }
  return client;
}

// ---------- the person: credential → identity ----------

// What the user pastes on the sign-in page. Returns a stored identity or null.
async function identityFromCredential(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 500) return null;
  const db = getDb();

  // Therapist / parent link: .../therapy/t/<practitionerId>/...  or  .../therapy/p/<kidId>/...
  const link = /\/(t|p)\/([^/?#\s]+)/.exec(text);
  if (link) {
    const id = decodeURIComponent(link[2]);
    if (link[1] === 't') {
      const doc = await db.collection('practitioners').doc(id).get();
      return doc.exists ? { authType: 'therapist', practitionerId: id, label: doc.data().name || 'מטפל/ת' } : null;
    }
    const doc = await db.collection('kids').doc(id).get();
    return doc.exists ? { authType: 'parent', kidId: id, label: `הורים של ${doc.data().name || ''}`.trim() } : null;
  }

  // Admin access code
  const snap = await db.collection('adminKeys').where('key', '==', text).limit(1).get();
  if (snap.empty) return null;
  const admin = snap.docs[0].data();
  if (admin.active === false) return null;
  return { authType: 'admin', adminKeyId: snap.docs[0].id, label: admin.name || 'מנהל/ת' };
}

// Identity → the same request fields middleware/auth.js sets. Re-checked on every use (cached briefly),
// so deactivating an access code or deleting a practitioner cuts the connector off too.
const ctxCache = new Map();
const CTX_TTL_MS = 5 * 60 * 1000;

async function contextForIdentity(identity) {
  const cacheKey = JSON.stringify(identity);
  const hit = ctxCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.ctx;
  const db = getDb();
  let ctx = null;
  if (identity.authType === 'admin') {
    const doc = await db.collection('adminKeys').doc(identity.adminKeyId).get();
    const a = doc.exists ? doc.data() : null;
    if (a && a.active !== false) {
      ctx = { authType: 'admin', adminId: a.adminId, isSuperAdmin: !!a.isSuperAdmin, adminName: a.name };
    }
  } else if (identity.authType === 'therapist') {
    const doc = await db.collection('practitioners').doc(identity.practitionerId).get();
    if (doc.exists) {
      ctx = { authType: 'therapist', adminId: doc.data().createdBy, practitionerId: identity.practitionerId, isSuperAdmin: false };
    }
  } else if (identity.authType === 'parent') {
    const doc = await db.collection('kids').doc(identity.kidId).get();
    if (doc.exists) {
      ctx = { authType: 'parent', adminId: doc.data().adminId, kidViewId: identity.kidId, isSuperAdmin: false };
    }
  }
  if (ctx) ctxCache.set(cacheKey, { ctx, expiresAt: Date.now() + CTX_TTL_MS });
  return ctx;
}

// ---------- codes and tokens ----------

async function createAuthCode({ client, redirectUri, codeChallenge, identity, resource }) {
  const code = newSecret();
  await getDb().collection('mcpAuthCodes').doc(sha256(code)).set({
    clientId: client.id, redirectUri, codeChallenge, identity, resource: resource || null,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

async function issueTokens(clientId, identity, resource) {
  const db = getDb();
  const access = newSecret();
  const refresh = newSecret();
  const now = Date.now();
  const batch = db.batch();
  batch.set(db.collection('mcpTokens').doc(sha256(access)), {
    kind: 'access', clientId, identity, resource: resource || null, createdAt: new Date(now), expiresAt: new Date(now + ACCESS_TTL_MS),
  });
  batch.set(db.collection('mcpTokens').doc(sha256(refresh)), {
    kind: 'refresh', clientId, identity, resource: resource || null, createdAt: new Date(now), expiresAt: new Date(now + REFRESH_TTL_MS),
  });
  await batch.commit();
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refresh,
    scope: SCOPE,
  };
}

// Consume a one-time document (auth code / refresh token) inside a transaction.
async function consume(collection, rawValue, check) {
  const db = getDb();
  const ref = db.collection(collection).doc(sha256(String(rawValue || '')));
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new OAuthError('invalid_grant', 'Invalid or used grant');
    const data = doc.data();
    tx.delete(ref);
    if (data.expiresAt.toMillis() < Date.now()) throw new OAuthError('invalid_grant', 'Grant expired');
    check(data);
    return data;
  });
}

function pkceMatches(verifier, challenge) {
  if (!verifier || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return crypto.createHash('sha256').update(verifier).digest('base64url') === challenge;
}

async function exchangeToken(req) {
  const client = await authenticateClient(req);
  const { grant_type: grantType } = req.body;

  if (grantType === 'authorization_code') {
    const data = await consume('mcpAuthCodes', req.body.code, (d) => {
      if (d.clientId !== client.id) throw new OAuthError('invalid_grant', 'Code was issued to another client');
      if (req.body.redirect_uri && req.body.redirect_uri !== d.redirectUri) throw new OAuthError('invalid_grant', 'redirect_uri mismatch');
      if (!pkceMatches(req.body.code_verifier, d.codeChallenge)) throw new OAuthError('invalid_grant', 'PKCE verification failed');
    });
    console.log(`[mcp-auth] tokens issued to ${client.id} for ${data.identity.authType}`);
    return issueTokens(client.id, data.identity, data.resource);
  }

  if (grantType === 'refresh_token') {
    const data = await consume('mcpTokens', req.body.refresh_token, (d) => {
      if (d.kind !== 'refresh') throw new OAuthError('invalid_grant', 'Not a refresh token');
      if (d.clientId !== client.id) throw new OAuthError('invalid_grant', 'Token was issued to another client');
    });
    if (!(await contextForIdentity(data.identity))) throw new OAuthError('invalid_grant', 'Access was revoked');
    return issueTokens(client.id, data.identity, data.resource);
  }

  throw new OAuthError('unsupported_grant_type', 'Only authorization_code and refresh_token are supported');
}

async function revokeToken(token) {
  if (!token) return;
  await getDb().collection('mcpTokens').doc(sha256(String(token))).delete();
}

// Bearer token → request context, or null.
async function contextForAccessToken(token) {
  if (!token) return null;
  const doc = await getDb().collection('mcpTokens').doc(sha256(token)).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.kind !== 'access' || data.expiresAt.toMillis() < Date.now()) return null;
  const ctx = await contextForIdentity(data.identity);
  return ctx ? { ...ctx, clientId: data.clientId } : null;
}

module.exports = {
  OAuthError, SCOPE,
  registerClient, getClient, validRedirectUri,
  identityFromCredential, createAuthCode, exchangeToken, revokeToken, contextForAccessToken,
};
