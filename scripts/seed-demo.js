const path = require('path');
const { randomUUID: uuidv4 } = require('crypto');
const { getDb } = require(path.join(__dirname, '..', 'server', 'services', 'firebase'));

// ==================== DETERMINISTIC IDs ====================
// Using fixed IDs so re-running always overwrites, never duplicates
const ADMIN_ID = 'demo3-admin';
const NOA_ID = 'demo3-noa';
const ORI_ID = 'demo3-ori';

const SARA_ID = 'demo3-pract-sara';
const RONIT_ID = 'demo3-pract-ronit';
const DANA_ID = 'demo3-pract-dana';
const YAEL_ID = 'demo3-pract-yael';

const G_NOA_1 = 'demo3-goal-noa-1', G_NOA_2 = 'demo3-goal-noa-2', G_NOA_3 = 'demo3-goal-noa-3', G_NOA_4 = 'demo3-goal-noa-4';
const G_ORI_1 = 'demo3-goal-ori-1', G_ORI_2 = 'demo3-goal-ori-2', G_ORI_3 = 'demo3-goal-ori-3', G_ORI_4 = 'demo3-goal-ori-4';

const S_NOA_1 = 'demo3-sess-noa-1', S_NOA_2 = 'demo3-sess-noa-2', S_NOA_3 = 'demo3-sess-noa-3';
const S_NOA_4 = 'demo3-sess-noa-4', S_NOA_5 = 'demo3-sess-noa-5', S_NOA_6 = 'demo3-sess-noa-6';
const S_ORI_1 = 'demo3-sess-ori-1', S_ORI_2 = 'demo3-sess-ori-2', S_ORI_3 = 'demo3-sess-ori-3';
const S_ORI_4 = 'demo3-sess-ori-4', S_ORI_5 = 'demo3-sess-ori-5', S_ORI_6 = 'demo3-sess-ori-6', S_ORI_7 = 'demo3-sess-ori-7';

const F_NOA_1 = 'demo3-form-noa-1', F_NOA_2 = 'demo3-form-noa-2', MF_NOA = 'demo3-mform-noa-1';
const F_ORI_1 = 'demo3-form-ori-1', F_ORI_2 = 'demo3-form-ori-2', F_ORI_3 = 'demo3-form-ori-3', MF_ORI = 'demo3-mform-ori-1';

const P_NOA_1 = 'demo3-parent-noa-1', P_NOA_2 = 'demo3-parent-noa-2';
const P_ORI_1 = 'demo3-parent-ori-1', P_ORI_2 = 'demo3-parent-ori-2';

const KP_1 = 'demo3-kp-1', KP_2 = 'demo3-kp-2', KP_3 = 'demo3-kp-3';
const KP_4 = 'demo3-kp-4', KP_5 = 'demo3-kp-5', KP_6 = 'demo3-kp-6';

const N_1 = 'demo3-notif-1', N_2 = 'demo3-notif-2', N_3 = 'demo3-notif-3';

// ==================== GOAL SNAPSHOTS ====================
// Pre-defined so they can be reused correctly in forms
const GOAL_NOA_1 = { goalId: G_NOA_1, goalTitle: 'להגיד משפטים של 3 מילים ומעלה', categoryId: 'language' };
const GOAL_NOA_2 = { goalId: G_NOA_2, goalTitle: 'לשחק משחק תורות עם ילד אחר', categoryId: 'play-social' };
const GOAL_NOA_3 = { goalId: G_NOA_3, goalTitle: 'לצבוע בתוך הקווים', categoryId: 'motor-fine' };
const GOAL_NOA_4 = { goalId: G_NOA_4, goalTitle: 'להתלבש באופן עצמאי', categoryId: 'adl' };

const GOAL_ORI_1 = { goalId: G_ORI_1, goalTitle: 'לבצע הוראה בת 3 שלבים', categoryId: 'cognitive' };
const GOAL_ORI_2 = { goalId: G_ORI_2, goalTitle: 'לשבת על כיסא 10 דקות רצוף', categoryId: 'motor-gross' };
const GOAL_ORI_3 = { goalId: G_ORI_3, goalTitle: 'לארגן תיק בית ספר באופן עצמאי', categoryId: 'adl' };
const GOAL_ORI_4 = { goalId: G_ORI_4, goalTitle: 'להמתין לתור בלי להתפרץ', categoryId: 'general' };

