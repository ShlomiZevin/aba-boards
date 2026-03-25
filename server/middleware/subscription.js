const { getDb } = require('../services/firebase');

// Cache subscription checks for 60 seconds to reduce Firestore reads
const SUB_CACHE_TTL = 60 * 1000;
const subCache = new Map();

function getCached(adminId) {
  const entry = subCache.get(adminId);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  subCache.delete(adminId);
  return null;
}

function setSubCache(adminId, data) {
  subCache.set(adminId, { data, expiresAt: Date.now() + SUB_CACHE_TTL });
}

// Call this to invalidate cache after payment activation
function invalidateSubCache(adminId) {
  subCache.delete(adminId);
}

async function requireActiveSubscription(req, res, next) {
  // Super admin — always allowed
  if (req.isSuperAdmin) return next();

  // Therapist and parent views — they use the admin's subscription, skip check here
  // (they can't pay anyway, and the admin is responsible)
  if (req.authType === 'therapist' || req.authType === 'parent') return next();

  const adminId = req.adminId;
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let subData = getCached(adminId);

    if (!subData) {
      const db = getDb();
      const snap = await db.collection('subscriptions')
        .where('adminId', '==', adminId)
        .limit(1)
        .get();

      if (snap.empty) {
        // No subscription doc — could be an old admin created before this feature.
        // Give them a grace pass and log it.
        console.warn(`No subscription found for admin ${adminId} — allowing access (legacy account)`);
        return next();
      }

      subData = snap.docs[0].data();
      setSubCache(adminId, subData);
    }

    const now = new Date();

    // Trial active
    if (subData.plan === 'trial' && subData.status === 'active') {
      const trialEnd = subData.trialEndDate?.toDate?.() || new Date(0);
      if (now < trialEnd) return next();
      // Trial expired — update status (async, don't block)
      updateExpiredStatus(adminId);
      return res.status(403).json({ error: 'subscription_expired', message: 'תקופת הניסיון הסתיימה' });
    }

    // Pro active
    if (subData.plan === 'pro' && subData.status === 'active') {
      return next();
    }

    // Anything else (expired, cancelled)
    return res.status(403).json({ error: 'subscription_expired', message: 'המנוי אינו פעיל' });

  } catch (err) {
    console.error('Subscription check error:', err);
    // On error, allow access to avoid blocking legitimate users
    return next();
  }
}

async function updateExpiredStatus(adminId) {
  try {
    const db = getDb();
    const snap = await db.collection('subscriptions')
      .where('adminId', '==', adminId)
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ status: 'expired', updatedAt: new Date() });
      invalidateSubCache(adminId);
    }
  } catch (err) {
    console.error('Failed to update expired status:', err);
  }
}

module.exports = { requireActiveSubscription, invalidateSubCache };
