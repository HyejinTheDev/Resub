const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const venvPath = path.join(__dirname, '..', '..', '..', 'oneclick-subtitles-generator', '.venv');
const venvBinDir = process.platform === 'win32' ? 'Scripts' : 'bin';
const venvYtDlpPath = path.join(venvPath, venvBinDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

/**
 * Get the path to yt-dlp executable
 */
function getYtDlpPath() {
  if (fs.existsSync(venvYtDlpPath)) {
    return venvYtDlpPath;
  }
  return 'yt-dlp';
}

/**
 * Get ffmpeg location to pass to yt-dlp
 */
function getFfmpegDir() {
  const parentFfmpegDir = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'oneclick-subtitles-generator',
    'node_modules',
    '@ffmpeg-installer',
    'ffmpeg',
    process.platform === 'win32' ? 'bin/win32/x64' : 'bin/linux/x64'
  );
  if (fs.existsSync(parentFfmpegDir)) {
    return parentFfmpegDir;
  }
  return null;
}

/**
 * Download video from URL (YouTube, Douyin, etc.) using yt-dlp
 */
async function downloadVideo(videoUrl, outputDir, videoId) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const tempPath = path.join(outputDir, `${videoId}.ytdlp.mp4`);
    const finalPath = path.join(outputDir, `${videoId}.mp4`);
    const ytdlpCommand = getYtDlpPath();

    const args = [
      '--progress',
      '--newline',
      '--no-colors',
      videoUrl,
      '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]',
      '-o', tempPath,
      '--no-playlist',
      '--merge-output-format', 'mp4',
      '--no-post-overwrites'
    ];

    const ffmpegDir = getFfmpegDir();
    if (ffmpegDir) {
      args.push('--ffmpeg-location', ffmpegDir);
    }

    console.log(`[downloader] Spawning ${ytdlpCommand} with args:`, args);

    const proc = spawn(ytdlpCommand, args, {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    });

    let stderrData = '';

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      // Track progress in stdout (optional logger)
      if (line.includes('[download]')) {
        console.log(`[downloader stdout] ${line.trim()}`);
      }
    });

    proc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp failed with code ${code}. Stderr: ${stderrData}`));
      }

      if (fs.existsSync(tempPath)) {
        try {
          fs.renameSync(tempPath, finalPath);
          resolve(finalPath);
        } catch (err) {
          reject(err);
        }
      } else if (fs.existsSync(finalPath)) {
        resolve(finalPath);
      } else {
        reject(new Error('Downloaded file not found.'));
      }
    });
  });
}

module.exports = {
  downloadVideo
};
