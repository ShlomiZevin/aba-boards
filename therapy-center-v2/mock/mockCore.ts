/**
 * In-memory mock of the therapy + admin API (pure, browser-safe).
 * Used by the dev server (mock/mockApi.ts) and by the offline demo build (src/demo/demoFetch.ts).
 * v2's dev server never proxies to the real server (which talks to the production
 * Firestore), so nothing done locally can reach real data. Data resets on restart.
 * Login key for the mock: 1234.
 */

import { buildDefaultAgreement } from '../src/utils/agreementTemplate';

type Doc = Record<string, any>;

const DAY = 86400000;
const iso = (d: Date) => d.toISOString();
function at(dayOffset: number, hh: number, mm = 0) {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return new Date(d.getTime() + dayOffset * DAY);
}

const ADMIN = {
  adminId: 'admin-michal', isSuperAdmin: false, name: 'מיכל', mobile: '050-0000000', email: 'michal@example.com',
  subscription: { plan: 'pro', status: 'active', trialEndDate: null, proEndDate: iso(at(300, 0)), billingCycle: 'yearly', nextPaymentDate: iso(at(300, 0)), paypalSubscriptionId: null },
};

const practitioners: Doc[] = [
  { id: 'p-shira', name: 'שירה לוי', type: 'מטפלת', mobile: '050-1111111', email: 'shira@example.com', createdAt: iso(at(-200, 9)) },
  { id: 'p-dana', name: 'דנה כהן', type: 'מטפלת', mobile: '050-2222222', email: 'dana@example.com', createdAt: iso(at(-180, 9)) },
  { id: 'p-rotem', name: 'רותם אברהם', type: 'מדריכת הורים', mobile: '050-3333333', createdAt: iso(at(-150, 9)) },
  { id: 'p-yael', name: 'יעל מזרחי', type: 'מנתחת התנהגות', mobile: '050-4444444', createdAt: iso(at(-120, 9)) },
];

const kids: Doc[] = [
  { id: 'k-noga', name: 'נגה', age: 6, gender: 'girl', adminId: ADMIN.adminId, kidDescription: 'אוהבת פאזלים ובועות סבון', totalMoney: 42, tasks: [] },
  { id: 'k-liam', name: 'ליאם', age: 5, gender: 'boy', adminId: ADMIN.adminId, kidDescription: 'אוהב מכוניות ושירים', totalMoney: 18, tasks: [] },
  { id: 'k-omer', name: 'עומר', age: 7, gender: 'boy', adminId: ADMIN.adminId, totalMoney: 65, tasks: [] },
  { id: 'k-tamar', name: 'תמר', age: 4, gender: 'girl', adminId: ADMIN.adminId, totalMoney: 9, tasks: [] },
  { id: 'k-yoav', name: 'יואב', age: 8, gender: 'boy', adminId: ADMIN.adminId, totalMoney: 30, tasks: [] },
];

const kidTeam: Record<string, string[]> = {
  'k-noga': ['p-shira', 'p-dana', 'p-rotem'],
  'k-liam': ['p-dana', 'p-yael'],
  'k-omer': ['p-shira', 'p-rotem'],
  'k-tamar': ['p-shira', 'p-yael'],
  'k-yoav': ['p-dana'],
};

const parents: Doc[] = kids.flatMap(k => [
  { id: `par-${k.id}-1`, kidId: k.id, name: `אמא של ${k.name}`, mobile: '052-0000001', email: '', createdAt: iso(at(-100, 9)) },
  { id: `par-${k.id}-2`, kidId: k.id, name: `אבא של ${k.name}`, mobile: '052-0000002', email: '', createdAt: iso(at(-100, 9)) },
]);

const GOALS: [string, string, string][] = [
  ['k-noga', 'language', 'קשר עין בפנייה בשם'],
  ['k-noga', 'motor-fine', 'הרכבת פאזל 12 חלקים'],
  ['k-noga', 'play-social', 'משחק תורות עם חבר'],
  ['k-noga', 'adl', 'לבישת מעיל באופן עצמאי'],
  ['k-liam', 'language', 'בקשה במילה אחת'],
  ['k-liam', 'cognitive', 'מיון לפי צבע'],
  ['k-liam', 'motor-gross', 'קפיצה על שתי רגליים'],
  ['k-omer', 'play-social', 'הצטרפות למשחק קבוצתי'],
  ['k-omer', 'language', 'סיפור רצף של 3 תמונות'],
  ['k-tamar', 'adl', 'שטיפת ידיים עצמאית'],
  ['k-tamar', 'language', 'חיקוי צלילים'],
  ['k-yoav', 'cognitive', 'השלמת דף עבודה'],
  ['k-yoav', 'play-social', 'המתנה לתור'],
];
const goals: Doc[] = GOALS.map(([kidId, categoryId, title], i) => ({
  id: `g-${i + 1}`, kidId, categoryId, title, isActive: true, createdAt: iso(at(-90, 9)), libraryItemId: `lib-${i + 1}`,
}));

