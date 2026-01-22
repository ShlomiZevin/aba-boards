const express = require('express');
const router = express.Router();
const avatarService = require('../services/avatar');
const openaiService = require('../services/openai');
const elevenlabsService = require('../services/elevenlabs');
const lipsyncService = require('../services/lipsync');

// Per-user conversation history (keyed by oderId, clears after 1 day)
const conversations = new Map();
const CONV_TTL = 24 * 60 * 60 * 1000; // 1 day

function getConversation(userId) {
  if (!userId) return [];
  const conv = conversations.get(userId);
  if (!conv) return [];
  // Check if expired
  if (Date.now() - conv.created > CONV_TTL) {
    conversations.delete(userId);
    return [];
  }
  return conv.history;
}

function addToConversation(userId, userMsg, assistantMsg) {
  if (!userId) return;
  let conv = conversations.get(userId);
  if (!conv || Date.now() - conv.created > CONV_TTL) {
    conv = { created: Date.now(), history: [] };
    conversations.set(userId, conv);
  }
  conv.history.push({ role: 'user', content: userMsg });
  conv.history.push({ role: 'assistant', content: assistantMsg });
  // Keep limited to last 10 exchanges
  if (conv.history.length > 20) {
    conv.history.splice(0, 2);
  }
}

/**
 * POST /api/avatar/speak
 * Generate speech with lip-sync data
 */
