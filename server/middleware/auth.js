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
  if (!key) {
    return res.status(401).json({ error: 'Missing access key' });
  }

  try {
    const db = getDb();
    const snapshot = await db.collection('adminKeys')
      .where('key', '==', key)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid access key' });
    }

    const adminData = snapshot.docs[0].data();

    if (adminData.active === false) {
      return res.status(401).json({ error: 'Access key is inactive' });
    }
    req.adminId = adminData.adminId;
    req.isSuperAdmin = adminData.isSuperAdmin || false;
    req.adminName = adminData.name;
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

module.exports = { authenticate, requireSuperAdmin };
