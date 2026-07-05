const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn, execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '874744439002-c4q4lhmlhndu81c3c97u4k4l2v4rbl7k.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const { downloadVideo } = require('../services/downloader');
const { transcribeSegmented } = require('../services/transcriptionEngine');
const { exportDubbedVideo, generateTTS, getFfprobeCommand } = require('../services/dubbingEngine');
const { exportQueue, transcribeQueue } = require('../services/taskQueue');
const { getPublicBaseUrl, getFullUrl } = require('../utils/urlHelpers');
const { detectSubtitlePosition } = require('../services/geminiService');

const router = express.Router();

// Paths configuration
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');
const VIDEOS_DIR = path.join(DOWNLOADS_DIR, 'videos');
const AUDIOS_DIR = path.join(DOWNLOADS_DIR, 'audios');
const EXPORTS_DIR = path.join(DOWNLOADS_DIR, 'exports');
const TEMP_TTS_DIR = path.join(DOWNLOADS_DIR, 'temp_tts');
const USERS_FILE = path.join(DOWNLOADS_DIR, 'users.json');

// Helper to read users
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE));
  } catch (e) {
    return [];
  }
}

// Helper to write users
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Auth endpoints
router.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const users = readUsers();
  const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại!' });
  }

  const newUser = {
    id: uuidv4(),
    username,
    password, // Store simply for local project use
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeUsers(users);

  res.json({
    success: true,
    user: { id: newUser.id, username: newUser.username }
  });
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const users = readUsers();
  let user = users.find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    // Auto-register since this is a private deployment and database was wiped on container restart
    user = {
      id: uuidv4(),
      username,
      password,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);
    console.log(`[Auth] Auto-registered wiped user on login: ${username}`);
  } else if (user.password !== password) {
    return res.status(400).json({ error: 'Sai tên đăng nhập hoặc mật khẩu!' });
  }

  res.json({
    success: true,
    user: { id: user.id, username: user.username }
  });
});

// Google Auth configuration endpoint
router.get('/auth/google-config', (req, res) => {
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

// Google Auth verification & login/register endpoint
router.post('/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'ID Token (credential) is required' });
  }

  try {
    // Verify token with Google API
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    const { email, name, picture } = payload;
    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    // Map email username (e.g. name@gmail.com -> name)
    const username = email.split('@')[0];

    const users = readUsers();
    let user = users.find(u => u.email === email || u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      // Auto-register new Google user
      user = {
        id: uuidv4(),
        username,
        email,
        avatar: picture,
        password: uuidv4(), // Random password
        createdAt: new Date().toISOString()
      };
      users.push(user);
      writeUsers(users);
      console.log(`[Google Auth] Auto-registered new user: ${username} (${email})`);
    } else {
      // Update avatar if changed
      if (picture && user.avatar !== picture) {
        user.avatar = picture;
        writeUsers(users);
      }
      console.log(`[Google Auth] Logged in existing user: ${user.username} (${email})`);
    }

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar }
    });
  } catch (error) {
    console.error('[Google Auth Error]:', error.message);
    res.status(400).json({ error: `Xác thực Google thất bại: ${error.message}` });
  }
});


// KeyManager Server Integration Configuration
const KEY_MANAGER_URL = process.env.KEY_MANAGER_URL || 'http://localhost:3060';
const KEY_MANAGER_TOKEN = process.env.KEY_MANAGER_TOKEN || 'resub_secret_key_rotation_token_123';

