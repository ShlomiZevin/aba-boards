const express = require('express');
const router = express.Router();
const avatarService = require('../services/avatar');
const openaiService = require('../services/openai');

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
    const { text, voiceId, mouthShapeCount = 4, lipSyncMethod = 'amplitude' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await avatarService.generateAvatarSpeech(text, {
      voiceId,
      mouthShapeCount,
      lipSyncMethod
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
    const { name, voiceId, mouthShapeCount = 4, lipSyncMethod = 'amplitude' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const greeting = avatarService.getGreeting(name);
    const result = await avatarService.generateAvatarSpeech(greeting, {
      voiceId,
      mouthShapeCount,
      lipSyncMethod
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

    const audioBuffer = req.body;

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // 1. Transcribe audio using OpenAI Whisper
    const userText = await openaiService.transcribeAudio(audioBuffer, 'recording.webm');
    console.log('=== Whisper Transcript ===');
    console.log('User said:', userText);
    console.log('==========================');

    if (!userText || userText.trim() === '') {
      return res.status(400).json({ error: 'Could not transcribe audio' });
    }

    // 2. Generate dinosaur response using GPT (with history)
    const history = getConversation(userId);
    const dinosaurResponse = await openaiService.generateDinosaurResponse(userText, history);
    addToConversation(userId, userText, dinosaurResponse);

    // 3. Generate speech with lip-sync
    const speechResult = await avatarService.generateAvatarSpeech(dinosaurResponse, {
      voiceId,
      mouthShapeCount,
      lipSyncMethod
    });

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
 * POST /api/avatar/chat
 * Text-based chat (for testing without microphone)
 */
router.post('/chat', async (req, res) => {
  try {
    const { text, voiceId, mouthShapeCount = 4, lipSyncMethod = 'amplitude', userId } = req.body;

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
      lipSyncMethod
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
