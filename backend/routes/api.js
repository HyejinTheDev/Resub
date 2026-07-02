const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn, execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const { downloadVideo } = require('../services/downloader');
const { uploadFileToGemini, waitForFileProcessing, deleteGeminiFile, transcribeAndTranslate } = require('../services/geminiService');
const { exportDubbedVideo, generateTTS, getFfprobeCommand } = require('../services/dubbingEngine');

const router = express.Router();

// Paths configuration
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');
const VIDEOS_DIR = path.join(DOWNLOADS_DIR, 'videos');
const AUDIOS_DIR = path.join(DOWNLOADS_DIR, 'audios');
const EXPORTS_DIR = path.join(DOWNLOADS_DIR, 'exports');
const TEMP_TTS_DIR = path.join(DOWNLOADS_DIR, 'temp_tts');

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

function getFfmpegCommand() {
  const parentFfmpeg = path.join(
    __dirname,
    '..',
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
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'resub-backend' });
});

// 1. Download Video
router.post('/download', async (req, res) => {
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

    const PORT = process.env.PORT || 3051;
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
router.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const videoId = path.basename(req.file.filename, path.extname(req.file.filename));
  const videoPath = req.file.path;
  const audioPath = path.join(AUDIOS_DIR, `${videoId}.mp3`);

  try {
    await extractAudio(videoPath, audioPath);

    const PORT = process.env.PORT || 3051;
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

// Initialize progress tracking map
global.transcribeProgress = global.transcribeProgress || {};

// 3. Transcribe & Translate (Async Background Task)
router.post('/transcribe', async (req, res) => {
  const { audioPath, geminiKey, taskId } = req.body;
  if (!audioPath || !geminiKey || !taskId) {
    return res.status(400).json({ error: 'audioPath, geminiKey, and taskId are required' });
  }

  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: `Audio file not found at path: ${audioPath}` });
  }

  console.log(`[api/transcribe] Starting background transcription task: ${taskId} for ${audioPath}`);
  
  // Initialize progress
  global.transcribeProgress[taskId] = { 
    status: 'uploading', 
    percent: 15, 
    message: 'Gửi âm thanh lên máy chủ Google AI...' 
  };

  // Start background process
  (async () => {
    try {
      // Step 1: Upload to Gemini Files API
      const fileInfo = await uploadFileToGemini(audioPath, 'audio/mp3', geminiKey);
      console.log(`[api/transcribe] Uploaded to Google: ${fileInfo.name}`);

      // Update progress
      global.transcribeProgress[taskId] = { 
        status: 'processing', 
        percent: 45, 
        message: 'Google AI đang phân tích tệp âm thanh...' 
      };

      // Step 2: Wait for file processing
      await waitForFileProcessing(fileInfo.name, geminiKey);

      // Update progress
      global.transcribeProgress[taskId] = { 
        status: 'transcribing', 
        percent: 75, 
        message: 'Gemini AI đang nhận dạng tiếng Trung & biên dịch phụ đề...' 
      };

      // Step 3: Call model
      const subtitles = await transcribeAndTranslate(fileInfo.uri, geminiKey);
      console.log(`[api/transcribe] Task ${taskId} successfully generated ${subtitles.length} segments`);

      // Clean up remote file
      deleteGeminiFile(fileInfo.name, geminiKey).catch(() => {});

      // Final progress update
      global.transcribeProgress[taskId] = { 
        status: 'done', 
        percent: 100, 
        subtitles 
      };
    } catch (error) {
      console.error(`[api/transcribe] Task ${taskId} failed:`, error.message);
      global.transcribeProgress[taskId] = { 
        status: 'error', 
        percent: 100, 
        error: error.message 
      };
    }
  })();

  // Return immediately with taskId
  res.json({
    success: true,
    taskId
  });
});

// Endpoint to poll transcription progress status
router.get('/transcribe-status', (req, res) => {
  const { taskId } = req.query;
  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  const progress = global.transcribeProgress[taskId];
  if (!progress) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(progress);
});

