const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { generateTTS, getFfmpegCommand, getFfprobeCommand } = require('./dubbingEngine');

const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash'
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiFailure(status, message) {
  return [429, 500, 502, 503, 504].includes(Number(status))
    || /high demand|overload|temporar|rate.?limit|resource exhausted|try again/i.test(message || '');
}

function splitImageBatches(imagePaths) {
  const batches = [];
  let batch = [];
  let batchBytes = 0;
  const maxBatchBytes = 8 * 1024 * 1024;
  const maxBatchPages = 6;
  for (const imagePath of imagePaths) {
    const imageBytes = fs.statSync(imagePath).size;
    if (batch.length > 0 && (batch.length >= maxBatchPages || batchBytes + imageBytes > maxBatchBytes)) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push(imagePath);
    batchBytes += imageBytes;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

async function analyzeComicBatch(imagePaths, apiKey, style, pageOffset, previousContext) {
  const firstPage = pageOffset + 1;
  const lastPage = pageOffset + imagePaths.length;
  const parts = [{ text: `Bạn là biên kịch review truyện tranh Việt Nam. Đây là các trang ${firstPage}-${lastPage} trong một bộ truyện dài. Hãy đọc đúng thứ tự, hiểu diễn biến và viết lời kể hấp dẫn, tự nhiên cho từng trang. Không bịa chi tiết không có trong ảnh. Mỗi trang cần 1-3 câu. Phong cách: ${style || 'kịch tính, dễ nghe'}. Ngữ cảnh từ lô ngay trước (chỉ dùng để nối mạch, không lặp lại): ${previousContext || 'Đây là lô đầu tiên.'}. Trả về duy nhất JSON array gồm đúng ${imagePaths.length} object theo mẫu {"page": số trang, "script": "lời review tiếng Việt"}; page chạy từ ${firstPage} đến ${lastPage}.` }];
  for (const imagePath of imagePaths) {
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    parts.push({ inlineData: { mimeType, data: fs.readFileSync(imagePath).toString('base64') } });
  }

  const failures = [];
  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } },
          { timeout: 60000, maxContentLength: 80 * 1024 * 1024, maxBodyLength: 80 * 1024 * 1024 }
        );
        const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) {
          const reason = response.data?.promptFeedback?.blockReason
            || response.data?.candidates?.[0]?.finishReason
            || 'Gemini không trả về nội dung.';
          throw new Error(`Gemini không thể xử lý lô ảnh này: ${reason}`);
        }
        const decoded = JSON.parse(raw.trim());
        const parsed = Array.isArray(decoded) ? decoded : decoded.scenes || decoded.pages || decoded.result;
        if (!Array.isArray(parsed) || parsed.length !== imagePaths.length) {
          throw new Error('AI trả về số cảnh không khớp số trang truyện.');
        }
        return parsed.map((item, index) => ({ page: pageOffset + index + 1, script: String(item.script || item.text || '').trim() }));
      } catch (error) {
        const status = error.response?.status || error.response?.data?.error?.code || 0;
        const message = error.response?.data?.error?.message || error.message;
        const retryable = isRetryableGeminiFailure(status, message);
        failures.push({ model, status, message, retryable });
        console.warn(`[comicReview] ${model} attempt ${attempt} failed: ${message}`);
        if (!retryable || attempt >= 2) break;
        await wait(attempt * 2000);
      }
    }
  }
  const usefulFailure = failures.find((failure) => failure.status !== 404 && !failure.retryable)
    || failures.find((failure) => failure.status !== 404)
    || failures[0];
  if (usefulFailure) {
    if (usefulFailure.retryable) {
      throw new Error('Các máy chủ Gemini đang quá tải. Hệ thống đã tự thử lại và đổi model nhưng chưa thành công; vui lòng chờ 1-2 phút rồi thử lại.');
    }
    throw new Error(`${usefulFailure.model}: ${usefulFailure.message}`);
  }
  throw new Error('Không thể phân tích ảnh truyện.');
}

async function analyzeComicPages(imagePaths, apiKey, style = '') {
  const batches = splitImageBatches(imagePaths);
  const results = [];
  for (const batch of batches) {
    const previousContext = results.slice(-2).map((item) => item.script).join(' ');
    console.log(`[comicReview] Analyzing pages ${results.length + 1}-${results.length + batch.length} of ${imagePaths.length}`);
    const batchResults = await analyzeComicBatch(batch, apiKey, style, results.length, previousContext);
    results.push(...batchResults);
  }
  return results;
}

function runProcess(command, args, cancelToken) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    cancelToken.proc = proc;
    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      cancelToken.proc = null;
      if (cancelToken.cancelled) reject(new Error('EXPORT_CANCELLED'));
      else if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} failed (${code}): ${stderr.slice(-1600)}`));
    });
  });
}

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfprobeCommand(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => code === 0 ? resolve(Math.max(1, Number.parseFloat(stdout) || 1)) : reject(new Error(stderr)));
  });
}

function wrapText(text, width = 44) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3).join('\n');
}

function ffmpegFilterPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}

async function renderComicReview({ scenes, voice, outputPath, capcutCookie = '', onProgress = () => {}, cancelToken }) {
  const ffmpeg = getFfmpegCommand();
  const systemFont = process.platform === 'win32'
    ? 'C:/Windows/Fonts/arial.ttf'
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const fontOption = fs.existsSync(systemFont) ? `:fontfile='${ffmpegFilterPath(systemFont)}'` : '';
  const tempDir = path.join(path.dirname(outputPath), `comic-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const clips = [];
  try {
    for (let i = 0; i < scenes.length; i += 1) {
      if (cancelToken.cancelled) throw new Error('EXPORT_CANCELLED');
      const scene = scenes[i];
      const audioPath = path.join(tempDir, `audio-${i}.mp3`);
      const textPath = path.join(tempDir, `caption-${i}.txt`);
      const clipPath = path.join(tempDir, `clip-${String(i).padStart(3, '0')}.mp4`);
      fs.writeFileSync(textPath, wrapText(scene.script), 'utf8');
      onProgress(Math.round((i / scenes.length) * 55), `Đang tạo giọng cảnh ${i + 1}/${scenes.length}...`);
      await generateTTS(scene.script, voice, audioPath, capcutCookie);
      const duration = (await probeDuration(audioPath)) + 0.35;
      const caption = ffmpegFilterPath(textPath);
      const filter = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,zoompan=z='min(zoom+0.00035,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,drawbox=x=0:y=ih-205:w=iw:h=205:color=black@0.55:t=fill,drawtext=textfile='${caption}'${fontOption}:fontcolor=white:fontsize=42:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-155:line_spacing=10,format=yuv420p`;
      await runProcess(ffmpeg, ['-y', '-loop', '1', '-i', scene.imagePath, '-i', audioPath, '-vf', filter, '-t', duration.toFixed(3), '-c:v', 'libx264', '-preset', 'superfast', '-crf', '23', '-c:a', 'aac', '-b:a', '160k', '-shortest', clipPath], cancelToken);
      clips.push(clipPath);
      onProgress(55 + Math.round(((i + 1) / scenes.length) * 35), `Đã dựng cảnh ${i + 1}/${scenes.length}`);
    }
    const concatPath = path.join(tempDir, 'concat.txt');
    fs.writeFileSync(concatPath, clips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    onProgress(92, 'Đang ghép video review 16:9...');
    await runProcess(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', '-movflags', '+faststart', outputPath], cancelToken);
    onProgress(100, 'Hoàn tất video review.');
    return outputPath;
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = { analyzeComicPages, renderComicReview };
