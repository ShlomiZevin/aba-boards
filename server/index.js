require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const avatarRoutes = require('./routes/avatar');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (audio, avatar images)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/avatar', avatarRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Avatar server running on http://localhost:${PORT}`);
  console.log(`Test page: http://localhost:${PORT}/test-avatar.html`);
});
