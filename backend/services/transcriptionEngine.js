const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const { getFfmpegCommand, getFfprobeCommand } = require('./dubbingEngine');
const { transcribeAndTranslate } = require('./geminiService');

// Segment tuning: short segments keep Gemini's timestamps tightly aligned to speech.
const SEGMENT_SEC = 30;
const OVERLAP_SEC = 2;
const CONCURRENCY = 15;

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

async function getAudioDurationSec(filePath) {
  try {
    const out = await runCommand(getFfprobeCommand(), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    return parseFloat(out.trim()) || 0;
  } catch (e) {
    console.error('[transcriptionEngine] Failed to read audio duration:', e.message);
    return 0;
  }
}

function parseTimeToMs(timeStr) {
  if (typeof timeStr === 'number') return timeStr * 1000;
  if (!timeStr) return 0;
  const match = String(timeStr).match(/(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?/);
  if (match && (match[1] || match[2] || match[3])) {
    const mins = parseInt(match[1] || '0', 10);
    const secs = parseInt(match[2] || '0', 10);
    const ms = parseInt(match[3] || '0', 10);
    return mins * 60 * 1000 + secs * 1000 + ms;
  }
  return parseFloat(timeStr) * 1000 || 0;
}

function formatMsToCustom(ms) {
  const safeMs = Math.max(0, Math.round(ms));
  const mins = Math.floor(safeMs / 60000);
  const secs = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;
  return `${String(mins).padStart(2, '0')}m${String(secs).padStart(2, '0')}s${String(millis).padStart(3, '0')}ms`;
}

/**
 * Cut a short segment out of the source audio using ffmpeg (re-encoded for accurate timing).
 */
function cutAudioSegment(sourcePath, outPath, startSec, lengthSec) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', String(startSec),
      '-t', String(lengthSec),
      '-i', sourcePath,
      '-acodec', 'copy',
      outPath
    ];
    const proc = spawn(getFfmpegCommand(), args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) resolve(outPath);
      else reject(new Error(`ffmpeg segment cut failed: ${stderr.substring(stderr.length - 200)}`));
    });
  });
}

/** Accept compact [start, end, chinese, vi] arrays or legacy object items from Gemini. */
function normalizeSubtitleItem(item) {
  if (Array.isArray(item)) {
    return {
      startTime: item[0],
      endTime: item[1],
      chineseText: item[2] || '',
      text: item[3] || ''
    };
  }
  return {
    startTime: item.startTime,
    endTime: item.endTime,
    chineseText: item.chineseText || '',
    text: item.text || ''
  };
}

/**
 * Process one audio segment through Gemini with per-segment key failover.
 * Returns subtitles with timestamps already offset to absolute video time.
 */