// Sessions: a weekly pattern per kid over the last 8 weeks and the next 2.
const PATTERN: [string, string, number, number, number, string][] = [
  // kidId, therapist, weekday(0=Sun), hh, mm, type
  ['k-noga', 'p-shira', 0, 8, 30, 'therapy'],
  ['k-noga', 'p-dana', 3, 10, 0, 'therapy'],
  ['k-liam', 'p-dana', 1, 11, 0, 'therapy'],
  ['k-liam', 'p-yael', 4, 9, 0, 'therapy'],
  ['k-omer', 'p-rotem', 2, 14, 0, 'guidance'],
  ['k-omer', 'p-shira', 4, 15, 0, 'therapy'],
  ['k-tamar', 'p-shira', 1, 16, 30, 'therapy'],
  ['k-yoav', 'p-dana', 2, 12, 0, 'therapy'],
];
const sessions: Doc[] = [];
const forms: Doc[] = [];
let seq = 1;
const today = new Date(); today.setHours(0, 0, 0, 0);
const todayDow = today.getDay();
for (let week = -8; week <= 2; week++) {
  for (const [kidId, therapistId, dow, hh, mm, type] of PATTERN) {
    const offset = week * 7 + (dow - todayDow);
    const when = at(offset, hh, mm);
    const id = `s-${seq++}`;
    const past = when.getTime() < Date.now() - 2 * 3600000;
    sessions.push({ id, kidId, therapistId, scheduledDate: iso(when), type, status: past ? 'completed' : 'scheduled', adminId: ADMIN.adminId, createdAt: iso(at(-60, 9)) });
  }
}
// Today's board, matching the design concepts: 4 sessions with mixed states.
const TODAY: [string, string, number, number, string, string][] = [
  ['k-noga', 'p-shira', 8, 30, 'therapy', 'pending_form'],
  ['k-liam', 'p-dana', 11, 0, 'therapy', 'scheduled'],
  ['k-omer', 'p-rotem', 14, 0, 'guidance', 'scheduled'],
  ['k-tamar', 'p-shira', 16, 30, 'therapy', 'scheduled'],
];
for (let i = sessions.length - 1; i >= 0; i--) if (new Date(sessions[i].scheduledDate).toDateString() === today.toDateString()) sessions.splice(i, 1);
for (const [kidId, therapistId, hh, mm, type, status] of TODAY) {
  sessions.push({ id: `s-${seq++}`, kidId, therapistId, scheduledDate: iso(at(0, hh, mm)), type, status, adminId: ADMIN.adminId, createdAt: iso(at(-10, 9)) });
}
// One older session still waiting for its form.
const lateOne = sessions.filter(s => s.status === 'completed' && s.kidId === 'k-yoav').pop();
if (lateOne) lateOne.status = 'pending_form';
// An old one (3 weeks ago) — v2 hides forms missing for more than two weeks.
const oldOne = sessions.find(s => s.kidId === 'k-omer' && s.status === 'completed' && Date.now() - new Date(s.scheduledDate).getTime() > 18 * DAY);
if (oldOne) oldOne.status = 'pending_form';

// Forms for completed sessions, with cooperation trending up.
const MOODS = ['שמחה ורגועה', 'עייפה בהתחלה ואז התחברה', 'מצב רוח טוב', 'מעט מתוסכל', 'אנרגטי ושמח'];
for (const s of sessions.filter(x => x.status === 'completed' && x.type === 'therapy')) {
  const daysAgo = (Date.now() - new Date(s.scheduledDate).getTime()) / DAY;
  const kidGoals = goals.filter(g => g.kidId === s.kidId);
  const base = 88 - daysAgo * 0.5 + ((seq * 7) % 11) - 5;
  const id = `f-${seq++}`;
  s.formId = id;
  forms.push({
    id, sessionId: s.id, kidId: s.kidId, practitionerId: s.therapistId, sessionDate: s.scheduledDate,
    cooperation: Math.max(30, Math.min(100, Math.round(base / 5) * 5)), sessionDuration: 90, sittingDuration: 25 + (seq % 4) * 5,
    mood: MOODS[seq % MOODS.length], concentrationLevel: 'טובה', newReinforcers: 'בועות סבון', wordsProduced: 'עוד, תן, בועה',
    breakActivities: 'טרמפולינה', endOfSessionActivity: 'שיר סיום', successes: 'השלימה משימה לבד', difficulties: '', notes: '',
    goalsWorkedOn: kidGoals.slice(0, 3).map(g => ({ goalId: g.id, goalTitle: g.title, categoryId: g.categoryId })),
    additionalGoals: [], createdAt: s.scheduledDate, updatedAt: s.scheduledDate,
  });
}