function d(year, month, day, hour = 10, min = 0) {
  return new Date(year, month - 1, day, hour, min);
}

// ==================== CLEANUP ====================
async function deleteByQuery(db, collection, field, value) {
  const snap = await db.collection(collection).where(field, '==', value).get();
  for (const doc of snap.docs) await doc.ref.delete();
  return snap.size;
}

async function cleanup(db) {
  console.log('Cleaning up previous demo data...');

  // Admin key
  await deleteByQuery(db, 'adminKeys', 'adminId', ADMIN_ID);

  // Kid-practitioner links
  for (const kidId of [NOA_ID, ORI_ID]) {
    await deleteByQuery(db, 'kidPractitioners', 'kidId', kidId);
  }

  // Per-kid data
  for (const kidId of [NOA_ID, ORI_ID]) {
    await deleteByQuery(db, 'sessionForms', 'kidId', kidId);
    await deleteByQuery(db, 'meetingForms', 'kidId', kidId);
    await deleteByQuery(db, 'sessions', 'kidId', kidId);
    await deleteByQuery(db, 'goals', 'kidId', kidId);
    await deleteByQuery(db, 'parents', 'kidId', kidId);
    await deleteByQuery(db, 'notifications', 'kidId', kidId);

    const kidDoc = db.collection('kids').doc(kidId);
    if ((await kidDoc.get()).exists) await kidDoc.delete();
  }

  // Practitioners
  await deleteByQuery(db, 'practitioners', 'adminId', ADMIN_ID);
  // Also delete the admin practitioner doc itself
  const adminDoc = db.collection('practitioners').doc(ADMIN_ID);
  if ((await adminDoc.get()).exists) await adminDoc.delete();

  console.log('Cleanup done.\n');
}

