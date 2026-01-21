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
 * @param {number} speed - Speech speed (0.25 to 4.0, default 1.0)
 * @returns {Promise<{audioPath: string, audioBuffer: Buffer}>}
 */
async function generateSpeech(text, voiceId = null, speed = 1.0) {
  // Use a default multilingual voice if none specified
  const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Sarah - multilingual

  // Build URL with speed as query parameter for eleven_v3
  const url = new URL(`${ELEVENLABS_API_URL}/text-to-speech/${selectedVoiceId}`);
  if (speed !== 1.0) {
    url.searchParams.append('speed', speed.toString());
  }

  const response = await fetch(
    url.toString(),
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
 * @param {number} speed - Speech speed (0.25 to 4.0, default 1.0)
 * @returns {Promise<{audioPath: string, timestamps: Array}>}
 */
async function generateSpeechWithTimestamps(text, voiceId = null, speed = 1.0) {
  const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL';
  console.log('imhere');
  const requestBody = {
    text,
    model_id: 'eleven_v3',
    voice_settings: {
      speed: speed,
      stability: 0.5,
      similarity_boost: 0.75
    }
  };

  // Build URL with speed as query parameter for eleven_v3
  const url = new URL(`${ELEVENLABS_API_URL}/text-to-speech/${selectedVoiceId}/with-timestamps`);
  if (speed !== 1.0) {
    url.searchParams.append('speed', speed.toString());
  }

  console.log('=== ElevenLabs Request ===');
  console.log('Voice ID:', selectedVoiceId);
  console.log('Speed:', speed);
  console.log('URL:', url.toString());
  console.log('Model:', requestBody.model_id);
  console.log('==========================');

  const response = await fetch(
    url.toString(),
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  const data = await response.json();
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');

  return {
    audioBuffer,
    audioBase64: data.audio_base64,
    alignment: data.alignment // Contains character-level timing
  };
}

module.exports = {
  getVoices,
  generateSpeech,
  generateSpeechWithTimestamps
};
