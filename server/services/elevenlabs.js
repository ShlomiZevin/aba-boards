const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - multilingual

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
        output_format: 'mp3_22050_32',
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
  const requestBody = {
    text,
    model_id: 'eleven_v3',
    output_format: 'mp3_22050_32',
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

/**
 * Stream speech with timestamps for real-time lip-sync
 * Uses ElevenLabs streaming endpoint with alignment data
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {number} speed - Speech speed (0.25 to 4.0)
 * @yields {{ audioBase64: string, alignment: object, isFinal: boolean }}
 */
async function* streamSpeechWithTimestamps(text, voiceId = null, speed = 1.0) {
  const selectedVoiceId = voiceId || DEFAULT_VOICE_ID;

  // Build URL with query parameters
  // Note: optimize_streaming_latency is NOT supported with eleven_v3 model
  const url = new URL(`${ELEVENLABS_API_URL}/text-to-speech/${selectedVoiceId}/stream/with-timestamps`);
  if (speed !== 1.0) {
    url.searchParams.append('speed', speed.toString());
  }

  const requestBody = {
    text,
    model_id: 'eleven_v3',
    output_format: 'mp3_22050_32',
    auto_mode: true,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75
    }
  };

  console.log('=== ElevenLabs Streaming Request ===');
  console.log('Voice ID:', selectedVoiceId);
  console.log('Text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  console.log('Speed:', speed);
  console.log('====================================');

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs streaming API error: ${error}`);
  }

  // Parse the streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // Parse complete JSON objects from the buffer
    // ElevenLabs sends newline-delimited JSON
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const chunk = JSON.parse(trimmed);

        // Yield the chunk with audio and alignment data
        if (chunk.audio_base64) {
          yield {
            audioBase64: chunk.audio_base64,
            alignment: chunk.alignment || null,
            normalizedAlignment: chunk.normalized_alignment || null,
            isFinal: false
          };
        }
      } catch (parseError) {
        // Skip invalid JSON lines
        console.warn('Failed to parse ElevenLabs chunk:', trimmed.substring(0, 100));
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.trim()) {
    try {
      const chunk = JSON.parse(buffer.trim());
      if (chunk.audio_base64) {
        yield {
          audioBase64: chunk.audio_base64,
          alignment: chunk.alignment || null,
          normalizedAlignment: chunk.normalized_alignment || null,
          isFinal: true
        };
      }
    } catch (parseError) {
      // Ignore final parse errors
    }
  }
}

/**
 * Stream speech without timestamps (faster, uses amplitude-based lip-sync)
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {number} speed - Speech speed
 * @yields {{ audioBase64: string }}
 */
async function* streamSpeech(text, voiceId = null, speed = 1.0) {
  const selectedVoiceId = voiceId || DEFAULT_VOICE_ID;

  // Note: optimize_streaming_latency is NOT supported with eleven_v3 model
  const url = new URL(`${ELEVENLABS_API_URL}/text-to-speech/${selectedVoiceId}/stream`);
  if (speed !== 1.0) {
    url.searchParams.append('speed', speed.toString());
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_v3',
      output_format: 'mp3_22050_32',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs streaming API error: ${error}`);
  }

  // Stream raw audio chunks
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Convert chunk to base64
    const audioBase64 = Buffer.from(value).toString('base64');
    yield { audioBase64 };
  }
}

module.exports = {
  getVoices,
  generateSpeech,
  generateSpeechWithTimestamps,
  streamSpeechWithTimestamps,
  streamSpeech,
  DEFAULT_VOICE_ID
};
