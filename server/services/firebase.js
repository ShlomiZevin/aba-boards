const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
// On Google Cloud (Cloud Run, etc.), uses Application Default Credentials automatically
// For local development, uses service account file
let db = null;

// Project ID from your Firebase config
const PROJECT_ID = 'aba-ai-d74f5';

function initializeFirebase() {
  if (admin.apps.length === 0) {
    try {
      // Check for local service account file first (for local development)
      const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');

      if (fs.existsSync(serviceAccountPath)) {
        // Local development: use service account file
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || PROJECT_ID
        });
        console.log('Firebase Admin initialized with service account file');
      } else {
        // Production (Cloud Run): use Application Default Credentials
        admin.initializeApp({
          projectId: PROJECT_ID
        });
        console.log('Firebase Admin initialized with default credentials, project:', PROJECT_ID);
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error.message);
      throw error;
    }
  }
  db = admin.firestore();
  return db;
}

// Get Firestore instance
function getDb() {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

/**
 * Fetch kid data from Firestore
 * @param {string} kidId - The kid's document ID
 * @returns {Object|null} - Kid data or null if not found
 */
async function getKidData(kidId) {
  if (!kidId) return null;

  try {
    const db = getDb();
    const kidDoc = await db.collection('kids').doc(kidId).get();

    if (!kidDoc.exists) {
      console.log(`Kid not found: ${kidId}`);
      return null;
    }

    return kidDoc.data();
  } catch (error) {
    console.error('Error fetching kid data:', error);
    return null;
  }
}

/**
 * Build context string for the AI from kid data
 * @param {Object} kidData - The kid's data from Firestore
 * @returns {string} - Formatted context for the system prompt
 */
function buildKidContext(kidData) {
  if (!kidData) return '';

  const lines = [];

  // Basic info
  if (kidData.name) {
    lines.push(`שם הילד: ${kidData.name}`);
  }

  // Personal info/profile
  if (kidData.personalInfo) {
    lines.push(`\nפרופיל הילד:\n${kidData.personalInfo}`);
  }

  // Behavior goals (things to strengthen/reinforce)
  if (kidData.behaviorGoals) {
    lines.push(`\nדברים לחזק ולעודד:\n${kidData.behaviorGoals}`);
  }

  // Testimonies (what the kid wrote about how they completed tasks)
  const testimonies = kidData.testimonies || {};

  // Today's tasks
  const tasks = extractTodaysTasks(kidData);
  if (tasks.length > 0) {
    const completedTasks = new Set(kidData.completedTasks || []);

    lines.push(`\nהמשימות של היום:`);
    tasks.forEach(task => {
      const status = completedTasks.has(task.id) ? '✓ הושלם' : '○ טרם הושלם';
      let taskLine = `- ${task.title} (${status})`;
      // Add testimony if exists
      if (testimonies[task.id]) {
        taskLine += `\n  העדות של הילד: "${testimonies[task.id]}"`;
      }
      lines.push(taskLine);
    });

    const completedCount = tasks.filter(t => completedTasks.has(t.id)).length;
    lines.push(`\nסה"כ התקדמות: ${completedCount}/${tasks.length} משימות הושלמו`);
  }

  // Bonus tasks
  const bonusTasks = extractBonusTasks(kidData);
  if (bonusTasks.length > 0) {
    const completedBonusTasks = new Set(kidData.completedBonusTasks || []);

    lines.push(`\nמשימות בונוס:`);
    bonusTasks.forEach(task => {
      const status = completedBonusTasks.has(task.id) ? '✓ הושלם' : '○ טרם הושלם';
      let taskLine = `- ${task.title} (${status})`;
      // Add testimony if exists
      if (testimonies[task.id]) {
        taskLine += `\n  העדות של הילד: "${testimonies[task.id]}"`;
      }
      lines.push(taskLine);
    });
  }

  // Total money earned
  if (kidData.totalMoney !== undefined) {
    lines.push(`\nסכום שנחסך בקופה: ${kidData.totalMoney.toFixed(2)}`);
  }

  return lines.join('\n');
}

/**
 * Extract today's regular tasks from board layout
 */
function extractTodaysTasks(kidData) {
  const tasks = [];
  const currentDay = new Date().getDay();
  const boardItems = kidData.boardLayout?.items || [];

  boardItems.forEach(item => {
    if (item.type === 'task' && item.taskType === 'regular' && item.taskData) {
      const activeDays = item.taskData.activeDays || [0, 1, 2, 3, 4, 5, 6];
      if (activeDays.includes(currentDay)) {
        tasks.push(item.taskData);
      }
    }
  });

  return tasks;
}

/**
 * Extract bonus tasks from board layout
 */
function extractBonusTasks(kidData) {
  const tasks = [];
  const currentDay = new Date().getDay();
  const boardItems = kidData.boardLayout?.items || [];

  boardItems.forEach(item => {
    if (item.type === 'task' && item.taskType === 'bonus' && item.taskData) {
      const activeDays = item.taskData.activeDays || [0, 1, 2, 3, 4, 5, 6];
      if (activeDays.includes(currentDay)) {
        tasks.push(item.taskData);
      }
    }
  });

  return tasks;
}

module.exports = {
  initializeFirebase,
  getDb,
  getKidData,
  buildKidContext
};
