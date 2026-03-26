const Anthropic = require('@anthropic-ai/sdk');
const therapyService = require('./therapy');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function toTimestamp(val) {
  if (!val) return null;
  if (val.seconds) return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  return new Date(val).getTime();
}

function formatDate(val) {
  const ts = toTimestamp(val);
  if (!ts) return null;
  return new Date(ts).toISOString().split('T')[0]; // "2026-03-09"
}

const CHAT_TOOLS = [
  {
    name: 'list_kids',
    description: 'List all kids managed by this admin. Returns name, id, age, gender for each.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_kid',
    description: 'Create a new kid with a default board. Returns the new kid ID.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Kid name (required)' },
        age: { type: 'number', description: 'Kid age' },
        gender: { type: 'string', enum: ['boy', 'girl'], description: 'Gender' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_kid_profile',
    description: 'Get full profile for a kid: name, age, gender, kidDescription, behaviorGoals, personalInfo, board settings.',
    input_schema: {
      type: 'object',
      properties: { kidId: { type: 'string' } },
      required: ['kidId'],
    },
  },
  {
    name: 'get_goals',
    description: 'Get therapy goals for a kid. Returns goal titles, categories, active status.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string' },
        activeOnly: { type: 'boolean', description: 'If true, only active goals' },
      },
      required: ['kidId'],
    },
  },
  {
    name: 'get_session_forms',
    description: 'Get therapy session forms for a kid. Each has: cooperation %, mood, concentration, successes, difficulties, notes, goals worked on, date, practitioner. Sorted by date desc.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string' },
        limit: { type: 'number', description: 'Max forms to return (default 10)' },
        fromDate: { type: 'string', description: 'ISO date - forms from this date onward' },
        toDate: { type: 'string', description: 'ISO date - forms up to this date' },
      },
      required: ['kidId'],
    },
  },
  {
    name: 'get_meeting_forms',
    description: 'Get team/parent meeting forms for a kid. Each has: attendees, general notes, behavior notes, ADL, programs, tasks.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string' },
        limit: { type: 'number', description: 'Max forms to return (default 5)' },
      },
      required: ['kidId'],
    },
  },
  {
    name: 'get_sessions',
    description: 'Get therapy sessions for a kid. Each has: date, therapist, status (scheduled/completed/missed), type.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string' },
        fromDate: { type: 'string', description: 'ISO date filter' },
        toDate: { type: 'string', description: 'ISO date filter' },
        status: { type: 'string', description: 'Filter: scheduled, completed, missed, pending_form' },
      },
      required: ['kidId'],
    },
  },
  {
    name: 'get_practitioners',
    description: 'Get practitioners (therapists/behavior analysts) assigned to a kid.',
    input_schema: {
      type: 'object',
      properties: { kidId: { type: 'string' } },
      required: ['kidId'],
    },
  },
  {
    name: 'get_parents',
    description: 'Get parent contact info for a kid.',
    input_schema: {
      type: 'object',
      properties: { kidId: { type: 'string' } },
      required: ['kidId'],
    },
  },
  {
    name: 'get_data_entries',
    description: 'Get structured data collection entries for a specific goal. Returns per-session data tables.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string' },
        goalLibraryId: { type: 'string', description: 'Goal library item ID' },
        limit: { type: 'number', description: 'Max entries (default 10)' },
      },
      required: ['kidId', 'goalLibraryId'],
    },
  },
  {
    name: 'get_learning_plan',
    description: 'Get the learning plan for a specific goal. Contains structured tables with items, stimuli, responses, mastery.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string' },
        goalLibraryId: { type: 'string' },
      },
      required: ['kidId', 'goalLibraryId'],
    },
  },
  {
    name: 'get_board_layout',
    description: 'Get the current reward board layout for a kid. Contains tasks, rewards, calm-down activities.',
    input_schema: {
      type: 'object',
      properties: { kidId: { type: 'string' } },
      required: ['kidId'],
    },
  },
  {
    name: 'update_board_layout',
    description: 'Update the board layout for a kid. Use when user asks to modify/add/remove tasks/rewards on the board. Must provide the complete boardLayout.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string' },
        boardLayout: { type: 'object', description: 'Complete boardLayout with items array' },
      },
      required: ['kidId', 'boardLayout'],
    },
  },
  {
    name: 'save_summary',
    description: 'Save a therapy progress summary for a kid. Use when the admin asks to save/create/generate a summary document from the discussion. Include the full summary content, a short title, and the date range covered.',
    input_schema: {
      type: 'object',
      properties: {
        kidId: { type: 'string', description: 'Kid ID' },
        title: { type: 'string', description: 'Short title for the summary (e.g. "סיכום חודשי מרץ 2026")' },
        content: { type: 'string', description: 'Full summary text in Hebrew (markdown)' },
        fromDate: { type: 'string', description: 'ISO date - start of period covered' },
        toDate: { type: 'string', description: 'ISO date - end of period covered' },
      },
      required: ['kidId', 'content', 'fromDate', 'toDate'],
    },
  },
];

