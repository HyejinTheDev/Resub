---
title: Resub Backend
emoji: 📉
colorFrom: gray
colorTo: blue
sdk: docker
pinned: false
---

# RESUB - CapCut style Auto Dubbing Tool

RESUB is a powerful web-based application designed for automated Chinese to Vietnamese video transcription, translation, voice dubbing, and editing. It features a professional multi-track timeline, visual editing overlays (drag and resize for subtitles and blur masks), and real-time audio generation.

## Features

- **Automated Workflow**: Simply paste a Gemini API Key, drag and drop your video file, and start the auto-transcription and translation process.
- **CapCut-style Timeline**: Edit text and audio tracks with visual trimming handles on a synchronized layout.
- **Visual Subtitle Styling**: Drag to position and scale font size or wrap boundaries directly on the video preview.
- **2D Segmented Blur Masks**: Create and resize blur mask boxes to hide original Chinese subtitles or watermarks during specific times.
- **FFmpeg Integration**: Merges, overlays, and burns in custom subtitle styles and blur boxes on export.

## Tech Stack

## Build Info

Triggered rebuild to resolve Hugging Face scheduling issue.

- **Frontend**: React, Vite, CSS, Lucide icons.
- **Backend**: Node.js, Express, FFmpeg.
- **AI Models**: Gemini API (for transcription and translation), Microsoft Edge TTS (for voiceover audio).

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Open Application**:
   Navigate to `http://localhost:5173/` in your browser.