const notifications: Doc[] = [
  { id: 'n-1', kidId: 'k-noga', adminId: ADMIN.adminId, message: 'נגה השלימה היום פאזל לבד בפעם הראשונה!', createdAt: iso(at(0, 9, 40)), recipientType: 'practitioner', recipientId: 'p-dana', recipientName: 'דנה כהן', read: false },
  { id: 'n-2', kidId: 'k-liam', adminId: ADMIN.adminId, message: 'מחר הטיפול של ליאם מתחיל ב־11:30', createdAt: iso(at(-1, 18)), recipientType: 'parent', recipientId: 'par-k-liam-1', recipientName: 'אמא של ליאם', read: true },
  { id: 'n-4', kidId: 'k-noga', adminId: ADMIN.adminId, message: 'שירה, אפשר לנסות היום את הפאזל של 16 חלקים עם נגה', createdAt: iso(at(0, 7, 50)), recipientType: 'practitioner', recipientId: 'p-shira', recipientName: 'שירה לוי', read: false },
  { id: 'n-5', kidId: 'k-tamar', adminId: ADMIN.adminId, message: 'תמר מגיעה היום עם אבא, הוא ישמח לשמוע איך היה', createdAt: iso(at(-1, 15, 10)), recipientType: 'practitioner', recipientId: 'p-shira', recipientName: 'שירה לוי', read: true },
  { id: 'n-3', kidId: 'k-omer', adminId: ADMIN.adminId, message: 'עדכון לגבי תוכנית ההדרכה לשבוע הבא', createdAt: iso(at(-2, 12)), recipientType: 'practitioner', recipientId: 'p-rotem', recipientName: 'רותם אברהם', read: false },
];

const SIGNATURE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><path d="M10 55c20-2 30-40 45-40 10 0 0 45 15 45 12 0 15-28 28-28 9 0 6 20 16 20 14 0 20-30 34-30 8 0 4 22 14 22 12 0 22-12 40-14" fill="none" stroke="#2A2140" stroke-width="3" stroke-linecap="round"/></svg>');
const agreements: Record<string, Doc> = {
  'k-noga': { id: 'a-noga', kidId: 'k-noga', adminId: ADMIN.adminId, title: 'הסכם טיפול', content: buildDefaultAgreement({ childName: 'נגה', parentNames: ['אמא של נגה', 'אבא של נגה'], analystName: 'מיכל', analystRole: 'מדריכת הורים ומנתחת התנהגות', startDate: iso(at(-30, 0)).slice(0, 10), noticeWeeks: 4 }), noticeWeeks: 4, adminRole: 'מדריכת הורים ומנתחת התנהגות', startDate: iso(at(-30, 0)).slice(0, 10), status: 'active',
    signatures: { 'admin:admin-michal': { signerType: 'admin', signerId: 'admin-michal', signerName: 'מיכל', signatureImage: SIGNATURE, signedAt: iso(at(-29, 10)), updatedAt: iso(at(-29, 10)), revision: 1 } }, createdAt: iso(at(-30, 9)), updatedAt: iso(at(-29, 10)) },
};

const DEFAULT_TEMPLATE = [
  ['cooperation', 'שיתוף פעולה', 'percentage'], ['sessionDuration', 'משך הטיפול (דקות)', 'number'], ['sittingDuration', 'משך ישיבה (דקות)', 'number'],
  ['mood', 'מצב רוח', 'text'], ['concentrationLevel', 'רמת ריכוז / עייפות', 'text'], ['newReinforcers', 'מחזקים (חדשים)', 'text'],
  ['wordsProduced', 'מילים שהפיק', 'text'], ['breakActivities', 'פעילות בהפסקות', 'text'], ['endOfSessionActivity', 'פעילות סוף שיעור', 'text'],
  ['successes', 'הצלחות', 'text'], ['difficulties', 'קשיים', 'text'], ['notes', 'הערות', 'text'],
].map(([id, label, type], i) => ({ id, label, type, order: i + 1, isDefault: true }));

const library: Doc[] = goals.map((g, i) => ({ id: `lib-${i + 1}`, title: g.title, categoryId: g.categoryId, usageCount: 1, activeCount: 1 }));

// ---------- routing ----------
type Handler = (m: RegExpMatchArray, q: URLSearchParams, body: Doc, h: Doc) => any;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, path: string, fn: Handler) =>
  routes.push([method, new RegExp('^' + path.replace(/:[a-zA-Z]+/g, '([^/]+)') + '$'), fn]);

const inRange = (d: string, q: URLSearchParams) => {
  const t = new Date(d).getTime();
  const from = q.get('from'), to = q.get('to');
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + (to.length <= 10 ? DAY : 0)) return false;
  return true;
};
const sortByDate = (a: Doc[], key = 'scheduledDate') => [...a].sort((x, y) => new Date(x[key]).getTime() - new Date(y[key]).getTime());
const teamOf = (kidId: string) => (kidTeam[kidId] || []).map(id => practitioners.find(p => p.id === id)).filter(Boolean);
const newId = (p: string) => `${p}-${seq++}`;
const visibleKids = (h: Doc) => {
  const pid = h['x-practitioner-id'];
  if (pid) return kids.filter(k => (kidTeam[k.id] || []).includes(pid));
  return kids;
};

// admin
on('GET', '/api/admin/me', (_m, _q, _b, h) => (h['x-admin-key'] === '1234' ? ADMIN : h['x-admin-key'] === '9999' ? { ...ADMIN, isSuperAdmin: true } : { __status: 401, error: 'מפתח שגוי' }));
on('GET', '/api/admin/subscription', () => ({ ...ADMIN.subscription, isSuperAdmin: false }));

