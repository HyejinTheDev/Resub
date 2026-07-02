const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Upload a file to Google Gemini Files API using resumable protocol
 */
async function uploadFileToGemini(filePath, mimeType, apiKey) {
  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;

  try {
    // Step 1: Start resumable upload
    const startResponse = await axios.post(
      'https://generativelanguage.googleapis.com/upload/v1beta/files',
      {
        file: {
          display_name: path.basename(filePath)
        }
      },
      {
        headers: {
          'x-goog-api-key': apiKey,
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json'
        }
      }
    );

    const uploadUrl = startResponse.headers['x-goog-upload-url'];
    if (!uploadUrl) {
      throw new Error('Failed to get upload URL from Gemini Files API response.');
    }

    // Step 2: Upload file bytes
    const fileStream = fs.createReadStream(filePath);
    const uploadResponse = await axios.post(uploadUrl, fileStream, {
      headers: {
        'Content-Length': fileSize,
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Type': mimeType
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const fileInfo = uploadResponse.data.file;
    return fileInfo;
  } catch (error) {
    console.error('Error in uploadFileToGemini:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Wait for uploaded file to change state to ACTIVE
 */
async function waitForFileProcessing(fileName, apiKey, maxWaitMs = 180000) {
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
        {
          headers: {
            'x-goog-api-key': apiKey
          }
        }
      );

      const fileState = response.data.state;
      console.log(`[geminiService] File state: ${fileState}`);

      if (fileState === 'ACTIVE') {
        return response.data;
      } else if (fileState === 'FAILED') {
        throw new Error('File processing failed on Google servers.');
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    } catch (error) {
      console.error('Error polling file status:', error.response?.data || error.message);
      throw error;
    }
  }

  throw new Error('Timeout waiting for file to process.');
}

/**
 * Delete file from Google servers to clean up
 */
async function deleteGeminiFile(fileName, apiKey) {
  try {
    await axios.delete(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
      {
        headers: {
          'x-goog-api-key': apiKey
        }
      }
    );
    console.log(`[geminiService] Deleted remote file ${fileName}`);
  } catch (err) {
    console.warn(`[geminiService] Failed to clean up file ${fileName}:`, err.message);
  }
}

/**
 * Call Gemini model to transcribe and translate audio file
 */
async function transcribeAndTranslate(fileUri, apiKey) {
  const prompt = `Transcribe all spoken content in this audio. For each segment of speech:
1. Detect the exact start and end times in the format "00m00s000ms" (timing of speech)
2. Transcribe the original Chinese text exactly
3. Translate it directly into natural, context-appropriate Vietnamese

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
- CRITICAL: Split subtitle segments into short, readable phrases. Each segment's Vietnamese translation ("text") MUST be at most 8-10 words (or under 3 seconds in duration) so that it fits cleanly on a single line.
- If a speaker says a long sentence, you MUST split it into multiple consecutive smaller segments with precise start and end times matching the word timings.
- Translate idioms and cultural references into natural Vietnamese phrasing.
- Return ONLY the raw JSON array. DO NOT wrap it in markdown code blocks like \`\`\`json. DO NOT add any explanations or notes.`;

  const models = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-1.5-flash'
  ];

  let lastError = new Error('No models succeeded');

  for (const model of models) {
    try {
      console.log(`[geminiService] Attempting transcription and translation using model: ${model}...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  file_data: {
                    mime_type: 'audio/mp3',
                    file_uri: fileUri
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }
      );

      const outputText = response.data.candidates[0].content.parts[0].text;
      console.log(`[geminiService] Raw model response from ${model}:`, outputText);

      const parsedJson = JSON.parse(outputText.trim());
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
  uploadFileToGemini,
  waitForFileProcessing,
  deleteGeminiFile,
  transcribeAndTranslate
};