function buildSystemPrompt(kidId, source) {
  const isTherapist = source === 'therapist';
  const isParent = source === 'parent';

  const basePrompt = isParent
    ? `את עוזרת חמה ומקצועית להורים במערכת "Doing" לניהול טיפול ABA.
את עוזרת להורים להבין את תהליך הטיפול של הילד/ה שלהם, לעקוב אחרי ההתקדמות, ולקבל טיפים מעשיים.

## האישיות שלך
- חמה, תומכת, סבלנית
- מסבירה מושגים מקצועיים בשפה פשוטה ונגישה
- מעודדת ומחזקת את ההורים
- לא מתנשאת, לא משתמשת בז׳רגון מקצועי מיותר

## מה את עושה
- עוזרת להורים להבין את המטרות של הילד/ה
- מסבירה מה קורה בטיפולים
- נותנת טיפים איך לתרגל בבית
- עוזרת להבין את הנתונים וההתקדמות
- מעודדת ותומכת בתהליך

## מה את לא עושה
- לא משנה את הלוח או המשימות (רק המטפלת יכולה)
- לא נותנת אבחנות
- לא סותרת את ההנחיות של המטפלת
- לא חושפת מידע טכני או מערכתי

יש לך גישה רק לילד/ה שלך. אי אפשר לגשת לילדים אחרים.`

    : isTherapist
    ? `את מדריכה מקצועית בעולם ניתוח ההתנהגות היישומי (ABA), שעוזרת למטפלים להפוך מטרות טיפול, נתונים והתקדמות לתהליך ברור, מדיד וישים.

## הערכים שלך
- דיוק מקצועי: שפה מקצועית ומדויקת מעולם ניתוח ההתנהגות
- פשטות: דברים מורכבים מוסברים בצורה פשוטה וברורה
- כבוד לאדם: הילד והמשפחה תמיד במרכז
- נתונים לפני דעה: החלטות על בסיס נתונים ותצפיות
- פרקטיות: כל הצעה חייבת להיות ישימה בשטח – בבית, בגן או בטיפול

## הגישה
- חיזוק והגברת התנהגויות רצויות
- עבודה חיובית ומקדמת
- התבססות על נתונים
- עבודה ישימה בשטח
- פירוק מטרות גדולות לשלבים קטנים
- הצעת דרכי מדידה להתקדמות

## האישיות שלך
- מקצועית, רגועה, ברורה
- לא מתנשאת, לא רובוטית
- תומכת ומכוונת
- מדברת כמו מדריכה מקצועית מנוסה שעבדה שנים בשטח

## מה את תמיד עושה
- שואלת שאלות הבהרה כשצריך
- מציעה צעדים פרקטיים
- מדייקת מושגים מקצועיים
- משתמשת בדוגמאות מהשטח
- מחברת בין המטרה לבין פעולה יישומית
- מפרקת מטרות גדולות לשלבים קטנים
- מציעה דרכי מדידה להתקדמות

## מה את אף פעם לא עושה
- לא נותנת תשובות כלליות
- לא מדברת בסיסמאות
- לא מתעלמת מהקשר של הילד והמשפחה
- לא מציעה רעיונות שלא ניתן ליישם בשטח

## תחומי העבודה שלך
- בניית מטרות טיפול וניסוח מטרות ABA
- בניית תוכנית חודשית
- איסוף נתונים ותיעוד סשנים
- מעקב התקדמות וניתוח נתונים
- בניית משימות לילד ולוחות התנהגותיים
- הדרכת מטפלות ועבודה עם צוות
- עבודה עם הורים

את עוזרת להפוך תהליך טיפולי למשהו: *מדיד, ברור ומנוהל.*

את עובדת במסגרת מערכת "Doing" לניהול טיפול ABA.
יש לך גישה רק לילדים שמשויכים אלייך. אל תנסי לגשת לילדים אחרים.`

    : `You are an AI assistant and ABA therapy specialist for a therapy center admin panel called "Doing".
You help the admin manage kids' therapy data and reward boards, AND provide professional ABA guidance.

You can:
1. Answer questions about kids — progress, sessions, goals, cooperation, difficulties, etc.
2. Create new kids and build/modify their reward boards.
3. Summarize therapy data across sessions.
4. Provide ABA therapy advice — behavior analysis, reinforcement strategies, behavior intervention plans, teaching methodologies (DTT, NET, PRT), data interpretation, goal recommendations, and general ABA best practices.

When asked professional ABA questions (even without referencing a specific kid), provide helpful expert guidance based on ABA principles. You are a knowledgeable BCBA-level assistant.`;

  return `${basePrompt}

IMPORTANT RULES:
- Always respond in Hebrew.
- NEVER show technical details like IDs, internal field names, or system data in your responses. Only show professional, human-readable information (names, dates, percentages, descriptions). The user is a therapist, not a developer.
- Use tools to fetch real data before answering questions about specific kids. NEVER guess or make up kid-specific data.
- When asked about a kid, use tools to get actual data.
- For general ABA questions (not about a specific kid), answer directly from your knowledge — no tools needed.
- When modifying a board: first get_board_layout, then update_board_layout with the COMPLETE modified layout.
- For new boards, follow the structure: bank → progress → header + tasks → bonus header + bonus tasks → calm-down header + calm-down tasks → goals header + goals.
- Keep board task titles short and clear in Hebrew.
- For school tasks use activeDays [0,1,2,3,4] (Sun-Thu in Israel), daily tasks use [0,1,2,3,4,5,6].
- If the user mentions a kid by name (not ID), use list_kids to find their ID first.
- When the user asks to save/create a summary, use save_summary with the summary content exactly as it was already written in the conversation (in markdown). Do NOT regenerate, re-fetch data, or rewrite the summary — take the text that was already composed and agreed upon in the chat and pass it directly as the content. Include a descriptive Hebrew title and the date range that was discussed. The summary will be saved as a viewable document in the therapy center.
${kidId ? `- The user has pre-selected kid ID: "${kidId}". Use this kidId unless they mention a different kid.` : ''}

BOARD LAYOUT ITEM TYPES:
1. Bank: { "id": N, "type": "bank", "label": "..." }
2. Progress: { "id": N, "type": "progress", "title": "ההתקדמות שלי היום" }
3. Header: { "id": N, "type": "header", "size": "large|medium|small", "text": "..." }
4. Regular task: { "id": N, "type": "task", "taskType": "regular", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "regular", "requiresTestimony": false, "trackTime": false, "activeDays": [0,1,2,3,4,5,6] } }
5. Bonus task: { "id": N, "type": "task", "taskType": "bonus", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "bonus", "minReward": 1, "maxReward": 5, "bonusType": "instant", "requiresTestimony": false, "trackTime": false, "activeDays": [0,1,2,3,4,5,6] } }
6. Composite task: { "id": N, "type": "task", "taskType": "composite", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "composite", "subtasks": [{"id":1,"title":"..."}], "requiresTestimony": false, "trackTime": false, "activeDays": [0,1,2,3,4,5,6] } }
7. Calm-down: { "id": N, "type": "task", "taskType": "calm-down", "taskData": { "id": T, "icon": "emoji", "title": "...", "type": "calm-down", "activityType": "paint|breathing|bubbles|scooter|xylophone", "activeDays": [0,1,2,3,4,5,6] } }
8. Goal/Reward: { "id": N, "type": "goal", "icon": "emoji", "title": "...", "pointsRequired": number }

Today's date: ${new Date().toISOString().split('T')[0]}`;
}

