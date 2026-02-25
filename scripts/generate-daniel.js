const path = require('path');
const { getDb } = require(path.join(__dirname, '..', 'server', 'services', 'firebase'));

async function main() {
  const db = getDb();
  const timestamp = Date.now();
  const kidId = 'דניאל_' + timestamp;

  const boardLayout = {
    items: [
      { id: 1, type: 'bank', label: 'קופת הנקודות של דניאל' },
      { id: 2, type: 'progress', title: 'ההתקדמות שלי היום' },
      { id: 3, type: 'header', size: 'medium', text: '✨ המשימות שלי ✨' },
      { id: 4, type: 'task', taskType: 'regular', taskData: { id: 1, icon: '🛏️', title: 'לסדר את המיטה', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 5, type: 'task', taskType: 'regular', taskData: { id: 2, icon: '👕', title: 'להתלבש', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 6, type: 'task', taskType: 'regular', taskData: { id: 3, icon: '🧼', title: 'לשטוף ידיים', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 7, type: 'task', taskType: 'regular', taskData: { id: 4, icon: '🦷', title: 'לצחצח שיניים', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 8, type: 'task', taskType: 'regular', taskData: { id: 5, icon: '🍽️', title: 'לאכול ארוחת ערב', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 9, type: 'task', taskType: 'regular', taskData: { id: 6, icon: '🚿', title: 'להתקלח מתי שאבא ואמא אומרים לי', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 10, type: 'task', taskType: 'regular', taskData: { id: 7, icon: '🌙', title: 'ללכת לישון במיטה שלי', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 11, type: 'task', taskType: 'regular', taskData: { id: 8, icon: '👋', title: 'לענות שקוראים לי בשם', type: 'regular', requiresTestimony: false, trackTime: false, activeDays: [0,1,2,3,4,5,6] }},
      { id: 12, type: 'header', size: 'medium', text: '🧘 פינת ההרגעה 🧘' },
      { id: 13, type: 'task', taskType: 'calm-down', taskData: { id: 9, icon: '🎨', title: 'לוח ציור', type: 'calm-down', activityType: 'paint', activeDays: [0,1,2,3,4,5,6] }},
      { id: 14, type: 'task', taskType: 'calm-down', taskData: { id: 10, icon: '🫧', title: 'בועות סבון', type: 'calm-down', activityType: 'bubbles', activeDays: [0,1,2,3,4,5,6] }},
      { id: 15, type: 'task', taskType: 'calm-down', taskData: { id: 11, icon: '🌬️', title: 'תרגיל נשימות', type: 'calm-down', activityType: 'breathing', activeDays: [0,1,2,3,4,5,6] }},
    ]
  };

  const tasks = boardLayout.items.filter(i => i.type === 'task').map(i => i.taskData);

  await db.collection('kids').doc(kidId).set({
    name: 'דניאל', age: 6, gender: 'boy', imageName: '',
    kidDescription: 'ילד על הרצף',
    behaviorGoals: 'שיפור סבלנות, מעבר בין פעילויות, התמדה במשימות, ויסות רגשי',
    personalInfo: 'הילד הוא על הרצף בתפקוד בינוני',
    tasks, boardLayout,
    completedTasks: [], completedBonusTasks: [], bonusRewardsEarned: {}, totalMoney: 0,
    dailyReward: 0.5, coinStyle: 'points', coinImageName: '',
    colorSchema: 'blue', headerLabel: '', savingsLabel: 'הנקודות שלי',
    regularTasksHeader: '✨ המשימות שלי ✨',
    bonusTasksHeader: '💰 משימות בונוס 💰',
    calmDownHeader: '🧘 פינת ההרגעה 🧘',
    showDino: true, soundsEnabled: true, builderPin: '1234',
    todayRewardGiven: false, lastResetDate: new Date().toDateString(),
    createdAt: new Date(), adminId: null, selfBuilt: false, inviteToken: null,
  });
  console.log('✅ Kid created:', kidId);

  await db.collection('parents').add({
    kidId, name: 'גלית', email: 'golgol91@gmail.com', mobile: '0543452278', createdAt: new Date(),
  });
  console.log('✅ Parent saved');
  console.log('Board: https://startdoing.co.il/board.html?kid=' + encodeURIComponent(kidId));
  console.log('Builder: https://startdoing.co.il/board-builder.html?kid=' + encodeURIComponent(kidId));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