async function fetchKeyFromManager() {
  const response = await fetch(`${KEY_MANAGER_URL}/api/get-key`, {
    headers: { 'Authorization': `Bearer ${KEY_MANAGER_TOKEN}` }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown KeyManager error' }));
    throw new Error(err.error || 'Failed to fetch API key from KeyManager');
  }
  const data = await response.json();
  return data.apiKey;
}

async function reportBadKeyToManager(key, type) {
  await fetch(`${KEY_MANAGER_URL}/api/report-bad-key`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY_MANAGER_TOKEN}` 
    },
    body: JSON.stringify({ key, type })
  }).catch(err => console.error('[api/reportBadKey] Failed:', err.message));
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
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150 MB max upload per file
});

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
      '-ac', '1',
      '-ar', '16000',
      '-ab', '64k',
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

    res.json({
      success: true,
      videoId,
      videoUrl: getFullUrl(req, `/downloads/videos/${videoId}.mp4`),
      audioUrl: getFullUrl(req, `/downloads/audios/${videoId}.mp3`),
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
  const ffprobe = getFfprobeCommand();
  const safeFfprobe = ffprobe.includes(' ') ? `"${ffprobe}"` : ffprobe;

  try {
    const durationCmd = `${safeFfprobe} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const duration = parseFloat(execSync(durationCmd).toString().trim()) || 0;

    if (duration > 300) {
      fs.unlinkSync(videoPath);
      return res.status(400).json({ error: 'Video quá dài! Thời lượng tối đa cho phép là 5 phút (300 giây).' });
    }

    await extractAudio(videoPath, audioPath);

    res.json({
      success: true,
      videoId,
      videoUrl: getFullUrl(req, `/downloads/videos/${req.file.filename}`),
      audioUrl: getFullUrl(req, `/downloads/audios/${videoId}.mp3`),
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

// 3. Transcribe & Translate (Async Background Task with Rotation & Failover)
router.post('/transcribe', async (req, res) => {
  const { audioPath, videoPath, geminiKey, taskId } = req.body;
  if (!audioPath || !taskId) {
    return res.status(400).json({ error: 'audioPath and taskId are required' });
  }

  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: `Audio file not found at path: ${audioPath}` });
  }

  if (!transcribeQueue.hasCapacity()) {
    return res.status(503).json({
      error: 'Máy chủ đang quá tải (quá nhiều người nhận dạng cùng lúc). Vui lòng thử lại sau 2–3 phút.'
    });
  }

  const useSystemPool = !geminiKey;
  console.log(`[api/transcribe] Starting background transcription task: ${taskId} for ${audioPath} (useSystemPool: ${useSystemPool})`);
  
  global.transcribeProgress[taskId] = {
    status: 'queued',
    percent: 2,
    message: 'Đang chờ lượt xử lý nhận dạng...'
  };

  transcribeQueue.enqueue(
    taskId,
    async () => {
      global.transcribeProgress[taskId] = {
        status: 'uploading',
        percent: 5,
        message: 'Khởi tạo tác vụ nhận dạng & dịch thuật...'
      };

      const acquireKey = async () => {
        if (!useSystemPool) return geminiKey;
        return fetchKeyFromManager();
      };
      const reportBadKey = async (key, type) => {
        if (!useSystemPool) return;
        const isInvalid = type === 'invalid';
        console.warn(`[api/transcribe] Reporting bad key: ${key.substring(0, 8)}... (isInvalid: ${isInvalid})`);
        await reportBadKeyToManager(key, type);
      };

      try {
        if (useSystemPool) {
          global.transcribeProgress[taskId] = {
            status: 'uploading',
            percent: 6,
            message: 'Đang mượn API Key từ KeyManager...'
          };
        }

        const subtitles = await transcribeSegmented(audioPath, {
          acquireKey,
          reportBadKey,
          onProgress: ({ percent, message }) => {
            global.transcribeProgress[taskId] = { status: 'transcribing', percent, message };
          }
        });

        // Auto-detect subtitle Y position using Gemini on a keyframe
        let detectedPosition = null;
        if (videoPath && subtitles && subtitles.length > 0) {
          global.transcribeProgress[taskId] = {
            status: 'transcribing',
            percent: 99,
            message: 'Đang tự động định vị chiều cao phụ đề gốc...'
          };
          try {
            // Pick a subtitle segment that is reasonably long for best keyframe extraction
            const parseTimeToSecondsLocal = (timeStr) => {
              const match = timeStr.match(/(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?/);
              if (!match) return 0;
              const m = parseInt(match[1]) || 0;
              const s = parseInt(match[2]) || 0;
              const ms = parseInt(match[3]) || 0;
              return m * 60 + s + ms / 1000;
            };

            const targetSub = subtitles.find(s => {
              const start = parseTimeToSecondsLocal(s.startTime);
              const end = parseTimeToSecondsLocal(s.endTime);
              return (end - start) >= 1.5;
            }) || subtitles[0];

            if (targetSub) {
              const start = parseTimeToSecondsLocal(targetSub.startTime);
              const end = parseTimeToSecondsLocal(targetSub.endTime);
              const midSec = (start + end) / 2;

              const activeKey = await acquireKey();
              detectedPosition = await detectSubtitlePosition(videoPath, midSec, activeKey);
            }
          } catch (detError) {
            console.warn('[api/transcribe] Failed to automatically detect subtitle Y-coordinate:', detError.message);
          }
        }

        console.log(`[api/transcribe] Task ${taskId} generated ${subtitles.length} merged segments`);
        global.transcribeProgress[taskId] = {
          status: 'done',
          percent: 100,
          subtitles,
          detectedPosition
        };
      } catch (error) {
        console.error(`[api/transcribe] Task ${taskId} failed:`, error.message);
        global.transcribeProgress[taskId] = {
          status: 'error',
          percent: 100,
          error: error.message
        };
      }
    },
    (position) => {
      global.transcribeProgress[taskId] = {
        status: 'queued',
        percent: 2,
        message: `Đang chờ lượt nhận dạng (hàng đợi: ${position})...`,
        queuePosition: position
      };
    }
  ).catch((error) => {
    if (error.queueFull) {
      global.transcribeProgress[taskId] = {
        status: 'error',
        percent: 100,
        error: 'Máy chủ đang quá tải. Vui lòng thử lại sau vài phút.'
      };
    }
  });

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

// 4. Dub & Export (Async background task — the HTTP request returns immediately
// and the frontend polls /dub-status, so slow FFmpeg runs no longer hit proxy timeouts)
global.dubProgress = global.dubProgress || {};
global.dubTasks = global.dubTasks || {};

router.post('/dub', (req, res) => {
  const { videoPath, subtitles, voice, bgVolume, ttsVolume, blurMask, blurMasks, subtitleStyle, capcutCookie, cropStyle, videoTransform, exportResolution, exportQuality, burnSubtitles } = req.body;
  if (!videoPath || !subtitles || !Array.isArray(subtitles)) {
    return res.status(400).json({ error: 'videoPath and subtitles array are required' });
  }

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Không tìm thấy tệp video gốc trên máy chủ (có thể server vừa được deploy lại). Vui lòng tải video lên lại và làm lại từ đầu.' });
  }

  const exportId = uuidv4();
  const outputPath = path.join(EXPORTS_DIR, `${exportId}.mp4`);
  console.log(`[api/dub] Starting background dubbing export ${exportId} for ${videoPath}...`);

  try {
    const ffprobe = getFfprobeCommand();
    const safeFfprobe = ffprobe.includes(' ') ? `"${ffprobe}"` : ffprobe;
    const durationCmd = `${safeFfprobe} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const duration = parseFloat(execSync(durationCmd).toString().trim()) || 0;

    if (duration > 300) {
      return res.status(400).json({ error: 'Video xuất quá dài! Thời lượng tối đa cho phép là 5 phút (300 giây).' });
    }
  } catch (error) {
    return res.status(500).json({ error: `Không đọc được thông tin video: ${error.message}` });
  }

  if (!exportQueue.hasCapacity()) {
    return res.status(503).json({
      error: 'Máy chủ đang quá tải (quá nhiều người xuất video cùng lúc). Vui lòng thử lại sau 2–3 phút.'
    });
  }

  global.dubProgress[exportId] = { status: 'queued', percent: 1, message: 'Đang chờ lượt xuất video...' };
  const cancelToken = { cancelled: false, proc: null };
  global.dubTasks[exportId] = cancelToken;
  const publicBase = getPublicBaseUrl(req);

  exportQueue.enqueue(
    exportId,
    async () => {
      if (cancelToken.cancelled) {
        throw new Error('EXPORT_CANCELLED');
      }
      global.dubProgress[exportId] = { status: 'processing', percent: 0, message: 'Khởi tạo xuất video...' };

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
        exportQuality,
        burnSubtitles: burnSubtitles !== undefined ? burnSubtitles : true,
        onProgress: ({ percent, message }) => {
          if (!cancelToken.cancelled) {
            global.dubProgress[exportId] = { status: 'processing', percent, message };
          }
        },
        cancelToken
      });

      global.dubProgress[exportId] = {
        status: 'done',
        percent: 100,
        videoUrl: getFullUrl(publicBase, `/downloads/exports/${exportId}.mp4`),
        outputPath
      };
      console.log(`[api/dub] Export ${exportId} completed successfully.`);
    },
    (position) => {
      global.dubProgress[exportId] = {
        status: 'queued',
        percent: 1,
        message: `Đang chờ lượt xuất video (hàng đợi: ${position})...`,
        queuePosition: position
      };
    }
  ).catch((error) => {
    if (error.queueFull) {
      global.dubProgress[exportId] = {
        status: 'error',
        percent: 100,
        error: 'Máy chủ đang quá tải. Vui lòng thử lại sau vài phút.'
      };
    } else if (cancelToken.cancelled || error.message === 'EXPORT_CANCELLED') {
      console.log(`[api/dub] Export ${exportId} cancelled by user.`);
      global.dubProgress[exportId] = { status: 'cancelled', percent: 100, message: 'Đã hủy xuất video.' };
    } else {
      console.error(`[api/dub] Export ${exportId} failed:`, error.message);
      global.dubProgress[exportId] = { status: 'error', percent: 100, error: error.message };
    }
  }).finally(() => {
    delete global.dubTasks[exportId];
  });

  res.json({ success: true, exportId });
});

// Cancel a running dubbing export
router.post('/dub-cancel', (req, res) => {
  const { exportId } = req.body;
  if (!exportId) {
    return res.status(400).json({ error: 'exportId is required' });
  }

  const task = global.dubTasks[exportId];
  if (!task) {
    return res.status(404).json({ error: 'Tác vụ xuất video không tồn tại hoặc đã kết thúc.' });
  }

  const queueResult = exportQueue.cancel(exportId);
  if (queueResult.removed) {
    delete global.dubTasks[exportId];
    global.dubProgress[exportId] = { status: 'cancelled', percent: 100, message: 'Đã hủy xuất video.' };
    console.log(`[api/dub-cancel] Export ${exportId} removed from queue.`);
    return res.json({ success: true });
  }

  task.cancelled = true;
  if (task.proc) {
    try { task.proc.kill('SIGKILL'); } catch (e) { console.warn('[api/dub-cancel] Failed to kill ffmpeg:', e.message); }
  }
  global.dubProgress[exportId] = { status: 'cancelled', percent: 100, message: 'Đã hủy xuất video.' };
  console.log(`[api/dub-cancel] Export ${exportId} cancellation requested.`);
  res.json({ success: true });
});

// Poll dubbing export progress
router.get('/dub-status', (req, res) => {
  const { exportId } = req.query;
  if (!exportId) {
    return res.status(400).json({ error: 'exportId is required' });
  }

  const progress = global.dubProgress[exportId];
  if (!progress) {
    return res.status(404).json({ error: 'Export task not found' });
  }

  res.json(progress);
});

// Server load / queue status (for monitoring when many users are active)
router.get('/server-status', (req, res) => {
  res.json({
    ok: true,
    export: exportQueue.getStats(),
    transcribe: transcribeQueue.getStats()
  });
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

    res.json({
      success: true,
      audioUrl: getFullUrl(req, `/downloads/temp_tts/${filename}`)
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
  const safeFfmpeg = ffmpeg.includes(' ') ? `"${ffmpeg}"` : ffmpeg;
  const safeFfprobe = ffprobe.includes(' ') ? `"${ffprobe}"` : ffprobe;

  try {
    // 1. Get original video duration using ffprobe
    const durationCmd = `${safeFfprobe} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const originalDuration = parseFloat(execSync(durationCmd).toString().trim()) || 0;

    // 2. Perform splitting
    const outputPattern = path.join(splitDirPath, `part_%03d${videoExt}`);
    
    // Command: ffmpeg -i input -f segment -segment_time S -reset_timestamps 1 -c copy -map 0 output_%03d.mp4
    // We execute this synchronously
    const { execSync: cpExecSync } = require('child_process');
    const splitCmd = `${safeFfmpeg} -y -i "${videoPath}" -f segment -segment_time ${segmentSeconds} -reset_timestamps 1 -c copy -map 0 "${outputPattern}"`;
    cpExecSync(splitCmd);

    // 3. Read output files
    const files = fs.readdirSync(splitDirPath);
    const segments = [];

    files.sort().forEach((file, index) => {
      const filePath = path.join(splitDirPath, file);

      const segDurationCmd = `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
      const duration = parseFloat(cpExecSync(segDurationCmd).toString().trim()) || 0;

      const fileUrl = getFullUrl(req, `/downloads/exports/${splitDirName}/${file}`);

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

    res.json({
      success: true,
      videoId,
      videoUrl: getFullUrl(req, `/downloads/videos/${videoId}${videoExt}`),
      audioUrl: getFullUrl(req, `/downloads/audios/${videoId}.mp3`),
      videoPath: targetVideoPath,
      audioPath
    });
  } catch (error) {
    console.error('Failed to load split segment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

