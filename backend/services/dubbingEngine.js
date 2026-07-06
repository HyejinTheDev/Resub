const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { EdgeTTS } = require('node-edge-tts');

// Mappings for FFmpeg video quality preset & CRF (Constant Rate Factor)
const qualityCrfMap = {
  high: '18',
  medium: '23',
  low: '28'
};

const presetMap = {
  high: 'medium',
  medium: 'superfast',
  low: 'ultrafast'
};

function fetchUrl(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buffer.toString('utf8'),
          raw: buffer
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(body);
    }
    req.end();
  });
}



// Paths to Python and FFmpeg
const venvPath = path.join(__dirname, '..', '..', '..', 'oneclick-subtitles-generator', '.venv');
const pythonExecutable = process.platform === 'win32'
  ? path.join(venvPath, 'Scripts', 'python.exe')
  : path.join(venvPath, 'bin', 'python');

/**
 * Helper to get the ffmpeg command.
 * It will try to use the ffmpeg bundled in node_modules of the parent project first.
 */
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

function getFfprobeCommand() {
  const ffmpeg = getFfmpegCommand();
  if (ffmpeg === 'ffmpeg') return 'ffprobe';
  
  const ffprobeWin = ffmpeg.replace('ffmpeg.exe', 'ffprobe.exe');
  if (fs.existsSync(ffprobeWin)) return ffprobeWin;
  
  const ffprobeLinux = ffmpeg.replace('ffmpeg', 'ffprobe');
  if (fs.existsSync(ffprobeLinux)) return ffprobeLinux;
  
  return 'ffprobe';
}

/**
 * Run a command asynchronously and capture stdout (non-blocking, keeps the event loop free)
 */
function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.substring(0, 300) || `Command failed with code ${code}`));
    });
  });
}

async function getVideoDimensions(videoPath) {
  try {
    const ffprobe = getFfprobeCommand();
    const output = await runCommand(ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      videoPath
    ]);
    const data = JSON.parse(output);
    if (data.streams && data.streams[0]) {
      return {
        width: parseInt(data.streams[0].width) || 1280,
        height: parseInt(data.streams[0].height) || 720
      };
    }
  } catch (e) {
    console.error('[getVideoDimensions] Error querying video resolution:', e.message);
  }
  return { width: 1280, height: 720 };
}

const CAPCUT_VOICES = {
  'capcut-nhongotngao': { speaker: 'BV421_vivn_streaming', item_id: '7252594014782755330' },
  'capcut-nuphothong': { speaker: 'vi_female_huong', item_id: '7264854897953083905' },
  'capcut-giongbe': { speaker: 'BV074_streaming_dsp', item_id: '7550087831092251920' },
  'capcut-cogaihoatngon': { speaker: 'BV074_streaming', item_id: '7102355709945188865' },
  'capcut-vietmeo': { speaker: 'BV075_streaming_vibrato_dsp', item_id: '7569450639810465040' },
  'capcut-mai': { speaker: 'BV562_streaming', item_id: '7483736254694035984' },
  'capcut-banmai': { speaker: 'multi_female_yangguangnv_uranus_bigtts', item_id: '7637456432522218773' },
  'capcut-review1': { speaker: 'multi_female_richgirl_uranus_bigtts', item_id: '7637460351541447956' },
  'capcut-bantin1': { speaker: 'multi_female_quanweinv_uranus_bigtts', item_id: '7637458743197732117' },
  'capcut-review4': { speaker: 'multi_female_stokie_uranus_bigtts', item_id: '7637456729696996628' },
  'capcut-review3': { speaker: 'multi_female_daqi_uranus_bigtts', item_id: '7637451983389019409' },
  'capcut-review2': { speaker: 'multi_female_xyf04auto_uranus_bigtts', item_id: '7637458743197732117' },
  'capcut-bantinnu': { speaker: 'multi_female_sisi_uranus_bigtts', item_id: '7637455857285860629' },
  'capcut-sunnyidol': { speaker: 'multi_female_kiwi_uranus_bigtts', item_id: '7637457995882089749' },
  'capcut-kennydaide': { speaker: 'BV075_streaming_demon_dsp', item_id: '7569442422665661712' }
};


