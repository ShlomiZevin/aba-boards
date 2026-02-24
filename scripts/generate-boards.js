/**
 * Board Generation Script for הילה and אורי
 * Run: node scripts/generate-boards.js
 */

const path = require('path');

// Use the existing Firebase setup
const { getDb } = require(path.join(__dirname, '..', 'server', 'services', 'firebase'));

// ============================================================
// BOARD 1: הילה (Hila)
// ============================================================

function buildHilaBoardLayout() {
  return {
    items: [
      // Bank
      { id: 1, type: 'bank', label: 'קופת הנקודות של הילה' },
      // Progress
      { id: 2, type: 'progress', title: 'ההתקדמות שלי היום' },
      // Tasks header
      { id: 3, type: 'header', size: 'medium', text: '✨ המשימות שלי ✨' },
      // Regular tasks
      {
        id: 4, type: 'task', taskType: 'regular',
        taskData: { id: 1, icon: '🛏️', title: 'סידור חדר', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 5, type: 'task', taskType: 'regular',
        taskData: { id: 2, icon: '🎒', title: 'הכנת תיק', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4] }
      },
      {
        id: 6, type: 'task', taskType: 'regular',
        taskData: { id: 3, icon: '👗', title: 'הכנת בגדים', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 7, type: 'task', taskType: 'regular',
        taskData: { id: 4, icon: '🏠', title: 'מטלת בית (כביסה/ מדיח)', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 8, type: 'task', taskType: 'regular',
        taskData: { id: 5, icon: '🌙', title: 'ללכת לישון ב-21:00', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 9, type: 'task', taskType: 'regular',
        taskData: { id: 6, icon: '🪥', title: 'להכין מברשת שיניים', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 10, type: 'task', taskType: 'regular',
        taskData: { id: 7, icon: '🦷', title: 'לצחצח שיניים', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 11, type: 'task', taskType: 'regular',
        taskData: { id: 8, icon: '💊', title: 'לקחת תרופה בערב', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 12, type: 'task', taskType: 'regular',
        taskData: { id: 9, icon: '🐕', title: 'לצאת עם באני הכלבה לטיילת', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      // Calm-down header
      { id: 13, type: 'header', size: 'medium', text: '🧘 פינת ההרגעה 🧘' },
      // Calm-down activities
      {
        id: 14, type: 'task', taskType: 'calm-down',
        taskData: { id: 10, icon: '🎨', title: 'לוח ציור', type: 'calm-down', activityType: 'paint', activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 15, type: 'task', taskType: 'calm-down',
        taskData: { id: 11, icon: '🫧', title: 'בועות סבון', type: 'calm-down', activityType: 'bubbles', activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 16, type: 'task', taskType: 'calm-down',
        taskData: { id: 12, icon: '🌬️', title: 'תרגיל נשימות', type: 'calm-down', activityType: 'breathing', activeDays: [0,1,2,3,4,5,6] }
      },
      // Goals header
      { id: 17, type: 'header', size: 'medium', text: '🎁 הפרסים שלי 🎁' },
      // Goals/Rewards
      { id: 18, type: 'goal', icon: '🎨', title: 'יצירה', pointsRequired: 30 },
      { id: 19, type: 'goal', icon: '☕', title: 'יציאה לבית קפה', pointsRequired: 50 },
    ]
  };
}

function buildHilaKidDoc(childImage) {
  const boardLayout = buildHilaBoardLayout();
  const tasks = boardLayout.items
    .filter(item => item.type === 'task')
    .map(item => item.taskData);

  return {
    name: 'הילה',
    age: 10,
    gender: 'girl',
    imageName: childImage || '',
    kidDescription: 'ריקוד. תיאטרון\nחברות. אקרובטיקה. תנועת נוער ( התנועה החדשה) צחוקים שטויות ולהיות בתנועה',
    behaviorGoals: 'להפחית שימוש בטלפון. ולעשות יצירה במקום.\nיכולת להרגע בערב כשמפחדת\nלהפרד ממני בערב ולהצליח ללכת לישון בזמן. \nלהצליח לשהות במיטה כשהולכת לישון\nלהרגיע פחדי לילה\nלהיות עצמאית במעברים בבוקר',
    personalInfo: 'אוהבת אקרובטיקה. זקוקה לטכניקות הרגעות. מנחי יוגה נשימות וכו. שפחות מצליחה לעשות באופן עצמאי',

    // Board
    tasks,
    boardLayout,

    // State
    completedTasks: [],
    completedBonusTasks: [],
    bonusRewardsEarned: {},
    totalMoney: 0,

    // Rewards
    dailyReward: 5,
    coinStyle: 'points',
    coinImageName: '',

    // Display
    colorSchema: 'pink',
    headerLabel: '',
    savingsLabel: 'הנקודות שלי',
    regularTasksHeader: '✨ המשימות שלי ✨',
    bonusTasksHeader: '💰 משימות בונוס 💰',
    calmDownHeader: '🧘 פינת ההרגעה 🧘',

    // Features
    showDino: true,
    soundsEnabled: true,
    builderPin: '1234',

    // Timestamps
    todayRewardGiven: false,
    lastResetDate: new Date().toDateString(),
    createdAt: new Date(),

    // No admin — standalone board
    adminId: null,
    selfBuilt: false,
    inviteToken: null,
  };
}

// ============================================================
// BOARD 2: אורי (Ori)
// ============================================================

function buildOriBoardLayout() {
  return {
    items: [
      // Bank
      { id: 1, type: 'bank', label: 'קופת הנקודות של אורי' },
      // Progress
      { id: 2, type: 'progress', title: 'ההתקדמות שלי היום' },
      // Tasks header
      { id: 3, type: 'header', size: 'medium', text: '✨ המשימות שלי ✨' },
      // Regular tasks
      {
        id: 4, type: 'task', taskType: 'regular',
        taskData: { id: 1, icon: '📚', title: 'הכנת שיעורי בית', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4] }
      },
      {
        id: 5, type: 'task', taskType: 'regular',
        taskData: { id: 2, icon: '🛏️', title: 'סידור חדר', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 6, type: 'task', taskType: 'regular',
        taskData: { id: 3, icon: '🎒', title: 'סידור ילקוט', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4] }
      },
      {
        id: 7, type: 'task', taskType: 'regular',
        taskData: { id: 4, icon: '🍽️', title: 'ארוחת ערב', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      {
        id: 8, type: 'task', taskType: 'regular',
        taskData: { id: 5, icon: '🚿', title: 'מקלחת', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }
      },
      // Goals header
      { id: 9, type: 'header', size: 'medium', text: '🎁 הפרסים שלי 🎁' },
      // Goals/Rewards
      { id: 10, type: 'goal', icon: '💕', title: 'זמן איכות עם אמא או אבא', pointsRequired: 10 },
    ]
  };
}

function buildOriKidDoc() {
  const boardLayout = buildOriBoardLayout();
  const tasks = boardLayout.items
    .filter(item => item.type === 'task')
    .map(item => item.taskData);

  return {
    name: 'אורי',
    age: 11,
    gender: 'girl',
    imageName: '',
    kidDescription: '',
    behaviorGoals: 'מעבר בין פעילויות, ניהול זמנים, דחיית סיפוקים',
    personalInfo: '',

    // Board
    tasks,
    boardLayout,

    // State
    completedTasks: [],
    completedBonusTasks: [],
    bonusRewardsEarned: {},
    totalMoney: 0,

    // Rewards
    dailyReward: 1,
    coinStyle: 'points',
    coinImageName: '',

    // Display
    colorSchema: 'purple',
    headerLabel: '',
    savingsLabel: 'הנקודות שלי',
    regularTasksHeader: '✨ המשימות שלי ✨',
    bonusTasksHeader: '💰 משימות בונוס 💰',
    calmDownHeader: '🧘 פינת ההרגעה 🧘',

    // Features
    showDino: false,
    soundsEnabled: true,
    builderPin: '1234',

    // Timestamps
    todayRewardGiven: false,
    lastResetDate: new Date().toDateString(),
    createdAt: new Date(),

    // No admin — standalone board
    adminId: null,
    selfBuilt: false,
    inviteToken: null,
  };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  try {
    const db = getDb();
    const timestamp = Date.now();

    // --- HILA ---
    const hilaId = 'הילה_' + timestamp;
    // NOTE: childImage is very large base64 — pass it in or set to '' if not needed now
    const hilaDoc = buildHilaKidDoc(''); // Set '' for now, image can be added via board-builder

    console.log(`Creating board for הילה (ID: ${hilaId})...`);
    await db.collection('kids').doc(hilaId).set(hilaDoc);
    console.log(`✅ הילה board created!`);

    // Store parent info
    await db.collection('parents').add({
      kidId: hilaId,
      name: 'שרית אלתרמן',
      email: 'saritr4@gmail.com',
      mobile: '0545201721',
      createdAt: new Date(),
    });
    console.log(`   Parent info saved for הילה`);

    // --- ORI ---
    const oriId = 'אורי_' + timestamp;
    const oriDoc = buildOriKidDoc();

    console.log(`Creating board for אורי (ID: ${oriId})...`);
    await db.collection('kids').doc(oriId).set(oriDoc);
    console.log(`✅ אורי board created!`);

    // Store parent info
    await db.collection('parents').add({
      kidId: oriId,
      name: 'דורית שחם',
      email: 'dorthsh@gmail.com',
      mobile: '',
      createdAt: new Date(),
    });
    console.log(`   Parent info saved for אורי`);

    // --- SUMMARY ---
    console.log('\n========================================');
    console.log('BOARD URLs:');
    console.log(`הילה: https://aba-ai-d74f5.web.app/board.html?kid=${encodeURIComponent(hilaId)}`);
    console.log(`הילה builder: https://aba-ai-d74f5.web.app/board-builder.html?kid=${encodeURIComponent(hilaId)}`);
    console.log('');
    console.log(`אורי: https://aba-ai-d74f5.web.app/board.html?kid=${encodeURIComponent(oriId)}`);
    console.log(`אורי builder: https://aba-ai-d74f5.web.app/board-builder.html?kid=${encodeURIComponent(oriId)}`);
    console.log('========================================');
    console.log('Builder PIN for both: 1234');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
