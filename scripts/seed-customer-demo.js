// Seed a fresh, separate demo centre to hand to a prospective customer.
// Every run with a new slug creates its own centre (own access code, own kids),
// so customers never see each other's clicks. Dates are relative to today, so
// the calendar, forms and "השבוע במטרות" always look current.
//
// Run:    node scripts/seed-customer-demo.js <slug> [accessCode]
//         e.g. node scripts/seed-customer-demo.js c1
// Remove: node scripts/seed-customer-demo.js <slug> --delete
//
// Pro subscription for 60 days (then the trial-ended screen shows).

const path = require('path');
const crypto = require('crypto');
const { getDb } = require(path.join(__dirname, '..', 'server', 'services', 'firebase'));

const slug = (process.argv[2] || '').toLowerCase();
if (!/^[a-z0-9-]{1,20}$/.test(slug)) {
  console.error('Usage: node scripts/seed-customer-demo.js <slug> [accessCode] | <slug> --delete');
  process.exit(1);
}
const DELETE = process.argv.includes('--delete');
const P = `demoC-${slug}`;
const ADMIN_ID = `${P}-admin`;
const KIDS = { noa: `${P}-noa`, ori: `${P}-ori` };
const PR = { sara: `${P}-sara`, ronit: `${P}-ronit`, dana: `${P}-dana`, yael: `${P}-yael` };
const DAY = 24 * 3600 * 1000;

// Sunday of this week at 00:00 local
const today = new Date(); today.setHours(0, 0, 0, 0);
const weekStart = new Date(today.getTime() - today.getDay() * DAY);
// offset in days from this week's Sunday, hour
const at = (dayOffset, hour = 10) => { const d = new Date(weekStart.getTime() + dayOffset * DAY); d.setHours(hour, 0, 0, 0); return d; };

