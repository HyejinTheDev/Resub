const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const axios = require('axios');

// Compact array schema — ~60% fewer output tokens than object keys per subtitle line.
const SUBTITLE_SCHEMA = {
  type: 'array',
  items: {
    type: 'array',
    items: { type: 'string' },
    minItems: 4,
    maxItems: 4,
    description: '0: startTime, 1: endTime, 2: chineseText, 3: Vietnamese text'
  }
};

// Prioritize gemini-1.5-flash as the most stable and available model.
const TRANSCRIBE_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.5-flash'
];

/**
 * Call Gemini model to transcribe and translate an audio file (or a short segment of one) using base64 inline data.
 */
async function transcribeAndTranslate(audioPath, apiKey, options = {}) {
  const { isSegment = false, segmentDurationSec = null } = options;

  const segmentNote = isSegment
    ? `\n\nSEGMENT TIMING: This audio is a short segment cut from a longer video${segmentDurationSec ? ` (about ${segmentDurationSec.toFixed(1)} seconds long)` : ''}. Measure every start and end time RELATIVE TO THE BEGINNING OF THIS SEGMENT, i.e. the segment starts at 00m00s000ms. Do NOT try to guess the position within the original full video.`
    : '';

  const prompt = `Transcribe all spoken content in this audio. For each segment of speech:
1. Detect the exact start and end times in the format "00m00s000ms" (timing of speech). Be precise: the times MUST line up tightly with when each phrase is actually spoken.
2. Transcribe the original Chinese text exactly.
3. Translate it directly into natural, context-appropriate Vietnamese.

Your response MUST be a JSON array only. Each item is a 4-element array: [startTime, endTime, chineseText, vietnameseText].
Follow this exact JSON structure:
[
  ["00m01s200ms", "00m03s500ms", "你拼出来就知道了", "Cậu ghép thử xem là biết ngay."]
]

IMPORTANT RULES:
- CRITICAL: Split subtitle segments into short, readable phrases. The Vietnamese translation ("text") MUST have its word count strictly matching the segment's duration to ensure perfect lip-sync. For a segment of D seconds (duration = endTime - startTime), the Vietnamese translation MUST contain between Math.floor(D * 2.8) and Math.ceil(D * 3.5) words. For example: a 2-second segment MUST have 6 to 7 words; a 1-second segment MUST have 3 to 4 words. Do not let the translation exceed this length.
- If a speaker says a long sentence, you MUST split it into multiple consecutive smaller segments with precise start and end times matching the word timings.
- Timestamps must be in chronological order and must never exceed the length of this audio.
- Translate idioms and cultural references into natural Vietnamese phrasing.
- Return ONLY the raw JSON array. DO NOT wrap it in markdown code blocks like \`\`\`json. DO NOT add any explanations or notes.${segmentNote}`;

  let base64Audio;
  try {
    const audioBuffer = fs.readFileSync(audioPath);
    base64Audio = audioBuffer.toString('base64');
  } catch (err) {
    console.error(`[geminiService] Failed to read audio file: ${audioPath}`, err.message);
    throw err;
  }

  let lastError = new Error('No models succeeded');

  for (const model of TRANSCRIBE_MODELS) {
    try {
      console.log(`[geminiService] Attempting transcription${isSegment ? ' (segment)' : ''} using model: ${model} (inline data)...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/mp3',
                    data: base64Audio
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SUBTITLE_SCHEMA,
            maxOutputTokens: 65536,
            topK: 32,
            topP: 0.95
          }
        }
      );

      const outputText = response.data.candidates[0].content.parts[0].text;
      const parsedJson = JSON.parse(outputText.trim());
      if (!Array.isArray(parsedJson)) {
        throw new Error('Model did not return a JSON array');
      }
      return parsedJson;
    } catch (error) {
      const status = error.response?.status || error.response?.data?.error?.code || 'unknown';
      const msg = error.response?.data?.error?.message || error.message;
      console.warn(`[geminiService] Model ${model} failed (status: ${status}): ${msg}`);
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Extract a frame from the video at a given timestamp and use Gemini to detect the vertical range of subtitles.
 */
async function detectSubtitlePosition(videoPath, timestampSec, apiKey) {
  const tempFramePath = path.join(os.tmpdir(), `subtitle_frame_${Date.now()}.jpg`);
  
  // Replicate getFfmpegCommand logic locally to avoid circular dependencies
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
  const ffmpeg = fs.existsSync(parentFfmpeg) ? parentFfmpeg : 'ffmpeg';
  const safeFfmpeg = ffmpeg.includes(' ') ? `"${ffmpeg}"` : ffmpeg;

  try {
    // 1. Extract frame
    const extractCmd = `${safeFfmpeg} -y -ss ${timestampSec.toFixed(3)} -i "${videoPath}" -vframes 1 -q:v 2 "${tempFramePath}"`;
    execSync(extractCmd, { stdio: 'ignore' });

    if (!fs.existsSync(tempFramePath)) {
      throw new Error('Failed to extract frame');
    }

    // 2. Read frame as Base64
    const frameBuffer = fs.readFileSync(tempFramePath);
    const base64Frame = frameBuffer.toString('base64');

    const model = 'gemini-1.5-flash';
    console.log(`[geminiService] Detecting subtitle position using model: ${model} at ${timestampSec.toFixed(2)}s...`);
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Frame
                }
              },
              {
                text: 'Analyze this video frame. Locate the burned-in subtitles (usually in Chinese, at the bottom or center). Identify their bounding box height: what is the vertical range they occupy as percentages of the total image height (from 0 at the top to 100 at the bottom)? Return ONLY a JSON array of two numbers: [startYPercentage, endYPercentage]. Example: [78, 90]. Do not add any text or explanation.'
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2
          }
        }
      }
    );

    const outputText = response.data.candidates[0].content.parts[0].text;
    const parsedJson = JSON.parse(outputText.trim());
    if (Array.isArray(parsedJson) && parsedJson.length === 2) {
      const [startY, endY] = parsedJson;
      const yPercentage = Math.round((startY + endY) / 2);
      const heightPercentage = Math.max(5, Math.min(40, Math.round(endY - startY) + 4)); // add margin
      console.log(`[geminiService] Detected subtitle Y: ${yPercentage}%, Height: ${heightPercentage}%`);
      return { yPercentage, heightPercentage };
    }
    throw new Error('Invalid coordinates returned from Gemini');
  } catch (error) {
    console.warn('[geminiService] Subtitle detection failed, using fallback:', error.message);
    return { yPercentage: 78, heightPercentage: 15 }; // Default fallback
  } finally {
    try {
      if (fs.existsSync(tempFramePath)) fs.unlinkSync(tempFramePath);
    } catch {}
  }
}

module.exports = {
  transcribeAndTranslate,
  detectSubtitlePosition
};
