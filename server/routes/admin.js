const express = require('express');
const router = express.Router();
const publicRouter = express.Router(); // no auth required
const { requireSuperAdmin } = require('../middleware/auth');
const { getDb } = require('../services/firebase');
const { v4: uuidv4 } = require('uuid');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/admin/me — validate key and return current admin info
router.get('/me', asyncHandler(async (req, res) => {
  const db = getDb();

  // Fetch mobile/email from practitioners doc
  const practDoc = await db.collection('practitioners').doc(req.adminId).get();
  const pract = practDoc.exists ? practDoc.data() : {};

  // Fetch subscription
  let subscription = null;
  if (!req.isSuperAdmin) {
    const subSnap = await db.collection('subscriptions')
      .where('adminId', '==', req.adminId)
      .limit(1)
      .get();
    if (!subSnap.empty) {
      const sub = subSnap.docs[0].data();
      subscription = {
        plan: sub.plan,
        status: sub.status,
        trialEndDate: sub.trialEndDate?.toDate?.()?.toISOString() || null,
        proEndDate: sub.proEndDate?.toDate?.()?.toISOString() || null,
        billingCycle: sub.billingCycle || null,
        nextPaymentDate: sub.nextPaymentDate?.toDate?.()?.toISOString() || null,
        paypalSubscriptionId: sub.paypalSubscriptionId || null,
      };
    }
  }

  res.json({
    adminId: req.adminId,
    isSuperAdmin: req.isSuperAdmin,
    name: req.adminName,
    mobile: pract.mobile || '',
    email: pract.email || '',
    subscription,
  });
}));

// PUT /api/admin/profile — update own name/mobile/email
router.put('/profile', asyncHandler(async (req, res) => {
  const { name, mobile, email } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'שם הוא שדה חובה' });

  const db = getDb();

  // Update adminKeys doc
  const keySnap = await db.collection('adminKeys')
    .where('adminId', '==', req.adminId)
    .limit(1)
    .get();
  if (!keySnap.empty) {
    await keySnap.docs[0].ref.update({ name: name.trim() });
  }

  // Update practitioners doc
  await db.collection('practitioners').doc(req.adminId).set({
    name: name.trim(),
    mobile: mobile?.trim() || '',
    email: email?.trim() || '',
  }, { merge: true });

  res.json({ success: true, name: name.trim(), mobile: mobile?.trim() || '', email: email?.trim() || '' });
}));

// GET /api/admin/subscription — get own subscription
router.get('/subscription', asyncHandler(async (req, res) => {
  if (req.isSuperAdmin) return res.json({ isSuperAdmin: true });

  const db = getDb();
  const subSnap = await db.collection('subscriptions')
    .where('adminId', '==', req.adminId)
    .limit(1)
    .get();
  if (subSnap.empty) return res.status(404).json({ error: 'לא נמצא מנוי' });

  const sub = subSnap.docs[0].data();
  res.json({
    plan: sub.plan,
    status: sub.status,
    trialEndDate: sub.trialEndDate?.toDate?.()?.toISOString() || null,
    proEndDate: sub.proEndDate?.toDate?.()?.toISOString() || null,
    billingCycle: sub.billingCycle || null,
    nextPaymentDate: sub.nextPaymentDate?.toDate?.()?.toISOString() || null,
    paypalSubscriptionId: sub.paypalSubscriptionId || null,
  });
}));

