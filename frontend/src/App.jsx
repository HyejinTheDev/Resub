import React, { useEffect, useRef } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { usePlaybackStore } from './store/usePlaybackStore';
import { useSettingsStore } from './store/useSettingsStore';
import { parseTimeToSeconds } from './shared/utils/timeFormatter';

import VideoImportScreen from './features/video-import/VideoImportScreen';
import SubtitleList from './features/subtitle-editor/SubtitleList';
import PreviewPlayer from './features/preview-player/PreviewPlayer';
import InspectorPanel from './features/inspector/InspectorPanel';
import TimelineWorkspace from './features/timeline/TimelineWorkspace';

import './App.css';

export default function App() {
  const {
    videoData,
    subtitles,
    activeSubtitleIndex,
    setActiveSubtitleIndex,
    leftWidth,
    setLeftWidth,
    rightWidth,
    setRightWidth,
    topHeight,
    setTopHeight,
    isProcessing,
    statusMessage,
    toastMessage
  } = useProjectStore();

  const {
    currentTime,
    setCurrentTime,
    videoDuration,
    isPlaying
  } = usePlaybackStore();

  const {
    geminiKey,
    setGeminiKey,
    fptApiKey,
    setFptApiKey,
    capcutCookie,
    setCapcutCookie
  } = useSettingsStore();

  const videoRef = useRef(null);
  const isResizingRef = useRef({ type: null, startX: 0, startY: 0, startLeftWidth: 0, startRightWidth: 0, startTopHeight: 0 });

  const handleMouseDown = (type, e) => {
    e.preventDefault();
    isResizingRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startLeftWidth: leftWidth,
      startRightWidth: rightWidth,
      startTopHeight: topHeight
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizingRef.current.type) return;
    const { type, startX, startY, startLeftWidth, startRightWidth, startTopHeight } = isResizingRef.current;
    
    if (type === 'col1') {
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newLeftWidth = Math.min(Math.max(startLeftWidth + deltaPercent, 20), 60);
      setLeftWidth(newLeftWidth);
    } else if (type === 'col2') {
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newRightWidth = Math.min(Math.max(startRightWidth - deltaPercent, 15), 45);
      setRightWidth(newRightWidth);
    } else if (type === 'row') {
      const deltaY = e.clientY - startY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      const newTopHeight = Math.min(Math.max(startTopHeight + deltaPercent, 30), 80);
      setTopHeight(newTopHeight);
    }
  };

  const handleMouseUp = () => {
    isResizingRef.current.type = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth, rightWidth, topHeight]);

  const handleSeek = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  // Keep track of which subtitle is currently active based on video playback
  useEffect(() => {
    if (!videoRef.current) return;
    const index = subtitles.findIndex(sub => {
      const start = parseTimeToSeconds(sub.startTime);
      const end = parseTimeToSeconds(sub.endTime);
      return currentTime >= start && currentTime <= end;
    });
    setActiveSubtitleIndex(index);
  }, [currentTime, subtitles]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <span className="logo-text">RESUB</span>
          <span className="logo-badge">Auto Dubbing v1.0</span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="api-key-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent)'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span className="key-label">Gemini Key:</span>
            <input 
              type="password" 
              placeholder="Dán key vào đây..." 
              className="key-input"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
          <div className="api-key-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent)'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span className="key-label">FPT.AI Key:</span>
            <input 
              type="password" 
              placeholder="Dán FPT key..." 
              className="key-input"
              value={fptApiKey}
              onChange={(e) => setFptApiKey(e.target.value)}
            />
          </div>
          <div className="api-key-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent)'}}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
            <span className="key-label">CapCut Cookie:</span>
            <input 
              type="password" 
              placeholder="Dán Cookie CapCut..." 
              className="key-input"
              value={capcutCookie}
              onChange={(e) => setCapcutCookie(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Setup / Media Loader Screen */}
      {!videoData && !isProcessing && <VideoImportScreen />}

      {/* Processing Loader Screen */}
      {isProcessing && (
        <main className="setup-view">
          <div className="setup-card" style={{padding: '50px'}}>
            <div className="loading-container">
              <div className="spinner"></div>
              <h3 style={{fontSize: '18px', fontWeight: 600}}>{statusMessage}</h3>
              <p style={{color: 'var(--text-muted)', fontSize: '13px'}}>Quá trình này có thể mất từ 1 - 2 phút tùy thuộc vào độ dài video.</p>
            </div>
          </div>
        </main>
      )}

      {/* Main Workspace */}
      {videoData && !isProcessing && (
        <main className="workspace-view">
          {/* Top Panel Splitter */}
          <div className="editor-grid" style={{ height: `${topHeight}%` }}>
            
            {/* Left Panel: Subtitles */}
            <div style={{ width: `${leftWidth}%`, height: '100%' }}>
              <SubtitleList onSeek={handleSeek} />
            </div>

            {/* Vertical Splitter 1 */}
            <div className="resizer-col" onMouseDown={(e) => handleMouseDown('col1', e)}></div>

            {/* Center Panel: Video Preview Player */}
            <div style={{ width: `${100 - leftWidth - rightWidth}%`, height: '100%' }}>
              <PreviewPlayer videoRef={videoRef} />
            </div>

            {/* Vertical Splitter 2 */}
            <div className="resizer-col" onMouseDown={(e) => handleMouseDown('col2', e)}></div>

            {/* Right Panel: Inspector Panel */}
            <div style={{ width: `${rightWidth}%`, height: '100%' }}>
              <InspectorPanel />
            </div>
          </div>

          {/* Horizontal Splitter */}
          <div className="resizer-row" onMouseDown={(e) => handleMouseDown('row', e)}></div>

          {/* Bottom Panel: Timeline */}
          <div className="bottom-panel" style={{ height: `calc(${100 - topHeight}% - 4px)` }}>
            <div className="timeline-toolbar">
              <span>Timeline Workspace</span>
              <span>Kéo đầu kim đỏ để cuộn phát</span>
            </div>
            <TimelineWorkspace videoRef={videoRef} />
          </div>
        </main>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
