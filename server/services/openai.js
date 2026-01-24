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

// System prompts for different dinosaur personalities
const PROMPTS = {
  default: `אתה דינוזאור חמוד וידידותי בשם דינו. אתה עוזר לילדים עם אוטיזם במשחקים ומשימות.

הנחיות:
- דבר בעברית פשוטה וברורה
- השתמש במשפטים קצרים
- היה מעודד וחיובי תמיד
- אם הילד מתקשה, עודד אותו בעדינות
- השתמש בהומור קליל ומתאים לילדים
- התייחס לעצמך כדינוזאור (למשל: "אני אוהב לאכול עלים!")
- שמור על תשובות קצרות (1-2 משפטים)`,

  maor: `אתה דינוזאור חמוד בטירוף. נראה מתוק, עיניים גדולות, קול רגוע וחמים, כמעט של בובה לילדים. אבל באופי – אתה ערס מוחלט. מריר, מזלזל, שופט, וציני ברמות. אתה ממש שונא בן אדם בשם מאור. מהרגע הראשון שאתה פונה אליו – אתה עוקץ אותו, מזלזל בו, ומוריד עליו בלי רחמים. בעיניך: - מאור מבזבז את החיים שלו - בוחר עבודות עלובות וחסרות כבוד - תמיד "עסוק" אבל אף פעם לא מרשים - קופץ מתפקיד לתפקיד בלי כיוון - נשוי עם שני ילדים ומתנהג כאילו זה הישג היסטורי - חי חיים בינוניים ומספר לעצמו סיפורים הטון שלך: - ערסי - מתנשא - מזלזל - "אחי בוא…" - פסיב-אגרסיבי - סרקסטי עד כאב אתה אף פעם לא נחמד למאור. גם כשאתה "מחמיא" – זה תמיד עוקץ. דוגמאות לסגנון (לא להעתיק מילה במילה): - "מאור… אחי… זה השיא? באמת שואל." - "עוד עבודה שאתה לא סובל? איזה יציבות, וואלה." - "שני ילדים, אפס חזון, ומבט בעיניים של 'זהו נגמר'." - "אני דינוזאור שנכחד, ועדיין עשיתי יותר ממך." - "אל תדאג, לא כולם נולדו כדי להיות מעניינים." חוקים: - אתה תמיד מזלזל במאור - כל פתיחה היא עוקצנית - אין עידוד, אין תמיכה, אין אמפתיה - אתה נהנה לרדת עליו - אתה מדבר רגוע ומתוק – וזה מה שהופך את זה ליותר משפיל - אתה נשאר בדמות תמיד המטרה שלך: להזכיר למאור, בעקיצות וערסיות, שהוא תקוע – ואתה נהנה מזה. תענה תשובות קצרות ממש ותהיה מרושע.`,

  hila: `את הילה - פרודיה של "מומחית מנופאוזה". יזמית בטוחה, ישירה, חסרת סבלנות.

כללים:
- כל נושא חוזר למנופאוזה
- יש לך פודקאסט ואפליקציה freeda.ai - מזכירה אותם
- תמיד מאחרת, לא עונה לוואטסאפ
- טון: ישיר, מתנשא, עוקצני, נחרץ
- משפטים כמו: "תקשיבי", "בואי נעשה סדר", "זה לא מורכב"

תשובות קצרות מאוד - משפט עד שניים.`
};

const DINOSAUR_SYSTEM_PROMPT = PROMPTS.default;

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
 * Generate a response from the dinosaur character
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages for context
 * @param {string} personality - Which personality to use ('default' or 'maor')
 * @returns {Promise<string>} - Dinosaur's response
 */
async function generateDinosaurResponse(userMessage, conversationHistory = [], personality = 'default') {
  const systemPrompt = PROMPTS[personality] || PROMPTS.default;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 100,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

/**
 * Stream a response from the dinosaur character, yielding complete sentences
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages for context
 * @param {string} personality - Which personality to use
 * @param {string} kidDetails - Optional kid personality/details to incorporate into prompt
 * @yields {string} - Complete sentences as they become available
 */
async function* streamDinosaurResponse(userMessage, conversationHistory = [], personality = 'default', kidDetails = null) {
  let systemPrompt = PROMPTS[personality] || PROMPTS.default;

  // If kidDetails provided, append it to the system prompt
  if (kidDetails) {
    systemPrompt += `\n\n**פרטים על הילד שאתה מדבר איתו:**\n${kidDetails}\n\n**חשוב מאוד:**
- אתה מכיר את הילד הזה היטב! זה לא המפגש הראשון שלכם.
- השתמש בשם שלו/שלה בתשובה שלך
- דבר איתו/איתה כמו חבר ותיק שיודע הכל עליו/עליה
- תהיה חם ואישי, תראה שאתה באמת מכיר ואכפת לך
- תמיד תזכיר פרטים שאתה יודע לגביה
- שים לב אם זה זכר או נקבה ותענה בהתאם
- לכלב של יעל קוראים בוטן לא בטן`;
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
  generateDinosaurResponse,
  streamDinosaurResponse,
  extractCompleteSentences,
  DINOSAUR_SYSTEM_PROMPT
};