// kids
on('GET', '/api/therapy/kids', (_m, _q, _b, h) => visibleKids(h));
on('GET', '/api/therapy/kids/all-grouped', () => ({ myKids: kids, orphanKids: [], otherAdminKids: [] }));
on('POST', '/api/therapy/kids', (_m, _q, b) => { const k = { id: newId('k'), adminId: ADMIN.adminId, tasks: [], totalMoney: 0, ...b }; kids.push(k); kidTeam[k.id] = []; return k; });
on('GET', '/api/therapy/kids/:id', m => kids.find(k => k.id === m[1]) || { __status: 404, error: 'לא נמצא' });
on('PUT', '/api/therapy/kids/:id', (m, _q, b) => Object.assign(kids.find(k => k.id === m[1]) || {}, b));
on('DELETE', '/api/therapy/kids/:id', m => { const i = kids.findIndex(k => k.id === m[1]); if (i >= 0) kids.splice(i, 1); return {}; });

// team
on('GET', '/api/therapy/kids/:id/practitioners', m => teamOf(m[1]));
on('POST', '/api/therapy/kids/:id/practitioners', (m, _q, b) => { const p = { id: newId('p'), createdAt: iso(new Date()), ...b }; practitioners.push(p); (kidTeam[m[1]] ||= []).push(p.id); return p; });
on('POST', '/api/therapy/kids/:id/practitioners/link', (m, _q, b) => { (kidTeam[m[1]] ||= []).push(b.practitionerId); return {}; });
on('DELETE', '/api/therapy/kids/:id/practitioners/:pid', m => { kidTeam[m[1]] = (kidTeam[m[1]] || []).filter(x => x !== m[2]); return {}; });
on('GET', '/api/therapy/practitioners/my-therapists', () => practitioners);
on('POST', '/api/therapy/practitioners', (_m, _q, b) => { const p = { id: newId('p'), createdAt: iso(new Date()), ...b }; practitioners.push(p); return p; });
on('GET', '/api/therapy/practitioners/:id/info', m => practitioners.find(p => p.id === m[1]) || { __status: 404, error: 'לא נמצא' });
on('GET', '/api/therapy/practitioners/:id/kids', m => kids.filter(k => (kidTeam[k.id] || []).includes(m[1])));
on('PUT', '/api/therapy/practitioners/:id', (m, _q, b) => Object.assign(practitioners.find(p => p.id === m[1]) || {}, b));
on('DELETE', '/api/therapy/practitioners/:id', m => { const i = practitioners.findIndex(p => p.id === m[1]); if (i >= 0) practitioners.splice(i, 1); return {}; });
on('GET', '/api/therapy/kids/:id/parents', m => parents.filter(p => p.kidId === m[1]));
on('POST', '/api/therapy/kids/:id/parents', (m, _q, b) => { const p = { id: newId('par'), kidId: m[1], createdAt: iso(new Date()), ...b }; parents.push(p); return p; });

// goals
on('GET', '/api/therapy/kids/:id/goals', m => goals.filter(g => g.kidId === m[1]));
on('POST', '/api/therapy/kids/:id/goals', (m, _q, b) => { const g = { id: newId('g'), kidId: m[1], isActive: true, createdAt: iso(new Date()), ...b }; goals.push(g); return g; });
on('PUT', '/api/therapy/goals/:id', (m, _q, b) => Object.assign(goals.find(g => g.id === m[1]) || {}, b));
on('GET', '/api/therapy/goals/library/all', () => library);
on('GET', '/api/therapy/goals/library', (_m, q) => library.filter(l => l.title.includes(q.get('search') || '')));

// sessions
on('GET', '/api/therapy/sessions/alerts', (_m, _q, _b, h) => {
  const ids = new Set(visibleKids(h).map(k => k.id));
  return sortByDate(sessions.filter(s => s.status === 'pending_form' && ids.has(s.kidId)));
});
on('GET', '/api/therapy/sessions', (_m, q, _b, h) => {
  const pid = h['x-practitioner-id'];
  return sortByDate(sessions.filter(s => inRange(s.scheduledDate, q) && (!pid || s.therapistId === pid)));
});
on('POST', '/api/therapy/sessions', (_m, _q, b) => { const s = { id: newId('s'), status: 'scheduled', type: 'therapy', adminId: ADMIN.adminId, createdAt: iso(new Date()), ...b }; sessions.push(s); return s; });
on('GET', '/api/therapy/kids/:id/sessions', (m, q) => sortByDate(sessions.filter(s => s.kidId === m[1] && inRange(s.scheduledDate, q) && (!q.get('status') || s.status === q.get('status')))));
on('POST', '/api/therapy/kids/:id/sessions', (m, _q, b) => { const s = { id: newId('s'), kidId: m[1], status: 'scheduled', type: 'therapy', createdAt: iso(new Date()), ...b }; sessions.push(s); return s; });
on('PUT', '/api/therapy/sessions/:id', (m, _q, b) => Object.assign(sessions.find(s => s.id === m[1]) || {}, b));
on('DELETE', '/api/therapy/sessions/:id', m => { const i = sessions.findIndex(s => s.id === m[1]); if (i >= 0) sessions.splice(i, 1); return {}; });
on('GET', '/api/therapy/sessions/:id/form', m => forms.find(f => f.sessionId === m[1]) || { __status: 404, error: 'אין טופס' });

