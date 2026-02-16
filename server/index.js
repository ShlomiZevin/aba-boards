require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const avatarRoutes = require('./routes/avatar');
const therapyRoutes = require('./routes/therapy');
const { initializeSuperAdmin, initializeGoalCategories } = require('./services/therapy');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (audio, avatar images)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/avatar', avatarRoutes);
app.use('/api/therapy', therapyRoutes);

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
