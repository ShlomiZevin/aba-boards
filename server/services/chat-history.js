// AI chat history — one document per conversation in `chatConversations`.
//
// Ownership comes from the auth headers, never the request body:
//   admin → adminId, therapist → practitionerId, parent → kidId (the family link).
// Owners see their own conversations; the super admin (Michal) can read everyone's.
// Conversations live 14 days from the last message: `expiresAt` is pushed forward
// on every turn, and a Firestore TTL policy on that field does the deleting
// (TTL can lag up to a day, so reads also filter out anything past expiresAt).

const admin = require('firebase-admin');
const { getDb } = require('./firebase');

const COL = 'chatConversations';
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_MSG_CHARS = 30000;
const MAX_DOC_BYTES = 900 * 1024; // Firestore caps a document at 1 MiB

const ROLE_LABEL = { admin: 'מנהל/ת', therapist: 'מטפל/ת', parent: 'הורה' };

function ownerOf(req) {
  if (req.authType === 'therapist') return { ownerType: 'therapist', ownerId: req.practitionerId };
  if (req.authType === 'parent') return { ownerType: 'parent', ownerId: req.kidViewId };
  return { ownerType: 'admin', ownerId: req.adminId };
}

const isOwner = (conv, req) => {
  const o = ownerOf(req);
  return conv.ownerType === o.ownerType && conv.ownerId === o.ownerId;
};
const canRead = (conv, req) => isOwner(conv, req) || !!req.isSuperAdmin;
const isExpired = (conv) => !conv.expiresAt || conv.expiresAt.toMillis() < Date.now();
const toIso = (ts) => (ts && ts.toDate ? ts.toDate().toISOString() : ts || null);

async function ownerName(req) {
  const db = getDb();
  try {
    if (req.authType === 'therapist') {
      const d = await db.collection('practitioners').doc(req.practitionerId).get();
      return d.exists ? d.data().name || 'מטפל/ת' : 'מטפל/ת';
    }
    if (req.authType === 'parent') {
      const d = await db.collection('kids').doc(req.kidViewId).get();
      return d.exists ? `הורים של ${d.data().name || ''}`.trim() : 'הורים';
    }
  } catch { /* fall through */ }
  return req.adminName || 'מנהל/ת';
}

async function kidName(kidId) {
  if (!kidId) return null;
  try {
    const d = await getDb().collection('kids').doc(kidId).get();
    return d.exists ? d.data().name || null : null;
  } catch { return null; }
}

function cleanMessage(m) {
  const out = {
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, MAX_MSG_CHARS),
    at: new Date().toISOString(),
  };
  if (Array.isArray(m.toolsUsed) && m.toolsUsed.length) out.toolsUsed = m.toolsUsed.slice(0, 20).map(String);
  if (m.boardUpdated) out.boardUpdated = true;
  if (m.summaryCreated) out.summaryCreated = true;
  if (Array.isArray(m.images) && m.images.length) out.images = m.images.slice(0, 4).map(String);
  if (m.imageModelLabel) out.imageModelLabel = String(m.imageModelLabel);
  return out;
}

function summarize(id, c, req) {
  return {
    id,
    title: c.title,
    ownerType: c.ownerType,
    ownerName: c.ownerName,
    ownerRole: ROLE_LABEL[c.ownerType] || c.ownerType,
    kidId: c.kidId || null,
    kidName: c.kidName || null,
    messageCount: c.messageCount || 0,
    createdAt: toIso(c.createdAt),
    updatedAt: toIso(c.updatedAt),
    expiresAt: toIso(c.expiresAt),
    isMine: isOwner(c, req),
  };
}

/** Throws a 4xx-tagged error if `id` is given but can't be written by this caller. */
async function assertWritable(req, id) {
  if (!id) return;
  const doc = await getDb().collection(COL).doc(id).get();
  if (!doc.exists || isExpired(doc.data())) return; // gone → a new conversation will start
  if (!isOwner(doc.data(), req)) {
    const err = new Error('אפשר לצפות בשיחה הזו אך לא להמשיך אותה');
    err.status = 403;
    throw err;
  }
}

/**
 * Appends user + assistant messages. Creates the conversation when `id` is
 * missing, expired or deleted. Returns the conversation id.
 */
async function appendTurn(req, id, kidId, newMessages) {
  const db = getDb();
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + RETENTION_MS);
  const msgs = newMessages.map(cleanMessage);

  let ref = id ? db.collection(COL).doc(id) : null;
  if (ref) {
    const snap = await ref.get();
    if (!snap.exists || isExpired(snap.data())) ref = null;
  }

  if (!ref) {
    ref = db.collection(COL).doc();
    const o = ownerOf(req);
    const firstUser = msgs.find(m => m.role === 'user');
    await ref.set({
      ...o,
      ownerName: await ownerName(req),
      centerAdminId: req.adminId || null,
      kidId: kidId || null,
      kidName: await kidName(kidId),
      title: (firstUser ? firstUser.content : 'שיחה').replace(/\s+/g, ' ').trim().slice(0, 70) || 'שיחה',
      messages: msgs,
      messageCount: msgs.length,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });
    return ref.id;
  }

  const newKidName = await kidName(kidId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const c = snap.data();
    const messages = (c.messages || []).concat(msgs);
    while (messages.length > 2 && Buffer.byteLength(JSON.stringify(messages)) > MAX_DOC_BYTES) messages.shift();
    const update = { messages, messageCount: messages.length, updatedAt: now, expiresAt };
    if ((kidId || null) !== (c.kidId || null)) {
      update.kidId = kidId || null;
      update.kidName = newKidName;
    }
    tx.update(ref, update);
  });
  return ref.id;
}

async function listConversations(req, { scope } = {}) {
  const db = getDb();
  const nowTs = admin.firestore.Timestamp.now();
  const fields = ['title', 'ownerType', 'ownerId', 'ownerName', 'kidId', 'kidName', 'messageCount', 'createdAt', 'updatedAt', 'expiresAt'];
  let snap;
  if (scope === 'all' && req.isSuperAdmin) {
    // expiresAt moves with every message, so ordering by it = ordering by last activity
    snap = await db.collection(COL).where('expiresAt', '>', nowTs).orderBy('expiresAt', 'desc').limit(500).select(...fields).get();
  } else {
    const o = ownerOf(req);
    snap = await db.collection(COL).where('ownerType', '==', o.ownerType).where('ownerId', '==', o.ownerId).select(...fields).get();
  }
  return snap.docs
    .filter(d => !isExpired(d.data()))
    .map(d => summarize(d.id, d.data(), req))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

async function getConversation(req, id) {
  const doc = await getDb().collection(COL).doc(id).get();
  if (!doc.exists || isExpired(doc.data()) || !canRead(doc.data(), req)) return null;
  return { ...summarize(doc.id, doc.data(), req), messages: doc.data().messages || [] };
}

async function deleteConversation(req, id) {
  const ref = getDb().collection(COL).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  if (!isOwner(doc.data(), req) && !req.isSuperAdmin) return false;
  await ref.delete();
  return true;
}

module.exports = { appendTurn, assertWritable, listConversations, getConversation, deleteConversation };