// POST /api/admin/signup — PUBLIC (no auth required)
publicRouter.post('/signup', asyncHandler(async (req, res) => {
  const { name, mobile, email, key } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'שם הוא שדה חובה' });
  if (!mobile?.trim()) return res.status(400).json({ error: 'טלפון הוא שדה חובה' });
  if (!email?.trim()) return res.status(400).json({ error: 'אימייל הוא שדה חובה' });
  if (!key?.trim()) return res.status(400).json({ error: 'מפתח גישה הוא שדה חובה' });
  if (key.trim().length < 4) return res.status(400).json({ error: 'מפתח גישה חייב להכיל לפחות 4 תווים' });

  const db = getDb();

  // Check key is unique
  const existing = await db.collection('adminKeys').where('key', '==', key.trim()).limit(1).get();
  if (!existing.empty) return res.status(400).json({ error: 'מפתח גישה זה כבר בשימוש' });

  const adminId = uuidv4();
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  await db.collection('adminKeys').add({
    key: key.trim(),
    adminId,
    name: name.trim(),
    isSuperAdmin: false,
    active: true,
    createdAt: now,
    createdBy: 'self-signup',
  });

  await db.collection('practitioners').doc(adminId).set({
    name: name.trim(),
    mobile: mobile.trim(),
    email: email.trim(),
    type: 'מנתחת התנהגות',
    isSuperAdmin: false,
    adminId,
    createdAt: now,
    createdBy: 'self-signup',
  });

  await db.collection('subscriptions').add({
    adminId,
    plan: 'trial',
    status: 'active',
    trialStartDate: now,
    trialEndDate: trialEnd,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Self-signup: new admin ${name.trim()} (${adminId})`);
  res.status(201).json({ key: key.trim(), adminId, name: name.trim() });
}));

// GET /api/admin/list — super admin only: list all center admins
router.get('/list', requireSuperAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  const snapshot = await db.collection('adminKeys')
    .where('isSuperAdmin', '==', false)
    .get();

  const admins = await Promise.all(snapshot.docs.map(async doc => {
    const data = doc.data();
    // Pull contact details from practitioners doc
    const practDoc = await db.collection('practitioners').doc(data.adminId).get();
    const pract = practDoc.exists ? practDoc.data() : {};
    return {
      docId: doc.id,
      adminId: data.adminId,
      name: data.name,
      key: data.key,
      active: data.active,
      mobile: pract.mobile || '',
      email: pract.email || '',
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    };
  }));

  res.json(admins);
}));

// POST /api/admin/create-key — super admin only
router.post('/create-key', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { name, mobile, email, key } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'שם הוא שדה חובה' });
  if (!key?.trim()) return res.status(400).json({ error: 'מפתח גישה הוא שדה חובה' });
  if (key.trim().length < 4) return res.status(400).json({ error: 'מפתח גישה חייב להכיל לפחות 4 תווים' });

  const db = getDb();

  // Check key is unique
  const existing = await db.collection('adminKeys').where('key', '==', key.trim()).limit(1).get();
  if (!existing.empty) return res.status(400).json({ error: 'מפתח גישה זה כבר בשימוש' });

  const adminId = uuidv4();

  await db.collection('adminKeys').add({
    key: key.trim(),
    adminId,
    name: name.trim(),
    isSuperAdmin: false,
    active: true,
    createdAt: new Date(),
    createdBy: req.adminId,
  });

  await db.collection('practitioners').doc(adminId).set({
    name: name.trim(),
    mobile: mobile?.trim() || '',
    email: email?.trim() || '',
    type: 'מנתחת התנהגות',
    isSuperAdmin: false,
    createdAt: new Date(),
    createdBy: req.adminId,
  });

  console.log(`Created new center admin: ${name.trim()}`);
  res.status(201).json({ key: key.trim(), adminId, name: name.trim() });
}));

// DELETE /api/admin/:adminId — super admin only
router.delete('/:adminId', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  if (adminId === req.adminId) {
    return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
  }

  const db = getDb();
  const keySnapshot = await db.collection('adminKeys')
    .where('adminId', '==', adminId)
    .get();

  const batch = db.batch();
  keySnapshot.docs.forEach(doc => batch.delete(doc.ref));
  batch.delete(db.collection('practitioners').doc(adminId));
  await batch.commit();

  console.log(`Deleted admin: ${adminId}`);
  res.status(204).send();
}));

// POST /api/admin/change-key — any authenticated user can change their own key
router.post('/change-key', asyncHandler(async (req, res) => {
  const { newKey } = req.body;
  if (!newKey?.trim()) return res.status(400).json({ error: 'מפתח גישה חסר' });
  if (newKey.trim().length < 4) return res.status(400).json({ error: 'מפתח גישה חייב להכיל לפחות 4 תווים' });

  const db = getDb();

  // Check new key is unique (excluding current user's key)
  const existing = await db.collection('adminKeys')
    .where('key', '==', newKey.trim())
    .limit(1)
    .get();
  if (!existing.empty && existing.docs[0].data().adminId !== req.adminId) {
    return res.status(400).json({ error: 'מפתח גישה זה כבר בשימוש' });
  }

  const snapshot = await db.collection('adminKeys')
    .where('adminId', '==', req.adminId)
    .limit(1)
    .get();

  if (snapshot.empty) return res.status(404).json({ error: 'לא נמצא מפתח גישה' });

  await snapshot.docs[0].ref.update({ key: newKey.trim() });
  res.json({ success: true });
}));

const errorHandler = (err, req, res, next) => {
  console.error('Admin API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
};
router.use(errorHandler);
publicRouter.use(errorHandler);

module.exports = { router, publicRouter };
