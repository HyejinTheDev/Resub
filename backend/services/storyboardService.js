const axios = require('axios');

const TRANSCRIBE_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.5-flash'
];

/**
 * Call Gemini to analyze the Chinese transcript and suggest a storyboard context
 */
async function suggestStoryboard(subtitles, apiKey) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return {
      context: 'Chưa có thông tin bối cảnh.',
      characterRules: 'Chưa có quy tắc xưng hô.',
      translationTone: 'Tự nhiên'
    };
  }

  // Get a sample of subtitles for analysis (max 50 lines to save tokens and stay relevant)
  const sampleText = subtitles
    .slice(0, 50)
    .map((s, idx) => `[Câu ${idx + 1}] ${s.chineseText || s.text}`)
    .join('\n');

  const prompt = `Analyze these lines from a video transcript (Chinese). Understand the relationship between speakers, the setting, and the topic.
Suggest a Storyboard config to unify the Vietnamese pronouns (chủ ngữ, vị ngữ) and tone of translation.

Transcript lines:
${sampleText}

Return ONLY a JSON object with the following structure:
{
  "context": "Mô tả bối cảnh ngắn gọn (Ví dụ: Thầy giáo đang giảng bài toán hình học cho học sinh phổ thông)",
  "characterRules": "Mô tả cụ thể đại từ nhân xưng và quy tắc xưng hô (Ví dụ: Thầy giáo: xưng 'Thầy', gọi 'Em'. Học sinh: xưng 'Em', gọi 'Thầy')",
  "translationTone": "Tông giọng của bản dịch (Ví dụ: Trang trọng, sư phạm, dễ hiểu)"
}

Do NOT wrap the JSON in markdown code blocks like \`\`\`json. DO NOT add any other explanations or notes.`;

  let lastError = new Error('No models succeeded');

  for (const model of TRANSCRIBE_MODELS) {
    try {
      console.log(`[storyboardService] Analyzing transcript using model: ${model}...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                context: { type: 'string' },
                characterRules: { type: 'string' },
                translationTone: { type: 'string' }
              },
              required: ['context', 'characterRules', 'translationTone']
            }
          }
        }
      );

      const outputText = response.data.candidates[0].content.parts[0].text;
      return JSON.parse(outputText.trim());
    } catch (error) {
      const status = error.response?.status || error.response?.data?.error?.code || 'unknown';
      const msg = error.response?.data?.error?.message || error.message;
      console.warn(`[storyboardService] Model ${model} failed (status: ${status}): ${msg}`);
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Re-translate subtitles in batches incorporating storyboard context rules
 */
async function translateWithStoryboard(subtitles, storyboard, apiKey) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return [];
  }

  const { context, characterRules, translationTone } = storyboard;

  // We process in batches of 40 subtitles to stay within token limits and maintain contextual coherence
  const batchSize = 40;
  const results = [];

  for (let i = 0; i < subtitles.length; i += batchSize) {
    const batch = subtitles.slice(i, i + batchSize);
    const batchJson = batch.map(s => [s.startTime, s.endTime, s.chineseText || '', s.text || '']);

    const prompt = `Translate these Chinese subtitles into natural Vietnamese.
Follow these Storyboard/Context rules strictly to determine correct Vietnamese pronouns and tone:
- Bối cảnh video: ${context || 'Không rõ'}
- Quy tắc xưng hô các nhân vật: ${characterRules || 'Không rõ'}
- Tông giọng dịch thuật: ${translationTone || 'Tự nhiên'}

Subtitles input:
${JSON.stringify(batchJson, null, 2)}

IMPORTANT RULES:
1. Your response MUST be a JSON array only. Each item is a 4-element array: [startTime, endTime, chineseText, vietnameseTranslation].
2. Keep the timestamps (startTime, endTime) and Chinese text exactly identical. Only replace the fourth element with your translated Vietnamese.
3. Make sure the Vietnamese translation is natural, context-appropriate, and strictly honors the xưng hô/pronouns rules in the storyboard.
4. Keep the translations concise so they fit the timing durations.
5. Return ONLY the raw JSON array. DO NOT wrap it in markdown code blocks like \`\`\`json. DO NOT add any explanations.`;

    let lastError = new Error('No models succeeded');
    let batchSuccess = false;

    for (const model of TRANSCRIBE_MODELS) {
      try {
        console.log(`[storyboardService] Translating batch ${i} to ${i + batch.length} using model: ${model}...`);
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 4,
                  maxItems: 4
                }
              }
            }
          }
        );

        const outputText = response.data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(outputText.trim());
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            results.push({
              startTime: item[0],
              endTime: item[1],
              chineseText: item[2] || '',
              text: item[3] || ''
            });
          });
          batchSuccess = true;
          break; // success, break model loop
        }
      } catch (error) {
        const status = error.response?.status || error.response?.data?.error?.code || 'unknown';
        const msg = error.response?.data?.error?.message || error.message;
        console.warn(`[storyboardService] Batch translation failed with model ${model} (status: ${status}): ${msg}`);
        lastError = error;
      }
    }

    if (!batchSuccess) {
      throw lastError;
    }
  }

  return results;
}

module.exports = {
  suggestStoryboard,
  translateWithStoryboard
};
