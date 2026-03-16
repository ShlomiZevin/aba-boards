const { getDb } = require('../services/firebase');

// In-memory auth cache — avoids hitting Firestore on every request
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const authCache = new Map(); // cacheKey → { data, expiresAt }

function getCached(key) {
  const entry = authCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  authCache.delete(key);
  return null;
}

function setCache(key, data) {
  authCache.set(key, { data, expiresAt: Date.now() + AUTH_CACHE_TTL });
}

async function authenticate(req, res, next) {
  const key = req.headers['x-admin-key'];
  const practitionerId = req.headers['x-practitioner-id'];
  const rawKidId = req.headers['x-kid-id'];
  const kidViewId = rawKidId ? decodeURIComponent(rawKidId) : undefined;

  try {
    const db = getDb();

    if (key) {
      // --- Admin passkey auth ---
      const cacheKey = `admin:${key}`;
      let adminData = getCached(cacheKey);
      if (!adminData) {
        const snapshot = await db.collection('adminKeys')
          .where('key', '==', key)
          .limit(1)
          .get();
        if (snapshot.empty) return res.status(401).json({ error: 'Invalid access key' });
        adminData = snapshot.docs[0].data();
        setCache(cacheKey, adminData);
      }
      if (adminData.active === false) return res.status(401).json({ error: 'Access key is inactive' });
      req.adminId = adminData.adminId;
      req.isSuperAdmin = adminData.isSuperAdmin || false;
      req.adminName = adminData.name;
      req.authType = 'admin';

    } else if (practitionerId) {
      // --- Therapist auth (practitioner ID in header, set by frontend) ---
      const cacheKey = `therapist:${practitionerId}`;
      let pData = getCached(cacheKey);
      if (!pData) {
        const pDoc = await db.collection('practitioners').doc(practitionerId).get();
        if (!pDoc.exists) return res.status(401).json({ error: 'Invalid practitioner' });
        pData = pDoc.data();
        setCache(cacheKey, pData);
      }
      req.adminId = pData.createdBy;
      req.practitionerId = practitionerId;
      req.authType = 'therapist';

    } else if (kidViewId) {
      // --- Parent read-only auth (kidId in header) ---
      const cacheKey = `kid:${kidViewId}`;
      let kData = getCached(cacheKey);
      if (!kData) {
        const kDoc = await db.collection('kids').doc(kidViewId).get();
        if (!kDoc.exists) return res.status(404).json({ error: 'Kid not found' });
        kData = kDoc.data();
        setCache(cacheKey, kData);
      }
      req.adminId = kData.adminId;
      req.kidViewId = kidViewId;
      req.authType = 'parent';

    } else {
      return res.status(401).json({ error: 'Missing access credentials' });
    }

    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

// Block write operations for non-admin auth
function requireAdmin(req, res, next) {
  if (req.authType !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireSuperAdmin, requireAdmin };
