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

async function getAllKids(adminId) {
  const db = getDb();
  const snapshot = await db.collection('kids')
    .where('adminId', '==', adminId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getKidById(kidId) {
  const db = getDb();
  const doc = await db.collection('kids').doc(kidId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function createKid(data, adminId) {
  const db = getDb();
  const name = (data.name || '').trim();
  if (!name) throw new Error('Name is required');

  const kidId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u0590-\u05FF-]/g, '');
  if (!kidId) throw new Error('Invalid name');

  const existing = await db.collection('kids').doc(kidId).get();
  if (existing.exists) throw new Error('Kid with this name already exists');

  const defaultBoardLayout = {
    items: [
      { id: 1, type: 'bank', label: `קופת החיסכון של ${name}` },
      { id: 2, type: 'progress', title: 'ההתקדמות שלי היום' },
      { id: 3, type: 'header', size: 'medium', text: 'המשימות שלי' },
      { id: 4, type: 'task', taskType: 'regular', taskData: { id: 1, icon: '✅', title: 'משימה לדוגמה', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 5, type: 'header', size: 'medium', text: '💰 משימות בונוס 💰' },
      { id: 6, type: 'task', taskType: 'bonus', taskData: { id: 2, icon: '🌟', title: 'משימת בונוס לדוגמה', type: 'bonus', minReward: 1, maxReward: 5, requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 7, type: 'header', size: 'medium', text: '🧘 פינת ההרגעה 🧘' },
      { id: 8, type: 'task', taskType: 'calm-down', taskData: { id: 3, icon: '🎨', title: 'לוח ציור', type: 'calm-down', activityType: 'paint', activeDays: [0,1,2,3,4,5,6] }},
    ]
  };

  const tasks = defaultBoardLayout.items
    .filter(item => item.type === 'task')
    .map(item => item.taskData);

  const kidDoc = {
    name,
    imageName: '',
    tasks,
    boardLayout: defaultBoardLayout,
    completedTasks: [],
    completedBonusTasks: [],
    bonusRewardsEarned: {},
    totalMoney: 0,
    dailyReward: 0.5,
    coinStyle: 'dollar',
    coinImageName: '',
    age: data.age || '',
    gender: data.gender || '',
    colorSchema: 'purple',
    headerLabel: '',
    savingsLabel: '',
    regularTasksHeader: 'המשימות שלי',
    bonusTasksHeader: '💰 משימות בונוס 💰',
    calmDownHeader: '🧘 פינת ההרגעה 🧘',
    builderPin: '1234',
    todayRewardGiven: false,
    lastResetDate: new Date().toDateString(),
    createdAt: new Date(),
    adminId,
  };

  await db.collection('kids').doc(kidId).set(kidDoc);
  return { id: kidId, ...kidDoc };
}

async function deleteKid(kidId) {
  const db = getDb();

  // Check kid exists
  const kidDoc = await db.collection('kids').doc(kidId).get();
  if (!kidDoc.exists) throw new Error('Kid not found');

  // Collect all documents to delete in batches
  // Firestore batches are limited to 500 operations, so we'll commit in chunks
  const refs = [db.collection('kids').doc(kidId)];

  // Kid-Practitioner links and their practitioners
  const linksSnap = await db.collection('kidPractitioners').where('kidId', '==', kidId).get();
  for (const linkDoc of linksSnap.docs) {
    refs.push(linkDoc.ref);
    refs.push(db.collection('practitioners').doc(linkDoc.data().practitionerId));
  }

  // Parents
  const parentsSnap = await db.collection('parents').where('kidId', '==', kidId).get();
  parentsSnap.docs.forEach(doc => refs.push(doc.ref));

  // Goals
  const goalsSnap = await db.collection('goals').where('kidId', '==', kidId).get();
  goalsSnap.docs.forEach(doc => refs.push(doc.ref));

  // Sessions
  const sessionsSnap = await db.collection('sessions').where('kidId', '==', kidId).get();
  sessionsSnap.docs.forEach(doc => refs.push(doc.ref));

  // Forms
  const formsSnap = await db.collection('sessionForms').where('kidId', '==', kidId).get();
  formsSnap.docs.forEach(doc => refs.push(doc.ref));

  // Delete in batches of 500
  for (let i = 0; i < refs.length; i += 500) {
    const batch = db.batch();
    refs.slice(i, i + 500).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function getAllKidsForSuperAdmin(superAdminId) {
  const db = getDb();
  const snapshot = await db.collection('kids').get();
  const allKids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Build admin name map
  const adminKeysSnap = await db.collection('adminKeys').get();
  const adminNames = {};
  adminKeysSnap.docs.forEach(doc => {
    const data = doc.data();
    adminNames[data.adminId] = data.name;
  });

  const myKids = [];
  const orphanKids = [];
  const otherAdminKids = [];

  for (const kid of allKids) {
    if (kid.adminId === superAdminId) {
      myKids.push(kid);
    } else if (!kid.adminId) {
      orphanKids.push(kid);
    } else {
      otherAdminKids.push({ ...kid, adminName: adminNames[kid.adminId] || kid.adminId });
    }
  }

  // Sort unassociated kids by createdAt descending (newest first)
  orphanKids.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
    return bTime - aTime;
  });

  return { myKids, orphanKids, otherAdminKids };
}

async function detachKid(kidId, adminId) {
  const db = getDb();
  const doc = await db.collection('kids').doc(kidId).get();
  if (!doc.exists) throw new Error('Kid not found');
  if (doc.data().adminId !== adminId) throw new Error('Kid does not belong to this admin');
  await db.collection('kids').doc(kidId).update({ adminId: null });
}

async function attachKid(kidId, adminId) {
  const db = getDb();
  const doc = await db.collection('kids').doc(kidId).get();
  if (!doc.exists) throw new Error('Kid not found');
  const currentAdminId = doc.data().adminId;
  if (currentAdminId) throw new Error('Kid already belongs to another admin');
  await db.collection('kids').doc(kidId).update({ adminId });
}

// ==================== PRACTITIONERS ====================

async function getKidsForPractitioner(practitionerId) {
  const db = getDb();
  const linksSnapshot = await db.collection('kidPractitioners')
    .where('practitionerId', '==', practitionerId)
    .get();

  if (linksSnapshot.empty) return [];

  const kidIds = linksSnapshot.docs.map(doc => doc.data().kidId);
  const kids = [];
  for (const kidId of kidIds) {
    const kidDoc = await db.collection('kids').doc(kidId).get();
    if (kidDoc.exists) {
      kids.push({ id: kidDoc.id, ...kidDoc.data() });
    }
  }
  return kids;
}

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

async function linkExistingPractitionerToKid(kidId, practitionerId, addedBy) {
  const db = getDb();

  // No-op if already linked
  const existing = await db.collection('kidPractitioners')
    .where('kidId', '==', kidId)
    .where('practitionerId', '==', practitionerId)
    .get();
  if (!existing.empty) return;

  const practDoc = await db.collection('practitioners').doc(practitionerId).get();
  if (!practDoc.exists) throw new Error('Practitioner not found');
  const pract = practDoc.data();

  const linkId = uuidv4();
  await db.collection('kidPractitioners').doc(linkId).set({
    kidId,
    practitionerId,
    role: pract.type === 'מטפלת' ? 'therapist' : 'admin',
    addedAt: new Date(),
    addedBy: addedBy || null,
  });
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

async function unlinkPractitioner(kidId, practitionerId) {
  const db = getDb();

  // Only delete the link between this kid and the practitioner
  const linksSnapshot = await db.collection('kidPractitioners')
    .where('kidId', '==', kidId)
    .where('practitionerId', '==', practitionerId)
    .get();

  const batch = db.batch();
  linksSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
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

async function getPractitionerById(id) {
  const db = getDb();
  const doc = await db.collection('practitioners').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function getMyTherapists(adminId) {
  const db = getDb();
  const snapshot = await db.collection('practitioners')
    .where('createdBy', '==', adminId)
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

async function getAllGoalsLibrary() {
  const db = getDb();
  const [libSnapshot, goalsSnapshot] = await Promise.all([
    db.collection('goalsLibrary').orderBy('usageCount', 'desc').limit(1000).get(),
    db.collection('goals').where('isActive', '==', true).get(),
  ]);

  // Count active goals per "title|categoryId" key
  const activeGoalCounts = {};
  goalsSnapshot.docs.forEach(doc => {
    const g = doc.data();
    const key = `${g.title}|${g.categoryId}`;
    activeGoalCounts[key] = (activeGoalCounts[key] || 0) + 1;
  });

  return libSnapshot.docs.map(doc => {
    const data = doc.data();
    const key = `${data.title}|${data.categoryId}`;
    const activeCount = activeGoalCounts[key] || 0;
    return {
      id: doc.id,
      ...data,
      activeCount,
      isOrphan: activeCount === 0,
    };
  });
}

async function deleteGoalLibraryItem(id) {
  const db = getDb();
  await db.collection('goalsLibrary').doc(id).delete();
}

async function addGoalLibraryItem(data) {
  const db = getDb();
  const title = (data.title || '').trim();
  if (!title) throw new Error('Title is required');

  const validCatIds = GOAL_CATEGORIES.map(c => c.id);
  if (!validCatIds.includes(data.categoryId)) throw new Error('Invalid categoryId');

  // Check for duplicate
  const existing = await db.collection('goalsLibrary')
    .where('title', '==', title)
    .where('categoryId', '==', data.categoryId)
    .limit(1)
    .get();
  if (!existing.empty) throw new Error('Goal already exists in library');

  const id = uuidv4();
  const item = { title, categoryId: data.categoryId, usageCount: 0 };
  await db.collection('goalsLibrary').doc(id).set(item);
  return { id, ...item };
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
    type: data.type || 'therapy',
    status: 'scheduled',
    formId: null,
    createdAt: new Date(),
  };

  await db.collection('sessions').doc(sessionId).set(session);
  return { id: sessionId, ...session };
}

async function scheduleRecurringSessions(kidId, data) {
  const db = getDb();
  const { scheduledDate, type, therapistId, until } = data;

  const start = new Date(scheduledDate);
  const end = new Date(until);
  const weekday = start.getDay(); // 0=Sun … 6=Sat

  const sessions = [];
  const cur = new Date(start);
  while (cur <= end) {
    const sessionId = uuidv4();
    const session = {
      kidId,
      therapistId: therapistId || null,
      scheduledDate: new Date(cur),
      type: type || 'therapy',
      status: 'scheduled',
      formId: null,
      createdAt: new Date(),
    };
    await db.collection('sessions').doc(sessionId).set(session);
    sessions.push({ id: sessionId, ...session });
    // Advance by 7 days to same weekday next week
    cur.setDate(cur.getDate() + 7);
  }
  return sessions;
}

async function updateSession(id, data) {
  const db = getDb();
  const updates = {};

  if (data.therapistId !== undefined) updates.therapistId = data.therapistId;
  if (data.scheduledDate !== undefined) updates.scheduledDate = new Date(data.scheduledDate);
  if (data.status !== undefined) updates.status = data.status;
  if (data.formId !== undefined) updates.formId = data.formId;
  if (data.type !== undefined) updates.type = data.type;

  await db.collection('sessions').doc(id).update(updates);

  const doc = await db.collection('sessions').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deleteSession(id) {
  const db = getDb();

  const sessionDoc = await db.collection('sessions').doc(id).get();
  if (sessionDoc.exists) {
    const { formId, type } = sessionDoc.data();
    if (formId) {
      const collection = type === 'meeting' ? 'meetingForms' : 'sessionForms';
      await db.collection(collection).doc(formId).delete();
    }
  }

  await db.collection('sessions').doc(id).delete();
}

async function getSessionAlerts(adminId) {
  const db = getDb();

  // Get sessions that are past scheduled date but don't have a form
  const now = new Date();

  // Get all kids for this admin to filter sessions
  const kidsSnapshot = await db.collection('kids')
    .where('adminId', '==', adminId)
    .get();
  const kidIds = kidsSnapshot.docs.map(doc => doc.id);

  if (kidIds.length === 0) return [];

  const snapshot = await db.collection('sessions')
    .where('status', 'in', ['scheduled', 'pending_form'])
    .where('kidId', 'in', kidIds.slice(0, 10)) // Firestore 'in' limit is 10
    .get();

  const alerts = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(s => new Date(s.scheduledDate) < now);

  return alerts;
}

// ==================== FORMS ====================

async function getFormsForKid(kidId, filters = {}) {
  const db = getDb();
  const snapshot = await db.collection('sessionForms')
    .where('kidId', '==', kidId)
    .get();

  let forms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (filters.weekOf) {
    const weekDate = new Date(filters.weekOf);
    const dayOfWeek = weekDate.getDay();
    const sunday = new Date(weekDate);
    sunday.setDate(weekDate.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    forms = forms.filter(f => {
      const fDate = f.sessionDate?.seconds
        ? new Date(f.sessionDate.seconds * 1000)
        : new Date(f.sessionDate);
      return fDate >= sunday && fDate <= saturday;
    });
  }

  return forms;
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
    customFields: data.customFields || {},
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

async function updateForm(id, data) {
  const db = getDb();
  const updates = { updatedAt: new Date() };

  const allowedFields = [
    'practitionerId', 'sessionDate', 'cooperation', 'sessionDuration', 'sittingDuration',
    'mood', 'concentrationLevel', 'newReinforcers', 'wordsProduced', 'breakActivities',
    'endOfSessionActivity', 'successes', 'difficulties', 'notes',
    'goalsWorkedOn', 'additionalGoals', 'customFields'
  ];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = field === 'sessionDate' ? new Date(data[field]) : data[field];
    }
  }

  await db.collection('sessionForms').doc(id).update(updates);
  const doc = await db.collection('sessionForms').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deleteForm(id) {
  const db = getDb();

  const formDoc = await db.collection('sessionForms').doc(id).get();
  if (!formDoc.exists) throw new Error('Form not found');

  const formData = formDoc.data();

  // Clear formId from associated session
  if (formData.sessionId) {
    const sessionDoc = await db.collection('sessions').doc(formData.sessionId).get();
    if (sessionDoc.exists) {
      await db.collection('sessions').doc(formData.sessionId).update({
        formId: null,
        status: 'scheduled',
      });
    }
  }

  await db.collection('sessionForms').doc(id).delete();
}

// Default form template sections
const DEFAULT_FORM_TEMPLATE = [
  { id: 'cooperation', label: 'שיתוף פעולה', type: 'percentage', order: 1, isDefault: true },
  { id: 'sessionDuration', label: 'משך הטיפול (דקות)', type: 'number', order: 2, isDefault: true },
  { id: 'sittingDuration', label: 'משך ישיבה (דקות)', type: 'number', order: 3, isDefault: true },
  { id: 'mood', label: 'מצב רוח', type: 'text', order: 4, isDefault: true },
  { id: 'concentrationLevel', label: 'רמת ריכוז / עייפות', type: 'text', order: 5, isDefault: true },
  { id: 'newReinforcers', label: 'מחזקים (חדשים)', type: 'text', order: 6, isDefault: true },
  { id: 'wordsProduced', label: 'מילים שהפיק', type: 'text', order: 7, isDefault: true },
  { id: 'breakActivities', label: 'פעילות בהפסקות', type: 'text', order: 8, isDefault: true },
  { id: 'endOfSessionActivity', label: 'פעילות סוף שיעור', type: 'text', order: 9, isDefault: true },
  { id: 'successes', label: 'הצלחות', type: 'text', order: 10, isDefault: true },
  { id: 'difficulties', label: 'קשיים', type: 'text', order: 11, isDefault: true },
  { id: 'notes', label: 'הערות', type: 'text', order: 12, isDefault: true },
];

async function getFormTemplate(kidId) {
  const db = getDb();
  const kidDoc = await db.collection('kids').doc(kidId).get();
  if (!kidDoc.exists) throw new Error('Kid not found');

  const kid = kidDoc.data();
  return kid.formTemplate || { sections: DEFAULT_FORM_TEMPLATE };
}

async function updateFormTemplate(kidId, template) {
  const db = getDb();
  if (!template.sections || !Array.isArray(template.sections)) {
    throw new Error('Invalid template: sections array required');
  }
  for (const section of template.sections) {
    if (!section.id || !section.label || !section.type || section.order === undefined) {
      throw new Error('Invalid section: id, label, type, and order are required');
    }
    if (!['text', 'number', 'percentage'].includes(section.type)) {
      throw new Error(`Invalid section type: ${section.type}`);
    }
  }

  await db.collection('kids').doc(kidId).update({
    formTemplate: { ...template, updatedAt: new Date() }
  });

  return { sections: template.sections, updatedAt: new Date() };
}

// ==================== BOARD REQUESTS ====================

async function getBoardRequests() {
  const db = getDb();
  const snap = await db.collection('boardRequests').orderBy('submittedAt', 'desc').get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function updateBoardRequest(id, data) {
  const db = getDb();
  const allowed = ['status', 'createdBoardId'];
  const updates = {};
  for (const field of allowed) {
    if (data[field] !== undefined) updates[field] = data[field];
  }
  await db.collection('boardRequests').doc(id).update(updates);
  const doc = await db.collection('boardRequests').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deleteBoardRequest(id) {
  const db = getDb();
  await db.collection('boardRequests').doc(id).delete();
}

// ==================== INIT ====================

async function initializeSuperAdmin() {
  const db = getDb();
  const adminId = 'michal-super-admin';

  // Ensure practitioners doc exists
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

  // Ensure adminKeys entry exists for the super admin passkey
  const keySnapshot = await db.collection('adminKeys')
    .where('adminId', '==', adminId)
    .limit(1)
    .get();
  if (keySnapshot.empty) {
    await db.collection('adminKeys').add({
      key: '6724',
      adminId,
      name: 'מיכל',
      isSuperAdmin: true,
      active: true,
      createdAt: new Date(),
    });
    console.log('Seeded super admin passkey');
  } else {
    // Fix name if it was seeded as 'Super Admin'
    const keyDoc = keySnapshot.docs[0];
    if (keyDoc.data().name === 'Super Admin') {
      await keyDoc.ref.update({ name: 'מיכל' });
      console.log('Updated super admin name to מיכל');
    }
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

// ==================== UPDATE KID ====================

async function updateKid(id, data) {
  const db = getDb();
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.age !== undefined) updates.age = data.age;
  if (data.gender !== undefined) updates.gender = data.gender;
  if (data.imageName !== undefined) updates.imageName = data.imageName;
  await db.collection('kids').doc(id).update(updates);
  const doc = await db.collection('kids').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

// ==================== MEETING FORMS ====================

async function getMeetingFormsForKid(kidId) {
  const db = getDb();
  const snap = await db.collection('meetingForms').where('kidId', '==', kidId).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getMeetingFormById(id) {
  const db = getDb();
  const doc = await db.collection('meetingForms').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function submitMeetingForm(data) {
  const db = getDb();
  const formId = uuidv4();
  const sessionDate = new Date(data.sessionDate);

  let sessionId = data.sessionId;
  if (!sessionId) {
    sessionId = uuidv4();
    await db.collection('sessions').doc(sessionId).set({
      kidId: data.kidId,
      therapistId: null,
      scheduledDate: sessionDate,
      type: 'meeting',
      status: 'completed',
      formId,
      createdAt: new Date(),
    });
  }

  const form = {
    sessionId,
    kidId: data.kidId,
    sessionDate,
    attendees: data.attendees || [],
    generalNotes: data.generalNotes || '',
    behaviorNotes: data.behaviorNotes || '',
    adl: data.adl || '',
    grossMotorPrograms: data.grossMotorPrograms || '',
    programsOutsideRoom: data.programsOutsideRoom || '',
    learningProgramsInRoom: data.learningProgramsInRoom || '',
    tasks: data.tasks || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('meetingForms').doc(formId).set(form);

  if (data.sessionId) {
    await db.collection('sessions').doc(data.sessionId).update({ status: 'completed', formId });
  }

  return { id: formId, ...form };
}

async function updateMeetingForm(id, data) {
  const db = getDb();
  const allowed = ['attendees', 'generalNotes', 'behaviorNotes', 'adl',
    'grossMotorPrograms', 'programsOutsideRoom', 'learningProgramsInRoom', 'tasks', 'sessionDate'];
  const updates = { updatedAt: new Date() };
  for (const field of allowed) {
    if (data[field] !== undefined) {
      updates[field] = field === 'sessionDate' ? new Date(data[field]) : data[field];
    }
  }
  await db.collection('meetingForms').doc(id).update(updates);
  const doc = await db.collection('meetingForms').doc(id).get();
  return { id: doc.id, ...doc.data() };
}

async function deleteMeetingForm(id) {
  const db = getDb();
  const doc = await db.collection('meetingForms').doc(id).get();
  if (doc.exists && doc.data().sessionId) {
    await db.collection('sessions').doc(doc.data().sessionId).update({ status: 'scheduled', formId: null });
  }
  await db.collection('meetingForms').doc(id).delete();
}

// ==================== NOTIFICATIONS ====================

async function createNotifications(kidId, adminId, message, targets) {
  const db = getDb();
  const batch = db.batch();
  const now = new Date();
  for (const target of targets) {
    const ref = db.collection('notifications').doc();
    batch.set(ref, {
      kidId,
      adminId,
      message,
      createdAt: now,
      recipientType: target.type,
      recipientId: target.id,
      recipientName: target.name,
      read: false,
      readAt: null,
      dismissed: false,
      dismissedByAdmin: false,
    });
  }
  await batch.commit();
}

async function getMyNotifications(recipientType, recipientId) {
  const db = getDb();
  const snap = await db.collection('notifications')
    .where('recipientType', '==', recipientType)
    .where('recipientId', '==', recipientId)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => !n.dismissed);
}

async function getSentNotifications(kidId, adminId) {
  const db = getDb();
  const snap = await db.collection('notifications')
    .where('kidId', '==', kidId)
    .where('adminId', '==', adminId)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(n => !n.dismissedByAdmin);
}

async function getAllSentNotifications(adminId, { includeHidden = false } = {}) {
  const db = getDb();
  const snap = await db.collection('notifications')
    .where('adminId', '==', adminId)
    .orderBy('createdAt', 'desc')
    .get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return includeHidden ? all : all.filter(n => !n.dismissedByAdmin);
}

async function deleteAllNotifications(adminId) {
  const db = getDb();
  const snap = await db.collection('notifications')
    .where('adminId', '==', adminId)
    .get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function markNotificationRead(notificationId) {
  const db = getDb();
  await db.collection('notifications').doc(notificationId).update({ read: true, readAt: new Date() });
}

async function markAllNotificationsRead(recipientType, recipientId) {
  const db = getDb();
  const snap = await db.collection('notifications')
    .where('recipientType', '==', recipientType)
    .where('recipientId', '==', recipientId)
    .get();
  const unread = snap.docs.filter(d => !d.data().read);
  if (unread.length === 0) return;
  const batch = db.batch();
  const now = new Date();
  unread.forEach(d => batch.update(d.ref, { read: true, readAt: now }));
  await batch.commit();
}

async function deleteNotification(notificationId, adminId) {
  const db = getDb();
  const doc = await db.collection('notifications').doc(notificationId).get();
  if (!doc.exists) throw new Error('Notification not found');
  if (doc.data().adminId !== adminId) throw new Error('Unauthorized');
  await db.collection('notifications').doc(notificationId).delete();
}

async function dismissNotification(notificationId) {
  const db = getDb();
  await db.collection('notifications').doc(notificationId).update({ dismissed: true });
}

async function dismissNotificationByAdmin(notificationId, adminId) {
  const db = getDb();
  const doc = await db.collection('notifications').doc(notificationId).get();
  if (!doc.exists) throw new Error('Notification not found');
  if (doc.data().adminId !== adminId) throw new Error('Unauthorized');
  await db.collection('notifications').doc(notificationId).update({ dismissedByAdmin: true });
}

module.exports = {
  // Kids
  getAllKids,
  getKidById,
  createKid,
  updateKid,
  deleteKid,
  getAllKidsForSuperAdmin,
  detachKid,
  attachKid,
  // Practitioners
  getKidsForPractitioner,
  getPractitionersForKid,
  getPractitionerById,
  addPractitionerToKid,
  linkExistingPractitionerToKid,
  updatePractitioner,
  unlinkPractitioner,
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
  getAllGoalsLibrary,
  deleteGoalLibraryItem,
  addGoalLibraryItem,
  // Sessions
  getSessionsForKid,
  scheduleSession,
  scheduleRecurringSessions,
  updateSession,
  deleteSession,
  getSessionAlerts,
  // Meeting Forms
  getMeetingFormsForKid,
  getMeetingFormById,
  submitMeetingForm,
  updateMeetingForm,
  deleteMeetingForm,
  // Forms
  getFormsForKid,
  getFormById,
  getFormForSession,
  submitForm,
  updateForm,
  deleteForm,
  createFormLink,
  // Form Template
  getFormTemplate,
  updateFormTemplate,
  // Notifications
  createNotifications,
  getMyNotifications,
  getSentNotifications,
  getAllSentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  dismissNotification,
  dismissNotificationByAdmin,
  // Board Requests
  getBoardRequests,
  updateBoardRequest,
  deleteBoardRequest,
  // Init
  initializeSuperAdmin,
  initializeGoalCategories,
  GOAL_CATEGORIES,
};