// forms
on('GET', '/api/therapy/kids/:id/forms', (m, q) => {
  const week = q.get('weekOf');
  const start = week ? new Date(week) : null;
  if (start) { start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay()); }
  return sortByDate(forms.filter(f => f.kidId === m[1] && (!start || (new Date(f.sessionDate).getTime() >= start.getTime() && new Date(f.sessionDate).getTime() < start.getTime() + 7 * DAY))), 'sessionDate').reverse();
});
on('GET', '/api/therapy/forms/:id', m => forms.find(f => f.id === m[1]) || { __status: 404, error: 'לא נמצא' });
on('POST', '/api/therapy/forms', (_m, _q, b) => {
  const f = { id: newId('f'), createdAt: iso(new Date()), updatedAt: iso(new Date()), ...b }; forms.push(f);
  const s = sessions.find(x => x.id === b.sessionId); if (s) { s.status = 'completed'; s.formId = f.id; }
  return f;
});
on('PUT', '/api/therapy/forms/:id', (m, _q, b) => Object.assign(forms.find(f => f.id === m[1]) || {}, b, { updatedAt: iso(new Date()) }));
on('GET', '/api/therapy/kids/:id/form-template', () => ({ sections: DEFAULT_TEMPLATE }));

// agreement
on('GET', '/api/therapy/kids/:id/agreement', m => agreements[m[1]] || null);

// notifications
on('GET', '/api/therapy/notifications/mine', (_m, _q, _b, h) => notifications.filter(n => !h['x-practitioner-id'] || n.recipientId === h['x-practitioner-id']));
on('GET', '/api/therapy/notifications/sent', (_m, q) => notifications.filter(n => n.kidId === q.get('kidId')));
on('GET', '/api/therapy/notifications/all-sent', () => notifications);
on('POST', '/api/therapy/notifications', (_m, _q, b) => {
  for (const t of b.targets || []) notifications.unshift({ id: newId('n'), kidId: b.kidId, adminId: ADMIN.adminId, message: b.message, createdAt: iso(new Date()), recipientType: t.type, recipientId: t.id, recipientName: t.name, read: false });
  return {};
});
on('PUT', '/api/therapy/notifications/:id/read', m => { const n = notifications.find(x => x.id === m[1]); if (n) n.read = true; return {}; });