async function generateCapCutTTS(text, voiceKey, outputPath, capcutCookie) {
  if (!capcutCookie) {
    throw new Error('Bạn cần nhập Cookie CapCut ở thanh menu trên cùng để sử dụng giọng nói này.');
  }

  // Sanitize and format cookie string if it's pasted in a multiline / key-value format
  let sanitizedCookie = capcutCookie.trim();
  if (sanitizedCookie.includes('\n') || sanitizedCookie.includes('\r')) {
    const lines = sanitizedCookie.split(/[\r\n]+/);
    const parsedPairs = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Handle "Key: Value" or "Key=Value" format
      let separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        separatorIndex = line.indexOf('=');
      }
      if (separatorIndex !== -1) {
        const key = line.substring(0, separatorIndex).trim();
        const val = line.substring(separatorIndex + 1).trim();
        if (key && val) {
          if (key.toLowerCase() === 'cookie') {
            parsedPairs.push(val);
          } else {
            parsedPairs.push(`${key}=${val}`);
          }
        }
      } else {
        parsedPairs.push(line);
      }
    }
    sanitizedCookie = parsedPairs.join('; ');
  }

  const voiceConfig = CAPCUT_VOICES[voiceKey];
  if (!voiceConfig) {
    throw new Error(`Unsupported CapCut voice key: ${voiceKey}`);
  }

  const body = {
    texts: [text],
    tts_conf: {
      speaker: voiceConfig.speaker,
      rate: 1,
      volume: 100,
      name: voiceKey,
      platform: "sami",
      effect_id: voiceConfig.item_id,
      resource_id: voiceConfig.item_id,
      is_clone: false
    },
    need_url: true
  };

  const payloadText = JSON.stringify(body);
  const payloadBuffer = Buffer.from(payloadText, 'utf8');

  const deviceTime = Math.floor(Date.now() / 1000);
  const pathPart = 'latform';
  const pf = '7';
  const appvr = '8.4.0';
  const tdid = '';

  // Generate MD5 signature
  const signStr = `9e2c|${pathPart}|${pf}|${appvr}|${deviceTime}|${tdid}|11ac`;
  const sign = crypto.createHash('md5').update(signStr).digest('hex');

  const headers = {
    'Cookie': sanitizedCookie,
    'Content-Type': 'application/json',
    'Content-Length': payloadBuffer.length,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Origin': 'https://www.capcut.com',
    'Referer': 'https://www.capcut.com/',
    'did': '7655937363961415189',
    'sign-ver': '1',
    'sign': sign,
    'pf': pf,
    'store-country-code': 'vn',
    'store-country-code-src': 'uid',
    'appvr': appvr,
    'appid': '348188',
    'device-time': String(deviceTime)
  };

  const response = await fetchUrl('https://edit-api-sg.capcut.com/storyboard/v1/tts/multi_platform', 'POST', headers, payloadBuffer);

  if (response.statusCode !== 200) {
    throw new Error(`CapCut TTS Request failed: ${response.statusCode} - ${response.body}`);
  }

  const json = JSON.parse(response.body);
  if (json.ret !== '0' && json.ret !== 0) {
    throw new Error(`CapCut TTS API error: ${json.errmsg || 'Unknown error'}`);
  }

  if (!json.data || !json.data.tts_materials || !json.data.tts_materials[0]) {
    throw new Error('CapCut TTS API did not return any audio materials');
  }

  const metaData = json.data.tts_materials[0].meta_data;
  if (!metaData || !metaData.url) {
    console.error('[CapCutTTS] Response missing audio URL. tts_materials[0]:', JSON.stringify(json.data.tts_materials[0]).substring(0, 500));
    throw new Error('CapCut không trả về file âm thanh. Cookie CapCut có thể đã hết hạn hoặc tài khoản bị giới hạn — hãy đăng nhập lại capcut.com, lấy cookie mới và dán vào thanh menu trên cùng. Hoặc chuyển sang giọng Edge TTS (Hoài My / Nam Minh) để không cần cookie.');
  }

  const audioUrl = metaData.url;
  
  // Download the generated mp3 file
  const downloadRes = await fetchUrl(audioUrl, 'GET');
  if (downloadRes.statusCode !== 200) {
    throw new Error(`Failed to download audio from CapCut: Status ${downloadRes.statusCode}`);
  }

  fs.writeFileSync(outputPath, downloadRes.raw);
  return outputPath;
}

