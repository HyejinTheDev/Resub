const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const { downloadVideo } = require('./services/downloader');
const { uploadFileToGemini, waitForFileProcessing, deleteGeminiFile, transcribeAndTranslate } = require('./services/geminiService');
const { exportDubbedVideo } = require('./services/dubbingEngine');

const app = express();
const PORT = process.env.PORT || 3051;

// Paths configuration
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

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    cb(null, `${uniqueId}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(DOWNLOADS_DIR));

/**
 * Helper to get the ffmpeg command path.
 */
function getFfmpegCommand() {
  const parentFfmpeg = path.join(
    __dirname,
    '..',
    '..',
    'oneclick-subtitles-generator',
    'node_modules',
    '@ffmpeg-installer',
    'ffmpeg',
    process.platform === 'win32' ? 'bin/win32/x64/ffmpeg.exe' : 'bin/linux/x64/ffmpeg'
  );
  if (fs.existsSync(parentFfmpeg)) {
    return parentFfmpeg;
  }
  return 'ffmpeg';
}

/**
 * Extract audio track (MP3) from a video file using FFmpeg
 */
function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(videoPath)) {
      return reject(new Error('Không tìm thấy tệp video được tải lên. Vui lòng thử lại.'));
    }
    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      return reject(new Error('Tệp video tải lên bị trống (0 bytes). Vui lòng thử tải lại hoặc chọn tệp video khác.'));
    }

    const ffmpeg = getFfmpegCommand();
    const args = [
      '-y',
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-q:a', '2',
      audioPath
    ];

    console.log(`[server] Extracting audio: ${ffmpeg} ${args.join(' ')}`);
    const proc = spawn(ffmpeg, args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(audioPath);
      } else {
        if (stderr.includes('moov atom not found')) {
          reject(new Error('Tệp video tải lên bị lỗi hoặc chưa hoàn thành (moov atom not found). Vui lòng tải lại tệp video hợp lệ.'));
        } else {
          reject(new Error(`Lỗi trích xuất âm thanh từ video: ${stderr.substring(0, 150)}...`));
        }
      }
    });
  });
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'resub-backend' });
});

// 1. Download Video (Douyin, TikTok, YouTube)
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const videoId = uuidv4();
  console.log(`[api/download] Request received for URL: ${url}`);

  try {
    const videoPath = await downloadVideo(url, VIDEOS_DIR, videoId);
    const audioPath = path.join(AUDIOS_DIR, `${videoId}.mp3`);
    await extractAudio(videoPath, audioPath);

    res.json({
      success: true,
      videoId,
      videoUrl: `http://localhost:${PORT}/downloads/videos/${videoId}.mp4`,
      audioUrl: `http://localhost:${PORT}/downloads/audios/${videoId}.mp3`,
      videoPath,
      audioPath
    });
  } catch (error) {
    console.error('[api/download] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. Upload Local Video File
app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const videoId = path.basename(req.file.filename, path.extname(req.file.filename));
  const videoPath = req.file.path;
  const audioPath = path.join(AUDIOS_DIR, `${videoId}.mp3`);

  try {
    await extractAudio(videoPath, audioPath);

    res.json({
      success: true,
      videoId,
      videoUrl: `http://localhost:${PORT}/downloads/videos/${videoId}.mp4`,
      audioUrl: `http://localhost:${PORT}/downloads/audios/${videoId}.mp3`,
      videoPath,
      audioPath
    });
  } catch (error) {
    console.error('[api/upload] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Transcribe & Translate (using Gemini Files API)
app.post('/api/transcribe', async (req, res) => {
  const { audioPath, geminiKey } = req.body;
  if (!audioPath || !geminiKey) {
    return res.status(400).json({ error: 'audioPath and geminiKey are required' });
  }

  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: `Audio file not found at path: ${audioPath}` });
  }

  console.log(`[api/transcribe] Uploading and transcribing ${audioPath}...`);

  try {
    // Step 1: Upload audio file to Gemini Files API
    const fileInfo = await uploadFileToGemini(audioPath, 'audio/mp3', geminiKey);
    console.log(`[api/transcribe] Uploaded to Google: ${fileInfo.name}`);

    // Step 2: Wait for it to process
    await waitForFileProcessing(fileInfo.name, geminiKey);

    // Step 3: Run model to transcribe & translate
    const subtitles = await transcribeAndTranslate(fileInfo.uri, geminiKey);
    console.log(`[api/transcribe] Successfully generated ${subtitles.length} segments`);

    // Step 4: Clean up remote file asynchronously (non-blocking)
    deleteGeminiFile(fileInfo.name, geminiKey).catch(() => {});

    res.json({
      success: true,
      subtitles
    });
  } catch (error) {
    console.error('[api/transcribe] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4. Dub & Export (TTS + Burn-in subtitles)
app.post('/api/dub', async (req, res) => {
  const { videoPath, subtitles, voice, bgVolume, blurMask, blurMasks, subtitleStyle, fptApiKey } = req.body;
  if (!videoPath || !subtitles || !Array.isArray(subtitles)) {
    return res.status(400).json({ error: 'videoPath and subtitles array are required' });
  }

  const exportId = uuidv4();
  const outputPath = path.join(EXPORTS_DIR, `${exportId}.mp4`);
  console.log(`[api/dub] Starting dubbing export for ${videoPath}...`);

  try {
    await exportDubbedVideo({
      videoPath,
      subtitles,
      voice: voice || 'vi-VN-HoaiMyNeural',
      outputPath,
      bgVolume: bgVolume !== undefined ? parseFloat(bgVolume) : 0.15,
      blurMask,
      blurMasks,
      subtitleStyle,
      fptApiKey
    });

    res.json({
      success: true,
      exportId,
      videoUrl: `http://localhost:${PORT}/downloads/exports/${exportId}.mp4`,
      outputPath
    });
  } catch (error) {
    console.error('[api/dub] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 5. TTS Preview
app.post('/api/tts-preview', async (req, res) => {
  const { text, voice, fptApiKey } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const voiceName = voice || 'vi-VN-HoaiMyNeural';
  const tempTtsDir = path.join(DOWNLOADS_DIR, 'temp_tts');
  if (!fs.existsSync(tempTtsDir)) {
    fs.mkdirSync(tempTtsDir, { recursive: true });
  }

  const filename = `${uuidv4()}.mp3`;
  const outputPath = path.join(tempTtsDir, filename);

  try {
    const { generateTTS } = require('./services/dubbingEngine');
    await generateTTS(text, voiceName, outputPath, fptApiKey);

    res.json({
      success: true,
      audioUrl: `http://localhost:${PORT}/downloads/temp_tts/${filename}`
    });
  } catch (error) {
    console.error('[api/tts-preview] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Resub backend running at http://localhost:${PORT}`);
});
