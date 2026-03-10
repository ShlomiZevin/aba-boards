const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./firebase');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_TASKS = [
  { icon: '🛏️', title: 'לסדר את המיטה' },
  { icon: '👕', title: 'להתלבש' },
  { icon: '🧼', title: 'לשטוף ידיים' },
  { icon: '🦷', title: 'לצחצח שיניים' },
  { icon: '🍽️', title: 'לאכול ארוחת ערב' },
  { icon: '🚿', title: 'להתקלח מתי שאבא ואמא אומרים לי' },
  { icon: '🌙', title: 'ללכת לישון במיטה שלי' },
  { icon: '👋', title: 'לענות שקוראים לי בשם' },
];

const SYSTEM_PROMPT = `You are a board generator for a children's behavioral reward app called "Doing".
You receive a board request with info about a child (name, age, gender, tasks, rewards, behavior goals, etc.) and must produce a valid JSON board layout.

IMPORTANT RULES:
- Output ONLY valid JSON, no markdown, no explanation, no code fences.
- The JSON must have this exact structure:
{
  "boardLayout": { "items": [...] },
  "kidDescription": "...",
  "behaviorGoals": "...",
  "personalInfo": "..."
}

BOARD LAYOUT ITEM TYPES:
1. Bank: { "id": N, "type": "bank", "label": "קופת הנקודות של <name>" }
2. Progress: { "id": N, "type": "progress", "title": "ההתקדמות שלי היום" }
3. Header: { "id": N, "type": "header", "size": "medium", "text": "..." }
4. Regular task: { "id": N, "type": "task", "taskType": "regular", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "regular", "requiresTestimony": false, "trackTime": false, "activeDays": [0,1,2,3,4,5,6] } }
5. Calm-down task: { "id": N, "type": "task", "taskType": "calm-down", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "calm-down", "activityType": "paint|breathing|bubbles|scooter|xylophone", "activeDays": [0,1,2,3,4,5,6] } }
6. Goal/Reward: { "id": N, "type": "goal", "icon": "emoji", "title": "...", "pointsRequired": number }

BOARD STRUCTURE ORDER:
1. Always start with bank, then progress bar
2. Then header "✨ המשימות שלי ✨" followed by regular tasks
3. If behavior goals mention calming/regulation/fears, add header "🧘 פינת ההרגעה 🧘" with 2-3 calm-down activities (paint, breathing, bubbles)
4. If rewards are specified, add header "🎁 הפרסים שלי 🎁" followed by goal items with point values

TASK GUIDELINES:
- Choose appropriate emoji icons for each task
- School-related tasks (homework, backpack) should have activeDays: [0,1,2,3,4] (Sun-Thu in Israel)
- Daily tasks get activeDays: [0,1,2,3,4,5,6]
- Keep task titles short and clear, in Hebrew
- Item IDs should be sequential starting from 1
- Task data IDs should be sequential starting from 1

REWARD GUIDELINES:
- If rewards text includes point values (e.g. "30 נקודות"), use those
- If no point values specified, assign reasonable amounts based on dailyReward and number of tasks
- Parse rewards from the text, each reward on a separate line

For kidDescription, behaviorGoals, personalInfo - clean up and organize the text from the request, keep in Hebrew.`;

async function generateBoardFromRequest(request) {
  const tasksText = (request.tasks || '').trim();
  const hasCustomTasks = tasksText.length > 0;

  let taskInstructions;
  if (hasCustomTasks) {
    taskInstructions = `Tasks requested by parent:\n${tasksText}`;
  } else {
    taskInstructions = `No specific tasks were requested. Use these default tasks:\n${DEFAULT_TASKS.map(t => `${t.icon} ${t.title}`).join('\n')}`;
  }

  const userMessage = `Generate a board for this child:

Name: ${request.childName}
Age: ${request.age}
Gender: ${request.gender === 'boy' ? 'בן' : 'בת'}
Daily reward: ${request.dailyReward || 1} points

Child description: ${request.childDescription || 'לא צוין'}
Behavior goals: ${request.behaviorGoals || 'לא צוין'}
Additional notes: ${request.additionalNotes || 'לא צוין'}

${taskInstructions}

Rewards: ${request.rewards || 'לא צוין'}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text.trim();

  // Parse JSON — strip code fences if Claude added them
  let jsonText = text;
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const generated = JSON.parse(jsonText);

  if (!generated.boardLayout || !generated.boardLayout.items) {
    throw new Error('Invalid board layout generated');
  }

  return generated;
}

async function createBoardFromRequest(requestId) {
  const db = getDb();

  // Get the request
  const reqDoc = await db.collection('boardRequests').doc(requestId).get();
  if (!reqDoc.exists) throw new Error('Request not found');
  const request = reqDoc.data();

  // Generate board via Claude
  const generated = await generateBoardFromRequest(request);
  const boardLayout = generated.boardLayout;

  // Extract tasks array
  const tasks = boardLayout.items
    .filter(item => item.type === 'task')
    .map(item => item.taskData);

  // Build kid ID
  const name = request.childName || 'ילד';
  const kidId = name.toLowerCase().replace(/[^a-zא-ת0-9]/g, '') + '_' + Date.now();

  // Build kid document
  const kidDoc = {
    name,
    age: request.age || '',
    gender: request.gender || '',
    imageName: request.childImage || '',
    kidDescription: generated.kidDescription || request.childDescription || '',
    behaviorGoals: generated.behaviorGoals || request.behaviorGoals || '',
    personalInfo: generated.personalInfo || request.additionalNotes || '',

    tasks,
    boardLayout,

    completedTasks: [],
    completedBonusTasks: [],
    bonusRewardsEarned: {},
    totalMoney: 0,

    dailyReward: request.dailyReward || 1,
    coinStyle: request.coinStyle || 'points',
    coinImageName: '',

    colorSchema: request.colorSchema || 'purple',
    headerLabel: '',
    savingsLabel: 'הנקודות שלי',
    regularTasksHeader: '✨ המשימות שלי ✨',
    bonusTasksHeader: '💰 משימות בונוס 💰',
    calmDownHeader: '🧘 פינת ההרגעה 🧘',

    showDino: request.showDino !== false,
    soundsEnabled: request.soundsEnabled !== false,
    builderPin: '1234',

    todayRewardGiven: false,
    lastResetDate: new Date().toDateString(),
    createdAt: new Date(),

    adminId: null,
    selfBuilt: false,
    inviteToken: request.inviteToken || null,
  };

  // Save kid
  await db.collection('kids').doc(kidId).set(kidDoc);

  // Save parent info
  const parentName = request.parentName || '';
  const parentEmail = request.email || '';
  const parentPhone = request.phone || '';
  if (parentName || parentEmail) {
    await db.collection('parents').add({
      kidId,
      name: parentName,
      email: parentEmail,
      mobile: parentPhone,
      createdAt: new Date(),
    });
  }

  // Update request status
  await db.collection('boardRequests').doc(requestId).update({
    status: 'completed',
    createdBoardId: kidId,
    completedAt: new Date(),
  });

  return {
    kidId,
    boardUrl: `https://startdoing.co.il/board.html?kid=${encodeURIComponent(kidId)}`,
    builderUrl: `https://startdoing.co.il/board-builder.html?kid=${encodeURIComponent(kidId)}`,
  };
}