async function processSegment(segment, keyState, reportBadKey, acquireKey) {
  const maxAttempts = 3;
  let attempts = 0;
  let lastError = new Error('Segment processing failed');

  while (attempts < maxAttempts) {
    const currentKey = keyState.key;
    try {
      const raw = await transcribeAndTranslate(segment.path, currentKey, {
        isSegment: true,
        segmentDurationSec: segment.lengthSec
      });

      const offsetMs = segment.startSec * 1000;
      const segmentEndMs = (segment.startSec + segment.lengthSec) * 1000;
      return (raw || [])
        .map((item) => {
          const norm = normalizeSubtitleItem(item);
          const startMs = parseTimeToMs(norm.startTime) + offsetMs;
          const endMs = parseTimeToMs(norm.endTime) + offsetMs;
          return { startMs, endMs, chineseText: norm.chineseText, text: norm.text };
        })
        // Drop invalid or empty items and anything that spills far past the segment
        .filter((s) => s.endMs > s.startMs && (s.text.trim() || s.chineseText.trim()) && s.startMs < segmentEndMs + 1500);
    } catch (error) {
      lastError = error;
      attempts++;
      console.warn(`[transcriptionEngine] Segment ${segment.index} attempt ${attempts} failed: ${error.message}`);

      if (acquireKey) {
        const isInvalid = error.message.includes('403') || error.message.includes('API key not valid');
        if (reportBadKey) await reportBadKey(currentKey, isInvalid ? 'invalid' : 'rate');
        if (attempts < maxAttempts) {
          keyState.key = await acquireKey();
          continue;
        }
      } else if (attempts < maxAttempts) {
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

/**
 * Merge per-segment subtitles: sort chronologically and drop duplicates created by
 * the overlap window (same Chinese text starting within ~0.7s of a kept entry).
 */
function mergeSubtitles(all) {
  const sorted = all.slice().sort((a, b) => a.startMs - b.startMs);
  const kept = [];
  for (const sub of sorted) {
    const dup = kept.find((k) =>
      Math.abs(k.startMs - sub.startMs) < 700 &&
      (k.chineseText.trim() === sub.chineseText.trim() || k.text.trim() === sub.text.trim())
    );
    if (dup) continue;
    kept.push(sub);
  }
  return kept.map((s) => ({
    startTime: formatMsToCustom(s.startMs),
    endTime: formatMsToCustom(s.endMs),
    chineseText: s.chineseText,
    text: s.text
  }));
}

/**
 * Transcribe + translate a full audio file by splitting it into short overlapping
 * segments, processing them (in parallel, with key failover), offsetting each
 * segment's timestamps to absolute time, and merging the results.
 *
 * @param {string} audioPath
 * @param {object} handlers
 * @param {function} handlers.acquireKey  async () => apiKey  (borrow/rotate a key)
 * @param {function} [handlers.reportBadKey]  async (key, type) => void
 * @param {function} [handlers.onProgress]  ({ percent, message }) => void
 */
async function transcribeSegmented(audioPath, handlers = {}) {
  const { acquireKey, reportBadKey, onProgress = () => {} } = handlers;
  if (!acquireKey) throw new Error('acquireKey handler is required');

  const duration = await getAudioDurationSec(audioPath);
  if (!duration || duration <= 0) {
    throw new Error('Không đọc được thời lượng audio để chia đoạn.');
  }

  // Build overlapping segment plan
  const step = SEGMENT_SEC - OVERLAP_SEC;
  const segments = [];
  for (let start = 0, i = 0; start < duration; start += step, i++) {
    const lengthSec = Math.min(SEGMENT_SEC, duration - start);
    if (lengthSec <= 0.5) break;
    segments.push({ index: i, startSec: start, lengthSec });
  }

  const tempDir = path.join(os.tmpdir(), `resub_transcribe_${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  onProgress({ percent: 8, message: `Đang chia âm thanh thành ${segments.length} đoạn để nhận dạng chính xác...` });

  try {
    // Cut all segments first (fast, local)
    for (const seg of segments) {
      seg.path = path.join(tempDir, `seg_${seg.index}.mp3`);
      await cutAudioSegment(audioPath, seg.path, seg.startSec, seg.lengthSec);
    }

    // Shared key reused across segments; rotated only when a segment errors out
    const keyState = { key: await acquireKey() };

    let completed = 0;
    const results = new Array(segments.length);
    let nextIdx = 0;

    const worker = async () => {
      while (nextIdx < segments.length) {
        const myIdx = nextIdx++;
        const seg = segments[myIdx];
        results[myIdx] = await processSegment(seg, keyState, reportBadKey, acquireKey);
        completed++;
        // Segment work spans 10% -> 95% of the progress bar
        onProgress({
          percent: Math.round(10 + (completed / segments.length) * 85),
          message: `Đang nhận dạng & dịch đoạn ${completed}/${segments.length}...`
        });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, segments.length) }, () => worker())
    );

    const merged = mergeSubtitles(results.flat());
    onProgress({ percent: 98, message: 'Đang ghép các đoạn phụ đề...' });
    return merged;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[transcriptionEngine] Failed to clean temp dir:', e.message);
    }
  }
}

module.exports = {
  transcribeSegmented
};