async function generateTTS(text, voice = 'vi-VN-HoaiMyNeural', outputPath, capcutCookie = '') {
  const cleanText = (text || '').trim();
  const cleanVoice = (voice || '').trim();
  
  // Calculate unique MD5 hash for cache file
  const hashInput = `${cleanText}_${cleanVoice}_${voice.startsWith('capcut-') ? capcutCookie : ''}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex');
  
  const cacheDir = path.join(__dirname, '..', 'cache', 'tts');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const cacheFilePath = path.join(cacheDir, `${hash}.mp3`);

  // Return cached file if it exists
  if (fs.existsSync(cacheFilePath)) {
    console.log(`[dubbingEngine] TTS Cache hit for: "${cleanText.substring(0, 30)}..."`);
    fs.copyFileSync(cacheFilePath, outputPath);
    return outputPath;
  }

  // Generate new TTS file
  if (voice.startsWith('capcut-')) {
    const defaultCookie = 'cc-target-idc=alisg; _ga=GA1.1.758113441.1782660555; _gcl_au=1.1.697862753.1782660555; _clck=6r9cr3%5E2%5Eg7a%5E0%5E2370; passport_csrf_token=680544f5d53dcfe4722595fa8ab152f9; passport_csrf_token_default=680544f5d53dcfe4722595fa8ab152f9; sid_guard=ee433bc57971be6a1bc12c578351fcbf%7C1782660585%7C5183997%7CThu%2C+27-Aug-2026+15%3A29%3A42+GMT; uid_tt=1f4510bb0a476c262aed61654df5ad56687974176b0857325a834d349ad75905; uid_tt_ss=1f4510bb0a476c262aed61654df5ad56687974176b0857325a834d349ad75905; sid_tt=ee433bc57971be6a1bc12c578351fcbf; sessionid=ee433bc57971be6a1bc12c578351fcbf; sessionid_ss=ee433bc57971be6a1bc12c578351fcbf; tt_session_tlb_tag=sttt%7C5%7C7kM7xXlxvmobwSxXg1H8v__________38NMLmmB1BSD6gpiHjOpLPo50huFVuAArc4O8tbXtuZ4%3D; sid_ucp_v1=1.0.1-KGYxYTU4OWVhMzE5NmYzZjZkOGU4ZTdjZTNmYzZhY2JmYmJkYzMyOTAKGAiBiKLo3ZyhzWEQ6fuE0gYYnKAVOAhAEhADGgNzZzEiIGVlNDMzYmM1Nzk3MWJlNmExYmMxMmM1NzgzNTFmY2JmMk4K IGNesXd0_HrrO0wdJPTy0JAu-8i6a_4kHlqfW6hDMmH4EiBS_sglF0zcJgqoVQ5f9IG6cNhx0o-lPV8hZCOn7-KuNBgFIgZ0aTikdG9r; ssid_ucp_v1=1.0.1-KGYxYTU4OWVhMzE5NmYzZjZkOGU4ZTdjZTNmYzZhY2JmYmJkYzMyOTAKGAiBiKLo3ZyhzWEQ6fuE0gYYnKAVOAhAEhADGgNzZzEiIGVlNDMzYmM1Nzk3MWJlNmExYmMxMmM1NzgzNTFmY2JmMk4K IGNesXd0_HrrO0wdJPTy0JAu-8i6a_4kHlqfW6hDMmH4EiBS_sglF0zcJgqoVQ5f9IG6cNhx0o-lPV8hZCOn7-KuNBgFIgZ0aTikdG9r; store-idc=alisg; store-country-code=vn; store-country-code-src=uid; tt-target-idc-sign=f8f5UiLL6bUPkIa32X7SAfIR1Qi1PPugbo2OE43l2GmSmdUb6z6UF9URCPeNDnedeq_Z9JAsHifWPUop6xCWfushtuz8bQHyvIbelBMFuInCqIZFZD85JmbNUDetGL3kLqUtIhtNiyWuhN0Kq7BZntbiHIANh_eU7g1d5Gupj4ZMGU5AElkz2mRGKYtm-RSjIBCRbTL8skX5rwxkKwF4H-1Hxno1z41QdtM130jdh3FoDdjMTLfozt6cvCzYE4-6h0oJMNcabZUIdjfTWuqGH46l3CcGY-X9lllAa1WjIe52xx4N0r8ha7XaeV0buqzLfvmHTYxcEgR8CRB8OZSYXcQS1YUDNUKWpKPcsK7RrVS73Y5qjAbSF-5iYgyiWb4KcwBbOELXn6JYLo8DMzvO6OuD8Y-VBDPnKnBkfhuo4hfyMfOsjWThnAouct61QvihsJ-gEg2xYKZL23AHjMhA3vmjLrC5qrip8MQsGYEEFUiS3Bpu4dHfZe4ci9i-wtfQ; ttwid=1|dSLmVau6HRclrs_xwlkbJbMhF8PfKFZgnEzI_fWhB4g|1782661129|df186e20ad3163aeeb628818fcf4319a833b914c0456951d1f4404cb602979f1; uifid=880181825689a65dfe6540b38551a1e0e995268b4ab4878fcaae61561e88e935868b130dd81adfc707e1a7077262332f42f9e2b84119c78200b833ea7338648bea1519f7194acda2fc6a363e822895d33a537dfeeea0f79858925edbed988b7368593dadf1c5fc4495201de17508d0219af774d6fbca7ddd074266b96ab58e6c080a1390e9b253da5b1555231db714cc5cb154697762c9d9a4a9b475ea3569c1a6d3ca64a6fc403a07c22715240e8e14; _ga_8CN68HEXH2=GS2.1.s1782660554$o1$g1$t1782661133$j59$l0$h0; _ga_F9J0QP63RB=GS2.1.s1782660554$o1$g1$t1782661133$j59$l0$h0; _uetsid=1f4a3150730611f1bb3507d73c58e71a; _uetvid=1f4abd50730611f1825c23d3f81a39ee; odin_tt=b099ac73b5d0c077a2f550581deed70ae374b0b62474af56639e1afbeee3ce9f09c3ef08acbb2cf543a8f7fbe6337fdb44b392462fe3372fb452adc3b33fb6b5; _clsk=1i7oywh%5E1782661142970%5E2%5E0%5Ef.clarity.ms%2Fcollect; msToken=zWzpZk5OZH4e-ycHZCnBTlCq1ZNWbnPc4gMaSrUInnobh9p8xBHkwOXxtQXbaZYdVs5neInDfY6kq2CG5frVcjlyZse_1ZE9nyGNNV3z1yXb8aoLMXNf__ueceA=; store-country-sign=MEIEDCg8Q6gSQ4b3BQQw4QQgmqrounI-nopq1ju-pkzWAveP2YuBM9LYfwG9aJBzLP0EEBO4iSeiixhpkF1AUMy6YcQ';
    const cookie = capcutCookie || process.env.CAPCUT_COOKIE || defaultCookie;
    await generateCapCutTTS(cleanText, voice, outputPath, cookie);
  } else {
    const cleanVoiceName = cleanVoice.replace('edge-', '');
    const tts = new EdgeTTS({
      voice: cleanVoiceName,
      lang: cleanVoiceName.substring(0, 5), // e.g. 'vi-VN'
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
    });
    await tts.ttsPromise(cleanText, outputPath);
  }

  // Save to cache for subsequent exports
  if (fs.existsSync(outputPath)) {
    fs.copyFileSync(outputPath, cacheFilePath);
  }
  return outputPath;
}

/**
 * Check whether the video file contains an audio stream.
 */
async function videoHasAudioStream(videoPath) {
  try {
    const ffprobe = getFfprobeCommand();
    const output = await runCommand(ffprobe, [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      videoPath
    ]);
    return output.trim() === 'audio';
  } catch {
    return false;
  }
}

/**
 * Run FFmpeg and surface stderr on failure (supports cancelToken).
 */
function runFfmpeg(ffmpeg, args, cancelToken, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, cwd ? { cwd } : undefined);
    if (cancelToken) cancelToken.proc = proc;
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (cancelToken) cancelToken.proc = null;
      if (cancelToken?.cancelled) reject(new Error('EXPORT_CANCELLED'));
      else if (code === 0) resolve(stderr);
      else reject(new Error(`FFmpeg failed with code ${code}. Stderr: ${stderr.substring(stderr.length - 500)}`));
    });
  });
}

const TTS_MIX_BATCH_SIZE = 40;
const AUDIO_BATCH_CONCURRENCY = 2;
const INTERMEDIATE_AUDIO_ARGS = ['-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2'];

/**
 * Estimate MP3 duration from file size (Edge TTS = 48kbps mono). Falls back to ffprobe.
 */
async function getMediaDurationFast(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    if (stat.size < 64) return 0;
    if (ext === '.mp3') {
      // Edge TTS uses 48k bitrate; CapCut/other MP3 is usually >= 64k
      const bitrate = stat.size < 20000 ? 48000 : 128000;
      return (stat.size * 8) / bitrate;
    }
  } catch { /* fall through */ }
  return getAudioDuration(filePath);
}

async function mixOneTtsBatch(ffmpeg, batch, startIndex, ttsVolume, cwd, cancelToken) {
  const batchPath = path.join(cwd, `tts_batch_${startIndex}.wav`);
  const args = ['-y'];
  batch.forEach((file) => args.push('-i', file.path));

  let graph = '';
  batch.forEach((file, idx) => {
    graph += `[${idx}:a]adelay=${file.startMs}|${file.startMs},volume=${ttsVolume}[a${idx}];`;
  });
  const labels = batch.map((_, idx) => `[a${idx}]`).join('');
  graph += `${labels}amix=inputs=${batch.length}:duration=longest:dropout_transition=0:normalize=0[batch]`;
  args.push('-filter_complex', graph, '-map', '[batch]', ...INTERMEDIATE_AUDIO_ARGS, batchPath);
  await runFfmpeg(ffmpeg, args, cancelToken, cwd);
  return batchPath;
}

/**
 * Mix many delayed TTS tracks in batches so FFmpeg amix stays reliable.
 */
async function mixTtsTracksBatched(ffmpeg, ttsFiles, ttsVolume, outputPath, cancelToken, cwd) {
  if (ttsFiles.length === 0) return;

  const jobs = [];
  for (let start = 0; start < ttsFiles.length; start += TTS_MIX_BATCH_SIZE) {
    jobs.push({ batch: ttsFiles.slice(start, start + TTS_MIX_BATCH_SIZE), start });
  }

  const batchPaths = new Array(jobs.length);
  let jobIdx = 0;
  const batchWorker = async () => {
    while (jobIdx < jobs.length) {
      const i = jobIdx++;
      const job = jobs[i];
      batchPaths[i] = await mixOneTtsBatch(ffmpeg, job.batch, job.start, ttsVolume, cwd, cancelToken);
    }
  };
  const workers = Math.min(AUDIO_BATCH_CONCURRENCY, jobs.length);
  await Promise.all(Array.from({ length: workers }, () => batchWorker()));

  if (batchPaths.length === 1) {
    fs.copyFileSync(batchPaths[0], outputPath);
    return;
  }

  const args = ['-y'];
  batchPaths.forEach((p) => args.push('-i', p));
  const inputs = batchPaths.map((_, idx) => `[${idx}:a]`).join('');
  const graph = `${inputs}amix=inputs=${batchPaths.length}:duration=longest:dropout_transition=0:normalize=0[aout]`;
  args.push('-filter_complex', graph, '-map', '[aout]', ...INTERMEDIATE_AUDIO_ARGS, outputPath);
  await runFfmpeg(ffmpeg, args, cancelToken, cwd);
}

/**
 * Pass A: background audio + all TTS tracks → mixed_audio.m4a
 */
async function buildMixedAudio(ffmpeg, videoPath, ttsFiles, bgVolume, ttsVolume, mixedAudioPath, cancelToken, cwd) {
  const hasAudio = await videoHasAudioStream(videoPath);
  const videoDurSec = await getAudioDuration(videoPath);
  const safeDur = Math.max(1, Math.ceil(videoDurSec || 60));

  const ttsMixedPath = path.join(cwd, 'tts_only.wav');
  if (ttsFiles.length > 0) {
    await mixTtsTracksBatched(ffmpeg, ttsFiles, ttsVolume, ttsMixedPath, cancelToken, cwd);
  }

  const args = ['-y'];
  if (hasAudio) {
    args.push('-i', videoPath);
  } else {
    args.push('-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:d=${safeDur}`);
  }

  let graph;
  if (ttsFiles.length > 0) {
    args.push('-i', ttsMixedPath);
    graph = `[0:a]volume=${bgVolume}[bg];[1:a]volume=1.0[tts];[bg][tts]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]`;
  } else {
    graph = `[0:a]volume=${bgVolume}[aout]`;
  }

  args.push('-filter_complex', graph, '-map', '[aout]', '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', mixedAudioPath);
  await runFfmpeg(ffmpeg, args, cancelToken, cwd);

  const stat = fs.statSync(mixedAudioPath);
  if (stat.size < 500) {
    throw new Error('Trộn âm thanh thất bại: file audio rỗng. Hãy thử xuất lại.');
  }
  const mixedDur = await getAudioDuration(mixedAudioPath);
  if (mixedDur < 0.3) {
    throw new Error('Trộn âm thanh thất bại: thời lượng audio quá ngắn. Hãy thử xuất lại.');
  }
}

