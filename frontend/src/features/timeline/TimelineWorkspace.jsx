import React, { useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { parseTimeToSeconds, formatTime, formatSecondsToCustomTime } from '../../shared/utils/timeFormatter';

export default function TimelineWorkspace({ videoRef }) {
  const {
    subtitles,
    setSubtitles,
    activeSubtitleIndex,
    setActiveSubtitleIndex,
    blurMasks,
    setBlurMasks,
    activeBlurIndex,
    setActiveBlurIndex,
    setInspectorTab,
    saveHistory
  } = useProjectStore();

  const {
    currentTime,
    setCurrentTime,
    videoDuration,
    isPlaying,
    pixelsPerSecond,
    setPixelsPerSecond
  } = usePlaybackStore();

  const timelineRef = useRef(null);
  const isScrubbingRef = useRef(false);

  // Auto-scroll timeline to keep playhead centered during playback
  useEffect(() => {
    if (timelineRef.current && isPlaying) {
      const scrollPos = currentTime * pixelsPerSecond - timelineRef.current.clientWidth / 2;
      timelineRef.current.scrollLeft = Math.max(0, scrollPos);
    }
  }, [currentTime, isPlaying, pixelsPerSecond]);

  // Alt + Mouse Wheel Zoom Listener
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    const handleWheelEvent = (e) => {
      if (e.altKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 5 : -5;
        const newZoom = Math.min(Math.max(pixelsPerSecond + zoomDelta, 20), 150);
        setPixelsPerSecond(newZoom);
      }
    };

    el.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelEvent);
    };
  }, [pixelsPerSecond, setPixelsPerSecond]);

  const handleTimelineMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.timeline-block-resize-handle')) return;

    const isTimelineClick = e.target.closest('.timeline-ruler') || 
                            e.target.closest('.timeline-tracks') || 
                            e.target.closest('.timeline-playhead') ||
                            e.target.closest('.timeline-playhead-cap') ||
                            e.target.classList.contains('timeline-scroll-container');
                            
    if (!isTimelineClick) return;
    
    isScrubbingRef.current = true;
    
    const wasPlaying = isPlaying;
    if (wasPlaying && videoRef.current) {
      videoRef.current.pause();
    }
    
    const doScrub = (clientX) => {
      if (!timelineRef.current) return;
      const tracksEl = timelineRef.current.querySelector('.timeline-tracks');
      if (!tracksEl) return;
      const rect = tracksEl.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const targetTime = Math.max(0, Math.min(clickX / pixelsPerSecond, videoDuration || 0));
      
      if (videoRef.current) {
        videoRef.current.currentTime = targetTime;
      }
      setCurrentTime(targetTime);
    };

    doScrub(e.clientX);

    const handleMouseMove = (moveEvent) => {
      if (!isScrubbingRef.current) return;
      doScrub(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      isScrubbingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (wasPlaying && videoRef.current) {
        videoRef.current.play();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTimelineBlockResizeMouseDown = (index, edge, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Save history snapshot before resize action starts
    saveHistory();
    
    const startX = e.clientX;
    const sub = subtitles[index];
    const originalStart = parseTimeToSeconds(sub.startTime);
    const originalEnd = parseTimeToSeconds(sub.endTime);
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSeconds = deltaX / pixelsPerSecond;
      
      if (edge === 'left') {
        const newStart = Math.max(0, Math.min(originalEnd - 0.1, originalStart + deltaSeconds));
        setSubtitles(subtitles.map((item, idx) => 
          idx === index ? { ...item, startTime: formatSecondsToCustomTime(newStart) } : item
        ));
      } else {
        const newEnd = Math.max(originalStart + 0.1, Math.min(videoDuration || 30, originalEnd + deltaSeconds));
        setSubtitles(subtitles.map((item, idx) => 
          idx === index ? { ...item, endTime: formatSecondsToCustomTime(newEnd) } : item
        ));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleBlurBlockResizeMouseDown = (index, edge, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Save history snapshot before resize action starts
    saveHistory();
    
    const startX = e.clientX;
    const mask = blurMasks[index];
    const originalStart = parseTimeToSeconds(mask.startTime);
    const originalEnd = parseTimeToSeconds(mask.endTime);
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSeconds = deltaX / pixelsPerSecond;
      
      if (edge === 'left') {
        const newStart = Math.max(0, Math.min(originalEnd - 0.2, originalStart + deltaSeconds));
        setBlurMasks(blurMasks.map((item, idx) => 
          idx === index ? { ...item, startTime: formatSecondsToCustomTime(newStart) } : item
        ));
      } else {
        const newEnd = Math.max(originalStart + 0.2, Math.min(videoDuration || 30, originalEnd + deltaSeconds));
        setBlurMasks(blurMasks.map((item, idx) => 
          idx === index ? { ...item, endTime: formatSecondsToCustomTime(newEnd) } : item
        ));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTimelineBlockDragMouseDown = (index, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    saveHistory();
    
    const startX = e.clientX;
    const sub = subtitles[index];
    const originalStart = parseTimeToSeconds(sub.startTime);
    const originalEnd = parseTimeToSeconds(sub.endTime);
    const blockDuration = originalEnd - originalStart;

    let hasDragged = false;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 2) {
        hasDragged = true;
      }
      const deltaSeconds = deltaX / pixelsPerSecond;
      
      const newStart = Math.max(0, Math.min((videoDuration || 30) - blockDuration, originalStart + deltaSeconds));
      const newEnd = newStart + blockDuration;
      
      setSubtitles(subtitles.map((item, idx) => 
        idx === index ? { 
          ...item, 
          startTime: formatSecondsToCustomTime(newStart), 
          endTime: formatSecondsToCustomTime(newEnd) 
        } : item
      ));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (!hasDragged) {
        setActiveSubtitleIndex(index);
        handleSeek(originalStart);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleBlurBlockDragMouseDown = (index, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    saveHistory();
    
    const startX = e.clientX;
    const mask = blurMasks[index];
    const originalStart = parseTimeToSeconds(mask.startTime);
    const originalEnd = parseTimeToSeconds(mask.endTime);
    const blockDuration = originalEnd - originalStart;

    let hasDragged = false;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 2) {
        hasDragged = true;
      }
      const deltaSeconds = deltaX / pixelsPerSecond;
      
      const newStart = Math.max(0, Math.min((videoDuration || 30) - blockDuration, originalStart + deltaSeconds));
      const newEnd = newStart + blockDuration;
      
      setBlurMasks(blurMasks.map((item, idx) => 
        idx === index ? { 
          ...item, 
          startTime: formatSecondsToCustomTime(newStart), 
          endTime: formatSecondsToCustomTime(newEnd) 
        } : item
      ));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (!hasDragged) {
        setActiveBlurIndex(index);
        setInspectorTab('mask');
        handleSeek(originalStart);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSeek = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  return (
    <div className="timeline-container">
      {/* Fixed Left Labels Column */}
      <div className="timeline-labels-column">
        <div className="timeline-label-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 4px' }}>
          <button 
            className="zoom-btn" 
            title="Thu nhỏ timeline (Alt + Cuộn chuột lùi)" 
            onClick={() => setPixelsPerSecond(Math.max(pixelsPerSecond - 10, 20))}
            style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
          >
            ➖
          </button>
          <span style={{ fontSize: '10px', color: '#a0a0a0', userSelect: 'none' }}>Zoom</span>
          <button 
            className="zoom-btn" 
            title="Phóng to timeline (Alt + Cuộn chuột tiến)" 
            onClick={() => setPixelsPerSecond(Math.min(pixelsPerSecond + 10, 150))}
            style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
          >
            ➕
          </button>
        </div>
        <div className="timeline-label-item" style={{ cursor: 'pointer' }} onClick={() => setInspectorTab('video')}>Video</div>
        <div className="timeline-label-item">Phụ Đề dịch</div>
        <div className="timeline-label-item">Lồng Tiếng</div>
        <div className="timeline-label-item">Làm Mờ</div>
      </div>

      {/* Scrollable Right Tracks Container */}
      <div className="timeline-scroll-container" ref={timelineRef} onMouseDown={handleTimelineMouseDown}>
        <div className="timeline-tracks" style={{ width: `${Math.max(100, (videoDuration || 30) * pixelsPerSecond + 200)}px` }}>
          {/* Timeline rulers */}
          <div className="timeline-ruler">
            {Array.from({ length: Math.ceil(videoDuration || 30) }).map((_, i) => (
              i % 5 === 0 ? (
                <div key={i} className="ruler-tick" style={{ left: `${i * pixelsPerSecond}px` }}>
                  <span className="ruler-label">{formatTime(i)}</span>
                </div>
              ) : null
            ))}
          </div>

          {/* Video Track Content */}
          <div className="timeline-track-content">
            <div 
              className="timeline-block video" 
              style={{ left: 0, width: `${(videoDuration || 30) * pixelsPerSecond}px`, cursor: 'pointer' }}
              onClick={() => setInspectorTab('video')}
            >
              Băng Video Gốc ({formatTime(videoDuration)})
            </div>
          </div>

          {/* Subtitles Track Content */}
          <div className="timeline-track-content">
            {subtitles.map((sub, i) => {
              const start = parseTimeToSeconds(sub.startTime);
              const end = parseTimeToSeconds(sub.endTime);
              const duration = end - start;
              return (
                <div 
                  key={i}
                  className={`timeline-block subtitle ${activeSubtitleIndex === i ? 'active' : ''}`}
                  style={{ left: `${start * pixelsPerSecond}px`, width: `${duration * pixelsPerSecond}px` }}
                  onMouseDown={(e) => handleTimelineBlockDragMouseDown(i, e)}
                  title={sub.text}
                >
                  <div className="timeline-block-resize-handle left" onMouseDown={(e) => handleTimelineBlockResizeMouseDown(i, 'left', e)}></div>
                  <span className="timeline-block-text">{sub.text}</span>
                  <div className="timeline-block-resize-handle right" onMouseDown={(e) => handleTimelineBlockResizeMouseDown(i, 'right', e)}></div>
                </div>
              );
            })}
          </div>

          {/* Voice Audio Dub Track Content */}
          <div className="timeline-track-content">
            {subtitles.map((sub, i) => {
              const start = parseTimeToSeconds(sub.startTime);
              const end = parseTimeToSeconds(sub.endTime);
              const duration = end - start;
              return (
                <div 
                  key={i}
                  className={`timeline-block audio ${activeSubtitleIndex === i ? 'active' : ''}`}
                  style={{ left: `${start * pixelsPerSecond}px`, width: `${duration * pixelsPerSecond}px` }}
                  onMouseDown={(e) => handleTimelineBlockDragMouseDown(i, e)}
                  title={`TTS: ${sub.text}`}
                >
                  <div className="timeline-block-resize-handle left" onMouseDown={(e) => handleTimelineBlockResizeMouseDown(i, 'left', e)}></div>
                  <span className="timeline-block-text">[VN Voice]</span>
                  <div className="timeline-block-resize-handle right" onMouseDown={(e) => handleTimelineBlockResizeMouseDown(i, 'right', e)}></div>
                </div>
              );
            })}
          </div>

          {/* Blur Mask Track Content */}
          <div className="timeline-track-content">
            {blurMasks.map((mask, i) => {
              const start = parseTimeToSeconds(mask.startTime);
              const end = parseTimeToSeconds(mask.endTime);
              const duration = end - start;
              return (
                <div 
                  key={mask.id || i}
                  className={`timeline-block blur ${activeBlurIndex === i ? 'active' : ''}`}
                  style={{ 
                    left: `${start * pixelsPerSecond}px`, 
                    width: `${duration * pixelsPerSecond}px`,
                    background: activeBlurIndex === i ? 'var(--accent-glow)' : 'rgba(16, 185, 129, 0.25)',
                    border: activeBlurIndex === i ? '1.5px solid var(--accent)' : '1px solid rgba(16, 185, 129, 0.4)'
                  }}
                  onMouseDown={(e) => handleBlurBlockDragMouseDown(i, e)}
                  title={`Làm mờ (${mask.yPercentage}%)`}
                >
                  <div className="timeline-block-resize-handle left" onMouseDown={(e) => handleBlurBlockResizeMouseDown(i, 'left', e)}></div>
                  <span className="timeline-block-text">Làm Mờ ({mask.yPercentage}%)</span>
                  <div className="timeline-block-resize-handle right" onMouseDown={(e) => handleBlurBlockResizeMouseDown(i, 'right', e)}></div>
                </div>
              );
            })}
          </div>

          {/* Red Playhead line */}
          <div className="timeline-playhead" style={{ left: `${currentTime * pixelsPerSecond}px` }}>
            <div className="timeline-playhead-cap"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