// ==================== MAIN ====================
async function main() {
  const db = getDb();

  // await cleanup(db); // uncomment to remove old demo data first
  console.log('Seeding demo data...\n');

  // ==================== 1. ADMIN KEY ====================
  console.log('1. Creating admin key...');
  await db.collection('adminKeys').add({
    key: 'demo3',
    adminId: ADMIN_ID,
    name: 'מרכז טיפולי לדוגמה',
    isSuperAdmin: false,
    active: true,
    createdAt: new Date(),
  });

  await db.collection('practitioners').doc(ADMIN_ID).set({
    name: 'מרכז טיפולי לדוגמה',
    type: 'מנתחת התנהגות',
    isSuperAdmin: false,
    createdAt: new Date(),
    createdBy: null,
    adminId: ADMIN_ID,
  });

  // ==================== 2. PRACTITIONERS ====================
  console.log('2. Creating practitioners...');

  const practitioners = [
    { id: SARA_ID, name: 'שרה כהן', type: 'מטפלת', mobile: '050-1234567', email: 'sara.k@example.com' },
    { id: RONIT_ID, name: 'רונית לוי', type: 'מנתחת התנהגות', mobile: '052-9876543', email: 'ronit.l@example.com' },
    { id: DANA_ID, name: 'דנה אברהם', type: 'מטפלת', mobile: '054-5551234', email: 'dana.a@example.com' },
    { id: YAEL_ID, name: 'יעל מזרחי', type: 'מדריכת הורים', mobile: '053-7778888', email: 'yael.m@example.com' },
  ];

  for (const p of practitioners) {
    await db.collection('practitioners').doc(p.id).set({
      name: p.name,
      type: p.type,
      mobile: p.mobile,
      email: p.email,
      isSuperAdmin: false,
      createdAt: new Date(),
      createdBy: ADMIN_ID,
      adminId: ADMIN_ID,
    });
  }

  // ==================== 3. KID: נועה ====================
  console.log('3. Creating kid: נועה...');

  const noaTasks = [
    { id: 1, icon: '🗣️', title: 'לומר משפט שלם', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 2, icon: '👕', title: 'להתלבש לבד', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 3, icon: '🦷', title: 'לצחצח שיניים', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 4, icon: '🎒', title: 'להכין תיק לגן', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4] },
    { id: 5, icon: '🍽️', title: 'לאכול ארוחה בשולחן', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 6, icon: '🌙', title: 'ללכת לישון בזמן', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 7, icon: '🎨', title: 'לוח ציור', type: 'calm-down', activityType: 'paint', activeDays: [0,1,2,3,4,5,6] },
    { id: 8, icon: '🌬️', title: 'תרגיל נשימות', type: 'calm-down', activityType: 'breathing', activeDays: [0,1,2,3,4,5,6] },
  ];

  const noaLayout = {
    items: [
      { id: 1, type: 'bank', label: 'קופת הנקודות של נועה' },
      { id: 2, type: 'progress', title: 'ההתקדמות שלי היום' },
      { id: 3, type: 'header', size: 'medium', text: '✨ המשימות שלי ✨' },
      ...noaTasks.filter(t => t.type === 'regular').map((t, i) => ({
        id: 4 + i, type: 'task', taskType: 'regular', taskData: t,
      })),
      { id: 10, type: 'header', size: 'medium', text: '🧘 פינת ההרגעה 🧘' },
      ...noaTasks.filter(t => t.type === 'calm-down').map((t, i) => ({
        id: 11 + i, type: 'task', taskType: 'calm-down', taskData: t,
      })),
    ],
  };

  await db.collection('kids').doc(NOA_ID).set({
    name: 'נועה', age: 5, gender: 'girl', imageName: '',
    kidDescription: 'ילדה על הרצף האוטיסטי, תפקוד גבוה. אוהבת ציור ומוזיקה',
    behaviorGoals: 'שיפור תקשורת מילולית, משחק עם ילדים אחרים, ויסות רגשי',
    personalInfo: '',
    tasks: noaTasks, boardLayout: noaLayout,
    completedTasks: [1, 3, 5], completedBonusTasks: [], bonusRewardsEarned: {},
    totalMoney: 12.5,
    dailyReward: 1, coinStyle: 'points', coinImageName: '',
    colorSchema: 'pink', headerLabel: '', savingsLabel: 'הנקודות שלי',
    regularTasksHeader: '✨ המשימות שלי ✨',
    bonusTasksHeader: '💰 משימות בונוס 💰',
    calmDownHeader: '🧘 פינת ההרגעה 🧘',
    showDino: true, soundsEnabled: true, builderPin: '1234',
    todayRewardGiven: false, lastResetDate: new Date().toDateString(),
    createdAt: d(2026, 1, 15), adminId: ADMIN_ID, selfBuilt: false, inviteToken: null,
  });

  // ==================== 4. KID: אורי ====================
  console.log('4. Creating kid: אורי...');

  const oriTasks = [
    { id: 1, icon: '🛏️', title: 'לסדר את המיטה', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 2, icon: '📚', title: 'להכין שיעורי בית', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4] },
    { id: 3, icon: '🎒', title: 'לארגן תיק בית ספר', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4] },
    { id: 4, icon: '🧼', title: 'לשטוף ידיים לפני אוכל', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 5, icon: '🪥', title: 'לצחצח שיניים בוקר וערב', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 6, icon: '👂', title: 'להקשיב להוראה ולבצע', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 7, icon: '⏰', title: 'לחכות לתור בסבלנות', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] },
    { id: 8, icon: '🎨', title: 'לוח ציור', type: 'calm-down', activityType: 'paint', activeDays: [0,1,2,3,4,5,6] },
    { id: 9, icon: '🫧', title: 'בועות סבון', type: 'calm-down', activityType: 'bubbles', activeDays: [0,1,2,3,4,5,6] },
    { id: 10, icon: '🌬️', title: 'תרגיל נשימות', type: 'calm-down', activityType: 'breathing', activeDays: [0,1,2,3,4,5,6] },
  ];

  const oriLayout = {
    items: [
      { id: 1, type: 'bank', label: 'קופת הנקודות של אורי' },
      { id: 2, type: 'progress', title: 'ההתקדמות שלי היום' },
      { id: 3, type: 'header', size: 'medium', text: '✨ המשימות שלי ✨' },
      ...oriTasks.filter(t => t.type === 'regular').map((t, i) => ({
        id: 4 + i, type: 'task', taskType: 'regular', taskData: t,
      })),
      { id: 11, type: 'header', size: 'medium', text: '🧘 פינת ההרגעה 🧘' },
      ...oriTasks.filter(t => t.type === 'calm-down').map((t, i) => ({
        id: 12 + i, type: 'task', taskType: 'calm-down', taskData: t,
      })),
    ],
  };

  await db.collection('kids').doc(ORI_ID).set({
    name: 'אורי', age: 7, gender: 'boy', imageName: '',
    kidDescription: 'ילד עם ADHD, אנרגטי ומלא חיים. אוהב כדורגל ולגו',
    behaviorGoals: 'שיפור ריכוז, ישיבה בשולחן, ביצוע הוראות רב שלביות',
    personalInfo: '',
    tasks: oriTasks, boardLayout: oriLayout,
    completedTasks: [1, 4], completedBonusTasks: [], bonusRewardsEarned: {},
    totalMoney: 8,
    dailyReward: 0.5, coinStyle: 'points', coinImageName: '',
    colorSchema: 'blue', headerLabel: '', savingsLabel: 'הנקודות שלי',
    regularTasksHeader: '✨ המשימות שלי ✨',
    bonusTasksHeader: '💰 משימות בונוס 💰',
    calmDownHeader: '🧘 פינת ההרגעה 🧘',
    showDino: true, soundsEnabled: true, builderPin: '1234',
    todayRewardGiven: false, lastResetDate: new Date().toDateString(),
    createdAt: d(2026, 1, 20), adminId: ADMIN_ID, selfBuilt: false, inviteToken: null,
  });

  // ==================== 5. KID-PRACTITIONER LINKS ====================
  console.log('5. Linking practitioners to kids...');

  const links = [
    { id: KP_1, kidId: NOA_ID, practitionerId: SARA_ID },
    { id: KP_2, kidId: NOA_ID, practitionerId: RONIT_ID },
    { id: KP_3, kidId: NOA_ID, practitionerId: YAEL_ID },
    { id: KP_4, kidId: ORI_ID, practitionerId: SARA_ID },
    { id: KP_5, kidId: ORI_ID, practitionerId: DANA_ID },
    { id: KP_6, kidId: ORI_ID, practitionerId: YAEL_ID },
  ];

  for (const link of links) {
    await db.collection('kidPractitioners').doc(link.id).set({
      kidId: link.kidId,
      practitionerId: link.practitionerId,
      role: 'therapist',
      addedAt: new Date(),
      addedBy: ADMIN_ID,
    });
  }

  // ==================== 6. PARENTS ====================
  console.log('6. Creating parents...');

  const parents = [
    { id: P_NOA_1, kidId: NOA_ID, name: 'אבי דוד', mobile: '050-3334444', email: 'avi.david@example.com' },
    { id: P_NOA_2, kidId: NOA_ID, name: 'מיכל דוד', mobile: '052-5556666', email: 'michal.david@example.com' },
    { id: P_ORI_1, kidId: ORI_ID, name: 'יוסי כהן', mobile: '054-1112222', email: 'yossi.cohen@example.com' },
    { id: P_ORI_2, kidId: ORI_ID, name: 'רחל כהן', mobile: '050-9998877', email: 'rachel.cohen@example.com' },
  ];

  for (const p of parents) {
    await db.collection('parents').doc(p.id).set({
      kidId: p.kidId,
      name: p.name,
      mobile: p.mobile,
      email: p.email,
      createdAt: new Date(),
    });
  }

  // ==================== 7. GOALS ====================
  console.log('7. Creating goals...');

  const goals = [
    { id: G_NOA_1, kidId: NOA_ID, categoryId: 'language', title: 'להגיד משפטים של 3 מילים ומעלה', isActive: true },
    { id: G_NOA_2, kidId: NOA_ID, categoryId: 'play-social', title: 'לשחק משחק תורות עם ילד אחר', isActive: true },
    { id: G_NOA_3, kidId: NOA_ID, categoryId: 'motor-fine', title: 'לצבוע בתוך הקווים', isActive: true },
    { id: G_NOA_4, kidId: NOA_ID, categoryId: 'adl', title: 'להתלבש באופן עצמאי', isActive: true },
    { id: G_ORI_1, kidId: ORI_ID, categoryId: 'cognitive', title: 'לבצע הוראה בת 3 שלבים', isActive: true },
    { id: G_ORI_2, kidId: ORI_ID, categoryId: 'motor-gross', title: 'לשבת על כיסא 10 דקות רצוף', isActive: true },
    { id: G_ORI_3, kidId: ORI_ID, categoryId: 'adl', title: 'לארגן תיק בית ספר באופן עצמאי', isActive: true },
    { id: G_ORI_4, kidId: ORI_ID, categoryId: 'general', title: 'להמתין לתור בלי להתפרץ', isActive: true },
  ];

  for (const g of goals) {
    await db.collection('goals').doc(g.id).set({
      kidId: g.kidId,
      categoryId: g.categoryId,
      title: g.title,
      isActive: g.isActive,
      createdAt: d(2026, 1, 20),
    });
  }

  // ==================== 8. SESSIONS - נועה ====================
  console.log('8. Creating sessions for נועה...');

  const noaSessions = [
    { id: S_NOA_1, kidId: NOA_ID, therapistId: SARA_ID,  scheduledDate: d(2026, 2, 18, 10, 0), type: 'therapy', status: 'completed', formId: F_NOA_1 },
    { id: S_NOA_2, kidId: NOA_ID, therapistId: RONIT_ID, scheduledDate: d(2026, 2, 20, 14, 0), type: 'therapy', status: 'completed', formId: F_NOA_2 },
    { id: S_NOA_3, kidId: NOA_ID, therapistId: null,      scheduledDate: d(2026, 2, 23, 11, 0), type: 'meeting', status: 'completed', formId: MF_NOA },
    { id: S_NOA_4, kidId: NOA_ID, therapistId: SARA_ID,  scheduledDate: d(2026, 2, 25, 10, 0), type: 'therapy', status: 'pending_form', formId: null },
    { id: S_NOA_5, kidId: NOA_ID, therapistId: RONIT_ID, scheduledDate: d(2026, 2, 27, 14, 0), type: 'therapy', status: 'scheduled', formId: null },
    { id: S_NOA_6, kidId: NOA_ID, therapistId: SARA_ID,  scheduledDate: d(2026, 3, 2, 10, 0),  type: 'therapy', status: 'scheduled', formId: null },
  ];

  for (const s of noaSessions) {
    await db.collection('sessions').doc(s.id).set({
      kidId: s.kidId, therapistId: s.therapistId,
      scheduledDate: s.scheduledDate, type: s.type,
      status: s.status, formId: s.formId,
      createdAt: d(2026, 2, 1),
    });
  }

  // ==================== 9. SESSIONS - אורי ====================
  console.log('9. Creating sessions for אורי...');

  const oriSessions = [
    { id: S_ORI_1, kidId: ORI_ID, therapistId: DANA_ID, scheduledDate: d(2026, 2, 16, 9, 0),  type: 'therapy', status: 'completed', formId: F_ORI_1 },
    { id: S_ORI_2, kidId: ORI_ID, therapistId: SARA_ID, scheduledDate: d(2026, 2, 18, 14, 0), type: 'therapy', status: 'completed', formId: F_ORI_2 },
    { id: S_ORI_3, kidId: ORI_ID, therapistId: DANA_ID, scheduledDate: d(2026, 2, 19, 9, 0),  type: 'therapy', status: 'missed', formId: null },
    { id: S_ORI_4, kidId: ORI_ID, therapistId: null,     scheduledDate: d(2026, 2, 22, 11, 0), type: 'meeting', status: 'completed', formId: MF_ORI },
    { id: S_ORI_5, kidId: ORI_ID, therapistId: DANA_ID, scheduledDate: d(2026, 2, 24, 9, 0),  type: 'therapy', status: 'completed', formId: F_ORI_3 },
    { id: S_ORI_6, kidId: ORI_ID, therapistId: SARA_ID, scheduledDate: d(2026, 2, 26, 14, 0), type: 'therapy', status: 'scheduled', formId: null },
    { id: S_ORI_7, kidId: ORI_ID, therapistId: DANA_ID, scheduledDate: d(2026, 3, 1, 9, 0),   type: 'therapy', status: 'scheduled', formId: null },
  ];

  for (const s of oriSessions) {
    await db.collection('sessions').doc(s.id).set({
      kidId: s.kidId, therapistId: s.therapistId,
      scheduledDate: s.scheduledDate, type: s.type,
      status: s.status, formId: s.formId,
      createdAt: d(2026, 2, 1),
    });
  }

  // ==================== 10. SESSION FORMS - נועה ====================
  console.log('10. Creating session forms for נועה...');

  // Form 1: שרה כהן, 18/02
  await db.collection('sessionForms').doc(F_NOA_1).set({
    sessionId: S_NOA_1,
    kidId: NOA_ID,
    practitionerId: SARA_ID,
    sessionDate: d(2026, 2, 18, 10, 0),
    cooperation: 75,
    sessionDuration: 45,
    sittingDuration: 30,
    mood: 'מצב רוח טוב, הגיעה עם חיוך. קצת עייפה לקראת סוף הטיפול',
    concentrationLevel: 'ריכוז בינוני-טוב. הצליחה להתמקד 10 דקות רצוף',
    newReinforcers: 'מדבקות של חד-קרן, בועות סבון',
    wordsProduced: 'אמא, תני, עוד, שלי, בובה, כדור',
    breakActivities: 'נדנדה על הנדנדה, ציור חופשי',
    endOfSessionActivity: 'משחק עם בצק',
    successes: 'אמרה משפט של 3 מילים: "אני רוצה עוד". שיתפה פעולה במשחק תורות',
    difficulties: 'קושי במעברים בין פעילויות. סירבה לסיים את הציור',
    notes: 'להמשיך לעבוד על משפטים ארוכים. לנסות משחק תורות עם ילד נוסף בשבוע הבא',
    goalsWorkedOn: [GOAL_NOA_1, GOAL_NOA_2],
    additionalGoals: [],
    customFields: {},
    createdAt: d(2026, 2, 18, 11, 0),
    updatedAt: d(2026, 2, 18, 11, 0),
  });

  // Form 2: רונית לוי, 20/02
  await db.collection('sessionForms').doc(F_NOA_2).set({
    sessionId: S_NOA_2,
    kidId: NOA_ID,
    practitionerId: RONIT_ID,
    sessionDate: d(2026, 2, 20, 14, 0),
    cooperation: 85,
    sessionDuration: 50,
    sittingDuration: 35,
    mood: 'שמחה ונלהבת. ביקשה להמשיך לשחק בסוף הטיפול',
    concentrationLevel: 'ריכוז גבוה היום. הצליחה להתמקד 15 דקות',
    newReinforcers: 'סיפור על דינוזאורים',
    wordsProduced: 'אני רוצה, תן לי, עוד פעם, יופי, סבבה',
    breakActivities: 'ריצה חופשית בחצר',
    endOfSessionActivity: 'צפייה בסרטון קצר',
    successes: 'צבעה בתוך הקווים במשך 5 דקות! אמרה "אני רוצה עוד צבע" - משפט של 4 מילים',
    difficulties: 'עדיין מתקשה בקשר עין ממושך. לא רצתה לשתף בצבעים',
    notes: 'התקדמות מעולה במוטוריקה עדינה. להמשיך לחזק שיתוף',
    goalsWorkedOn: [GOAL_NOA_1, GOAL_NOA_3],
    additionalGoals: ['עבודה על קשר עין'],
    customFields: {},
    createdAt: d(2026, 2, 20, 15, 0),
    updatedAt: d(2026, 2, 20, 15, 0),
  });

  // ==================== 11. MEETING FORM - נועה ====================
  console.log('11. Creating meeting form for נועה...');

  await db.collection('meetingForms').doc(MF_NOA).set({
    sessionId: S_NOA_3,
    kidId: NOA_ID,
    sessionDate: d(2026, 2, 23, 11, 0),
    attendees: [
      { type: 'parent', id: P_NOA_2, name: 'מיכל דוד' },
      { type: 'practitioner', id: SARA_ID, name: 'שרה כהן' },
      { type: 'practitioner', id: RONIT_ID, name: 'רונית לוי' },
      { type: 'practitioner', id: YAEL_ID, name: 'יעל מזרחי' },
    ],
    generalNotes: 'ישיבת צוות חודשית לסיכום התקדמות נועה. האם מדווחת על שיפור בתקשורת בבית - נועה מבקשת דברים במילים במקום בבכי.',
    behaviorNotes: 'ירידה בהתפרצויות זעם מ-3 ביום ל-1 בממוצע. משתמשת יותר במילים לבטא רגשות.',
    adl: 'מתלבשת לבד (חולצה ומכנסיים), עדיין צריכה עזרה בכפתורים ורוכסנים. אוכלת לבד עם כפית.',
    grossMotorPrograms: 'תרגילי שיווי משקל על קורה. קפיצה ברגליים מאוחדות - שיפור ניכר.',
    programsOutsideRoom: 'משחק בחצר עם ילד אחד - לתרגל תורות ושיתוף.',
    learningProgramsInRoom: 'התאמת צורות, חידות של 12 חלקים, מיון צבעים.',
    tasks: 'להמשיך לתרגל משפטים של 3+ מילים. להוסיף משחק תפקידים. לעבוד על הלבשה עצמאית עם כפתורים.',
    createdAt: d(2026, 2, 23, 12, 0),
    updatedAt: d(2026, 2, 23, 12, 0),
  });

  // ==================== 12. SESSION FORMS - אורי ====================
  console.log('12. Creating session forms for אורי...');

  // Form 1: דנה אברהם, 16/02
  await db.collection('sessionForms').doc(F_ORI_1).set({
    sessionId: S_ORI_1,
    kidId: ORI_ID,
    practitionerId: DANA_ID,
    sessionDate: d(2026, 2, 16, 9, 0),
    cooperation: 60,
    sessionDuration: 45,
    sittingDuration: 20,
    mood: 'חסר מנוחה, הגיע אחרי לילה קצר. קשה לו להתיישב',
    concentrationLevel: 'ריכוז נמוך היום. הצליח להתרכז 5 דקות בכל פעם',
    newReinforcers: 'זמן עם לגו, כדורגל בחצר',
    wordsProduced: '',
    breakActivities: 'ריצה בחצר, בעיטות בכדור',
    endOfSessionActivity: 'בניית מגדל לגו',
    successes: 'הצליח לבצע הוראה דו-שלבית: "קח את הכדור ושים על השולחן"',
    difficulties: 'קשה לו להמתין. קם מהכיסא כל 3 דקות. סירב לארגן את התיק',
    notes: 'לנסות טיימר ויזואלי לישיבה. לחזק כל ישיבה של 5 דקות',
    goalsWorkedOn: [GOAL_ORI_1, GOAL_ORI_2],
    additionalGoals: [],
    customFields: {},
    createdAt: d(2026, 2, 16, 10, 0),
    updatedAt: d(2026, 2, 16, 10, 0),
  });

  // Form 2: שרה כהן, 18/02
  await db.collection('sessionForms').doc(F_ORI_2).set({
    sessionId: S_ORI_2,
    kidId: ORI_ID,
    practitionerId: SARA_ID,
    sessionDate: d(2026, 2, 18, 14, 0),
    cooperation: 70,
    sessionDuration: 45,
    sittingDuration: 25,
    mood: 'מצב רוח סביר. שמח להגיע לטיפול',
    concentrationLevel: 'ריכוז בינוני. הצליח להתרכז 8 דקות עם טיימר',
    newReinforcers: 'משחק מחשב 5 דקות, ממתק',
    wordsProduced: '',
    breakActivities: 'קפיצות על טרמפולינה',
    endOfSessionActivity: 'משחק קלפי זיכרון',
    successes: 'ישב 8 דקות רצוף עם טיימר ויזואלי! שיא אישי. ארגן את התיק עם הנחיה מינימלית',
    difficulties: 'עדיין מתקשה בהוראה תלת-שלבית. שכח את השלב האמצעי',
    notes: 'הטיימר הויזואלי עובד מצוין. להמשיך להגדיל בהדרגה את זמן הישיבה',
    goalsWorkedOn: [GOAL_ORI_2, GOAL_ORI_3],
    additionalGoals: ['תרגול שימוש בטיימר'],
    customFields: {},
    createdAt: d(2026, 2, 18, 15, 0),
    updatedAt: d(2026, 2, 18, 15, 0),
  });

  // Form 3: דנה אברהם, 24/02
  await db.collection('sessionForms').doc(F_ORI_3).set({
    sessionId: S_ORI_5,
    kidId: ORI_ID,
    practitionerId: DANA_ID,
    sessionDate: d(2026, 2, 24, 9, 0),
    cooperation: 80,
    sessionDuration: 50,
    sittingDuration: 30,
    mood: 'מצב רוח מעולה! סיפר בהתרגשות על משחק כדורגל',
    concentrationLevel: 'ריכוז טוב. שיפור ניכר. 12 דקות ישיבה רצופה',
    newReinforcers: 'סטיקרים של כדורגלנים',
    wordsProduced: '',
    breakActivities: 'בועות סבון, ריצה',
    endOfSessionActivity: 'ציור חופשי',
    successes: 'ביצע הוראה תלת-שלבית לראשונה! "קח את הספר, שים על המדף, ובוא שב". ישב 12 דקות רצוף!',
    difficulties: 'קושי קל בהמתנה לתור במשחק. שיפור מהפגישה הקודמת',
    notes: 'פריצת דרך בהוראות תלת-שלביות! לחזק ולתרגל עם וריאציות שונות',
    goalsWorkedOn: [GOAL_ORI_1, GOAL_ORI_2, GOAL_ORI_4],
    additionalGoals: [],
    customFields: {},
    createdAt: d(2026, 2, 24, 10, 0),
    updatedAt: d(2026, 2, 24, 10, 0),
  });

  // ==================== 13. MEETING FORM - אורי ====================
  console.log('13. Creating meeting form for אורי...');

  await db.collection('meetingForms').doc(MF_ORI).set({
    sessionId: S_ORI_4,
    kidId: ORI_ID,
    sessionDate: d(2026, 2, 22, 11, 0),
    attendees: [
      { type: 'parent', id: P_ORI_1, name: 'יוסי כהן' },
      { type: 'parent', id: P_ORI_2, name: 'רחל כהן' },
      { type: 'practitioner', id: DANA_ID, name: 'דנה אברהם' },
      { type: 'practitioner', id: YAEL_ID, name: 'יעל מזרחי' },
    ],
    generalNotes: 'ישיבת הורים חודשית. שני ההורים נוכחים. ההורים מדווחים על שיפור בבית - אורי מצליח יותר לשבת בארוחות ולהקשיב להוראות.',
    behaviorNotes: 'ירידה בפעלתנות יתר בשעות אחר הצהריים. משתמש יותר בבקשות מילוליות במקום לקחת דברים.',
    adl: 'מסדר את המיטה לבד (לא מושלם אבל עצמאי). מצחצח שיניים עם פיקוח. מתחיל לארגן את התיק עם רשימת ציוד.',
    grossMotorPrograms: 'ריצות קצרות עם עצירה לפי פקודה. תרגילי שיווי משקל על רגל אחת.',
    programsOutsideRoom: 'משחק כדורגל מובנה עם כללים. תרגול המתנה בתור בחצר.',
    learningProgramsInRoom: 'מעקב אחרי הוראות מרובות שלבים. משחקי זיכרון. פאזלים.',
    tasks: 'להמשיך עם טיימר ויזואלי - להגדיל ל-15 דקות. לתרגל הוראות תלת-שלביות יומית. ההורים מתבקשים לתרגל ארגון תיק עם רשימה.',
    createdAt: d(2026, 2, 22, 12, 0),
    updatedAt: d(2026, 2, 22, 12, 0),
  });

  // ==================== 14. NOTIFICATIONS ====================
  console.log('14. Creating notifications...');

  const notifications = [
    {
      id: N_1,
      kidId: NOA_ID, adminId: ADMIN_ID,
      message: 'נועה הראתה התקדמות מעולה השבוע בתקשורת! אמרה משפט של 4 מילים לראשונה',
      recipientType: 'practitioner', recipientId: SARA_ID, recipientName: 'שרה כהן',
      read: true, readAt: d(2026, 2, 21, 9, 0), dismissed: false, dismissedByAdmin: false,
      createdAt: d(2026, 2, 20, 16, 0),
    },
    {
      id: N_2,
      kidId: ORI_ID, adminId: ADMIN_ID,
      message: 'נא לעדכן את ההורים של אורי לגבי תוכנית הישיבה עם הטיימר הויזואלי - הם ביקשו לדעת איך ליישם בבית',
      recipientType: 'practitioner', recipientId: YAEL_ID, recipientName: 'יעל מזרחי',
      read: false, readAt: null, dismissed: false, dismissedByAdmin: false,
      createdAt: d(2026, 2, 23, 10, 0),
    },
    {
      id: N_3,
      kidId: NOA_ID, adminId: ADMIN_ID,
      message: 'שלום מיכל, מצורף סיכום ההתקדמות של נועה בחודש פברואר. נועה ממשיכה להתקדם יפה מאוד בתחום השפה והתקשורת. נשמח לדבר על המשך התוכנית',
      recipientType: 'parent', recipientId: P_NOA_2, recipientName: 'מיכל דוד',
      read: true, readAt: d(2026, 2, 24, 20, 0), dismissed: false, dismissedByAdmin: false,
      createdAt: d(2026, 2, 24, 14, 0),
    },
  ];

  for (const n of notifications) {
    const { id, ...data } = n;
    await db.collection('notifications').doc(id).set(data);
  }

  // ==================== DONE ====================
  console.log('\n✅ Demo data seeded successfully!');
  console.log(`\nLogin: https://startdoing.co.il/therapy/login`);
  console.log(`Key: demo`);
  console.log(`\nKids:`);
  console.log(`  נועה: https://startdoing.co.il/board.html?kid=${NOA_ID}`);
  console.log(`  אורי: https://startdoing.co.il/board.html?kid=${ORI_ID}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
