// Documents (מסמכים) — free markdown documents per kid, or general for the centre (kidId null):
// meeting prep, guidance, notes. Written by admins in the app, or sent in from ChatGPT / Claude via MCP.
//
// Firestore: docs/{id} = { kidId|null, adminId, type, title, content, visibility, source, createdBy, createdAt, updatedAt }
//
// Visibility is enforced here, never in the UI:
//   private → the centre's admins only (default — prep notes must not reach parents by accident)
//   team    → + therapists linked to the kid (read-only)
//   parents → + the kid's parents (read-only)

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./firebase');
const therapyService = require('./therapy');

const TYPES = ['meeting-prep', 'guidance', 'note', 'summary', 'other'];
const VISIBILITY = ['private', 'team', 'parents'];
const SOURCES = ['chatgpt', 'claude', 'mcp', 'app', 'site-chat'];
const MAX_CONTENT = 200 * 1024;
const MAX_TITLE = 200;

class DocError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const toIso = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : v instanceof Date ? v : null)?.toISOString() || null;

function serialize(id, d) {
  return {
    id, kidId: d.kidId || null, type: d.type, title: d.title, content: d.content,
    visibility: d.visibility, source: d.source, createdBy: d.createdBy || null,
    createdAt: toIso(d.createdAt), updatedAt: toIso(d.updatedAt),
  };
}

const isAdmin = (ctx) => ctx.authType === 'admin';

// May the caller see this kid at all? (Same rules as the rest of the app.)
async function assertKidAccess(ctx, kidId) {
  const kid = await therapyService.getKidById(kidId);
  if (!kid) throw new DocError(404, 'הילד/ה לא נמצא/ה');
  if (ctx.authType === 'admin') {
    if (!ctx.isSuperAdmin && kid.adminId && kid.adminId !== ctx.adminId) throw new DocError(403, 'אין הרשאה לילד זה');
  } else if (ctx.authType === 'therapist') {
    const mine = await therapyService.getKidsForPractitioner(ctx.practitionerId);
    if (!mine.some((k) => k.id === kidId)) throw new DocError(403, 'אין הרשאה לילד זה');
  } else if (ctx.authType === 'parent') {
    if (ctx.kidViewId !== kidId) throw new DocError(403, 'אין הרשאה לילד זה');
  } else {
    throw new DocError(401, 'Missing access credentials');
  }
  return kid;
}

function visibleTo(ctx, doc) {
  if (isAdmin(ctx)) return true;
  if (ctx.authType === 'therapist') return doc.visibility === 'team' || doc.visibility === 'parents';
  if (ctx.authType === 'parent') return doc.visibility === 'parents';
  return false;
}

async function listForKid(ctx, kidId) {
  await assertKidAccess(ctx, kidId);
  const snap = await getDb().collection('docs').where('kidId', '==', kidId).get();
  return snap.docs
    .filter((d) => visibleTo(ctx, d.data()))
    .map((d) => serialize(d.id, d.data()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

async function listGeneral(ctx) {
  if (ctx.authType === 'parent') throw new DocError(403, 'אין הרשאה');
  const snap = await getDb().collection('docs').where('kidId', '==', null).where('adminId', '==', ctx.adminId).get();
  return snap.docs
    .filter((d) => visibleTo(ctx, d.data()))
    .map((d) => serialize(d.id, d.data()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

// Loads a doc the caller may see; 404 otherwise (don't reveal that a hidden doc exists).
async function loadVisible(ctx, id) {
  if (!id || typeof id !== 'string' || id.length > 100) throw new DocError(404, 'המסמך לא נמצא');
  const snap = await getDb().collection('docs').doc(id).get();
  if (!snap.exists) throw new DocError(404, 'המסמך לא נמצא');
  const d = snap.data();
  try {
    if (d.kidId) await assertKidAccess(ctx, d.kidId);
    else if (ctx.authType === 'parent' || d.adminId !== ctx.adminId) throw new DocError(404, '');
  } catch { throw new DocError(404, 'המסמך לא נמצא'); }
  if (!visibleTo(ctx, d)) throw new DocError(404, 'המסמך לא נמצא');
  return { ref: snap.ref, data: d };
}

async function getDoc(ctx, id) {
  const { data } = await loadVisible(ctx, id);
  return serialize(id, data);
}

function clean(input, { partial }) {
  const out = {};
  if (input.title !== undefined || !partial) {
    const title = String(input.title || '').trim().slice(0, MAX_TITLE);
    if (!title) throw new DocError(400, 'חסרה כותרת');
    out.title = title;
  }
  if (input.content !== undefined || !partial) {
    const content = String(input.content || '');
    if (!content.trim()) throw new DocError(400, 'חסר תוכן');
    if (content.length > MAX_CONTENT) throw new DocError(400, 'המסמך ארוך מדי');
    out.content = content;
  }
  if (input.type !== undefined || !partial) out.type = TYPES.includes(input.type) ? input.type : 'other';
  if (input.visibility !== undefined || !partial) {
    if (input.visibility !== undefined && !VISIBILITY.includes(input.visibility)) throw new DocError(400, 'visibility must be private, team or parents');
    out.visibility = input.visibility || 'private';
  }
  return out;
}

async function createDoc(ctx, input, { source = 'app', createdBy } = {}) {
  if (!isAdmin(ctx)) throw new DocError(403, 'Admin access required');
  const kidId = input.kidId || null;
  const kid = kidId ? await assertKidAccess(ctx, kidId) : null;
  const now = new Date();
  const doc = {
    kidId,
    adminId: kid ? (kid.adminId || ctx.adminId) : ctx.adminId,
    ...clean(input, { partial: false }),
    source: SOURCES.includes(source) ? source : 'app',
    createdBy: createdBy || { type: 'admin', name: ctx.adminName || null },
    createdAt: now,
    updatedAt: now,
  };
  const id = uuidv4();
  await getDb().collection('docs').doc(id).set(doc);
  return serialize(id, doc);
}

// mode 'append' adds content after the existing text (for building a doc up over a conversation).
async function updateDoc(ctx, id, input, { mode = 'replace' } = {}) {
  if (!isAdmin(ctx)) throw new DocError(403, 'Admin access required');
  const { ref, data } = await loadVisible(ctx, id);
  const updates = clean(input, { partial: true });
  if (mode === 'append' && updates.content !== undefined) {
    updates.content = `${data.content}\n\n${updates.content}`;
    if (updates.content.length > MAX_CONTENT) throw new DocError(400, 'המסמך ארוך מדי');
  }
  updates.updatedAt = new Date();
  await ref.update(updates);
  return serialize(id, { ...data, ...updates });
}

async function deleteDoc(ctx, id) {
  if (!isAdmin(ctx)) throw new DocError(403, 'Admin access required');
  const { ref } = await loadVisible(ctx, id);
  await ref.delete();
}

module.exports = { TYPES, VISIBILITY, DocError, listForKid, listGeneral, getDoc, createDoc, updateDoc, deleteDoc };
