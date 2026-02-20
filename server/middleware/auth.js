const { getDb } = require('../services/firebase');

// ==================== AUTH MIDDLEWARE ====================
//
// OPTION A (active): Passkey lookup via X-Admin-Key header
//
// OPTION B (future - swap this file to use Firebase Auth):
// async function authenticate(req, res, next) {
//   const authHeader = req.headers.authorization;
//   if (!authHeader?.startsWith('Bearer ')) {
//     return res.status(401).json({ error: 'Missing token' });
//   }
//   const token = authHeader.split('Bearer ')[1];
//   try {
//     const { getAuth } = require('../services/firebase');
//     const decoded = await getAuth().verifyIdToken(token);
//     // If using stable adminId: look it up via users collection
//     // const userDoc = await db.collection('users').doc(decoded.uid).get();
//     // req.adminId = userDoc.data().adminId;
//     req.adminId = decoded.uid;
//     req.isSuperAdmin = decoded.isSuperAdmin || false;
//     req.adminName = decoded.name || '';
//     next();
//   } catch (err) {
//     return res.status(401).json({ error: 'Invalid token' });
//   }
// }

async function authenticate(req, res, next) {
  const key = req.headers['x-admin-key'];
  const practitionerId = req.headers['x-practitioner-id'];
  const kidViewId = req.headers['x-kid-id'];

  try {
    const db = getDb();

    if (key) {
      // --- Admin passkey auth ---
      const snapshot = await db.collection('adminKeys')
        .where('key', '==', key)
        .limit(1)
        .get();
      if (snapshot.empty) return res.status(401).json({ error: 'Invalid access key' });
      const adminData = snapshot.docs[0].data();
      if (adminData.active === false) return res.status(401).json({ error: 'Access key is inactive' });
      req.adminId = adminData.adminId;
      req.isSuperAdmin = adminData.isSuperAdmin || false;
      req.adminName = adminData.name;
      req.authType = 'admin';

    } else if (practitionerId) {
      // --- Therapist auth (practitioner ID in header, set by frontend) ---
      const pDoc = await db.collection('practitioners').doc(practitionerId).get();
      if (!pDoc.exists) return res.status(401).json({ error: 'Invalid practitioner' });
      req.adminId = pDoc.data().createdBy;
      req.practitionerId = practitionerId;
      req.authType = 'therapist';

    } else if (kidViewId) {
      // --- Parent read-only auth (kidId in header) ---
      const kDoc = await db.collection('kids').doc(kidViewId).get();
      if (!kDoc.exists) return res.status(404).json({ error: 'Kid not found' });
      req.adminId = kDoc.data().adminId;
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