async function deleteByQuery(db, col, field, value) {
  const snap = await db.collection(col).where(field, '==', value).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

async function wipe(db) {
  await deleteByQuery(db, 'adminKeys', 'adminId', ADMIN_ID);
  await deleteByQuery(db, 'subscriptions', 'adminId', ADMIN_ID);
  for (const kidId of Object.values(KIDS)) {
    for (const col of ['kidPractitioners', 'sessionForms', 'meetingForms', 'sessions', 'goals', 'parents', 'notifications', 'docs']) {
      await deleteByQuery(db, col, 'kidId', kidId);
    }
    const days = await db.collection('kidAgendas').doc(kidId).collection('days').get();
    await Promise.all(days.docs.map(d => d.ref.delete()));
    await db.collection('kidAgendas').doc(kidId).delete();
    await db.collection('kids').doc(kidId).delete();
    await db.collection('kidStats').doc(kidId).delete();
  }
  await deleteByQuery(db, 'docs', 'adminId', ADMIN_ID);
  await deleteByQuery(db, 'practitioners', 'adminId', ADMIN_ID);
  await db.collection('practitioners').doc(ADMIN_ID).delete();
}

// Simple drawn avatars (no real children's photos)
function avatar(gender, color) {
  const bg = color === 'pink' ? '#FCE4EC' : '#E3F2FD';
  const hair = gender === 'girl' ? '#6D4C41' : '#4E342E';
  const hairShape = gender === 'girl'
    ? `<path d="M48 108c-6-50 18-74 52-74s58 24 52 74c-4 22-10 40-10 40h-84s-6-18-10-40z" fill="${hair}"/>
       <circle cx="146" cy="62" r="12" fill="#F06292"/><circle cx="160" cy="54" r="9" fill="#F06292"/>`
    : `<path d="M54 92c0-36 20-58 46-58s46 22 46 58c-10-14-28-20-46-20s-36 6-46 20z" fill="${hair}"/>`;
  const shirt = gender === 'girl' ? '#F48FB1' : '#64B5F6';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <circle cx="100" cy="100" r="100" fill="${bg}"/>
    ${gender === 'girl' ? hairShape : ''}
    <path d="M40 200c4-40 30-56 60-56s56 16 60 56z" fill="${shirt}"/>
    <circle cx="100" cy="98" r="44" fill="#FFD7B5"/>
    ${gender === 'girl' ? `<path d="M56 90c4-30 22-46 44-46s40 16 44 46c-14-16-30-22-44-22s-30 6-44 22z" fill="${hair}"/>` : hairShape}
    <circle cx="84" cy="100" r="5" fill="#3E2723"/><circle cx="116" cy="100" r="5" fill="#3E2723"/>
    <circle cx="74" cy="114" r="7" fill="#FFAB91" opacity=".6"/><circle cx="126" cy="114" r="7" fill="#FFAB91" opacity=".6"/>
    <path d="M86 118q14 12 28 0" stroke="#3E2723" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// ---------- content ----------
const GOALS = {
  noa: [
    ['language', 'להגיד משפטים של 3 מילים ומעלה'],
    ['language', 'לבקש עזרה במילים'],
    ['play-social', 'לשחק משחק תורות עם ילד אחר'],
    ['play-social', 'להצטרף למשחק של ילדים בחצר'],
    ['motor-fine', 'לצבוע בתוך הקווים'],
    ['motor-fine', 'לגזור לאורך קו ישר'],
    ['adl', 'להתלבש באופן עצמאי'],
    ['adl', 'לשטוף ידיים לבד לפני אוכל'],
    ['cognitive', 'למיין חפצים לפי צבע וצורה'],
    ['general', 'לעבור בין פעילויות בלי בכי'],
  ],
  ori: [
    ['cognitive', 'לבצע הוראה בת 3 שלבים'],
    ['cognitive', 'לזכור רצף של 4 תמונות'],
    ['motor-gross', 'לשבת על כיסא 10 דקות רצוף'],
    ['motor-gross', 'לקפוץ על רגל אחת 5 פעמים'],
    ['adl', 'לארגן תיק בית ספר באופן עצמאי'],
    ['adl', 'לסדר את הצעצועים בסוף משחק'],
    ['general', 'להמתין לתור בלי להתפרץ'],
    ['play-social', 'להפסיד במשחק בלי להתפרץ'],
    ['language', 'לספר מה עשה בגן ב-3 משפטים'],
  ],
};

const FORM_TEXT = [
  { mood: 'מצב רוח טוב, הגיע/ה עם חיוך. קצת עייפות לקראת הסוף', concentrationLevel: 'ריכוז בינוני-טוב, 10 דקות רצוף', newReinforcers: 'מדבקות, בועות סבון', wordsProduced: 'תני, עוד, שלי, כדור', breakActivities: 'נדנדה, ציור חופשי', endOfSessionActivity: 'משחק בבצק', successes: 'עמד/ה ביעד המשפטים פעמיים בלי הנחיה', difficulties: 'קושי במעבר בין פעילויות', notes: 'להמשיך עם טיימר ויזואלי לפני מעברים' },
  { mood: 'שמחה ונלהבות, ביקש/ה להמשיך בסוף', concentrationLevel: 'ריכוז גבוה, 15 דקות', newReinforcers: 'סיפור על דינוזאורים', wordsProduced: 'אני רוצה, תן לי, עוד פעם', breakActivities: 'ריצה בחצר', endOfSessionActivity: 'סרטון קצר', successes: 'שיתוף פעולה מלא בכל התרגילים', difficulties: 'קשר עין קצר', notes: 'התקדמות יפה, להעלות את רמת הקושי' },
  { mood: 'חוסר מנוחה בתחילת הטיפול, נרגע/ה אחרי הפסקה', concentrationLevel: 'ריכוז נמוך-בינוני, 5–7 דקות בכל פעם', newReinforcers: 'זמן לגו', wordsProduced: '', breakActivities: 'קפיצות על טרמפולינה', endOfSessionActivity: 'בניית מגדל לגו', successes: 'ביצע/ה הוראה דו-שלבית בלי עזרה', difficulties: 'קם/ה מהכיסא כל כמה דקות', notes: 'לחזק כל ישיבה של 5 דקות' },
  { mood: 'רגוע/ה ומרוכז/ת', concentrationLevel: 'ריכוז טוב, 12 דקות רצוף', newReinforcers: 'סטיקרים של כדורגלנים', wordsProduced: 'יופי, סבבה, עוד אחד', breakActivities: 'בועות סבון', endOfSessionActivity: 'ציור', successes: 'פריצת דרך: הצליח/ה לבד בפעם הראשונה', difficulties: 'קושי קל בהמתנה לתור', notes: 'לתרגל עם וריאציות שונות' },
];

const BOARD = {
  noa: [['🗣️', 'לומר משפט שלם'], ['👕', 'להתלבש לבד'], ['🦷', 'לצחצח שיניים'], ['🎒', 'להכין תיק לגן'], ['🍽️', 'לאכול ארוחה בשולחן'], ['🌙', 'ללכת לישון בזמן']],
  ori: [['🛏️', 'לסדר את המיטה'], ['📚', 'להכין שיעורי בית'], ['🎒', 'לארגן תיק בית ספר'], ['🧼', 'לשטוף ידיים לפני אוכל'], ['👂', 'להקשיב להוראה ולבצע'], ['⏰', 'לחכות לתור בסבלנות']],
};

async function main() {
  const db = getDb();
  if (DELETE) { await wipe(db); console.log(`Deleted demo centre ${ADMIN_ID}`); process.exit(0); }

  const code = process.argv[3] || `demo-${crypto.randomInt(100000, 999999)}`;
  const clash = await db.collection('adminKeys').where('key', '==', code).limit(1).get();
  if (!clash.empty && clash.docs[0].data().adminId !== ADMIN_ID) { console.error('Access code already in use'); process.exit(1); }

  await wipe(db); // idempotent re-run for the same slug
  const now = new Date();
  const batch = db.batch();
  const set = (col, id, data) => batch.set(db.collection(col).doc(id), data);
  const add = (col, data) => batch.set(db.collection(col).doc(), data);

  // centre
  add('adminKeys', { key: code, adminId: ADMIN_ID, name: 'אורית שמש', isSuperAdmin: false, active: true, createdAt: now, createdBy: 'demo-seed' });
  set('practitioners', ADMIN_ID, { name: 'אורית שמש', type: 'מנתחת התנהגות', mobile: '', email: '', isSuperAdmin: false, adminId: ADMIN_ID, createdAt: now, createdBy: 'demo-seed' });
  add('subscriptions', { adminId: ADMIN_ID, plan: 'pro', status: 'active', proStartDate: now, proEndDate: new Date(now.getTime() + 60 * DAY), billingCycle: 'manual', paypalSubscriptionId: null, nextPaymentDate: null, createdAt: now, updatedAt: now });

  const people = [
    [PR.sara, 'שרה כהן', 'מטפלת'], [PR.ronit, 'רונית לוי', 'מנתחת התנהגות'],
    [PR.dana, 'דנה אברהם', 'מטפלת'], [PR.yael, 'יעל מזרחי', 'מדריכת הורים'],
  ];
  for (const [id, name, type] of people) set('practitioners', id, { name, type, mobile: '', email: '', isSuperAdmin: false, adminId: ADMIN_ID, createdAt: now, createdBy: ADMIN_ID });

  // kids
  const kidDoc = (key, name, age, gender, desc, goalsText, color) => {
    const tasks = BOARD[key].map(([icon, title], i) => ({ id: i + 1, icon, title, type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0, 1, 2, 3, 4, 5, 6] }));
    tasks.push({ id: 20, icon: '🌬️', title: 'תרגיל נשימות', type: 'calm-down', activityType: 'breathing', activeDays: [0, 1, 2, 3, 4, 5, 6] });
    return {
      name, age, gender, imageName: avatar(gender, color), kidDescription: desc, behaviorGoals: goalsText, personalInfo: '',
      tasks, boardLayout: { items: [
        { id: 1, type: 'bank', label: `קופת הנקודות של ${name}` }, { id: 2, type: 'progress', title: 'ההתקדמות שלי היום' },
        { id: 3, type: 'header', size: 'medium', text: '✨ המשימות שלי ✨' },
        ...tasks.filter(t => t.type === 'regular').map((t, i) => ({ id: 4 + i, type: 'task', taskType: 'regular', taskData: t })),
        { id: 30, type: 'header', size: 'medium', text: '🧘 פינת ההרגעה 🧘' },
        { id: 31, type: 'task', taskType: 'calm-down', taskData: tasks[tasks.length - 1] },
      ] },
      completedTasks: [1, 3], completedBonusTasks: [], bonusRewardsEarned: {}, totalMoney: 12,
      dailyReward: 1, coinStyle: 'points', coinImageName: '', colorSchema: color, headerLabel: '', savingsLabel: 'הנקודות שלי',
      regularTasksHeader: '✨ המשימות שלי ✨', bonusTasksHeader: '💰 משימות בונוס 💰', calmDownHeader: '🧘 פינת ההרגעה 🧘',
      showDino: true, soundsEnabled: true, builderPin: '1234', todayRewardGiven: false, lastResetDate: now.toDateString(),
      createdAt: at(-35), adminId: ADMIN_ID, selfBuilt: false, inviteToken: null,
    };
  };
  set('kids', KIDS.noa, kidDoc('noa', 'נועה', 5, 'girl', 'ילדה על הרצף האוטיסטי, תפקוד גבוה. אוהבת ציור ומוזיקה', 'שיפור תקשורת מילולית, משחק עם ילדים אחרים, ויסות רגשי', 'pink'));
  set('kids', KIDS.ori, kidDoc('ori', 'אורי', 7, 'boy', 'ילד עם ADHD, אנרגטי ומלא חיים. אוהב כדורגל ולגו', 'שיפור ריכוז, ישיבה בשולחן, ביצוע הוראות רב שלביות', 'blue'));

  const team = { noa: [PR.sara, PR.ronit, PR.yael], ori: [PR.sara, PR.dana, PR.yael] };
  for (const k of ['noa', 'ori']) for (const p of team[k]) add('kidPractitioners', { kidId: KIDS[k], practitionerId: p, role: 'therapist', addedAt: now, addedBy: ADMIN_ID });

  const parents = { noa: [['אבי דוד', '050-0000001'], ['מיכל דוד', '050-0000002']], ori: [['יוסי כהן', '050-0000003'], ['רחל כהן', '050-0000004']] };
  for (const k of ['noa', 'ori']) parents[k].forEach(([name, mobile], i) => set('parents', `${KIDS[k]}-parent-${i + 1}`, { kidId: KIDS[k], name, mobile, email: '', createdAt: now }));

  // goals
  const goalSnap = {};
  for (const k of ['noa', 'ori']) {
    goalSnap[k] = GOALS[k].map(([categoryId, title], i) => {
      const goalId = `${KIDS[k]}-goal-${i + 1}`;
      set('goals', goalId, { kidId: KIDS[k], categoryId, title, isActive: true, createdAt: at(-35) });
      return { goalId, goalTitle: title, categoryId };
    });
  }

  // sessions: 2 weeks back, this week, next week. [kid, dayOffset, hour, therapist]
  const plan = [];
  for (const w of [-14, -7, 0, 7]) {
    plan.push(['noa', w + 0, 10, PR.sara], ['noa', w + 2, 15, PR.ronit], ['noa', w + 4, 10, PR.sara]);
    plan.push(['ori', w + 1, 9, PR.dana], ['ori', w + 3, 14, PR.sara], ['ori', w + 4, 16, PR.dana]);
  }
  const todayOffset = today.getDay();
  let seq = 0;
  for (const [k, off, hour, who] of plan) {
    seq++;
    const date = at(off, hour);
    const id = `${KIDS[k]}-s${seq}`;
    let status = 'scheduled', formId = null;
    if (off < todayOffset) {
      if (seq % 9 === 0) status = 'pending_form';          // one forgotten form now and then
      else { status = 'completed'; formId = `${id}-form`; }
    }
    set('sessions', id, { kidId: KIDS[k], therapistId: who, scheduledDate: date, type: 'therapy', status, formId, createdAt: at(-30) });
    if (formId) {
      const g = goalSnap[k];
      const worked = g.filter((_x, i) => (i * 7 + seq * 3) % 5 < 2);
      set('sessionForms', formId, {
        sessionId: id, kidId: KIDS[k], practitionerId: who, sessionDate: date,
        cooperation: 60 + (seq * 7) % 35, sessionDuration: 45, sittingDuration: 20 + (seq * 3) % 20,
        ...FORM_TEXT[seq % FORM_TEXT.length],
        goalsWorkedOn: worked.length ? worked : [g[0]], additionalGoals: [], customFields: {},
        createdAt: new Date(date.getTime() + 3600e3), updatedAt: new Date(date.getTime() + 3600e3),
      });
    }
  }

  // a team meeting last week for each kid
  for (const k of ['noa', 'ori']) {
    const sid = `${KIDS[k]}-meet1`, fid = `${sid}-form`, date = at(-5, 12);
    set('sessions', sid, { kidId: KIDS[k], therapistId: null, scheduledDate: date, type: 'meeting', status: 'completed', formId: fid, createdAt: at(-30) });
    set('meetingForms', fid, {
      sessionId: sid, kidId: KIDS[k], sessionDate: date,
      attendees: [{ type: 'parent', id: `${KIDS[k]}-parent-2`, name: parents[k][1][0] }, ...team[k].map(p => ({ type: 'practitioner', id: p, name: people.find(x => x[0] === p)[1] }))],
      generalNotes: 'ישיבת צוות חודשית לסיכום ההתקדמות. ההורים מדווחים על שיפור בבית.',
      behaviorNotes: 'ירידה בהתפרצויות, יותר שימוש במילים לביטוי רגשות.',
      adl: 'התקדמות בעצמאות בלבוש ובהיגיינה, עדיין צריך/ה עזרה בכפתורים.',
      grossMotorPrograms: 'שיווי משקל על קורה, קפיצות ברגליים צמודות.',
      programsOutsideRoom: 'משחק מובנה בחצר עם ילד אחד – תורות ושיתוף.',
      learningProgramsInRoom: 'התאמת צורות, פאזלים, מיון צבעים.',
      tasks: 'להמשיך עם הטיימר הוויזואלי. ההורים יתרגלו בבית את המטרות של החודש.',
      createdAt: date, updatedAt: date,
    });
  }

  // daily agenda routine for Noa
  const R = (morning, noon, evening) => ({ morning, noon, evening });
  const it = (id, icon, title, time) => ({ id, icon, title, time });
  const weekday = R([it('m1', '🛏️', 'לקום ולהתלבש', '07:00'), it('m2', '🥣', 'ארוחת בוקר', '07:30'), it('m3', '🎒', 'הולכים לגן', '08:00')],
    [it('n1', '🧩', 'טיפול', '15:00'), it('n2', '🛝', 'גינה', '16:30')],
    [it('e1', '🍽️', 'ארוחת ערב', '18:30'), it('e2', '🚿', 'מקלחת', '19:00'), it('e3', '📖', 'סיפור ולישון', '19:45')]);
  const routine = {}; for (let d = 0; d < 7; d++) routine[String(d)] = weekday;
  set('kidAgendas', KIDS.noa, { routine });

  // board points history for the stats page (last 45 days)
  for (const k of ['noa', 'ori']) {
    const dailyStats = {};
    for (let i = 45; i >= 1; i--) {
      const d = new Date(today.getTime() - i * DAY);
      const weekend = d.getDay() === 5 || d.getDay() === 6;
      const r = ((i * 37 + (k === 'noa' ? 11 : 5)) % 100) / 100;            // deterministic 0..1
      const trend = 0.55 + 0.35 * (1 - i / 45);                             // improves over time
      if (r > trend + (weekend ? -0.15 : 0.1)) continue;                    // a day off now and then
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      dailyStats[key] = { regularPoints: 1, bonusPoints: (i * 13) % 4 === 0 ? 1 : 0, lastUpdated: d };
    }
    set('kidStats', KIDS[k], { kidId: KIDS[k], dailyStats });
  }

  await batch.commit();

  const base = 'https://startdoing.co.il/therapy';
  console.log(`\nDemo centre ${ADMIN_ID} ready\n`);
  console.log(`Manager login: ${base}/login   code: ${code}`);
  console.log(`Therapist (שרה כהן): ${base}/t/${PR.sara}`);
  console.log(`Parent (נועה):       ${base}/p/${KIDS.noa}`);
  console.log(`Board (נועה):        https://startdoing.co.il/board.html?kid=${KIDS.noa}`);
  console.log(`Board (אורי):        https://startdoing.co.il/board.html?kid=${KIDS.ori}`);
  console.log(`Pro until: ${new Date(now.getTime() + 60 * DAY).toISOString().slice(0, 10)}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