// per-kid collections that start empty
const meetingForms: Doc[] = [{
  id: 'mf-1', kidId: 'k-noga', sessionDate: iso(at(-6, 13)), visibility: { parents: true, therapists: true },
  attendees: [{ id: 'par-k-noga-1', name: 'אמא של נגה', type: 'parent' }, { id: 'p-shira', name: 'שירה לוי', type: 'practitioner' }, { id: 'p-dana', name: 'דנה כהן', type: 'practitioner' }],
  goalsWorkedOn: goals.filter(g => g.kidId === 'k-noga').slice(0, 2).map(g => ({ goalId: g.id, goalTitle: g.title, categoryId: g.categoryId })),
  additionalGoals: [], generalNotes: 'נגה בהתקדמות יפה בשבועיים האחרונים.', behaviorNotes: 'פחות התפרצויות במעברים.', adl: 'מתחילה ללבוש מעיל לבד.',
  grossMotorPrograms: '', programsOutsideRoom: 'משחק בחצר עם חבר אחד.', learningProgramsInRoom: 'פאזלים, מיון צבעים.', tasks: 'שירה: להוסיף פאזל 16 חלקים.', status: 'completed',
  createdAt: iso(at(-6, 14)), updatedAt: iso(at(-6, 14)),
}];
const summaries: Doc[] = [{
  id: 'sum-1', kidId: 'k-noga', adminId: ADMIN.adminId, title: 'סיכום חודש אוקטובר',
  content: [
    '## עיקרי התקופה', '',
    '- שיתוף הפעולה עלה מ־70% ל־85%.',
    '- קשר עין בפנייה בשם: עקבי ברוב הטיפולים.', '',
    '## להמשך', '',
    '- להרחיב משחק תורות לשני חברים.',
  ].join('\n'),
  fromDate: iso(at(-34, 0)), toDate: iso(at(-4, 0)), createdAt: iso(at(-3, 12)), updatedAt: iso(at(-3, 12)),
}];
on('GET', '/api/therapy/kids/:id/meeting-forms', m => meetingForms.filter(f => f.kidId === m[1]));
on('GET', '/api/therapy/meeting-forms/:id', m => meetingForms.find(f => f.id === m[1]) || { __status: 404, error: 'לא נמצא' });
on('GET', '/api/therapy/kids/:id/summaries', m => summaries.filter(x => x.kidId === m[1]));
on('GET', '/api/therapy/summaries/:id', m => summaries.find(x => x.id === m[1]) || { __status: 404, error: 'לא נמצא' });
const dayStr = (o: number) => iso(at(o, 12)).slice(0, 10);
const dailyReports: Record<string, Doc> = {};
for (const [o, mood, coop] of [[0, 'good', 85], [-1, 'ok', 70], [-2, 'good', 80], [-5, 'hard', 55]] as const) {
  const date = dayStr(o);
  dailyReports[`k-noga|${date}`] = {
    date, reporter: 'שירה לוי', createdAt: iso(at(o, 13)), updatedAt: iso(at(o, 13)),
    lessons: [
      { id: `l1-${o}`, title: 'חשבון', mood, cooperationPct: coop, summary: 'עבדה יפה על מיון וספירה', start: { m: '+' }, attention: { m: mood === 'hard' ? '-' : '+' }, compliance: { m: 'r', note: 'תזכורת אחת' } },
      { id: `l2-${o}`, title: 'אומנות', mood: 'good', cooperationPct: 90, summary: 'ציור עם שותפה' },
    ],
    breaks: [{ id: `b1-${o}`, time: '10:00', duration: '20', type: 'הפסקת אוכל', foodWhat: 'כריך', foodIndependent: 'כן', activities: ['משחק בחול'], social: 'שיחקה עם חברה' }],
    abc: mood === 'hard' ? [{ id: `a1-${o}`, time: '11:20', location: 'כיתה', a: 'מעבר מפעילות', b: 'בכי קצר', c: 'הסבר ומתן בחירה', intensity: 'נמוכה', duration: '3 דק׳' }] : [],
  };
}
on('GET', '/api/therapy/kids/:id/daily-reports', m => Object.entries(dailyReports).filter(([k]) => k.startsWith(m[1] + '|')).map(([, r]) => ({ date: r.date, reporter: r.reporter, lessons: r.lessons.length, breaks: r.breaks.length, abc: r.abc.length, updatedAt: r.updatedAt })).sort((a, b) => b.date.localeCompare(a.date)));
on('GET', '/api/therapy/kids/:id/daily-reports/:date', m => dailyReports[`${m[1]}|${m[2]}`] || null);
on('PUT', '/api/therapy/kids/:id/daily-reports/:date', (m, _q, b) => { const k = `${m[1]}|${m[2]}`; dailyReports[k] = { date: m[2], lessons: [], breaks: [], abc: [], createdAt: iso(new Date()), ...dailyReports[k], ...b, updatedAt: iso(new Date()) }; return dailyReports[k]; });
on('PUT', '/api/therapy/kids/:id/daily-reports/:date/:section/:item', (m, _q, b) => {
  const k = `${m[1]}|${m[2]}`; const r = dailyReports[k] ||= { date: m[2], reporter: '', lessons: [], breaks: [], abc: [], createdAt: iso(new Date()) };
  const list: Doc[] = r[m[3]] ||= []; const i = list.findIndex(x => x.id === m[4]); if (i >= 0) list[i] = b; else list.push(b); r.updatedAt = iso(new Date()); return r;
});
on('DELETE', '/api/therapy/kids/:id/daily-reports/:date/:section/:item', m => { const r = dailyReports[`${m[1]}|${m[2]}`]; if (r) r[m[3]] = (r[m[3]] || []).filter((x: Doc) => x.id !== m[4]); return r || null; });
const ROUTINE = {
  morning: [{ id: 'r1', title: 'מתלבשים', icon: '👕', time: '07:15' }, { id: 'r2', title: 'ארוחת בוקר', icon: '🥣', time: '07:30' }, { id: 'r3', title: 'גן', icon: '🎒', time: '08:00' }],
  noon: [{ id: 'r4', title: 'טיפול עם שירה', icon: '🧩', time: '14:00' }, { id: 'r5', title: 'משחק בחצר', icon: '⚽' }],
  evening: [{ id: 'r6', title: 'מקלחת', icon: '🚿', time: '18:30' }, { id: 'r7', title: 'סיפור ושינה', icon: '🌙', time: '19:30' }],
};
const agendas: Record<string, Doc> = {};
on('GET', '/api/therapy/kids/:id/agenda', m => (agendas[m[1]] ||= { routine: Object.fromEntries([0, 1, 2, 3, 4].map(d => [d, ROUTINE])), days: {} }));
on('PUT', '/api/therapy/kids/:id/agenda/routine', (m, _q, b) => { (agendas[m[1]] ||= { routine: {}, days: {} }).routine = b.routine; return b.routine; });
on('PUT', '/api/therapy/kids/:id/agenda/days/:date/done', (m, _q, b) => {
  const a = agendas[m[1]] ||= { routine: {}, days: {} }; const d = a.days[m[2]] ||= { items: null, done: [] };
  d.done = b.done ? [...new Set([...d.done, b.itemId])] : d.done.filter((x: string) => x !== b.itemId); return d;
});
on('PUT', '/api/therapy/kids/:id/agenda/days/:date', (m, _q, b) => { const a = agendas[m[1]] ||= { routine: {}, days: {} }; const d = a.days[m[2]] ||= { items: null, done: [] }; d.items = b.items; return d; });
for (const p of ['pending-dc', 'all-dc', 'meeting-drafts']) on('GET', `/api/therapy/kids/:id/${p}`, () => []);
// Documents (מחברת). Visibility: private = admins, team = + linked therapists, parents = + the kid's parents.
const docs: Doc[] = [
  { id: 'd-1', kidId: 'k-noga', type: 'meeting-prep', title: 'הכנה לפגישת הורים, נובמבר', visibility: 'private', source: 'chatgpt', createdBy: { type: 'mcp', name: 'מיכל' },
    content: ['## נקודות לפתיחה', '', '- שיתוף הפעולה עלה ל־85% בשבועיים האחרונים', '- קשר עין בפנייה בשם: יציב', '', '## לשאול את ההורים', '', '1. איך הבוקר עובר בבית?', '2. האם מעיל לבד הצליח גם בגן?', '', '## לסיכום', '', 'להציע תרגול של משחק תורות בסופ״ש.'].join('\n'),
    createdAt: iso(at(-1, 21)), updatedAt: iso(at(-1, 21)) },
  { id: 'd-2', kidId: 'k-noga', type: 'guidance', title: 'הנחיות לצוות: מעברים בין פעילויות', visibility: 'team', source: 'app', createdBy: { type: 'admin', name: 'מיכל' },
    content: ['- להודיע דקה לפני מעבר, עם טיימר חזותי.', '- לתת בחירה בין שתי פעילויות.', '- לחזק מיד מעבר רגוע.'].join('\n'),
    createdAt: iso(at(-4, 12)), updatedAt: iso(at(-3, 9)) },
  { id: 'd-3', kidId: 'k-noga', type: 'note', title: 'לבית: משחקים לסופ״ש', visibility: 'parents', source: 'claude', createdBy: { type: 'mcp', name: 'מיכל' },
    content: 'פאזל של 16 חלקים, משחק תורות עם קוביה, ובועות סבון כחיזוק.', createdAt: iso(at(-6, 18)), updatedAt: iso(at(-6, 18)) },
  { id: 'd-4', kidId: null, type: 'guidance', title: 'נוהל מילוי טפסים בסוף מפגש', visibility: 'team', source: 'app', createdBy: { type: 'admin', name: 'מיכל' },
    content: 'ממלאים את טופס הטיפול עד סוף היום. טופס שלא מולא תוך שבועיים כבר לא מוצג כממתין.', createdAt: iso(at(-10, 10)), updatedAt: iso(at(-10, 10)) },
];
const DOC_TYPES = ['meeting-prep', 'guidance', 'note', 'summary', 'other'];
type Role = { kind: 'admin' } | { kind: 'therapist'; id: string } | { kind: 'parent'; kidId: string } | { kind: 'none' };
const roleOf = (h: Doc): Role => h['x-practitioner-id'] ? { kind: 'therapist', id: h['x-practitioner-id'] } : h['x-kid-id'] ? { kind: 'parent', kidId: decodeURIComponent(h['x-kid-id']) } : h['x-admin-key'] ? { kind: 'admin' } : { kind: 'none' };
const canSee = (d: Doc, r: Role) => r.kind === 'admin'
  || (r.kind === 'therapist' && d.visibility !== 'private' && (d.kidId === null || (kidTeam[d.kidId] || []).includes(r.id)))
  || (r.kind === 'parent' && d.visibility === 'parents' && d.kidId === r.kidId);
