const express = require('express');
const router = express.Router();
const openaiService = require('../services/openai');
const elevenlabsService = require('../services/elevenlabs');
const lipsyncService = require('../services/lipsync');
const firebaseService = require('../services/firebase');

// Per-user conversation history (keyed by userId, clears after 1 day)
const conversations = new Map();
const CONV_TTL = 24 * 60 * 60 * 1000; // 1 day

// Per-session audio queues for polling (keyed by sessionId)
const audioQueues = new Map();

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
 * POST /api/avatar/converse-poll-start
 * Start a polling-based conversation session
 * Returns sessionId for subsequent polling
 */
router.post('/converse-poll-start', express.raw({ type: 'audio/*', limit: '10mb' }), async (req, res) => {
  try {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const mouthShapeCount = parseInt(req.query.mouthShapeCount) || 6;
    const lipSyncMethod = req.query.lipSyncMethod || 'timestamps';
    const voiceId = req.query.voiceId || null;
    const userId = req.query.userId || null;
    const speed = parseFloat(req.query.speed) || 1.0;
    const kidId = req.query.kidId || null; // Kid ID to fetch from Firestore

    const audioBuffer = req.body;

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Initialize session queue
    const sessionQueue = {
      created: Date.now(),
      chunks: [],
      textChunks: [],
      isComplete: false,
      transcript: null,
      error: null
    };
    audioQueues.set(sessionId, sessionQueue);

    // Start processing in background
    (async () => {
      try {
        const totalStart = Date.now();

        // Fetch kid data from Firestore if kidId provided
        let kidContext = null;
        if (kidId) {
          console.log('Fetching kid data for:', kidId);
          const kidData = await firebaseService.getKidData(kidId);
          if (kidData) {
            kidContext = firebaseService.buildKidContext(kidData);
            console.log('Kid context built successfully');
          } else {
            console.log('Kid not found:', kidId);
          }
        }

        // 1. Transcribe audio
        const transcribeStart = Date.now();
        const userText = await openaiService.transcribeAudio(audioBuffer, 'recording.webm');
        const transcribeTime = Date.now() - transcribeStart;

        console.log('=== Polling-based Converse ===');
        console.log('Session:', sessionId);
        console.log('User said:', userText);
        console.log(`Transcription time: ${transcribeTime}ms`);

        if (!userText || userText.trim() === '') {
          sessionQueue.error = 'Could not transcribe audio';
          sessionQueue.isComplete = true;
          return;
        }

        sessionQueue.transcript = { userText, transcribeTime };

        // 2. Stream LLM response sentence by sentence
        const conversationHistory = getConversation(userId);
        let fullResponse = '';
        let sentenceIndex = 0;
        let firstAudioTime = null;

        console.log('Kid context available:', kidContext ? 'YES' : 'NO');
        if (kidContext) {
          console.log('Kid context preview:', kidContext.substring(0, 150) + '...');
        }

        for await (const sentence of openaiService.streamDinosaurResponse(userText, conversationHistory, kidContext)) {
          if (!sentence || sentence.trim() === '') continue;

          fullResponse += (fullResponse ? ' ' : '') + sentence;

          // Add text chunk to queue
          sessionQueue.textChunks.push({ text: sentence, index: sentenceIndex });

          const sentenceStart = Date.now();

          try {
            // Generate audio for this sentence
            if (lipSyncMethod === 'timestamps') {
              const result = await elevenlabsService.generateSpeechWithTimestamps(sentence, voiceId, speed);

              if (firstAudioTime === null) {
                firstAudioTime = Date.now() - totalStart;
                console.log(`First audio at: ${firstAudioTime}ms`);
              }

              let lipSyncData = null;
              if (result.alignment) {
                lipSyncData = lipsyncService.generateTimestampLipSync(result.alignment, mouthShapeCount);
              }

              // Add audio chunk to queue
              sessionQueue.chunks.push({
                audioBase64: result.audioBase64,
                lipSyncData,
                sentenceIndex,
                chunkIndex: 0,
                isFinal: true
              });

              console.log(`✓ Queued audio for sentence ${sentenceIndex}, queue length: ${sessionQueue.chunks.length}`);
            } else {
              const result = await elevenlabsService.generateSpeech(sentence, voiceId, speed);

              if (firstAudioTime === null) {
                firstAudioTime = Date.now() - totalStart;
                console.log(`First audio at: ${firstAudioTime}ms`);
              }

              const lipSyncData = lipsyncService.generateAmplitudeLipSync(result.audioBuffer, mouthShapeCount);

              sessionQueue.chunks.push({
                audioBase64: result.audioBase64,
                lipSyncData,
                sentenceIndex,
                chunkIndex: 0,
                isFinal: true
              });

              console.log(`✓ Queued audio for sentence ${sentenceIndex}, queue length: ${sessionQueue.chunks.length}`);
            }
          } catch (ttsError) {
            console.error('TTS generation error for sentence:', sentence, ttsError);
          }

          const sentenceTime = Date.now() - sentenceStart;
          console.log(`Sentence ${sentenceIndex} processed in ${sentenceTime}ms`);
          sentenceIndex++;
        }

        // Add to conversation history
        addToConversation(userId, userText, fullResponse);

        const totalTime = Date.now() - totalStart;
        console.log('=== Polling Session Complete ===');
        console.log(`Total time: ${totalTime}ms`);
        console.log(`Sentences: ${sentenceIndex}`);
        console.log('================================');

        sessionQueue.isComplete = true;
        sessionQueue.metrics = {
          transcribeTime,
          firstAudioTime,
          totalTime,
          sentenceCount: sentenceIndex
        };

      } catch (err) {
        console.error('Error in polling session:', err);
        sessionQueue.error = err.message;
        sessionQueue.isComplete = true;
      }
    })();

    // Return session ID immediately
    res.json({ sessionId });

  } catch (err) {
    console.error('Error starting polling session:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/avatar/converse-poll
 * Poll for new audio chunks from an active session
 */
router.get('/converse-poll', (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const sessionQueue = audioQueues.get(sessionId);

  if (!sessionQueue) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  // Return all available data
  const response = {
    transcript: sessionQueue.transcript,
    textChunks: sessionQueue.textChunks.splice(0), // Take all text chunks
    audioChunks: sessionQueue.chunks.splice(0), // Take all audio chunks
    isComplete: sessionQueue.isComplete,
    error: sessionQueue.error,
    metrics: sessionQueue.metrics
  };

  // Clean up completed sessions
  if (sessionQueue.isComplete && sessionQueue.chunks.length === 0 && sessionQueue.textChunks.length === 0) {
    audioQueues.delete(sessionId);
    console.log(`Session ${sessionId} cleaned up`);
  }

  res.json(response);
});

module.exports = router;
