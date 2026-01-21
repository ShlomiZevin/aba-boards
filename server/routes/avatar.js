const express = require('express');
const router = express.Router();
const avatarService = require('../services/avatar');

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

module.exports = router;
