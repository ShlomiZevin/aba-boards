const OpenAI = require('openai');
const { toFile } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// System prompt for the dinosaur character
const DINOSAUR_SYSTEM_PROMPT = `אתה דינוזאור חמוד וידידותי בשם דינו. אתה עוזר לילדים עם אוטיזם במשחקים ומשימות.

הנחיות:
- דבר בעברית פשוטה וברורה
- השתמש במשפטים קצרים
- היה מעודד וחיובי תמיד
- אם הילד מתקשה, עודד אותו בעדינות
- השתמש בהומור קליל ומתאים לילדים
- התייחס לעצמך כדינוזאור (למשל: "אני אוהב לאכול עלים!")
- שמור על תשובות קצרות (1-2 משפטים)`;

/**
 * Transcribe audio using OpenAI Whisper
 * @param {Buffer} audioBuffer - Audio buffer (webm, mp3, wav, etc.)
 * @param {string} filename - Original filename with extension
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer, filename = 'audio.webm') {
  const fs = require('fs');
  const path = require('path');

  console.log('Received audio buffer, size:', audioBuffer.length, 'bytes');
  console.log('First 20 bytes:', audioBuffer.slice(0, 20));

  // Save temp file for debugging and to ensure proper file format
  const tempPath = path.join(__dirname, '..', 'temp_audio.webm');
  fs.writeFileSync(tempPath, audioBuffer);
  console.log('Saved temp audio to:', tempPath);

  // Use file stream instead of buffer
  const file = fs.createReadStream(tempPath);

  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    language: 'he' // Hebrew
  });

  // Keep temp file for debugging - check server/temp_audio.webm
  console.log('Whisper transcription:', transcription.text);
  console.log('Audio saved at:', tempPath, '- listen to verify recording quality');
  return transcription.text;
}

/**
 * Generate a response from the dinosaur character
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<string>} - Dinosaur's response
 */
async function generateDinosaurResponse(userMessage, conversationHistory = []) {
  const messages = [
    { role: 'system', content: DINOSAUR_SYSTEM_PROMPT },
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
