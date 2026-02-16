const { getDb } = require('./firebase');
const { v4: uuidv4 } = require('uuid');

// Goal categories constant
const GOAL_CATEGORIES = [
  { id: 'motor-gross', name: 'Gross Motor', nameHe: 'מוטוריקה גסה', order: 1, color: '#4CAF50' },
  { id: 'motor-fine', name: 'Fine Motor', nameHe: 'מוטוריקה עדינה', order: 2, color: '#2196F3' },
  { id: 'language', name: 'Language/Communication', nameHe: 'שפה/תקשורת', order: 3, color: '#FF9800' },
  { id: 'play-social', name: 'Play/Social', nameHe: 'משחק/חברה', order: 4, color: '#E91E63' },
  { id: 'cognitive', name: 'Cognitive', nameHe: 'קוגנטיבי', order: 5, color: '#9C27B0' },
  { id: 'adl', name: 'ADL', nameHe: 'ADL', order: 6, color: '#00BCD4' },
  { id: 'general', name: 'General', nameHe: 'כללי', order: 7, color: '#607D8B' },
];

// ==================== KIDS ====================

async function getAllKids() {
  const db = getDb();
  const snapshot = await db.collection('kids').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getKidById(kidId) {
  const db = getDb();
  const doc = await db.collection('kids').doc(kidId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// ==================== PRACTITIONERS ====================

async function getPractitionersForKid(kidId) {
  const db = getDb();

  // Get kid-practitioner links
  const linksSnapshot = await db.collection('kidPractitioners')
    .where('kidId', '==', kidId)
    .get();

  if (linksSnapshot.empty) return [];

  const practitionerIds = linksSnapshot.docs.map(doc => doc.data().practitionerId);

  // Get practitioner details
  const practitioners = [];
  for (const id of practitionerIds) {
    const practDoc = await db.collection('practitioners').doc(id).get();
    if (practDoc.exists) {
      practitioners.push({ id: practDoc.id, ...practDoc.data() });
    }
  }

  return practitioners;
}

async function addPractitionerToKid(kidId, data, addedBy) {
  const db = getDb();
  const practitionerId = uuidv4();

  // Create practitioner
  const practitioner = {
    name: data.name,
    mobile: data.mobile || null,
    email: data.email || null,
    type: data.type || 'מטפלת',
    isSuperAdmin: false,
    createdAt: new Date(),
    createdBy: addedBy || null,
  };

  await db.collection('practitioners').doc(practitionerId).set(practitioner);

  // Create link
  const linkId = uuidv4();
  await db.collection('kidPractitioners').doc(linkId).set({
    kidId,
    practitionerId,
    role: data.type === 'מטפלת' ? 'therapist' : 'admin',
    addedAt: new Date(),
    addedBy: addedBy || null,
  });

  return { id: practitionerId, ...practitioner };
}

async function updatePractitioner(id, data) {
  const db = getDb();
  const updates = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.mobile !== undefined) updates.mobile = data.mobile;
  if (data.email !== undefined) updates.email = data.email;
  if (data.type !== undefined) updates.type = data.type;

  await db.collection('practitioners').doc(id).update(updates);

  const doc = await db.collection('practitioners').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deletePractitioner(id) {
  const db = getDb();

  // Delete links
  const linksSnapshot = await db.collection('kidPractitioners')
    .where('practitionerId', '==', id)
    .get();

  const batch = db.batch();
  linksSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  batch.delete(db.collection('practitioners').doc(id));

  await batch.commit();
}

async function getMyTherapists(adminId) {
  const db = getDb();
  const snapshot = await db.collection('practitioners')
    .where('createdBy', '==', adminId)
    .where('type', '==', 'מטפלת')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ==================== PARENTS ====================

async function getParentsForKid(kidId) {
  const db = getDb();
  const snapshot = await db.collection('parents')
    .where('kidId', '==', kidId)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function addParentToKid(kidId, data) {
  const db = getDb();
  const parentId = uuidv4();

  const parent = {
    kidId,
    name: data.name,
    mobile: data.mobile || null,
    email: data.email || null,
    createdAt: new Date(),
  };

  await db.collection('parents').doc(parentId).set(parent);
  return { id: parentId, ...parent };
}

async function updateParent(id, data) {
  const db = getDb();
  const updates = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.mobile !== undefined) updates.mobile = data.mobile;
  if (data.email !== undefined) updates.email = data.email;

  await db.collection('parents').doc(id).update(updates);

  const doc = await db.collection('parents').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deleteParent(id) {
  const db = getDb();
  await db.collection('parents').doc(id).delete();
}

// ==================== GOALS ====================

async function getGoalsForKid(kidId) {
  const db = getDb();
  const snapshot = await db.collection('goals')
    .where('kidId', '==', kidId)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function addGoalToKid(kidId, data) {
  const db = getDb();
  const goalId = uuidv4();

  const goal = {
    kidId,
    categoryId: data.categoryId,
    title: data.title,
    isActive: true,
    createdAt: new Date(),
  };

  await db.collection('goals').doc(goalId).set(goal);

  // Also add to goals library for autocomplete
  const librarySnapshot = await db.collection('goalsLibrary')
    .where('title', '==', data.title)
    .where('categoryId', '==', data.categoryId)
    .limit(1)
    .get();

  if (librarySnapshot.empty) {
    await db.collection('goalsLibrary').doc(uuidv4()).set({
      title: data.title,
      categoryId: data.categoryId,
      usageCount: 1,
    });
  } else {
    const libDoc = librarySnapshot.docs[0];
    await libDoc.ref.update({
      usageCount: (libDoc.data().usageCount || 0) + 1,
    });
  }

  return { id: goalId, ...goal };
}

async function updateGoal(id, data) {
  const db = getDb();
  const updates = {};

  if (data.title !== undefined) updates.title = data.title;
  if (data.isActive !== undefined) {
    updates.isActive = data.isActive;
    if (!data.isActive) {
      updates.deactivatedAt = new Date();
    }
  }

  await db.collection('goals').doc(id).update(updates);

  const doc = await db.collection('goals').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deleteGoal(id) {
  const db = getDb();
  await db.collection('goals').doc(id).delete();
}

async function searchGoalsLibrary(search) {
  const db = getDb();

  // Firestore doesn't support full-text search, so we fetch all and filter
  // In production, consider using Algolia or similar
  const snapshot = await db.collection('goalsLibrary')
    .orderBy('usageCount', 'desc')
    .limit(100)
    .get();

  const searchLower = search.toLowerCase();
  const results = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => item.title.toLowerCase().includes(searchLower))
    .slice(0, 10);

  return results;
}

// ==================== SESSIONS ====================

async function getSessionsForKid(kidId, filters = {}) {
  const db = getDb();
  let query = db.collection('sessions').where('kidId', '==', kidId);

  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }

  const snapshot = await query.get();
  let sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter by date range if specified
  if (filters.from) {
    const fromDate = new Date(filters.from);
    sessions = sessions.filter(s => new Date(s.scheduledDate) >= fromDate);
  }
  if (filters.to) {
    const toDate = new Date(filters.to);
    sessions = sessions.filter(s => new Date(s.scheduledDate) <= toDate);
  }

  return sessions;
}

async function scheduleSession(kidId, data) {
  const db = getDb();
  const sessionId = uuidv4();

  const session = {
    kidId,
    therapistId: data.therapistId || null,
    scheduledDate: new Date(data.scheduledDate),
    status: 'scheduled',
    formId: null,
    createdAt: new Date(),
  };

  await db.collection('sessions').doc(sessionId).set(session);
  return { id: sessionId, ...session };
}

async function updateSession(id, data) {
  const db = getDb();
  const updates = {};

  if (data.therapistId !== undefined) updates.therapistId = data.therapistId;
  if (data.scheduledDate !== undefined) updates.scheduledDate = new Date(data.scheduledDate);
  if (data.status !== undefined) updates.status = data.status;
  if (data.formId !== undefined) updates.formId = data.formId;

  await db.collection('sessions').doc(id).update(updates);

  const doc = await db.collection('sessions').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deleteSession(id) {
  const db = getDb();
  await db.collection('sessions').doc(id).delete();
}

async function getSessionAlerts() {
  const db = getDb();

  // Get sessions that are past scheduled date but don't have a form
  const now = new Date();
  const snapshot = await db.collection('sessions')
    .where('status', 'in', ['scheduled', 'pending_form'])
    .get();

  const alerts = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(s => new Date(s.scheduledDate) < now);

  return alerts;
}

// ==================== FORMS ====================

async function getFormsForKid(kidId) {
  const db = getDb();
  const snapshot = await db.collection('sessionForms')
    .where('kidId', '==', kidId)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getFormById(id) {
  const db = getDb();
  const doc = await db.collection('sessionForms').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function getFormForSession(sessionId) {
  const db = getDb();
  const snapshot = await db.collection('sessionForms')
    .where('sessionId', '==', sessionId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function submitForm(data) {
  const db = getDb();
  const formId = uuidv4();
  const sessionDate = new Date(data.sessionDate);

  let sessionId = data.sessionId;

  // If no session provided, create one automatically
  if (!sessionId) {
    sessionId = uuidv4();
    const session = {
      kidId: data.kidId,
      therapistId: data.practitionerId || null,
      scheduledDate: sessionDate,
      status: 'completed',
      formId,
      createdAt: new Date(),
    };
    await db.collection('sessions').doc(sessionId).set(session);
  }

  const form = {
    sessionId,
    kidId: data.kidId,
    practitionerId: data.practitionerId,
    sessionDate,
    cooperation: data.cooperation,
    sessionDuration: data.sessionDuration,
    sittingDuration: data.sittingDuration,
    mood: data.mood || '',
    concentrationLevel: data.concentrationLevel || '',
    newReinforcers: data.newReinforcers || '',
    wordsProduced: data.wordsProduced || '',
    breakActivities: data.breakActivities || '',
    endOfSessionActivity: data.endOfSessionActivity || '',
    successes: data.successes || '',
    difficulties: data.difficulties || '',
    notes: data.notes || '',
    goalsWorkedOn: data.goalsWorkedOn || [],
    additionalGoals: data.additionalGoals || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('sessionForms').doc(formId).set(form);

  // Update session status if it was an existing session
  if (data.sessionId) {
    await db.collection('sessions').doc(data.sessionId).update({
      status: 'completed',
      formId,
    });
  }

  return { id: formId, ...form };
}

async function createFormLink(kidId, sessionId) {
  const db = getDb();
  const token = uuidv4();

  await db.collection('formTokens').doc(token).set({
    kidId,
    sessionId: sessionId || null,
    createdAt: new Date(),
    used: false,
  });

  return { token, url: `/therapy/form/new?kidId=${kidId}&token=${token}${sessionId ? `&sessionId=${sessionId}` : ''}` };
}

// ==================== INIT ====================

async function initializeSuperAdmin() {
  const db = getDb();
  const adminId = 'michal-super-admin';

  const doc = await db.collection('practitioners').doc(adminId).get();
  if (!doc.exists) {
    await db.collection('practitioners').doc(adminId).set({
      name: 'מיכל',
      type: 'מנתחת התנהגות',
      isSuperAdmin: true,
      createdAt: new Date(),
    });
    console.log('Created super admin: מיכל');
  }
}

async function initializeGoalCategories() {
  const db = getDb();

  for (const cat of GOAL_CATEGORIES) {
    const doc = await db.collection('goalCategories').doc(cat.id).get();
    if (!doc.exists) {
      await db.collection('goalCategories').doc(cat.id).set(cat);
    }
  }
  console.log('Goal categories initialized');
}

module.exports = {
  // Kids
  getAllKids,
  getKidById,
  // Practitioners
  getPractitionersForKid,
  addPractitionerToKid,
  updatePractitioner,
  deletePractitioner,
  getMyTherapists,
  // Parents
  getParentsForKid,
  addParentToKid,
  updateParent,
  deleteParent,
  // Goals
  getGoalsForKid,
  addGoalToKid,
  updateGoal,
  deleteGoal,
  searchGoalsLibrary,
  // Sessions
  getSessionsForKid,
  scheduleSession,
  updateSession,
  deleteSession,
  getSessionAlerts,
  // Forms
  getFormsForKid,
  getFormById,
  getFormForSession,
  submitForm,
  createFormLink,
  // Init
  initializeSuperAdmin,
  initializeGoalCategories,
  GOAL_CATEGORIES,
};
