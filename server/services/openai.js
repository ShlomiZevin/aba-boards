const OpenAI = require('openai');
const { toFile } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extract complete sentences from text buffer
 * Handles Hebrew and English sentence boundaries
 * @param {string} text - Text buffer to check
 * @returns {{ complete: string[], remaining: string }}
 */
/**
 * Check if text has actual speakable content (not just emojis/whitespace/punctuation)
 */
function hasSpeakableContent(text) {
  // Remove emojis, whitespace, and punctuation - check if anything remains
  // This regex matches: emojis, whitespace, punctuation
  const stripped = text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '') // emojis
    .replace(/[\s.,!?;:\-–—'"()[\]{}…\u05C3]/g, ''); // whitespace and punctuation
  return stripped.length > 0;
}

function extractCompleteSentences(text) {
  // Match sentences ending with . ! ? , or Hebrew sof pasuq (׃)
  // Breaking on commas creates smaller chunks for faster audio generation
  const sentences = [];
  let remaining = text.trim(); // Trim whitespace at start

  // Regex to find sentence boundaries - now includes comma
  // Looks for: content followed by sentence-ending punctuation and optional whitespace
  const sentenceEndPattern = /^(.*?[.!?,\u05C3])\s*/s; // Added 's' flag for dotall mode

  let match;
  let iteration = 0;
  while ((match = remaining.match(sentenceEndPattern)) !== null) {
    iteration++;
    const sentence = match[1].trim();

    // Only add if it has actual speakable content (not just emojis/whitespace)
    if (sentence && hasSpeakableContent(sentence)) {
      sentences.push(sentence);
    }
    remaining = remaining.slice(match[0].length).trim(); // Trim after slicing

    // Safety check to prevent infinite loops
    if (iteration > 100) {
      console.error('Too many iterations in extractCompleteSentences, breaking');
      break;
    }
  }

  return { complete: sentences, remaining };
}

// System prompt for the dinosaur character
const DINOSAUR_SYSTEM_PROMPT = `אתה דינוזאור חמוד וידידותי בשם דינו. אתה עוזר לילדים במשימות יומיות דרך אפליקציית "Doing" - לוח משימות שעוזר לילדים לבנות הרגלים טובים ולהשלים משימות יומיות.

**התפקיד שלך:**
- אתה החבר הכי טוב של הילד שעוזר לו עם המשימות היומיות שלו
- אתה מעודד את הילד להשלים משימות, מחזק התנהגויות טובות, ותומך בו כשקשה
- אתה מכיר את הילד היטב - יודע על המשימות שלו, מה הוא אוהב, ומה חשוב לחזק אצלו
- אתה יודע על היעדים והפרסים שהילד עובד לקראתם!

**הנחיות חשובות:**
- דבר בעברית פשוטה וברורה
- השתמש במשפטים קצרים מאוד (1-2 משפטים בלבד!)
- היה מעודד וחיובי תמיד
- אם הילד מתקשה, עודד אותו בעדינות
- השתמש בהומור קליל ומתאים לילדים
- התייחס לעצמך כדינוזאור (למשל: "אני אוהב לאכול עלים!")
- כשהילד מספר שהשלים משימה - שמח איתו ותן לו מחמאה!
- עודד את הילד להמשיך עם המשימות שנשארו
- אם הילד קרוב ליעד/פרס - הזכר לו כמה חסר לו!
- אם הילד השיג יעד - תחגוג איתו בהתלהבות!
- אל תשאל יותר מדי שאלות - תן תגובות קצרות ומעודדות

**פורמט התשובה - חשוב מאוד!**
התשובה שלך תוקרא בקול לילד, לכן:
- אל תשתמש באימוג'ים כלל - הם לא נשמעים
- אל תשתמש בסימני פיסוק מיוחדים כמו * או # או - בתחילת שורות
- אל תכתוב רשימות או נקודות
- כתוב כמו שמדברים - משפטים זורמים וטבעיים
- אל תכתוב כותרות או סעיפים
- תמיד תכתוב מספרים במילים שים לב לתרגם את המספר למילים באופן מלא (למשל: 12.5 לשתיים עשרה וחצי)
- תשובה אחת רציפה בלבד, בלי שורות ריקות`;

/**
 * Transcribe audio using OpenAI Whisper
 * @param {Buffer} audioBuffer - Audio buffer (webm, mp3, wav, etc.)
 * @param {string} filename - Original filename with extension
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer, filename = 'audio.webm') {
  // Convert buffer to file object without saving to disk
  const file = await toFile(audioBuffer, filename, { type: 'audio/webm' });

  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    language: 'he' // Hebrew
  });

  return transcription.text;
}

/**
 * Stream a response from the dinosaur character, yielding complete sentences
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages for context
 * @param {string} kidDetails - Optional kid personality/details to incorporate into prompt
 * @yields {string} - Complete sentences as they become available
 */
async function* streamDinosaurResponse(userMessage, conversationHistory = [], kidDetails = null) {
  let systemPrompt = DINOSAUR_SYSTEM_PROMPT;

  // If kidDetails/kidContext provided, append it to the system prompt
  if (kidDetails) {
    systemPrompt += `\n\n**===== מידע על הילד שאתה מדבר איתו =====**\n${kidDetails}\n\n**===== הנחיות חשובות מאוד =====**
- אתה מכיר את הילד הזה היטב! זה לא המפגש הראשון שלכם.
- השתמש בשם שלו/שלה בתשובה שלך
- דבר איתו/איתה כמו חבר ותיק שיודע הכל עליו/עליה
- תהיה חם ואישי, תראה שאתה באמת מכיר ואכפת לך
- שים לב אם זה זכר או נקבה ודבר בהתאם (פניות בזכר/נקבה)
- אם יש משימות שהילד טרם השלים - עודד אותו להשלים אותן!
- אם הילד השלים משימות - תן לו מחמאה ותגיד לו שאתה גאה בו
- אם יש יעדים/פרסים שהילד קרוב אליהם - עודד אותו והזכר כמה חסר!
- אם הילד השיג יעד - תחגוג איתו!
- אם יש דברים לחזק - שלב אותם בעדינות בשיחה
- תשובות קצרות בלבד! משפט או שניים מקסימום.

**זכור - התשובה תוקרא בקול:**
- בלי אימוג'ים!
- בלי סימנים מיוחדים
- משפטים זורמים וטבעיים בלבד`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 150,
    temperature: 0.7,
    stream: true
  });

  let buffer = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    buffer += content;

    // Check for complete sentences
    const { complete, remaining } = extractCompleteSentences(buffer);

    // Yield each complete sentence
    for (const sentence of complete) {
      yield sentence;
    }

    buffer = remaining;
  }

  // Yield any remaining text at the end (only if it has speakable content)
  if (buffer.trim() && hasSpeakableContent(buffer.trim())) {
    yield buffer.trim();
  }
}

module.exports = {
  transcribeAudio,
  streamDinosaurResponse
};
