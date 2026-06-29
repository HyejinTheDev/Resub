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
    setInspectorTab
  } = useProjectStore();

  const {
    currentTime,
    setCurrentTime,
    videoDuration,
    isPlaying
  } = usePlaybackStore();

  const timelineRef = useRef(null);
  const isScrubbingRef = useRef(false);

  // Auto-scroll timeline to keep playhead centered during playback
  useEffect(() => {
    if (timelineRef.current && isPlaying) {
      const pixelsPerSecond = 50;
      const scrollPos = currentTime * pixelsPerSecond - timelineRef.current.clientWidth / 2;
      timelineRef.current.scrollLeft = Math.max(0, scrollPos);
    }
  }, [currentTime, isPlaying]);

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
      const pixelsPerSecond = 50;
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
    
    const startX = e.clientX;
    const sub = subtitles[index];
    const originalStart = parseTimeToSeconds(sub.startTime);
    const originalEnd = parseTimeToSeconds(sub.endTime);
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSeconds = deltaX / 50; // 50px = 1 second
      
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
    
    const startX = e.clientX;
    const mask = blurMasks[index];
    const originalStart = parseTimeToSeconds(mask.startTime);
    const originalEnd = parseTimeToSeconds(mask.endTime);
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSeconds = deltaX / 50; // 50px = 1 second
      
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
        <div className="timeline-label-header"></div>
        <div className="timeline-label-item" style={{ cursor: 'pointer' }} onClick={() => setInspectorTab('video')}>Video</div>
        <div className="timeline-label-item">Phụ Đề dịch</div>
        <div className="timeline-label-item">Lồng Tiếng</div>
        <div className="timeline-label-item">Làm Mờ</div>
      </div>

      {/* Scrollable Right Tracks Container */}
      <div className="timeline-scroll-container" ref={timelineRef} onMouseDown={handleTimelineMouseDown}>
        <div className="timeline-tracks">
          {/* Timeline rulers */}
          <div className="timeline-ruler">
            {Array.from({ length: Math.ceil(videoDuration || 30) }).map((_, i) => (
              i % 5 === 0 ? (
                <div key={i} className="ruler-tick" style={{ left: `${i * 50}px` }}>
                  <span className="ruler-label">{formatTime(i)}</span>
                </div>
              ) : null
            ))}
          </div>

          {/* Video Track Content */}
          <div className="timeline-track-content">
            <div 
              className="timeline-block video" 
              style={{ left: 0, width: `${(videoDuration || 30) * 50}px`, cursor: 'pointer' }}
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
                  style={{ left: `${start * 50}px`, width: `${duration * 50}px` }}
                  onClick={() => {
                    setActiveSubtitleIndex(i);
                    handleSeek(start);
                  }}
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
                  style={{ left: `${start * 50}px`, width: `${duration * 50}px` }}
                  onClick={() => {
                    setActiveSubtitleIndex(i);
                    handleSeek(start);
                  }}
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
                    left: `${start * 50}px`, 
                    width: `${duration * 50}px`,
                    background: activeBlurIndex === i ? 'var(--accent-glow)' : 'rgba(16, 185, 129, 0.25)',
                    border: activeBlurIndex === i ? '1.5px solid var(--accent)' : '1px solid rgba(16, 185, 129, 0.4)'
                  }}
                  onClick={() => {
                    setActiveBlurIndex(i);
                    setInspectorTab('mask');
                    handleSeek(start);
                  }}
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
          <div className="timeline-playhead" style={{ left: `${currentTime * 50}px` }}>
            <div className="timeline-playhead-cap"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