const byNewest = (a: Doc[]) => [...a].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
on('GET', '/api/therapy/kids/:id/docs', (m, _q, _b, h) => byNewest(docs.filter(d => d.kidId === m[1] && canSee(d, roleOf(h)))));
on('GET', '/api/therapy/docs', (_m, q, _b, h) => {
  const r = roleOf(h);
  if (q.get('scope') !== 'general') return [];
  if (r.kind === 'parent') return { __status: 403, error: 'אין הרשאה' };
  return byNewest(docs.filter(d => d.kidId === null && canSee(d, r)));
});
on('GET', '/api/therapy/docs/:id', (m, _q, _b, h) => { const d = docs.find(x => x.id === m[1]); return d && canSee(d, roleOf(h)) ? d : { __status: 404, error: 'לא נמצא' }; });
on('POST', '/api/therapy/docs', (_m, _q, b, h) => {
  if (roleOf(h).kind !== 'admin') return { __status: 403, error: 'אין הרשאה' };
  const now = iso(new Date());
  const d = { id: newId('d'), kidId: b.kidId ?? null, type: DOC_TYPES.includes(b.type) ? b.type : 'other', title: b.title || 'ללא כותרת', content: b.content || '', visibility: b.visibility || 'private', source: 'app', createdBy: { type: 'admin', name: ADMIN.name }, createdAt: now, updatedAt: now };
  docs.push(d); return d;
});
on('PUT', '/api/therapy/docs/:id', (m, _q, b, h) => {
  if (roleOf(h).kind !== 'admin') return { __status: 403, error: 'אין הרשאה' };
  const d = docs.find(x => x.id === m[1]); if (!d) return { __status: 404, error: 'לא נמצא' };
  for (const k of ['title', 'content', 'type', 'visibility']) if (b[k] !== undefined) d[k] = b[k];
  d.updatedAt = iso(new Date()); return d;
});
on('DELETE', '/api/therapy/docs/:id', (m, _q, _b, h) => {
  if (roleOf(h).kind !== 'admin') return { __status: 403, error: 'אין הרשאה' };
  const i = docs.findIndex(x => x.id === m[1]); if (i >= 0) docs.splice(i, 1); return {};
});

on('GET', '/api/therapy/kids/:id/game-state', () => ({}));
on('GET', '/api/therapy/category-lp-templates', () => []);

