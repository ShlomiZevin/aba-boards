const elevenlabs = require('./elevenlabs');
const lipsync = require('./lipsync');

/**
 * Generate avatar speech with lip-sync data
 * @param {string} text - Text to speak
 * @param {object} options - Options
 * @param {string} options.voiceId - ElevenLabs voice ID
 * @param {number} options.mouthShapeCount - Number of available mouth images (3-6)
 * @returns {Promise<{audioBase64: string, lipSyncData: Array}>}
 */
async function generateAvatarSpeech(text, options = {}) {
  const {
    voiceId = null,
    mouthShapeCount = 4
  } = options;

  // Generate speech audio (returns base64, no file storage)
  const { audioBase64 } = await elevenlabs.generateSpeech(text, voiceId);

  // Use simple pattern-based lip-sync
  // Estimate duration based on text length
  const estimatedDurationMs = text.length * 80;
  const lipSyncData = lipsync.generateSimpleLipSync(estimatedDurationMs);

  // Map shapes to available mouth images
  const mappedLipSync = lipsync.mapShapesToAvailable(lipSyncData, mouthShapeCount);

  return {
    audioBase64,
    lipSyncData: mappedLipSync
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
