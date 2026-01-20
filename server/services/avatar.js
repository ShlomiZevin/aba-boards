const path = require('path');
const fs = require('fs');
const elevenlabs = require('./elevenlabs');
const lipsync = require('./lipsync');

/**
 * Generate avatar speech with lip-sync data
 * @param {string} text - Text to speak
 * @param {object} options - Options
 * @param {string} options.voiceId - ElevenLabs voice ID
 * @param {number} options.mouthShapeCount - Number of available mouth images (3-6)
 * @param {boolean} options.useRhubarb - Whether to use Rhubarb for lip-sync (requires installation)
 * @returns {Promise<{audioUrl: string, lipSyncData: Array}>}
 */
async function generateAvatarSpeech(text, options = {}) {
  const {
    voiceId = null,
    mouthShapeCount = 4,
    useRhubarb = false
  } = options;

  // Generate speech audio
  const { audioPath, audioFilename } = await elevenlabs.generateSpeech(text, voiceId);

  let lipSyncData;

  if (useRhubarb) {
    try {
      // Try to use Rhubarb for accurate lip-sync
      lipSyncData = await lipsync.generateLipSync(audioPath);
    } catch (err) {
      console.warn('Rhubarb not available, using simple lip-sync:', err.message);
      // Estimate duration (rough estimate for Hebrew text)
      const estimatedDurationMs = text.length * 80; // ~80ms per character
      lipSyncData = lipsync.generateSimpleLipSync(estimatedDurationMs);
    }
  } else {
    // Use simple pattern-based lip-sync
    // Estimate duration based on text length
    const estimatedDurationMs = text.length * 80;
    lipSyncData = lipsync.generateSimpleLipSync(estimatedDurationMs);
  }

  // Map shapes to available mouth images
  const mappedLipSync = lipsync.mapShapesToAvailable(lipSyncData, mouthShapeCount);

  return {
    audioUrl: `/audio/${audioFilename}`,
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