/**
 * Get Audio Duration in seconds using ffprobe (async, non-blocking)
 */
async function getAudioDuration(filePath) {
  try {
    const stdout = await runCommand(getFfprobeCommand(), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    return parseFloat(stdout.trim()) || 0;
  } catch (err) {
    console.error('Error getting audio duration:', err.message);
    return 0;
  }
}

/**
 * Adjust audio speed using FFmpeg's atempo filter
 */
async function adjustAudioSpeed(inputPath, outputPath, speed) {
  return new Promise((resolve, reject) => {
    // Clamp speed between 0.5 and 2.0 (FFmpeg limit for atempo)
    const clampedSpeed = Math.min(Math.max(speed, 0.5), 2.0);
    const ffmpeg = getFfmpegCommand();
    
    // If speed is very close to 1.0, just copy the file
    if (Math.abs(clampedSpeed - 1.0) < 0.05) {
      try {
        fs.copyFileSync(inputPath, outputPath);
        return resolve(outputPath);
      } catch (err) {
        return reject(err);
      }
    }

    const args = [
      '-y',
      '-i', inputPath,
      '-filter:a', `atempo=${clampedSpeed.toFixed(2)}`,
      outputPath
    ];

    const proc = spawn(ffmpeg, args);
    proc.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg atempo failed with code ${code}`));
    });
  });
}

/**
 * Parse time string (e.g. 00m02s500ms or 0:02.50) into milliseconds
 */
function parseTimeToMs(timeStr) {
  if (typeof timeStr === 'number') return timeStr * 1000;
  if (!timeStr) return 0;
  
  // Format: 00m02s500ms
  const match = timeStr.match(/(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?/);
  if (match && (match[1] || match[2] || match[3])) {
    const mins = parseInt(match[1] || '0', 10);
    const secs = parseInt(match[2] || '0', 10);
    const ms = parseInt(match[3] || '0', 10);
    return mins * 60 * 1000 + secs * 1000 + ms;
  }

  // Format: 0:02.50
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secsParts = parts[1].split('.');
    const secs = parseInt(secsParts[0], 10);
    const ms = parseInt(secsParts[1] || '0', 10) * (secsParts[1]?.length === 2 ? 10 : 1);
    return mins * 60 * 1000 + secs * 1000 + ms;
  }

  return parseFloat(timeStr) * 1000 || 0;
}

/**
 * Format milliseconds into SRT timestamp (HH:MM:SS,mmm)
 */
function formatMsToSrtTime(ms) {
  const date = new Date(ms);
  const hours = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

/**
 * Generate SRT file from subtitles array
 */
function generateSrtFile(subtitles, srtPath) {
  const content = subtitles.map((sub, index) => {
    const startMs = parseTimeToMs(sub.startTime);
    const endMs = parseTimeToMs(sub.endTime);
    return `${index + 1}\n${formatMsToSrtTime(startMs)} --> ${formatMsToSrtTime(endMs)}\n${sub.text}\n`;
  }).join('\n');
  fs.writeFileSync(srtPath, content, 'utf-8');
}

/**
 * Format milliseconds into ASS timestamp (H:MM:SS.cc)
 */
function formatMsToAssTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Generate an ASS subtitle file where every line is anchored with \an5\pos at the
 * exact center point the editor preview uses — so burned-in subtitles match the
 * position, size and wrap width seen while editing.
 */
function generateAssFile(subtitles, assPath, { width, height, fontSize, style }) {
  const s = style || {};
  const primary = hexToAssColor(s.color || '#ffffff');
  const isBoxPreset = s.textColorPreset && s.textColorPreset.includes('-bg');
  const borderStyle = isBoxPreset ? 3 : 1;
  const outlineColour = isBoxPreset ? '&H80000000' : hexToAssColor(s.outlineColor || '#000000');
  const outline = isBoxPreset ? 2 : (s.outlineWidth !== undefined ? s.outlineWidth : 3.5);
  const bold = s.bold ? -1 : 0;
  const italic = s.italic ? -1 : 0;

  const xPercent = s.xPercent !== undefined ? s.xPercent : 50;
  const yPercent = s.yPercent !== undefined ? s.yPercent : 85;
  const wPercent = s.widthPercent !== undefined ? s.widthPercent : 80;
  const cx = Math.round(width * xPercent / 100);
  const cy = Math.round(height * yPercent / 100);
  // Wrap width comes from left/right margins; \pos only moves the anchor point
  const marginH = Math.max(0, Math.round(((100 - wPercent) / 2) / 100 * width));

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,Arial,${fontSize},${primary},&H000000FF,${outlineColour},&H80000000,${bold},${italic},0,0,100,100,0,0,${borderStyle},${outline},2.5,5,${marginH},${marginH},0,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ].join('\n');

  const events = subtitles.map((sub) => {
    const startMs = parseTimeToMs(sub.startTime);
    const endMs = parseTimeToMs(sub.endTime);
    const cleanText = String(sub.text || '')
      .replace(/[{}]/g, '')
      .replace(/\r?\n/g, ' ');

    const baseSize = fontSize;
    const wPercent = s.widthPercent !== undefined ? s.widthPercent : 80;
    const allowedWidth = Math.round(width * wPercent / 100);
    const approxTextWidth = cleanText.length * baseSize * 0.52;
    
    let lineFontSize = baseSize;
    if (approxTextWidth > allowedWidth && cleanText.length > 0) {
      lineFontSize = Math.max(6, Math.floor(allowedWidth / (cleanText.length * 0.52)));
    }

    return `Dialogue: 0,${formatMsToAssTime(startMs)},${formatMsToAssTime(endMs)},Default,,0,0,0,,{\\an5\\pos(${cx},${cy})\\fs${lineFontSize}}${cleanText}`;
  }).join('\n');

  fs.writeFileSync(assPath, `${header}\n${events}\n`, 'utf-8');
}

function hexToAssColor(hex) {
  if (!hex || hex === 'transparent') return '&HFF000000';
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}`;
}

/**
 * Mix TTS audios at correct offsets and burn-in subtitles into the video
 */
async function exportDubbedVideo({
  videoPath,
  subtitles,
  voice = 'vi-VN-HoaiMyNeural',
  outputPath,
  bgVolume = 0.15,
  ttsVolume = 1.0,
  blurMask,
  blurMasks,
  subtitleStyle,
  cropStyle,
  videoTransform,
  capcutCookie,
  exportResolution = 'original',
  exportQuality = 'medium',
  burnSubtitles = true,
  onProgress = () => {},
  cancelToken = { cancelled: false, proc: null }
}) {
  const tempDir = path.join(os.tmpdir(), `resub_export_${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const ffmpeg = getFfmpegCommand();

  try {
    // 1. Generate & speed-adjust TTS for all segments in parallel batches.
    // CapCut voices get a lower concurrency to avoid tripping their rate limit.
    const ttsTasks = [];
    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i];
      const startMs = parseTimeToMs(sub.startTime);
      const endMs = parseTimeToMs(sub.endTime);
      const originalDuration = (endMs - startMs) / 1000;
      if (originalDuration <= 0) continue;
      ttsTasks.push({ index: i, sub, startMs, originalDuration, path: null });
    }

    const usesCapcutVoice = ttsTasks.some(t => (t.sub.voice || voice).startsWith('capcut-'));
    const concurrency = Math.max(1, Math.min(usesCapcutVoice ? 4 : 10, ttsTasks.length));
    let completedCount = 0;
    let nextTaskIdx = 0;

    const ttsWorker = async () => {
      while (nextTaskIdx < ttsTasks.length) {
        if (cancelToken.cancelled) {
          throw new Error('EXPORT_CANCELLED');
        }
        const task = ttsTasks[nextTaskIdx++];
        const rawTtsPath = path.join(tempDir, `tts_${task.index}_raw.mp3`);
        const speedTtsPath = path.join(tempDir, `tts_${task.index}_speed.mp3`);

        await generateTTS(task.sub.text, task.sub.voice || voice, rawTtsPath, capcutCookie);
        const ttsDuration = await getMediaDurationFast(rawTtsPath);

        // Speed up TTS when it overflows the original subtitle interval
        let speed = 1.0;
        if (ttsDuration > task.originalDuration) {
          speed = ttsDuration / task.originalDuration;
        }
        if (Math.abs(speed - 1.0) < 0.05) {
          task.path = rawTtsPath;
        } else {
          await adjustAudioSpeed(rawTtsPath, speedTtsPath, speed);
          task.path = speedTtsPath;
        }
        completedCount++;
        // TTS generation covers 0-55% of overall progress
        onProgress({
          percent: Math.round((completedCount / ttsTasks.length) * 55),
          message: `Đang tạo giọng đọc: ${completedCount}/${ttsTasks.length} câu...`
        });
      }
    };

    if (ttsTasks.length > 0) {
      await Promise.all(Array.from({ length: concurrency }, () => ttsWorker()));
    }

    const ttsFiles = ttsTasks.filter(t => t.path).map(t => ({ index: t.index, startMs: t.startMs, path: t.path }));

    // 2. Pass A: mix background audio + all delayed TTS tracks into ONE audio file.
    // Audio-only processing is fast, and it keeps the heavy video pass down to 2 inputs.
    if (cancelToken.cancelled) {
      throw new Error('EXPORT_CANCELLED');
    }
    onProgress({ percent: 56, message: 'Đang trộn giọng đọc với nhạc nền...' });

    const mixedAudioPath = path.join(tempDir, 'mixed_audio.m4a');
    await buildMixedAudio(ffmpeg, videoPath, ttsFiles, bgVolume, ttsVolume, mixedAudioPath, cancelToken, tempDir);

    // Video filter graph (transform, blur, crop, scale, subtitles) is built below;
    // segments are appended with a leading ';' and the first one is stripped before use.
    let filterGraph = '';

    // Get original video dimensions to calculate accurate margins and crop sizes
    const originalDimensions = await getVideoDimensions(videoPath);
    let targetWidth = originalDimensions.width;
    let targetHeight = originalDimensions.height;

    if (cropStyle && cropStyle.aspectRatio !== 'original') {
      const wPercent = cropStyle.widthPercent !== undefined ? cropStyle.widthPercent : 100;
      const hPercent = cropStyle.heightPercent !== undefined ? cropStyle.heightPercent : 100;
      targetWidth = Math.round(originalDimensions.width * wPercent / 100);
      targetHeight = Math.round(originalDimensions.height * hPercent / 100);
    }

    // Adjust target dimensions if exportResolution is specified
    if (exportResolution && exportResolution !== 'original') {
      const heightMap = {
        '1080p': 1080,
        '720p': 720,
        '480p': 480
      };
      const targetH = heightMap[exportResolution];
      if (targetH) {
        const ratio = targetWidth / targetHeight;
        targetHeight = targetH;
        targetWidth = Math.round(targetH * ratio);
      }
    }

    // 4. Subtitle file generation — ASS with exact anchor point matching the preview.
    // The editor preview renders inside a 480px-wide container, so a CSS font of
    // `fs` px corresponds to fs/480 of the video WIDTH.
    const cssFontSize = (subtitleStyle && subtitleStyle.fontSize) || 10;
    const assFontSize = Math.max(6, Math.round(((cssFontSize + 12) * 0.7) * (targetWidth / PREVIEW_WIDTH)));

    const assPath = path.join(tempDir, 'subtitles.ass');
    generateAssFile(subtitles, assPath, {
      width: targetWidth,
      height: targetHeight,
      fontSize: assFontSize,
      style: subtitleStyle
    });

    // Process blur segments on original video size
    const { zoom = 100, xOffset = 0, yOffset = 0, rotation = 0 } = videoTransform || {};
    const hasTransform = zoom !== 100 || xOffset !== 0 || yOffset !== 0 || rotation !== 0;

    let currentVInput = '0:v';
    let filterIndex = 0;

    if (hasTransform) {
      const rotateLabel = `vrotated`;
      filterGraph += `;[0:v]scale=w=iw*${zoom}/100:h=ih*${zoom}/100,rotate=angle=${rotation}*PI/180:fillcolor=black[${rotateLabel}];`;
      filterGraph += `color=c=black:s=${originalDimensions.width}x${originalDimensions.height}[vbg];`;
      filterGraph += `[vbg][${rotateLabel}]overlay=x=(W-w)/2+W*${xOffset}/100:y=(H-h)/2+H*${yOffset}/100[vtransformed]`;
      
      currentVInput = 'vtransformed';
    }
    
    // Normalize masks list: if a single global mask is sent, convert to array format
    let activeMasks = [];
    if (Array.isArray(blurMasks)) {
      activeMasks = blurMasks;
    } else if (blurMask && blurMask.enabled) {
      activeMasks = [{
        startTime: '00m00s000ms',
        endTime: subtitles.length > 0 ? subtitles[subtitles.length - 1].endTime : '99m59s999ms',
        yPercentage: blurMask.yPercentage,
        heightPercentage: blurMask.heightPercentage,
        blurRadius: blurMask.blurRadius,
        color: blurMask.color,
        opacity: blurMask.opacity
      }];
    }

    // Scale down before blur so boxblur runs on fewer pixels (major speed win).
    if (exportResolution && exportResolution !== 'original') {
      const heightMap = {
        '1080p': 1080,
        '720p': 720,
        '480p': 480
      };
      const targetH = heightMap[exportResolution];
      if (targetH) {
        const scaleLabel = `scaled_preblur`;
        filterGraph += `;[${currentVInput}]scale=-2:${targetH}[${scaleLabel}]`;
        currentVInput = scaleLabel;
      }
    }

    const fastBlur = exportQuality === 'low';
    const blurFrameW = targetWidth;
    const blurFrameH = targetHeight;

    if (activeMasks.length > 0) {
      activeMasks.forEach(mask => {
        const start = parseTimeToMs(mask.startTime) / 1000;
        const end = parseTimeToMs(mask.endTime) / 1000;
        const x = mask.xPercentage !== undefined ? mask.xPercentage : 50;
        const y = mask.yPercentage || 80;
        const w = mask.widthPercentage !== undefined ? mask.widthPercentage : 80;
        const h = mask.heightPercentage || 15;
        const maskWpx = Math.max(2, Math.round(blurFrameW * w / 100));
        const maskHpx = Math.max(2, Math.round(blurFrameH * h / 100));
        const maxRadius = Math.max(1, Math.floor(Math.min(maskWpx, maskHpx) / 4) - 1);
        const r = Math.min(mask.blurRadius || 15, maxRadius);
        const hexColor = mask.color || '#000000';
        const userOpacity = mask.opacity !== undefined ? mask.opacity : 0.15;
        const coverOpacity = Math.min(1, Math.max(userOpacity, 0.88));
        const ffmpegColor = `0x${hexColor.slice(1)}`;

        const mainLabel = `main_${filterIndex}`;
        const cropLabel = `crop_${filterIndex}`;
        const blurredSrcLabel = `blurred_src_${filterIndex}`;
        const nextVLabel = `v_${filterIndex + 1}`;

        // Use a downscaled blur technique for a massive, extremely smooth blur that completely smears text (CapCut style)
        const scaleFactor = Math.max(0.05, Math.min(0.4, 4 / (mask.blurRadius || 15)));
        const downW = Math.max(4, Math.round(maskWpx * scaleFactor));
        const downH = Math.max(4, Math.round(maskHpx * scaleFactor));

        if (fastBlur) {
          // Fast path: single smooth blur + opaque cover, no alphamerge feather
          filterGraph += `;[${currentVInput}]split[${mainLabel}][${cropLabel}];` +
                         `[${cropLabel}]crop=w=iw*${w}/100:h=ih*${h}/100:x=iw*(${x}-${w}/2)/100:y=ih*(${y}-${h}/2)/100,` +
                         `scale=w=${downW}:h=${downH},boxblur=luma_radius=4:luma_power=3,scale=w=${maskWpx}:h=${maskHpx},` +
                         `drawbox=x=0:y=0:w=iw:h=ih:color=${ffmpegColor}@${coverOpacity}:t=fill[${blurredSrcLabel}];` +
                         `[${mainLabel}][${blurredSrcLabel}]overlay=x=W*(${x}-${w}/2)/100:y=H*(${y}-${h}/2)/100:enable='between(t,${start},${end})'[${nextVLabel}]`;
        } else {
          const toBlurLabel = `to_blur_${filterIndex}`;
          const toMaskLabel = `to_mask_${filterIndex}`;
          const alphaMaskLabel = `alpha_mask_${filterIndex}`;
          const featheredLabel = `feathered_${filterIndex}`;

          // Horizontal-only feathering: draw the white box to the top and bottom boundaries (y=0, h=ih)
          // and blur only horizontally by applying boxblur to the alpha mask.
          filterGraph += `;[${currentVInput}]split[${mainLabel}][${cropLabel}];` +
                         `[${cropLabel}]crop=w=iw*${w}/100:h=ih*${h}/100:x=iw*(${x}-${w}/2)/100:y=ih*(${y}-${h}/2)/100,split[${toBlurLabel}][${toMaskLabel}];` +
                         `[${toBlurLabel}]scale=w=${downW}:h=${downH},boxblur=luma_radius=4:luma_power=3,scale=w=${maskWpx}:h=${maskHpx},` +
                         `drawbox=x=0:y=0:w=iw:h=ih:color=${ffmpegColor}@${coverOpacity}:t=fill[${blurredSrcLabel}];` +
                         `[${toMaskLabel}]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill,drawbox=x=iw*0.06:y=0:w=iw*0.88:h=ih:color=white:t=fill,boxblur=luma_radius=${Math.max(2, Math.floor(maskWpx * 0.08))}:luma_power=3[alphaMaskLabel];` +
                         `[${blurredSrcLabel}][${alphaMaskLabel}]alphamerge[${featheredLabel}];` +
                         `[${mainLabel}][${featheredLabel}]overlay=x=W*(${x}-${w}/2)/100:y=H*(${y}-${h}/2)/100:enable='between(t,${start},${end})'[${nextVLabel}]`;
        }

        currentVInput = nextVLabel;
        filterIndex++;
      });
    }

    // Apply final crop if requested
    if (cropStyle && cropStyle.aspectRatio !== 'original') {
      const wPercent = cropStyle.widthPercent !== undefined ? cropStyle.widthPercent : 100;
      const hPercent = cropStyle.heightPercent !== undefined ? cropStyle.heightPercent : 100;
      const xVal = cropStyle.xPercent !== undefined ? cropStyle.xPercent : 50;
      const yVal = cropStyle.yPercent !== undefined ? cropStyle.yPercent : 50;
      
      const cropLabel = `cropped_final`;
      filterGraph += `;[${currentVInput}]crop=w=iw*${wPercent}/100:h=ih*${hPercent}/100:x=iw*(${xVal}-${wPercent}/2)/100:y=ih*(${yVal}-${hPercent}/2)/100[${cropLabel}]`;
      currentVInput = cropLabel;
    }

    const canCopyVideo = !burnSubtitles &&
      activeMasks.length === 0 &&
      !hasTransform &&
      (!cropStyle || cropStyle.aspectRatio === 'original') &&
      (!exportResolution || exportResolution === 'original');

    let ffmpegArgs;
    if (canCopyVideo) {
      console.log('[dubbingEngine] Subtitles and video filters are disabled. Using stream copy (-c:v copy) for instant export!');
      ffmpegArgs = [
        '-y',
        '-i', videoPath,
        '-i', mixedAudioPath,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-ac', '2',
        '-movflags', '+faststart',
        outputPath
      ];
    } else {
      // Burn-in subtitles on the final cropped stream (ass filter runs with cwd=tempDir)
      if (burnSubtitles) {
        filterGraph += `;[${currentVInput}]ass=subtitles.ass[vout]`;
      } else {
        filterGraph += `;[${currentVInput}]null[vout]`;
      }
      // Filter segments are appended with a leading ';' — strip it for a valid graph
      filterGraph = filterGraph.replace(/^;/, '');

      const crfValue = qualityCrfMap[exportQuality] || '23';
      const presetValue = presetMap[exportQuality] || 'superfast';

      ffmpegArgs = [
        '-y',
        '-i', videoPath,
        '-i', mixedAudioPath,
        '-filter_complex', filterGraph,
        '-map', '[vout]',
        '-map', '1:a:0',
        '-c:v', 'libx264',
        '-crf', crfValue,
        '-preset', presetValue,
        '-threads', '0',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-ac', '2',
        '-movflags', '+faststart',
        outputPath
      ];
    }

    if (cancelToken.cancelled) {
      throw new Error('EXPORT_CANCELLED');
    }
    console.log(`[dubbingEngine] Running FFmpeg video pass (${ttsFiles.length} TTS tracks pre-mixed)...`);
    onProgress({ percent: 60, message: 'Đang chèn phụ đề & xử lý hình ảnh (FFmpeg)...' });

    const videoDurationSec = await getAudioDuration(videoPath);

    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpeg, ffmpegArgs, { cwd: tempDir });
      // Expose the process so a cancel request can kill it mid-encode
      cancelToken.proc = proc;
      let stderr = '';
      
      proc.stderr.on('data', (d) => {
        const chunk = d.toString();
        stderr += chunk;
        // FFmpeg reports encode position as "time=HH:MM:SS.xx"; map it to 60-98%
        const timeMatch = chunk.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
        if (timeMatch && videoDurationSec > 0) {
          const encodedSec = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseInt(timeMatch[3], 10);
          const ffmpegRatio = Math.min(encodedSec / videoDurationSec, 1);
          onProgress({
            percent: Math.round(60 + ffmpegRatio * 38),
            message: `Đang xử lý video: ${Math.round(ffmpegRatio * 100)}% (FFmpeg)...`
          });
        }
      });
      proc.on('close', (code) => {
        cancelToken.proc = null;
        if (cancelToken.cancelled) reject(new Error('EXPORT_CANCELLED'));
        else if (code === 0) resolve();
        else {
          console.error('[dubbingEngine] Video pass failed. Filter graph:', filterGraph);
          reject(new Error(`FFmpeg export failed with code ${code}. Stderr: ${stderr.substring(stderr.length - 2500)}`));
        }
      });
    });

    return outputPath;
  } finally {
    // Cleanup temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up export temp directory:', e.message);
    }
  }
}

module.exports = {
  generateTTS,
  adjustAudioSpeed,
  exportDubbedVideo,
  parseTimeToMs,
  getFfmpegCommand,
  getFfprobeCommand
};
