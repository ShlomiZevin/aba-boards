const express = require('express');
const router = express.Router();
const avatarService = require('../services/avatar');
const openaiService = require('../services/openai');

// Simple in-memory conversation history (resets on server restart)
const conversationHistory = [];

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
    const dinosaurResponse = await openaiService.generateDinosaurResponse(userText, conversationHistory);

    // Add to history
    conversationHistory.push({ role: 'user', content: userText });
    conversationHistory.push({ role: 'assistant', content: dinosaurResponse });

    // Keep history limited to last 10 exchanges
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, 2);
    }

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
    const { text, voiceId, mouthShapeCount = 4, lipSyncMethod = 'amplitude' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // 1. Generate dinosaur response using GPT (with history)
    const dinosaurResponse = await openaiService.generateDinosaurResponse(text, conversationHistory);

    // Add to history
    conversationHistory.push({ role: 'user', content: text });
    conversationHistory.push({ role: 'assistant', content: dinosaurResponse });

    // Keep history limited to last 10 exchanges
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, 2);
    }

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
