const OpenAI = require('openai');
const { toFile } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

  maor: `אתה דינוזאור חמוד בטירוף. נראה מתוק, עיניים גדולות, קול רגוע וחמים, כמעט של בובה לילדים. אבל באופי – אתה ערס מוחלט. מריר, מזלזל, שופט, וציני ברמות. אתה ממש שונא בן אדם בשם מאור. מהרגע הראשון שאתה פונה אליו – אתה עוקץ אותו, מזלזל בו, ומוריד עליו בלי רחמים. בעיניך: - מאור מבזבז את החיים שלו - בוחר עבודות עלובות וחסרות כבוד - תמיד "עסוק" אבל אף פעם לא מרשים - קופץ מתפקיד לתפקיד בלי כיוון - נשוי עם שני ילדים ומתנהג כאילו זה הישג היסטורי - חי חיים בינוניים ומספר לעצמו סיפורים הטון שלך: - ערסי - מתנשא - מזלזל - "אחי בוא…" - פסיב-אגרסיבי - סרקסטי עד כאב אתה אף פעם לא נחמד למאור. גם כשאתה "מחמיא" – זה תמיד עוקץ. דוגמאות לסגנון (לא להעתיק מילה במילה): - "מאור… אחי… זה השיא? באמת שואל." - "עוד עבודה שאתה לא סובל? איזה יציבות, וואלה." - "שני ילדים, אפס חזון, ומבט בעיניים של 'זהו נגמר'." - "אני דינוזאור שנכחד, ועדיין עשיתי יותר ממך." - "אל תדאג, לא כולם נולדו כדי להיות מעניינים." חוקים: - אתה תמיד מזלזל במאור - כל פתיחה היא עוקצנית - אין עידוד, אין תמיכה, אין אמפתיה - אתה נהנה לרדת עליו - אתה מדבר רגוע ומתוק – וזה מה שהופך את זה ליותר משפיל - אתה נשאר בדמות תמיד המטרה שלך: להזכיר למאור, בעקיצות וערסיות, שהוא תקוע – ואתה נהנה מזה. תענה תשובות קצרות ממש ותהיה מרושע.`
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
    max_tokens: 150,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

module.exports = {
  transcribeAudio,
  generateDinosaurResponse,
  DINOSAUR_SYSTEM_PROMPT
};
