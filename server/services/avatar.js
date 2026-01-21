const elevenlabs = require('./elevenlabs');
const lipsync = require('./lipsync');

/**
 * Generate avatar speech with lip-sync data
 * @param {string} text - Text to speak
 * @param {object} options - Options
 * @param {string} options.voiceId - ElevenLabs voice ID
 * @param {number} options.mouthShapeCount - Number of available mouth images (3-6)
 * @param {string} options.lipSyncMethod - 'amplitude' or 'timestamps'
 * @returns {Promise<{audioBase64: string, lipSyncData: Array}>}
 */
async function generateAvatarSpeech(text, options = {}) {
  const {
    voiceId = null,
    mouthShapeCount = 4,
    lipSyncMethod = 'amplitude'
  } = options;

  let audioBase64, audioBuffer, lipSyncData;

  if (lipSyncMethod === 'timestamps') {
    // Use ElevenLabs with-timestamps API for character-level timing
    const result = await elevenlabs.generateSpeechWithTimestamps(text, voiceId);
    audioBase64 = result.audioBase64;
    audioBuffer = result.audioBuffer;
    lipSyncData = lipsync.generateTimestampLipSync(result.alignment, mouthShapeCount);
  } else {
    // Use amplitude-based analysis
    const result = await elevenlabs.generateSpeech(text, voiceId);
    audioBase64 = result.audioBase64;
    audioBuffer = result.audioBuffer;
    lipSyncData = lipsync.generateAmplitudeLipSync(audioBuffer, mouthShapeCount);
  }

  return {
    audioBase64,
    lipSyncData,
    method: lipSyncMethod
  };
}

/**
 * Get greeting for a child
 * @param {string} name - Child's name
 * @returns {string} - Hebrew greeting
 */
function getGreeting(name) {
  const greetings = [
    `שלום ${name}! מה נשמע?`,
    `היי ${name}! איזה כיף לראות אותך!`,
    `שלום ${name}! בוא נשחק ביחד!`
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

module.exports = {
  generateAvatarSpeech,
  getGreeting
};