// 4. Dub & Export
router.post('/dub', async (req, res) => {
  const { videoPath, subtitles, voice, bgVolume, ttsVolume, blurMask, blurMasks, subtitleStyle, capcutCookie, cropStyle, videoTransform, exportResolution, exportQuality } = req.body;
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
      ttsVolume: ttsVolume !== undefined ? parseFloat(ttsVolume) : 1.0,
      blurMask,
      blurMasks,
      subtitleStyle,
      capcutCookie,
      cropStyle,
      videoTransform,
      exportResolution,
      exportQuality
    });

    const PORT = process.env.PORT || 3051;
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
router.post('/tts-preview', async (req, res) => {
  const { text, voice, capcutCookie } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const voiceName = voice || 'vi-VN-HoaiMyNeural';
  console.log(`[api/tts-preview] Request: text="${text}", voice="${voiceName}", cookieLength=${capcutCookie ? capcutCookie.length : 0}`);
  
  const filename = `${uuidv4()}.mp3`;
  const outputPath = path.join(TEMP_TTS_DIR, filename);

  try {
    await generateTTS(text, voiceName, outputPath, capcutCookie);

    const PORT = process.env.PORT || 3051;
    res.json({
      success: true,
      audioUrl: `http://localhost:${PORT}/downloads/temp_tts/${filename}`
    });
  } catch (error) {
    console.error('[api/tts-preview] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 6. Split Long Video into Segments
router.post('/split-video', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Video file is required' });
  }

  const segmentMinutes = parseFloat(req.body.segmentMinutes) || 5.0;
  const segmentSeconds = segmentMinutes * 60;

  const videoPath = req.file.path;
  const videoExt = path.extname(req.file.originalname) || '.mp4';
  const originalName = path.basename(req.file.originalname, videoExt);
  
  const splitDirName = `split_${uuidv4()}`;
  const splitDirPath = path.join(DOWNLOADS_DIR, 'exports', splitDirName);
  fs.mkdirSync(splitDirPath, { recursive: true });

  const ffmpeg = getFfmpegCommand();
  const ffprobe = getFfprobeCommand();

  try {
    // 1. Get original video duration using ffprobe
    const durationCmd = `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const originalDuration = parseFloat(execSync(durationCmd).toString().trim()) || 0;

    // 2. Perform splitting
    const outputPattern = path.join(splitDirPath, `part_%03d${videoExt}`);
    
    // Command: ffmpeg -i input -f segment -segment_time S -reset_timestamps 1 -c copy -map 0 output_%03d.mp4
    // We execute this synchronously
    const { execSync: cpExecSync } = require('child_process');
    const splitCmd = `"${ffmpeg}" -y -i "${videoPath}" -f segment -segment_time ${segmentSeconds} -reset_timestamps 1 -c copy -map 0 "${outputPattern}"`;
    cpExecSync(splitCmd);

    // 3. Read output files
    const files = fs.readdirSync(splitDirPath);
    const segments = [];

    const PORT = process.env.PORT || 3051;
    
    // Sort files to keep correct order
    files.sort().forEach((file, index) => {
      const filePath = path.join(splitDirPath, file);
      
      // Get segment duration
      const segDurationCmd = `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
      const duration = parseFloat(cpExecSync(segDurationCmd).toString().trim()) || 0;

      const fileUrl = `http://localhost:${PORT}/downloads/exports/${splitDirName}/${file}`;
      
      segments.push({
        index,
        fileName: `${originalName}_Phần_${index + 1}${videoExt}`,
        duration,
        url: fileUrl,
        filePath
      });
    });

    // Cleanup uploaded temp video
    try {
      fs.unlinkSync(videoPath);
    } catch (err) {
      console.warn('Failed to delete temp video upload:', err.message);
    }

    res.json({
      success: true,
      originalName,
      originalDuration,
      segments
    });
  } catch (error) {
    console.error('Error splitting video:', error);
    res.status(500).json({ error: `Splitting failed: ${error.message}` });
  }
});

// 7. Load Split Segment as new Project
router.post('/load-split-segment', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Valid filePath is required' });
  }

  const videoId = uuidv4();
  const videoExt = path.extname(filePath);
  
  // Copy the split file into downloads/videos
  const targetVideoPath = path.join(VIDEOS_DIR, `${videoId}${videoExt}`);
  fs.copyFileSync(filePath, targetVideoPath);

  // Extract audio
  const audioPath = path.join(AUDIOS_DIR, `${videoId}.mp3`);
  
  try {
    await extractAudio(targetVideoPath, audioPath);

    const PORT = process.env.PORT || 3051;
    res.json({
      success: true,
      videoId,
      videoUrl: `http://localhost:${PORT}/downloads/videos/${videoId}${videoExt}`,
      audioUrl: `http://localhost:${PORT}/downloads/audios/${videoId}.mp3`,
      videoPath: targetVideoPath,
      audioPath
    });
  } catch (error) {
    console.error('Failed to load split segment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
