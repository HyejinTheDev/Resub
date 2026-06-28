const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

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

async function generateFptTTS(text, voice, apiKey, outputPath) {
  const response = await fetchUrl('https://api.fpt.ai/hmi/tts/v5', 'POST', {
    'api_key': apiKey,
    'voice': voice.replace('fpt-', ''),
    'speed': '0',
    'format': 'mp3'
  }, text);

  if (response.statusCode !== 200) {
    throw new Error(`FPT.AI TTS request failed: ${response.statusCode} - ${response.body}`);
  }

  const json = JSON.parse(response.body);
  if (json.success !== "true" && json.success !== true) {
    throw new Error(`FPT.AI error: ${json.message}`);
  }

  const audioUrl = json.message;
  
  let attempts = 0;
  const maxAttempts = 15;
  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const checkRes = await fetchUrl(audioUrl, 'GET');
      if (checkRes.statusCode === 200) {
        if (!checkRes.body.startsWith('{')) {
          fs.writeFileSync(outputPath, checkRes.raw);
          return;
        }
      }
    } catch (e) {
      console.warn(`FPT.AI polling attempt ${attempts} failed:`, e.message);
    }
    attempts++;
  }
  throw new Error(`FPT.AI TTS generation timed out after 15 seconds.`);
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

function getVideoDimensions(videoPath) {
  try {
    const ffprobe = getFfprobeCommand();
    const cmd = `"${ffprobe}" -v error -select_streams v:0 -show_entries stream=width,height -of json "${videoPath}"`;
    const output = execSync(cmd).toString();
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

/**
 * Generate audio speech from text using Microsoft Edge TTS (via Python wrapper)
 */
async function generateTTS(text, voice = 'vi-VN-HoaiMyNeural', outputPath, fptApiKey = '') {
  if (voice.startsWith('fpt-')) {
    if (!fptApiKey) {
      throw new Error('FPT.AI API Key is required to use this voice. Please enter it in the top settings bar.');
    }
    await generateFptTTS(text, voice, fptApiKey, outputPath);
    return outputPath;
  }

  return new Promise((resolve, reject) => {
    const tempScript = path.join(os.tmpdir(), `edge_tts_${uuidv4()}.py`);
    const scriptContent = `
import sys
import json
import asyncio
import tempfile
import os

try:
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    import edge_tts

    async def main():
        data = json.loads(sys.stdin.read())
        text = data["text"]
        voice = data["voice"]
        output_path = data["outputPath"]

        # Create temporary text file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_file:
            temp_file.write(text)
            temp_text_path = temp_file.name

        try:
            cmd = [
                sys.executable, '-m', 'edge_tts',
                '--voice', voice,
                '--file', temp_text_path,
                '--write-media', output_path
            ]
            import subprocess
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            print(json.dumps({'success': True}))
        finally:
            if os.path.exists(temp_text_path):
                os.unlink(temp_text_path)

    asyncio.run(main())
except ImportError:
    print(json.dumps({'success': False, 'error': 'edge-tts not installed in venv'}))
    sys.exit(1)
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
    sys.exit(1)
`;

    fs.writeFileSync(tempScript, scriptContent, 'utf-8');

    const pythonProcess = spawn(pythonExecutable, [tempScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // Clean up temp script
      try {
        if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
      } catch (e) {}

      if (code !== 0) {
        return reject(new Error(`Python process exited with code ${code}. Stderr: ${stderrData}. Stdout: ${stdoutData}`));
      }

      try {
        const res = JSON.parse(stdoutData.trim());
        if (res.success) {
          resolve(outputPath);
        } else {
          reject(new Error(res.error || 'Failed to generate TTS'));
        }
      } catch (err) {
        reject(new Error(`Failed to parse Python response: ${stdoutData}`));
      }
    });

    pythonProcess.stdin.write(JSON.stringify({ text, voice, outputPath }));
    pythonProcess.stdin.end();
  });
}

/**
 * Get Audio Duration in seconds using ffprobe
 */
function getAudioDuration(filePath) {
  const ffprobeCmd = getFfmpegCommand().replace('ffmpeg', 'ffprobe');
  try {
    const stdout = execSync(
      `"${ffprobeCmd}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' }
    );
    return parseFloat(stdout.trim());
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
  blurMask,
  blurMasks,
  subtitleStyle,
  fptApiKey,
  cropStyle
}) {
  const tempDir = path.join(os.tmpdir(), `resub_export_${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const ffmpeg = getFfmpegCommand();
  const ttsFiles = [];
  const filterInputs = [];
  const ffmpegArgs = ['-y', '-i', videoPath];

  try {
    // 1. Generate & Speed-adjust TTS for each subtitle segment
    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i];
      const startMs = parseTimeToMs(sub.startTime);
      const endMs = parseTimeToMs(sub.endTime);
      const originalDuration = (endMs - startMs) / 1000;

      if (originalDuration <= 0) continue;

      const rawTtsPath = path.join(tempDir, `tts_${i}_raw.mp3`);
      const speedTtsPath = path.join(tempDir, `tts_${i}_speed.mp3`);

      // Generate base TTS
      await generateTTS(sub.text, voice, rawTtsPath, fptApiKey);
      const ttsDuration = getAudioDuration(rawTtsPath);

      // Determine required speed-up
      let speed = 1.0;
      if (ttsDuration > originalDuration) {
        speed = ttsDuration / originalDuration;
      }

      // Adjust speed to fit original interval
      await adjustAudioSpeed(rawTtsPath, speedTtsPath, speed);

      // Add to FFmpeg inputs
      ffmpegArgs.push('-i', speedTtsPath);
      ttsFiles.push({ index: i, startMs, path: speedTtsPath });
    }

    // 2. Build the Audio Filter Graph for delays and mixing
    // Video audio is input index 0. TTS files are indices 1 to N.
    let filterGraph = '';
    
    // Scale original audio volume to bgVolume
    filterGraph += `[0:a]volume=${bgVolume}[bg];`;

    // Delay each TTS track
    ttsFiles.forEach((file, index) => {
      // index + 1 matches the input index in ffmpeg
      const inputIndex = index + 1;
      filterGraph += `[${inputIndex}:a]adelay=${file.startMs}|${file.startMs}[tts_${index}];`;
      filterInputs.push(`[tts_${index}]`);
    });

    // Mix background audio + all delayed TTS tracks
    filterGraph += `[bg]${filterInputs.join('')}amix=inputs=${1 + ttsFiles.length}:duration=first[aout]`;

    // 3. Subtitles SRT generation
    const srtPath = path.join(tempDir, 'subtitles.srt');
    generateSrtFile(subtitles, srtPath);

    // Get original video dimensions to calculate accurate margins and crop sizes
    const originalDimensions = getVideoDimensions(videoPath);
    let targetWidth = originalDimensions.width;
    let targetHeight = originalDimensions.height;

    if (cropStyle && cropStyle.aspectRatio !== 'original') {
      const wPercent = cropStyle.widthPercent !== undefined ? cropStyle.widthPercent : 100;
      const hPercent = cropStyle.heightPercent !== undefined ? cropStyle.heightPercent : 100;
      targetWidth = Math.round(originalDimensions.width * wPercent / 100);
      targetHeight = Math.round(originalDimensions.height * hPercent / 100);
    }

    // 4. Video filter graph for blur mask and subtitles
    let forceStyle = "FontName=Arial,Alignment=2";
    if (subtitleStyle) {
      const fs = subtitleStyle.fontSize || 17;
      const assFontSize = Math.round(fs * 1.8);
      forceStyle += `,FontSize=${assFontSize}`;
      
      const textColor = subtitleStyle.color || '#ffffff';
      forceStyle += `,PrimaryColour=${hexToAssColor(textColor)}`;
      
      if (subtitleStyle.textColorPreset && subtitleStyle.textColorPreset.includes('-bg')) {
        forceStyle += `,BorderStyle=3,OutlineColour=&H80000000,Outline=2`;
      } else {
        forceStyle += `,BorderStyle=1`;
        const outlineColor = subtitleStyle.outlineColor || '#000000';
        const outlineWidth = subtitleStyle.outlineWidth !== undefined ? subtitleStyle.outlineWidth : 2;
        forceStyle += `,OutlineColour=${hexToAssColor(outlineColor)},Outline=${outlineWidth}`;
      }
      
      const y = subtitleStyle.yPercent !== undefined ? subtitleStyle.yPercent : 85;
      const marginV = Math.round((100 - y) / 100 * targetHeight);
      forceStyle += `,MarginV=${marginV}`;

      const wPercent = subtitleStyle.widthPercent !== undefined ? subtitleStyle.widthPercent : 80;
      const marginH = Math.round(((100 - wPercent) / 2) / 100 * targetWidth);
      forceStyle += `,MarginL=${marginH},MarginR=${marginH}`;
    } else {
      forceStyle += `,FontSize=30,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2`;
    }

    // Process blur segments on original video size
    let currentVInput = '0:v';
    let filterIndex = 0;
    
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

    if (activeMasks.length > 0) {
      activeMasks.forEach(mask => {
        const start = parseTimeToMs(mask.startTime) / 1000;
        const end = parseTimeToMs(mask.endTime) / 1000;
        const x = mask.xPercentage !== undefined ? mask.xPercentage : 50;
        const y = mask.yPercentage || 80;
        const w = mask.widthPercentage !== undefined ? mask.widthPercentage : 80;
        const h = mask.heightPercentage || 15;
        const r = mask.blurRadius || 15;
        const hexColor = mask.color || '#000000';
        const opacity = mask.opacity !== undefined ? mask.opacity : 0.45;
        const ffmpegColor = `0x${hexColor.slice(1)}`;
        
        const mainLabel = `main_${filterIndex}`;
        const cropLabel = `crop_${filterIndex}`;
        const toBlurLabel = `to_blur_${filterIndex}`;
        const toMaskLabel = `to_mask_${filterIndex}`;
        const blurredSrcLabel = `blurred_src_${filterIndex}`;
        const alphaMaskLabel = `alpha_mask_${filterIndex}`;
        const featheredLabel = `feathered_${filterIndex}`;
        const nextVLabel = `v_${filterIndex + 1}`;
        
        filterGraph += `;[${currentVInput}]split[${mainLabel}][${cropLabel}];` +
                       `[${cropLabel}]crop=w=iw*${w}/100:h=ih*${h}/100:x=iw*(${x}-${w}/2)/100:y=ih*(${y}-${h}/2)/100,split[${toBlurLabel}][${toMaskLabel}];` +
                       `[${toBlurLabel}]boxblur=luma_radius=${r}:luma_power=3,drawbox=x=0:y=0:w=iw:h=ih:color=${ffmpegColor}@${opacity}:t=fill[${blurredSrcLabel}];` +
                       `[${toMaskLabel}]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill,drawbox=x=iw*0.1:y=ih*0.1:w=iw*0.8:h=ih*0.8:color=white:t=fill,boxblur=luma_radius=${r}:luma_power=3[${alphaMaskLabel}];` +
                       `[${blurredSrcLabel}][${alphaMaskLabel}]alphamerge[${featheredLabel}];` +
                       `[${mainLabel}][${featheredLabel}]overlay=x=iw*(${x}-${w}/2)/100:y=ih*(${y}-${h}/2)/100:enable='between(t,${start},${end})'[${nextVLabel}]`;
        
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

    // Burn-in subtitles on the final cropped stream
    filterGraph += `;[${currentVInput}]subtitles=subtitles.srt:force_style='${forceStyle}'[vout]`;

    // 5. Assemble final arguments
    ffmpegArgs.push(
      '-filter_complex', filterGraph,
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-shortest',
      outputPath
    );

    // 5. Run FFmpeg
    console.log(`[dubbingEngine] Running FFmpeg command with ${ttsFiles.length} TTS inputs...`);
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpeg, ffmpegArgs, { cwd: tempDir });
      let stderr = '';
      
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg export failed with code ${code}. Stderr: ${stderr}`));
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
  parseTimeToMs
};