const CHAT_SYSTEM_PROMPT = `You help edit a children's behavioral reward board via chat conversation.
You receive the current board state (JSON) and the user's request in Hebrew.

If the user asks to MODIFY the board (add/remove/change tasks, goals, headers, etc.):
Return JSON: { "reply": "הסבר קצר מה שינית...", "boardLayout": { "items": [...] } }

If the user asks a QUESTION or doesn't require board changes:
Return JSON: { "reply": "תשובה..." }

IMPORTANT: Output ONLY valid JSON. No markdown, no code fences.

BOARD LAYOUT ITEM TYPES:
1. Bank: { "id": N, "type": "bank", "label": "..." }
2. Progress: { "id": N, "type": "progress", "title": "ההתקדמות שלי היום" }
3. Header: { "id": N, "type": "header", "size": "large|medium|small", "text": "..." }
4. Regular task: { "id": N, "type": "task", "taskType": "regular", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "regular", "requiresTestimony": false, "trackTime": false, "activeDays": [0,1,2,3,4,5,6] } }
5. Bonus task: { "id": N, "type": "task", "taskType": "bonus", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "bonus", "minReward": 1, "maxReward": 5, "bonusType": "instant", "requiresTestimony": false, "trackTime": false, "activeDays": [0,1,2,3,4,5,6] } }
6. Composite task: { "id": N, "type": "task", "taskType": "composite", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "composite", "subtasks": [{"id":1,"title":"..."},{"id":2,"title":"..."}], "requiresTestimony": false, "trackTime": false, "activeDays": [0,1,2,3,4,5,6] } }
7. Calm-down: { "id": N, "type": "task", "taskType": "calm-down", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "calm-down", "activityType": "paint|breathing|bubbles|scooter|xylophone", "activeDays": [0,1,2,3,4,5,6] } }
8. Goal/Reward: { "id": N, "type": "goal", "icon": "emoji", "title": "...", "pointsRequired": number }

RULES:
- Keep existing item IDs when modifying — only assign new IDs for new items
- Use sequential IDs for new items starting from max existing ID + 1
- activeDays: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat (Israel week)
- School tasks: activeDays [0,1,2,3,4], daily tasks: [0,1,2,3,4,5,6]
- Always keep bank and progress as first two items
- Reply in Hebrew
- Keep task titles short and clear`;

async function chatBoardEdit(kidInfo, currentBoard, userMessage, history) {
  const messages = [];

  // Add conversation history
  if (history && history.length > 0) {
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Build current message with board context
  const contextMessage = `Current board state:
${JSON.stringify(currentBoard, null, 2)}

Kid info: ${kidInfo.name || 'לא ידוע'}, age ${kidInfo.age || '?'}, ${kidInfo.gender === 'boy' ? 'בן' : kidInfo.gender === 'girl' ? 'בת' : 'לא ידוע'}

User request: ${userMessage}`;

  messages.push({ role: 'user', content: contextMessage });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: CHAT_SYSTEM_PROMPT,
    messages,
  });

  const text = response.content[0].text.trim();

  // Try multiple strategies to extract JSON from the response
  let jsonText = text;

  // Strip code fences
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Strategy 1: Direct parse
  try {
    return JSON.parse(jsonText);
  } catch {}

  // Strategy 2: Find JSON object within text (Claude sometimes prefixes with plain text)
  const jsonMatch = text.match(/\{[\s\S]*"reply"[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // Strategy 3: Find any JSON object in the text
  const braceStart = text.indexOf('{');
  if (braceStart >= 0) {
    try {
      return JSON.parse(text.slice(braceStart));
    } catch {}
  }

  // Fallback: wrap plain text as reply
  return { reply: text };
}

module.exports = { generateBoardFromRequest, createBoardFromRequest, chatBoardEdit };