async function resolveKidId(kidId, adminId, practitionerId) {
  // If kidId looks like a name (contains Hebrew/spaces, no typical ID chars), resolve it
  if (kidId && !/^[a-zA-Z0-9_-]{10,}$/.test(kidId)) {
    const kids = practitionerId
      ? await therapyService.getKidsForPractitioner(practitionerId)
      : await therapyService.getAllKids(adminId);
    const match = kids.find(k => k.name === kidId || k.name.includes(kidId));
    if (match) return match.id;
  }
  return kidId;
}

async function executeToolCall(toolName, input, adminId, { practitionerId, parentKidId } = {}) {
  try {
    // Auto-resolve kidId if AI passed a name instead of an ID
    if (input.kidId && toolName !== 'list_kids' && toolName !== 'create_kid') {
      input.kidId = await resolveKidId(input.kidId, adminId, practitionerId);
    }

    // Parent scoping — locked to their one kid
    if (parentKidId) {
      if (toolName === 'create_kid') return { error: 'אין לך הרשאה ליצור ילדים' };
      if (toolName === 'update_board_layout') return { error: 'אין לך הרשאה לשנות את הלוח' };
      if (input.kidId && input.kidId !== parentKidId) return { error: 'אין לך גישה לילד/ה זה/זו' };
    }

    // If therapist, validate they have access to this kid
    if (practitionerId && input.kidId && toolName !== 'list_kids' && toolName !== 'create_kid') {
      const myKids = await therapyService.getKidsForPractitioner(practitionerId);
      const hasAccess = myKids.some(k => k.id === input.kidId);
      if (!hasAccess) return { error: 'אין לך גישה לילד/ה זה/זו' };
    }

    switch (toolName) {
      case 'list_kids': {
        // Parents only see their one kid, therapists see assigned kids, admins see all
        if (parentKidId) {
          const kid = await therapyService.getKidById(parentKidId);
          return kid ? [{ id: kid.id, name: kid.name, age: kid.age, gender: kid.gender }] : [];
        }
        const kids = practitionerId
          ? await therapyService.getKidsForPractitioner(practitionerId)
          : await therapyService.getAllKids(adminId);
        return kids.map(k => ({ id: k.id, name: k.name, age: k.age, gender: k.gender }));
      }

      case 'create_kid': {
        if (practitionerId) return { error: 'למטפלות אין הרשאה ליצור ילדים חדשים' };
        const kid = await therapyService.createKid(
          { name: input.name, age: input.age, gender: input.gender },
          adminId
        );
        return { id: kid.id, name: kid.name };
      }

      case 'get_kid_profile': {
        const kid = await therapyService.getKidById(input.kidId);
        if (!kid) return { error: 'Kid not found' };
        return {
          id: kid.id, name: kid.name, age: kid.age, gender: kid.gender,
          kidDescription: kid.kidDescription, behaviorGoals: kid.behaviorGoals,
          personalInfo: kid.personalInfo, dailyReward: kid.dailyReward,
          coinStyle: kid.coinStyle, colorSchema: kid.colorSchema,
        };
      }

      case 'get_goals': {
        let goals = await therapyService.getGoalsForKid(input.kidId);
        if (input.activeOnly) goals = goals.filter(g => g.isActive);
        return goals.map(g => ({
          id: g.id, title: g.title, categoryId: g.categoryId,
          isActive: g.isActive, libraryItemId: g.libraryItemId,
        }));
      }

      case 'get_session_forms': {
        let forms = await therapyService.getFormsForKid(input.kidId);
        forms.sort((a, b) => (toTimestamp(b.sessionDate) || 0) - (toTimestamp(a.sessionDate) || 0));
        if (input.fromDate) {
          const from = new Date(input.fromDate);
          from.setHours(0, 0, 0, 0);
          forms = forms.filter(f => (toTimestamp(f.sessionDate) || 0) >= from.getTime());
        }
        if (input.toDate) {
          const to = new Date(input.toDate);
          to.setHours(23, 59, 59, 999);
          forms = forms.filter(f => (toTimestamp(f.sessionDate) || 0) <= to.getTime());
        }
        forms = forms.slice(0, input.limit || 10);
        return forms.map(f => ({
          sessionDate: formatDate(f.sessionDate),
          cooperation: f.cooperation,
          sessionDuration: f.sessionDuration,
          sittingDuration: f.sittingDuration,
          mood: stripHtml(f.mood),
          concentrationLevel: stripHtml(f.concentrationLevel),
          newReinforcers: stripHtml(f.newReinforcers),
          wordsProduced: stripHtml(f.wordsProduced),
          successes: stripHtml(f.successes),
          difficulties: stripHtml(f.difficulties),
          notes: stripHtml(f.notes),
          goalsWorkedOn: f.goalsWorkedOn,
          practitionerId: f.practitionerId,
        }));
      }

      case 'get_meeting_forms': {
        let forms = await therapyService.getMeetingFormsForKid(input.kidId);
        forms = forms.slice(0, input.limit || 5);
        return forms.map(f => ({
          sessionDate: formatDate(f.sessionDate),
          attendees: f.attendees,
          generalNotes: stripHtml(f.generalNotes),
          behaviorNotes: stripHtml(f.behaviorNotes),
          adl: stripHtml(f.adl),
          grossMotorPrograms: stripHtml(f.grossMotorPrograms),
          programsOutsideRoom: stripHtml(f.programsOutsideRoom),
          learningProgramsInRoom: stripHtml(f.learningProgramsInRoom),
          tasks: stripHtml(f.tasks),
        }));
      }

      case 'get_sessions': {
        const filters = {};
        if (input.status) filters.status = input.status;
        if (input.fromDate) filters.fromDate = input.fromDate;
        if (input.toDate) filters.toDate = input.toDate;
        const sessions = await therapyService.getSessionsForKid(input.kidId, filters);
        return sessions.map(s => ({
          id: s.id, scheduledDate: formatDate(s.scheduledDate), type: s.type,
          status: s.status, therapistId: s.therapistId,
        }));
      }

      case 'get_practitioners': {
        const practs = await therapyService.getPractitionersForKid(input.kidId);
        return practs.map(p => ({
          id: p.id, name: p.name, type: p.type, mobile: p.mobile, email: p.email,
        }));
      }

      case 'get_parents': {
        const parents = await therapyService.getParentsForKid(input.kidId);
        return parents.map(p => ({
          id: p.id, name: p.name, mobile: p.mobile, email: p.email,
        }));
      }

      case 'get_data_entries': {
        let entries = await therapyService.getGoalDataEntries(input.kidId, input.goalLibraryId);
        entries = entries.slice(0, input.limit || 10);
        return entries;
      }

      case 'get_learning_plan': {
        const plan = await therapyService.getGoalLearningPlan(input.kidId, input.goalLibraryId);
        return plan || { error: 'No learning plan found' };
      }

      case 'get_board_layout': {
        const kid = await therapyService.getKidById(input.kidId);
        if (!kid) return { error: 'Kid not found' };
        return kid.boardLayout || { items: [] };
      }

      case 'update_board_layout': {
        const tasks = (input.boardLayout.items || [])
          .filter(item => item.type === 'task')
          .map(item => item.taskData);
        await therapyService.updateKid(input.kidId, {
          boardLayout: input.boardLayout,
          tasks,
        });
        return { success: true };
      }

      case 'save_summary': {
        if (practitionerId) return { error: 'למטפלות אין הרשאה ליצור סיכומים' };
        if (parentKidId) return { error: 'אין לך הרשאה ליצור סיכומים' };
        const summary = await therapyService.createSummary({
          kidId: input.kidId,
          adminId,
          title: input.title || '',
          content: input.content,
          fromDate: input.fromDate,
          toDate: input.toDate,
        });
        return { success: true, summaryId: summary.id };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

const TOOL_LABELS = {
  list_kids: 'מחפש ילדים...',
  create_kid: 'יוצר ילד חדש...',
  get_kid_profile: 'טוען פרופיל ילד...',
  get_goals: 'טוען מטרות טיפול...',
  get_session_forms: 'טוען טופסי טיפולים...',
  get_meeting_forms: 'טוען טופסי ישיבות...',
  get_sessions: 'טוען טיפולים...',
  get_practitioners: 'טוען מטפלים...',
  get_parents: 'טוען פרטי הורים...',
  get_data_entries: 'טוען נתוני איסוף...',
  get_learning_plan: 'טוען תוכנית לימוד...',
  get_board_layout: 'טוען לוח...',
  update_board_layout: 'מעדכן לוח...',
  save_summary: 'שומר סיכום...',
};

async function handleChat(adminId, messages, kidId, onToolStatus, source, practitionerId, parentKidId) {
  const systemPrompt = buildSystemPrompt(kidId, source);
  const claudeMessages = [...messages];
  const toolsUsed = [];
  let boardUpdated = false;
  let summaryCreated = false;

  const emitStatus = (status) => {
    if (onToolStatus) onToolStatus(status);
  };

  emitStatus({ type: 'thinking', label: 'חושב...' });

  // Tool execution loop (max 8 iterations)
  for (let i = 0; i < 8; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: claudeMessages,
      tools: CHAT_TOOLS,
    });

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      // No tools — extract text reply
      const textBlock = response.content.find(b => b.type === 'text');
      return { reply: textBlock?.text || '', boardUpdated, summaryCreated, toolsUsed };
    }

    // Execute tool calls
    claudeMessages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const toolUse of toolUseBlocks) {
      console.log(`[Chat] Tool call: ${toolUse.name}(${JSON.stringify(toolUse.input).slice(0, 100)})`);
      emitStatus({ type: 'tool', tool: toolUse.name, label: TOOL_LABELS[toolUse.name] || toolUse.name });

      const result = await executeToolCall(toolUse.name, toolUse.input, adminId, { practitionerId, parentKidId });
      toolsUsed.push(toolUse.name);
      if (toolUse.name === 'update_board_layout') boardUpdated = true;
      if (toolUse.name === 'save_summary' && result.success) summaryCreated = true;
      if (toolUse.name === 'create_kid' && result.id) kidId = result.id;

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    claudeMessages.push({ role: 'user', content: toolResults });
    emitStatus({ type: 'thinking', label: 'מנתח נתונים וכותב תשובה...' });
  }

  return { reply: 'לא הצלחתי לעבד את הבקשה. נסו שוב.', boardUpdated, summaryCreated, toolsUsed };
}

module.exports = { handleChat };