// crew hours, computed from forms
on('GET', '/api/therapy/crew-hours', (_m, q) => practitioners.map(p => {
  const fs = forms.filter(f => f.practitionerId === p.id && inRange(f.sessionDate, q) && (!q.get('kidId') || f.kidId === q.get('kidId')));
  const byKid = new Map<string, Doc>();
  for (const f of fs) {
    const k = byKid.get(f.kidId) || { kidId: f.kidId, kidName: kids.find(x => x.id === f.kidId)?.name || '', totalMinutes: 0, sessionCount: 0 };
    k.totalMinutes += f.sessionDuration; k.sessionCount++; byKid.set(f.kidId, k);
  }
  return { practitionerId: p.id, practitionerName: p.name, practitionerType: p.type, totalMinutes: fs.reduce((a, f) => a + f.sessionDuration, 0), sessionCount: fs.length,
    kids: [...byKid.values()], sessions: fs.map(f => ({ date: f.sessionDate, duration: f.sessionDuration, kidId: f.kidId, kidName: kids.find(x => x.id === f.kidId)?.name || '' })) };
}).filter(e => e.sessionCount > 0));

// studio (סטודיו קסם): canned reading; jobs finish ~10 s after they start, using the uploaded photo as the "result"
const studio: Doc[] = [];
on('POST', '/api/therapy/studio/understand', () => ({
  description: 'שני ילדים ליד כדור פורח צבעוני שבנו ממגנטים',
  build: 'a hot-air balloon built from colourful magnetic tiles',
  ideas: {
    video: ['הילדים נכנסים לסל והכדור הפורח ממריא מעל העננים', 'הכדור הפורח עף מעל העיר והילדים מנופפים', 'הכדור הפורח נוחת על אי עם דקלים'],
    images: ['הילדים בסל של כדור פורח אמיתי מעל ההרים', 'הכדור הפורח בשקיעה מעל הים', 'הילדים והכדור הפורח בציור צבעי מים'],
  },
}));
on('POST', '/api/therapy/studio/transcribe', () => ({ text: 'שהילדים ייכנסו לכדור הפורח והוא יעוף לשמיים' }));
const studioView = (c: Doc) => {
  const ready = Date.now() - c.t0 > 10000;
  return { ...c, image: undefined, t0: undefined, usd: ready ? (c.mode === 'video' ? 0.11 : 0.08) : 0,
    items: c.items.map((i: Doc) => ready ? { ...i, status: 'done', url: i.kind === 'video' ? '' : c.image, poster: c.image, usd: i.kind === 'video' ? 0.11 : 0.04 } : i) };
};
on('GET', '/api/therapy/studio/options', () => ({ defaultVideoModel: 'fast', video: [{ id: 'fast', usd: 0.34 }, { id: 'mini', usd: 0.11 }] }));
on('GET', '/api/therapy/studio/creations', () => studio.map(studioView).reverse());
on('POST', '/api/therapy/studio/creations', (_m, _q, b) => {
  const c = { id: newId('st'), mode: b.mode, wish: b.wish || '', prompt: 'mock prompt', description: b.description || '', note: /פיקא|ספיידר/.test(b.wish || '') ? 'דמויות מוכרות חסומות אצל המודלים, אז עיצבתי דמות מקורית בהשראתה.' : '', transform: /הופך|להפוך|יהפוך|תהפוך/.test(b.wish || '') ? (b.transform || 'end') : null, thumb: b.thumb, image: b.image, t0: Date.now(), createdAt: iso(new Date()),
    items: b.mode === 'video' ? [{ jobId: newId('j'), kind: 'video', model: b.videoModel === 'mini' ? 'mini' : 'fast', status: 'queued', usd: 0 }]
      : ['flare', 'sunburst'].map(model => ({ jobId: newId('j'), kind: 'image', model, status: 'queued', usd: 0 })) };
  studio.push(c); return studioView(c);
});
on('GET', '/api/therapy/studio/creations/:id', m => { const c = studio.find(x => x.id === m[1]); return c ? studioView(c) : { __status: 404, error: 'לא נמצא' }; });
on('DELETE', '/api/therapy/studio/creations/:id', m => { const i = studio.findIndex(x => x.id === m[1]); if (i >= 0) studio.splice(i, 1); return {}; });

// chat: a canned streamed reply
on('POST', '/api/therapy/chat', () => ({ __sse: 'זו תשובה לדוגמה מהשרת המדומה. בגרסה האמיתית כאן יופיע סיכום מבוסס נתוני הילד.' }));


export interface MockResult { status: number; json?: unknown; sse?: string }

/** Answer one API request from the in-memory fake centre. */
export function handleMock(method: string, pathname: string, search: URLSearchParams, body: Doc, headers: Doc): MockResult {
  const hit = routes.find(([mth, re]) => mth === method && re.test(pathname));
  let result: any;
  if (hit) result = hit[2](pathname.match(hit[1])!, search, body, headers);
  else if (method === 'GET') result = [];
  else if (method === 'DELETE') result = {};
  else result = { id: newId('mock'), ...body };
  if (result && result.__sse) return { status: 200, sse: result.__sse };
  const status = result && result.__status ? result.__status : 200;
  if (result && result.__status) { result = { ...result }; delete result.__status; }
  return { status, json: result ?? null };
}

export function sseBody(text: string) {
  return `data: ${JSON.stringify({ type: 'thinking', label: 'חושב…' })}

data: ${JSON.stringify({ type: 'done', reply: text })}

`;
}
