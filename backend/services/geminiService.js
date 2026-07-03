const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Structured schema forces Gemini to return well-formed timestamped items and
// prevents malformed / drifting output on longer inputs.
const SUBTITLE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      startTime: { type: 'string', description: 'Start time in format MMmSSsNNNms (e.g. "00m00s500ms")' },
      endTime: { type: 'string', description: 'End time in format MMmSSsNNNms (e.g. "00m03s500ms")' },
      chineseText: { type: 'string', description: 'Original Chinese transcription' },
      text: { type: 'string', description: 'Natural Vietnamese translation' }
    },
    required: ['startTime', 'endTime', 'chineseText', 'text'],
    propertyOrdering: ['startTime', 'endTime', 'chineseText', 'text']
  }
};

// Prefer Gemini 2.5 first: it respects short-segment timing far better than 2.0.
const TRANSCRIBE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-1.5-flash'
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

Your response MUST be a JSON array only. Follow this exact JSON structure:
[
  {
    "startTime": "00m01s200ms",
    "endTime": "00m03s500ms",
    "chineseText": "你拼出来就知道了",
    "text": "Cậu ghép thử xem là biết ngay."
  }
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

module.exports = {
  transcribeAndTranslate
};
