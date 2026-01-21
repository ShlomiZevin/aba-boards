const fs = require('fs');
const path = require('path');

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Get available voices from ElevenLabs
 */
async function getVoices() {
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Generate speech from text using ElevenLabs
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID (optional, uses default if not provided)
 * @returns {Promise<{audioPath: string, audioBuffer: Buffer}>}
 */
async function generateSpeech(text, voiceId = null) {
  // Use a default multilingual voice if none specified
  const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Sarah - multilingual

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${selectedVoiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_v3',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // Return buffer directly - no file storage
  return {
    audioBuffer,
    audioBase64: audioBuffer.toString('base64')
  };
}

/**
 * Generate speech with word-level timestamps for lip-sync
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @returns {Promise<{audioPath: string, timestamps: Array}>}
 */
async function generateSpeechWithTimestamps(text, voiceId = null) {
  const selectedVoiceId = voiceId || 'cgSgspJ2msm6clMCkdW9';

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${selectedVoiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  const data = await response.json();

  // Save audio
  const audioDir = path.join(__dirname, '../public/audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  const audioFilename = `speech_${Date.now()}.mp3`;
  const audioPath = path.join(audioDir, audioFilename);
  fs.writeFileSync(audioPath, audioBuffer);

  return {
    audioPath,
    audioFilename,
    alignment: data.alignment // Contains character-level timing
  };
}

module.exports = {
  getVoices,
  generateSpeech,
  generateSpeechWithTimestamps
};
