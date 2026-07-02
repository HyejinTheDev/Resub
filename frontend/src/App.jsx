import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { usePlaybackStore } from './store/usePlaybackStore';
import { useSettingsStore } from './store/useSettingsStore';
import { parseTimeToSeconds } from './shared/utils/timeFormatter';

import ProjectDashboard from './features/project-dashboard/ProjectDashboard';
import VideoImportScreen from './features/video-import/VideoImportScreen';
import SubtitleList from './features/subtitle-editor/SubtitleList';
import PreviewPlayer from './features/preview-player/PreviewPlayer';
import InspectorPanel from './features/inspector/InspectorPanel';
import TimelineWorkspace from './features/timeline/TimelineWorkspace';

import { useAuthStore } from './store/useAuthStore';
import AuthScreen from './features/auth/AuthScreen';
import './App.css';

export default function App() {
  const { currentUser, logout } = useAuthStore();

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
    uploadProgress,
    toastMessage,
    activeBlurIndex,
    handleDeleteBlurMask,
    undo,
    redo,
    handleDeleteSubtitle,
    currentProjectId,
    saveProjectProgress,
    closeProject,
    subtitleStyle,
    blurMasks,
    cropStyle,
    videoTransform
  } = useProjectStore();

  const {
    currentTime,
    setCurrentTime,
    videoDuration,
    isPlaying,
    setIsPlaying
  } = usePlaybackStore();

  const {
    geminiKey,
    setGeminiKey,
    capcutCookie,
    setCapcutCookie
  } = useSettingsStore();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);


  // Auto-save project progress whenever relevant editor state changes
  useEffect(() => {
    if (videoData) {
      saveProjectProgress();
    }
  }, [subtitles, blurMasks, subtitleStyle, cropStyle, videoTransform, videoData, currentProjectId, saveProjectProgress]);



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

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.isContentEditable
      );

      // Handle Ctrl+Z and Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }

      // If user is typing, don't trigger playback control shortcuts
      if (isTyping) return;

      // Spacebar: Play/Pause video
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      }

      // Left Arrow: Seek backward
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const target = Math.max(0, currentTime - step);
        handleSeek(target);
      }

      // Right Arrow: Seek forward
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const target = Math.min(videoDuration || 0, currentTime + step);
        handleSeek(target);
      }

      // Up Arrow: Jump to previous subtitle card
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (subtitles.length > 0) {
          let prevIndex = activeSubtitleIndex - 1;
          if (prevIndex < 0) prevIndex = subtitles.length - 1;
          const sub = subtitles[prevIndex];
          const time = parseTimeToSeconds(sub.startTime);
          handleSeek(time);
        }
      }

      // Down Arrow: Jump to next subtitle card
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (subtitles.length > 0) {
          let nextIndex = activeSubtitleIndex + 1;
          if (nextIndex >= subtitles.length) nextIndex = 0;
          const sub = subtitles[nextIndex];
          const time = parseTimeToSeconds(sub.startTime);
          handleSeek(time);
        }
      }

      // Delete/Backspace: Delete selected blur mask or subtitle card
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeBlurIndex !== -1) {
          e.preventDefault();
          handleDeleteBlurMask(activeBlurIndex);
        } else if (activeSubtitleIndex !== -1) {
          e.preventDefault();
          handleDeleteSubtitle(activeSubtitleIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [subtitles, activeSubtitleIndex, activeBlurIndex, currentTime, videoDuration]);

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
          {videoData && (
            <button 
              onClick={closeProject}
              className="action-btn"
              style={{
                marginRight: '12px',
                padding: '4px 8px',
                fontSize: '12px',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ⬅ Dự án
            </button>
          )}
          <span className="logo-text">RESUB</span>
          <span className="logo-badge">Auto Dubbing v1.0</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {currentUser && currentUser.username === 'admin' && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="action-btn"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-color)',
                fontSize: '12px',
                fontWeight: 600,
                gap: '6px',
                transition: 'background 0.2s'
              }}
              title="Cấu hình hệ thống"
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >
              ⚙️ Cấu hình
            </button>
          )}

          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tài khoản:</span>
                <strong style={{ color: 'var(--accent)' }}>{currentUser.username}</strong>
              </div>
              <button
                onClick={logout}
                className="action-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Đăng xuất
              </button>
            </div>
          )}

          {!currentUser && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="action-btn"
              style={{
                background: 'var(--accent, #10b981)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                cursor: 'pointer',
                color: '#000',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              🔑 Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* Setup / Media Loader / Dashboard Screen */}
      {!videoData && !isProcessing && (
        <ProjectDashboard />
      )}

      {/* Processing Loader Screen */}
      {isProcessing && (
        <main className="setup-view">
          <div className="setup-card" style={{padding: '50px'}}>
            <div className="loading-container">
              <div className="spinner"></div>
              <h3 style={{fontSize: '18px', fontWeight: 600}}>{statusMessage}</h3>
              {uploadProgress > 0 && (
                <div style={{ width: '100%', maxWidth: '300px', marginTop: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #22c55e, #10b981)', borderRadius: '10px', transition: 'width 0.2s ease-out' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Tiến trình tải lên</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-secondary, #171923)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--accent, #10b981)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ Cấu hình hệ thống
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', outline: 'none' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  🔑 Gemini API Key (Cá nhân)
                </label>
                <input 
                  type="password" 
                  placeholder="Dán Gemini API Key của bạn (Để trống nếu muốn dùng bể chứa của hệ thống)..." 
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-tertiary, #0d0d14)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  Nếu để trống, hệ thống sẽ tự động dùng và xoay vòng các API Key trong bể chứa trung tâm.
                </small>
              </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="action-btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  background: 'var(--accent, #10b981)',
                  color: '#000',
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal Overlay */}
      {showAuthModal && !currentUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ position: 'relative' }}>
            <AuthScreen onClose={() => setShowAuthModal(false)} />
          </div>
        </div>
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
