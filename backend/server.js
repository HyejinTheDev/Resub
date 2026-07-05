require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3051;

// Behind Hugging Face / reverse proxy — correct https host for absolute media URLs
app.set('trust proxy', true);

// Paths configuration for initial folder setup and cleanup
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const VIDEOS_DIR = path.join(DOWNLOADS_DIR, 'videos');
const AUDIOS_DIR = path.join(DOWNLOADS_DIR, 'audios');
const EXPORTS_DIR = path.join(DOWNLOADS_DIR, 'exports');
const TEMP_TTS_DIR = path.join(DOWNLOADS_DIR, 'temp_tts');

// Ensure folders exist
[DOWNLOADS_DIR, VIDEOS_DIR, AUDIOS_DIR, EXPORTS_DIR, TEMP_TTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Clear temp_tts on start
try {
  if (fs.existsSync(TEMP_TTS_DIR)) {
    const files = fs.readdirSync(TEMP_TTS_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TEMP_TTS_DIR, file));
    }
  }
} catch (e) {
  console.warn('Failed to clear temp_tts folder on start:', e.message);
}

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;

app.use(cors({
  origin: corsOrigins || true,
  credentials: true
}));
app.use(express.json());
app.use('/downloads', express.static(DOWNLOADS_DIR));

// Register API Router
app.use('/api', apiRouter);

// Serve static frontend files in production (monolith deploy)
const frontendDistPath = path.join(__dirname, 'public');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/downloads')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Resub backend running at http://localhost:${PORT}`);
});