router.post('/speak', async (req, res) => {
  try {
    const { text, voiceId, mouthShapeCount = 4, lipSyncMethod = 'amplitude', speed = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await avatarService.generateAvatarSpeech(text, {
      voiceId,
      mouthShapeCount,
      lipSyncMethod,
      speed
    });

    res.json(result);
  } catch (err) {
    console.error('Error generating speech:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/avatar/greet
 * Generate a greeting for a child
 */
router.post('/greet', async (req, res) => {
  try {
    const { name, voiceId, mouthShapeCount = 4, lipSyncMethod = 'amplitude', speed = 1.0 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const greeting = avatarService.getGreeting(name);
    const result = await avatarService.generateAvatarSpeech(greeting, {
      voiceId,
      mouthShapeCount,
      lipSyncMethod,
      speed
    });

    res.json({
      ...result,
      text: greeting
    });
  } catch (err) {
    console.error('Error generating greeting:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/avatar/converse
 * Full conversation: receive audio, transcribe, generate response, return speech
 */
router.post('/converse', express.raw({ type: 'audio/*', limit: '10mb' }), async (req, res) => {
  try {
    const mouthShapeCount = parseInt(req.query.mouthShapeCount) || 4;
    const lipSyncMethod = req.query.lipSyncMethod || 'amplitude';
    const voiceId = req.query.voiceId || null;
    const userId = req.query.userId || null;
    const personality = req.query.personality || 'default';
    const speed = parseFloat(req.query.speed) || 1.0;

    const audioBuffer = req.body;

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const totalStart = Date.now();

    // 1. Transcribe audio using OpenAI Whisper
    const transcribeStart = Date.now();
    const userText = await openaiService.transcribeAudio(audioBuffer, 'recording.webm');
    const transcribeTime = Date.now() - transcribeStart;

    console.log('=== Whisper Transcript ===');
    console.log('User said:', userText);
    console.log(`Transcription time: ${transcribeTime}ms`);
    console.log('==========================');

    if (!userText || userText.trim() === '') {
      return res.status(400).json({ error: 'Could not transcribe audio' });
    }

    // 2. Generate dinosaur response using GPT (with history)
    const llmStart = Date.now();
    const history = getConversation(userId);
    const dinosaurResponse = await openaiService.generateDinosaurResponse(userText, history, personality);
    const llmTime = Date.now() - llmStart;
    addToConversation(userId, userText, dinosaurResponse);

    // 3. Generate speech with lip-sync
    const ttsStart = Date.now();
    const speechResult = await avatarService.generateAvatarSpeech(dinosaurResponse, {
      voiceId,
      mouthShapeCount,
      lipSyncMethod,
      speed
    });
    const ttsTime = Date.now() - ttsStart;

    const totalTime = Date.now() - totalStart;

    console.log('=== Performance Metrics ===');
    console.log(`Transcription (Whisper): ${transcribeTime}ms`);
    console.log(`LLM Response (GPT): ${llmTime}ms`);
    console.log(`Text-to-Speech (ElevenLabs): ${ttsTime}ms`);
    console.log(`Total pipeline: ${totalTime}ms`);
    console.log(`Speed setting: ${speed}`);
    console.log('===========================');

    res.json({
      userText,
      responseText: dinosaurResponse,
      ...speechResult
    });
  } catch (err) {
    console.error('Error in conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/avatar/converse-stream
 * Streaming conversation: receive audio, transcribe, stream response with audio chunks
 * Uses Server-Sent Events (SSE) to push audio as it becomes available
 */
router.post('/converse-stream', express.raw({ type: 'audio/*', limit: '10mb' }), async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const mouthShapeCount = parseInt(req.query.mouthShapeCount) || 6;
    const lipSyncMethod = req.query.lipSyncMethod || 'timestamps';
    const voiceId = req.query.voiceId || null;
    const userId = req.query.userId || null;
    const personality = req.query.personality || 'default';
    const speed = parseFloat(req.query.speed) || 1.0;

    const audioBuffer = req.body;

    if (!audioBuffer || audioBuffer.length === 0) {
      sendEvent('error', { error: 'Audio data is required' });
      res.end();
      return;
    }

    const totalStart = Date.now();

    // 1. Transcribe audio (fast, non-streaming)
    const transcribeStart = Date.now();
    const userText = await openaiService.transcribeAudio(audioBuffer, 'recording.webm');
    const transcribeTime = Date.now() - transcribeStart;

    console.log('=== Streaming Converse ===');
    console.log('User said:', userText);
    console.log(`Transcription time: ${transcribeTime}ms`);

    if (!userText || userText.trim() === '') {
      sendEvent('error', { error: 'Could not transcribe audio' });
      res.end();
      return;
    }

    // Send transcript immediately
    sendEvent('transcript', { userText, transcribeTime });

    // 2. Stream LLM response sentence by sentence
    const history = getConversation(userId);
    let fullResponse = '';
    let sentenceIndex = 0;
    let firstAudioTime = null;

    const llmStart = Date.now();

    for await (const sentence of openaiService.streamDinosaurResponse(userText, history, personality)) {
      const sentenceStart = Date.now();
      fullResponse += (fullResponse ? ' ' : '') + sentence;

      // Send the text chunk
      sendEvent('text', { text: sentence, index: sentenceIndex });

      // Skip TTS for empty/whitespace-only sentences
      const cleanedSentence = sentence.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
      if (!cleanedSentence) {
        console.log(`Skipping TTS for emoji-only sentence: ${sentence}`);
        sentenceIndex++;
        continue;
      }

      // 3. Stream TTS for this sentence
      let audioChunkIndex = 0;
      const useTimestamps = lipSyncMethod === 'timestamps';

      try {
        if (useTimestamps) {
          // Stream with timestamps for precise lip-sync
          for await (const chunk of elevenlabsService.streamSpeechWithTimestamps(sentence, voiceId, speed)) {
            if (firstAudioTime === null) {
              firstAudioTime = Date.now() - totalStart;
              console.log(`First audio chunk at: ${firstAudioTime}ms`);
            }

            // Generate lip-sync data from alignment if available
            let lipSyncData = null;
            if (chunk.alignment) {
              lipSyncData = lipsyncService.generateTimestampLipSync(chunk.alignment, mouthShapeCount);
            }

            sendEvent('audio', {
              audioBase64: chunk.audioBase64,
              lipSyncData,
              sentenceIndex,
              chunkIndex: audioChunkIndex++,
              isFinal: chunk.isFinal
            });
          }
        } else {
          // Stream without timestamps, use amplitude-based lip-sync
          for await (const chunk of elevenlabsService.streamSpeech(sentence, voiceId, speed)) {
            if (firstAudioTime === null) {
              firstAudioTime = Date.now() - totalStart;
              console.log(`First audio chunk at: ${firstAudioTime}ms`);
            }

            // Generate amplitude-based lip-sync from audio chunk
            const audioBuffer = Buffer.from(chunk.audioBase64, 'base64');
            const lipSyncData = lipsyncService.generateAmplitudeLipSync(audioBuffer, mouthShapeCount);

            sendEvent('audio', {
              audioBase64: chunk.audioBase64,
              lipSyncData,
              sentenceIndex,
              chunkIndex: audioChunkIndex++,
              isFinal: false
            });
          }
        }
      } catch (ttsError) {
        console.error('TTS streaming error for sentence:', sentence, ttsError);
        sendEvent('tts-error', { error: ttsError.message, sentenceIndex });
      }

      const sentenceTime = Date.now() - sentenceStart;
      console.log(`Sentence ${sentenceIndex} processed in ${sentenceTime}ms`);
      sentenceIndex++;
    }

    // Add to conversation history
    addToConversation(userId, userText, fullResponse);

    const totalTime = Date.now() - totalStart;
    const llmTime = Date.now() - llmStart;

    console.log('=== Streaming Performance ===');
    console.log(`Transcription: ${transcribeTime}ms`);
    console.log(`First audio: ${firstAudioTime}ms`);
    console.log(`LLM + TTS streaming: ${llmTime}ms`);
    console.log(`Total: ${totalTime}ms`);
    console.log(`Sentences: ${sentenceIndex}`);
    console.log('=============================');

    // 4. Signal completion
    sendEvent('done', {
      fullResponse,
      metrics: {
        transcribeTime,
        firstAudioTime,
        totalTime,
        sentenceCount: sentenceIndex
      }
    });

  } catch (err) {
    console.error('Error in streaming conversation:', err);
    sendEvent('error', { error: err.message });
  }

  res.end();
});

/**
 * POST /api/avatar/chat
 * Text-based chat (for testing without microphone)
 */
router.post('/chat', async (req, res) => {
  try {
    const { text, voiceId, mouthShapeCount = 4, lipSyncMethod = 'amplitude', userId, speed = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // 1. Generate dinosaur response using GPT (with history)
    const history = getConversation(userId);
    const dinosaurResponse = await openaiService.generateDinosaurResponse(text, history);
    addToConversation(userId, text, dinosaurResponse);

    // 2. Generate speech with lip-sync
    const speechResult = await avatarService.generateAvatarSpeech(dinosaurResponse, {
      voiceId,
      mouthShapeCount,
      lipSyncMethod,
      speed
    });

    res.json({
      userText: text,
      responseText: dinosaurResponse,
      ...speechResult
    });
  } catch (err) {
    console.error('Error in chat:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
