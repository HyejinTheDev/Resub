import React, { useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { hexToRgba, parseTimeToSeconds, formatTime, formatSecondsToCustomTime } from '../../shared/utils/timeFormatter';
import { PRESET_COLORS } from '../../shared/config/constants';

export default function PreviewPlayer({ videoRef }) {
  const {
    videoData,
    videoTransform,
    cropStyle,
    setCropStyle,
    activeBlurIndex,
    setActiveBlurIndex,
    blurMasks,
    setBlurMasks,
    subtitleStyle,
    setSubtitleStyle,
    subtitles,
    activeSubtitleIndex,
    setInspectorTab,
    saveHistory
  } = useProjectStore();

  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    videoDuration,
    setVideoDuration,
    videoDimensions,
    setVideoDimensions,
    bgVolume
  } = usePlaybackStore();

  const isDraggingMaskRef = useRef(false);
  const isResizingMaskRef = useRef(false);
  const isResizingMaskCornerRef = useRef(false);
  const isDraggingTextRef = useRef(false);
  const isResizingTextRef = useRef(false);
  const isResizingWidthRef = useRef(false);
  const isDraggingCropRef = useRef(false);
  const isResizingCropRef = useRef(false);

  // Sync volume with bgVolume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = bgVolume;
    }
  }, [bgVolume, videoData]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);

    // Focus the translation input of the currently active subtitle card in the left panel
    if (activeSubtitleIndex !== -1) {
      setTimeout(() => {
        const activeInput = document.getElementById(`sub-input-${activeSubtitleIndex}`);
        if (activeInput) {
          activeInput.focus();
          activeInput.select();
        }
      }, 50);
    }
  };

  const handleCenterPanelClick = (e) => {
    // If user clicks the background panel itself or the video container
    if (e.target.className === 'center-panel' || e.target.className === 'video-container') {
      if (activeSubtitleIndex !== -1) {
        const activeInput = document.getElementById(`sub-input-${activeSubtitleIndex}`);
        if (activeInput) {
          activeInput.focus();
          activeInput.select();
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setVideoDuration(videoRef.current.duration);
    setVideoDimensions({
      width: videoRef.current.videoWidth || 1280,
      height: videoRef.current.videoHeight || 720
    });
  };

  const getCropDimensions = () => {
    if (cropStyle.aspectRatio === 'original') {
      return { w: 100, h: 100 };
    }
    const targetRatio = cropStyle.aspectRatio === '9:16' ? 9/16 :
                        cropStyle.aspectRatio === '16:9' ? 16/9 : 1.0;
    const videoRatio = videoDimensions.width / videoDimensions.height || 16/9;
    
    let h = cropStyle.heightPercent;
    let w = h * targetRatio / videoRatio;
    
    if (w > 100) {
      const scale = 100 / w;
      w = 100;
      h = h * scale;
    }
    return { w: Math.round(w), h: Math.round(h) };
  };

  // Drag Crop Box
  const handleCropMouseDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    saveHistory();
    isDraggingCropRef.current = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startXPercent = cropStyle.xPercent;
    const startYPercent = cropStyle.yPercent;
    
    const videoContainerEl = videoRef.current ? videoRef.current.parentElement : null;
    if (!videoContainerEl) return;
    const rect = videoContainerEl.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    
    const { w, h } = getCropDimensions();

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingCropRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      const deltaXPercent = (deltaX / containerWidth) * 100;
      const deltaYPercent = (deltaY / containerHeight) * 100;
      
      const halfW = w / 2;
      const halfH = h / 2;
      
      const newX = Math.max(halfW, Math.min(100 - halfW, startXPercent + deltaXPercent));
      const newY = Math.max(halfH, Math.min(100 - halfH, startYPercent + deltaYPercent));
      
      setCropStyle({
        ...cropStyle,
        xPercent: Math.round(newX),
        yPercent: Math.round(newY)
      });
    };

    const handleMouseUp = () => {
      isDraggingCropRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Resize Crop Box
  const handleCropResizeMouseDown = (corner, e) => {
    e.stopPropagation();
    e.preventDefault();
    saveHistory();
    isResizingCropRef.current = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startHeight = cropStyle.heightPercent;
    
    const videoContainerEl = videoRef.current ? videoRef.current.parentElement : null;
    if (!videoContainerEl) return;
    const rect = videoContainerEl.getBoundingClientRect();
    const containerHeight = rect.height;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingCropRef.current) return;
      const deltaY = moveEvent.clientY - startY;
      
      let changeY = (deltaY / containerHeight) * 100;
      if (corner === 'tl' || corner === 'tr') {
        changeY = -changeY;
      }
      
      const newHeight = Math.max(20, Math.min(100, startHeight + changeY));
      
      setCropStyle(prev => {
        const nextStyle = { ...prev, heightPercent: Math.round(newHeight) };
        const targetRatio = prev.aspectRatio === '9:16' ? 9/16 :
                            prev.aspectRatio === '16:9' ? 16/9 : 1.0;
        const videoRatio = videoDimensions.width / videoDimensions.height || 16/9;
        
        let tempH = newHeight;
        let tempW = tempH * targetRatio / videoRatio;
        if (tempW > 100) {
          const scale = 100 / tempW;
          tempW = 100;
          tempH = tempH * scale;
        }
        
        const halfW = tempW / 2;
        const halfH = tempH / 2;
        
        const boundedX = Math.max(halfW, Math.min(100 - halfW, prev.xPercent));
        const boundedY = Math.max(halfH, Math.min(100 - halfH, prev.yPercent));
        
        return {
          ...nextStyle,
          heightPercent: Math.round(tempH),
          xPercent: Math.round(boundedX),
          yPercent: Math.round(boundedY)
        };
      });
    };

    const handleMouseUp = () => {
      isResizingCropRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Drag Blur Mask
  const handleMaskMouseDown = (index, e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setActiveBlurIndex(index);
    saveHistory();
    
    isDraggingMaskRef.current = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const mask = blurMasks[index];
    const startXPercent = mask.xPercentage !== undefined ? mask.xPercentage : 50;
    const startYPercent = mask.yPercentage;
    const videoContainerEl = videoRef.current ? videoRef.current.parentElement : null;
    if (!videoContainerEl) return;
    const rect = videoContainerEl.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingMaskRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      const deltaXPercent = (deltaX / containerWidth) * 100;
      const deltaYPercent = (deltaY / containerHeight) * 100;
      
      const newX = Math.max(5, Math.min(95, startXPercent + deltaXPercent));
      const newY = Math.max(5, Math.min(95, startYPercent + deltaYPercent));
      
      setBlurMasks(blurMasks.map((item, idx) => 
        idx === index ? { ...item, xPercentage: Math.round(newX), yPercentage: Math.round(newY) } : item
      ));
    };

    const handleMouseUp = () => {
      isDraggingMaskRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Resize Blur Mask Corner
  const handleMaskCornerResizeMouseDown = (index, corner, e) => {
    e.stopPropagation();
    e.preventDefault();
    saveHistory();
    isResizingMaskCornerRef.current = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const mask = blurMasks[index];
    const startWidth = mask.widthPercentage !== undefined ? mask.widthPercentage : 80;
    const startHeight = mask.heightPercentage;
    
    const videoContainerEl = videoRef.current ? videoRef.current.parentElement : null;
    if (!videoContainerEl) return;
    const rect = videoContainerEl.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingMaskCornerRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      const deltaXPercent = (deltaX / containerWidth) * 100 * 2;
      const deltaYPercent = (deltaY / containerHeight) * 100 * 2;
      
      let changeX = 0;
      let changeY = 0;
      
      if (corner === 'br') {
        changeX = deltaXPercent;
        changeY = deltaYPercent;
      } else if (corner === 'tr') {
        changeX = deltaXPercent;
        changeY = -deltaYPercent;
      } else if (corner === 'bl') {
        changeX = -deltaXPercent;
        changeY = deltaYPercent;
      } else if (corner === 'tl') {
        changeX = -deltaXPercent;
        changeY = -deltaYPercent;
      }
      
      const newWidth = Math.max(10, Math.min(95, startWidth + changeX));
      const newHeight = Math.max(5, Math.min(50, startHeight + changeY));
      
      setBlurMasks(blurMasks.map((item, idx) => 
        idx === index ? { ...item, widthPercentage: Math.round(newWidth), heightPercentage: Math.round(newHeight) } : item
      ));
    };

    const handleMouseUp = () => {
      isResizingMaskCornerRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Resize Blur Mask Edges
  const handleMaskEdgeResizeMouseDown = (index, edge, e) => {
    e.stopPropagation();
    e.preventDefault();
    saveHistory();
    isResizingMaskRef.current = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const mask = blurMasks[index];
    const startWidth = mask.widthPercentage !== undefined ? mask.widthPercentage : 80;
    const startHeight = mask.heightPercentage;
    
    const videoContainerEl = videoRef.current ? videoRef.current.parentElement : null;
    if (!videoContainerEl) return;
    const rect = videoContainerEl.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingMaskRef.current) return;
      
      if (edge === 'left' || edge === 'right') {
        const deltaX = moveEvent.clientX - startX;
        const deltaPercent = (deltaX / containerWidth) * 100 * 2;
        let newWidth = startWidth;
        if (edge === 'right') {
          newWidth = Math.max(10, Math.min(95, startWidth + deltaPercent));
        } else {
          newWidth = Math.max(10, Math.min(95, startWidth - deltaPercent));
        }
        setBlurMasks(blurMasks.map((item, idx) => 
          idx === index ? { ...item, widthPercentage: Math.round(newWidth) } : item
        ));
      } else {
        const deltaY = moveEvent.clientY - startY;
        const deltaPercent = (deltaY / containerHeight) * 100 * 2;
        let newHeight = startHeight;
        if (edge === 'bottom') {
          newHeight = Math.max(5, Math.min(50, startHeight + deltaPercent));
        } else {
          newHeight = Math.max(5, Math.min(50, startHeight - deltaPercent));
        }
        setBlurMasks(blurMasks.map((item, idx) => 
          idx === index ? { ...item, heightPercentage: Math.round(newHeight) } : item
        ));
      }
    };

    const handleMouseUp = () => {
      isResizingMaskRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Drag Text Overlay
  const handleTextMouseDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    saveHistory();
    isDraggingTextRef.current = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startXPercent = subtitleStyle.xPercent;
    const startYPercent = subtitleStyle.yPercent;
    
    const videoContainerEl = videoRef.current ? videoRef.current.parentElement : null;
    if (!videoContainerEl) return;
    const rect = videoContainerEl.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingTextRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      const deltaXPercent = (deltaX / containerWidth) * 100;
      const deltaYPercent = (deltaY / containerHeight) * 100;
      
      const newX = Math.max(5, Math.min(95, startXPercent + deltaXPercent));
      const newY = Math.max(5, Math.min(95, startYPercent + deltaYPercent));
      
      setSubtitleStyle({
        ...subtitleStyle,
        xPercent: Math.round(newX),
        yPercent: Math.round(newY)
      });
    };

    const handleMouseUp = () => {
      isDraggingTextRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Scale Font Size via Corners
  const handleTextCornerResizeMouseDown = (corner, e) => {
    e.stopPropagation();
    e.preventDefault();
    saveHistory();
    isResizingTextRef.current = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startFontSize = subtitleStyle.fontSize;
    const startWidthPercent = subtitleStyle.widthPercent || 80;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingTextRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let change = 0;
      if (corner === 'br') {
        change = (deltaX + deltaY) / 2;
      } else if (corner === 'tr') {
        change = (deltaX - deltaY) / 2;
      } else if (corner === 'bl') {
        change = (-deltaX + deltaY) / 2;
      } else if (corner === 'tl') {
        change = (-deltaX - deltaY) / 2;
      }
      
      const newFontSize = Math.max(10, Math.min(60, startFontSize + Math.round(change / 4)));
      const ratio = newFontSize / startFontSize;
      const newWidthPercent = Math.max(15, Math.min(95, Math.round(startWidthPercent * ratio)));

      setSubtitleStyle({
        ...subtitleStyle,
        fontSize: newFontSize,
        widthPercent: newWidthPercent
      });
    };

    const handleMouseUp = () => {
      isResizingTextRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Stretch width via side edges
  const handleTextEdgeResizeMouseDown = (edge, e) => {
    e.stopPropagation();
    e.preventDefault();
    saveHistory();
    isResizingWidthRef.current = true;

    const startX = e.clientX;
    const startWidthPercent = subtitleStyle.widthPercent || 80;
    const videoContainerEl = videoRef.current ? videoRef.current.parentElement : null;
    if (!videoContainerEl) return;
    const rect = videoContainerEl.getBoundingClientRect();
    const containerWidth = rect.width;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingWidthRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100 * 2;
      
      let newWidthPercent = startWidthPercent;
      if (edge === 'right') {
        newWidthPercent = Math.max(15, Math.min(95, startWidthPercent + deltaPercent));
      } else {
        newWidthPercent = Math.max(15, Math.min(95, startWidthPercent - deltaPercent));
      }

      setSubtitleStyle({
        ...subtitleStyle,
        widthPercent: Math.round(newWidthPercent)
      });
    };

    const handleMouseUp = () => {
      isResizingWidthRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const isAnyMaskActiveAtCurrentTime = blurMasks.some(mask => {
    const start = parseTimeToSeconds(mask.startTime);
    const end = parseTimeToSeconds(mask.endTime);
    return currentTime >= start && currentTime <= end;
  });

  return (
    <section className="center-panel" style={{ width: '100%', height: '100%' }} onClick={handleCenterPanelClick}>
      <div className="video-container" style={{ aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` }}>
        <video 
          src={videoData.videoUrl}
          ref={videoRef}
          className="video-player"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onClick={togglePlay}
          style={{
            transform: `scale(${videoTransform.zoom / 100}) translate(${videoTransform.xOffset}%, ${videoTransform.yOffset}%) rotate(${videoTransform.rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out'
          }}
        />
        
        {cropStyle.aspectRatio !== 'original' && (() => {
          const { w: cW, h: cH } = getCropDimensions();
          const cL = cropStyle.xPercent - cW / 2;
          const cT = cropStyle.yPercent - cH / 2;
          
          return (
            <div 
              className="crop-preview-box"
              style={{
                left: `${cL}%`,
                top: `${cT}%`,
                width: `${cW}%`,
                height: `${cH}%`,
                position: 'absolute',
                border: '2px dashed var(--accent)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                cursor: 'move',
                zIndex: 10,
                boxSizing: 'border-box'
              }}
              onMouseDown={handleCropMouseDown}
            >
              {/* Bounding handles */}
              <div style={{
                position: 'absolute', top: '-6px', left: '-6px', width: '12px', height: '12px',
                borderLeft: '3px solid var(--accent)', borderTop: '3px solid var(--accent)',
                cursor: 'nwse-resize', zIndex: 11
              }} onMouseDown={(e) => handleCropResizeMouseDown('tl', e)} />
              
              <div style={{
                position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px',
                borderRight: '3px solid var(--accent)', borderTop: '3px solid var(--accent)',
                cursor: 'nesw-resize', zIndex: 11
              }} onMouseDown={(e) => handleCropResizeMouseDown('tr', e)} />
              
              <div style={{
                position: 'absolute', bottom: '-6px', left: '-6px', width: '12px', height: '12px',
                borderLeft: '3px solid var(--accent)', borderBottom: '3px solid var(--accent)',
                cursor: 'nesw-resize', zIndex: 11
              }} onMouseDown={(e) => handleCropResizeMouseDown('bl', e)} />
              
              <div style={{
                position: 'absolute', bottom: '-6px', right: '-6px', width: '12px', height: '12px',
                borderRight: '3px solid var(--accent)', borderBottom: '3px solid var(--accent)',
                cursor: 'nwse-resize', zIndex: 11
              }} onMouseDown={(e) => handleCropResizeMouseDown('br', e)} />
              
              <div style={{
                position: 'absolute', top: '6px', left: '6px', background: 'rgba(0, 0, 0, 0.8)',
                color: '#fff', fontSize: '9px', padding: '2px 6px', borderRadius: '3px',
                fontWeight: 'bold', pointerEvents: 'none', letterSpacing: '0.5px'
              }}>
                CẮT: {cropStyle.aspectRatio}
              </div>
            </div>
          );
        })()}

        {blurMasks.map((mask, i) => {
          const start = parseTimeToSeconds(mask.startTime);
          const end = parseTimeToSeconds(mask.endTime);
          const isActiveTime = currentTime >= start && currentTime <= end;
          if (!isActiveTime) return null;
          
          const isSelected = activeBlurIndex === i;
          const xVal = mask.xPercentage !== undefined ? mask.xPercentage : 50;
          const wVal = mask.widthPercentage !== undefined ? mask.widthPercentage : 80;
          const leftVal = xVal - wVal / 2;
          const topVal = mask.yPercentage - mask.heightPercentage / 2;

          return (
            <div 
              key={mask.id || i}
              className={`video-blur-mask ${isSelected ? 'active-selection' : ''}`}
              style={{
                left: `${leftVal}%`,
                top: `${topVal}%`,
                width: `${wVal}%`,
                height: `${mask.heightPercentage}%`,
                pointerEvents: 'auto',
                cursor: 'move',
                position: 'absolute',
                zIndex: 8,
                boxSizing: 'border-box'
              }}
              onMouseDown={(e) => handleMaskMouseDown(i, e)}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backdropFilter: `blur(${mask.blurRadius}px) brightness(1.0)`,
                WebkitBackdropFilter: `blur(${mask.blurRadius}px) brightness(1.0)`,
                backgroundColor: hexToRgba(mask.color, mask.opacity),
                maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                pointerEvents: 'none'
              }}></div>
              
              {isSelected && (
                <>
                  <div className="mask-select-border" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    border: '1.5px dashed rgba(16, 185, 129, 0.8)', pointerEvents: 'none'
                  }}></div>

                  <div className="mask-resize-handle tl" style={{
                    position: 'absolute', top: '-4px', left: '-4px', width: '8px', height: '8px',
                    background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
                    cursor: 'nwse-resize', zIndex: 10
                  }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'tl', e)}></div>

                  <div className="mask-resize-handle tr" style={{
                    position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px',
                    background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
                    cursor: 'nesw-resize', zIndex: 10
                  }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'tr', e)}></div>

                  <div className="mask-resize-handle bl" style={{
                    position: 'absolute', bottom: '-4px', left: '-4px', width: '8px', height: '8px',
                    background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
                    cursor: 'nesw-resize', zIndex: 10
                  }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'bl', e)}></div>

                  <div className="mask-resize-handle br" style={{
                    position: 'absolute', bottom: '-4px', right: '-4px', width: '8px', height: '8px',
                    background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
                    cursor: 'nwse-resize', zIndex: 10
                  }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'br', e)}></div>

                  <div className="mask-edge-handle top" style={{
                    position: 'absolute', top: '-4px', left: '10%', right: '10%', height: '6px',
                    cursor: 'ns-resize', zIndex: 9
                  }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'top', e)}></div>

                  <div className="mask-edge-handle bottom" style={{
                    position: 'absolute', bottom: '-4px', left: '10%', right: '10%', height: '6px',
                    cursor: 'ns-resize', zIndex: 9
                  }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'bottom', e)}></div>

                  <div className="mask-edge-handle left" style={{
                    position: 'absolute', left: '-4px', top: '10%', bottom: '10%', width: '6px',
                    cursor: 'ew-resize', zIndex: 9
                  }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'left', e)}></div>

                  <div className="mask-edge-handle right" style={{
                    position: 'absolute', right: '-4px', top: '10%', bottom: '10%', width: '6px',
                    cursor: 'ew-resize', zIndex: 9
                  }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'right', e)}></div>
                </>
              )}
            </div>
          );
        })}

        {activeSubtitleIndex !== -1 && subtitles[activeSubtitleIndex] && (
          <div 
            className="subtitle-overlay active-selection" 
            style={{
              left: `${subtitleStyle.xPercent}%`,
              top: `${subtitleStyle.yPercent}%`,
              width: `${subtitleStyle.widthPercent || 80}%`,
              transform: 'translate(-50%, -50%)',
              position: 'absolute',
              cursor: 'move',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
            onMouseDown={handleTextMouseDown}
          >
            <div 
              className={`subtitle-text ${isAnyMaskActiveAtCurrentTime ? 'no-bg' : ''}`}
              style={{
                fontSize: `${subtitleStyle.fontSize}px`,
                color: subtitleStyle.color,
                backgroundColor: subtitleStyle.bg || 'transparent',
                borderColor: subtitleStyle.outlineColor,
                fontWeight: subtitleStyle.bold ? 'bold' : 'normal',
                fontStyle: subtitleStyle.italic ? 'italic' : 'normal',
                textShadow: subtitleStyle.shadow || isAnyMaskActiveAtCurrentTime
                  ? `0 2px 4px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.95)` 
                  : 'none',
                border: subtitleStyle.bg !== 'transparent' && !isAnyMaskActiveAtCurrentTime ? 'none' : undefined,
                padding: subtitleStyle.bg !== 'transparent' && !isAnyMaskActiveAtCurrentTime ? '4px 10px' : '0',
                borderRadius: subtitleStyle.bg !== 'transparent' && !isAnyMaskActiveAtCurrentTime ? '4px' : '0',
                width: '100%',
                textAlign: 'center',
                wordBreak: 'break-word',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}
            >
              {subtitles[activeSubtitleIndex].text}
            </div>
            
            <div className="text-select-border" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              border: '1.5px dashed rgba(16, 185, 129, 0.8)', pointerEvents: 'none', borderRadius: '4px'
            }}></div>

            <div className="text-resize-handle tl" style={{
              position: 'absolute', top: '-4px', left: '-4px', width: '8px', height: '8px',
              background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
              cursor: 'nwse-resize', zIndex: 10
            }} onMouseDown={(e) => handleTextCornerResizeMouseDown('tl', e)}></div>

            <div className="text-resize-handle tr" style={{
              position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px',
              background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
              cursor: 'nesw-resize', zIndex: 10
            }} onMouseDown={(e) => handleTextCornerResizeMouseDown('tr', e)}></div>

            <div className="text-resize-handle bl" style={{
              position: 'absolute', bottom: '-4px', left: '-4px', width: '8px', height: '8px',
              background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
              cursor: 'nesw-resize', zIndex: 10
            }} onMouseDown={(e) => handleTextCornerResizeMouseDown('bl', e)}></div>

            <div className="text-resize-handle br" style={{
              position: 'absolute', bottom: '-4px', right: '-4px', width: '8px', height: '8px',
              background: 'var(--accent)', border: '1.5px solid #fff', borderRadius: '50%',
              cursor: 'nwse-resize', zIndex: 10
            }} onMouseDown={(e) => handleTextCornerResizeMouseDown('br', e)}></div>

            <div className="text-edge-handle left" style={{
              position: 'absolute', top: '10%', bottom: '10%', left: '-4px', width: '6px',
              cursor: 'ew-resize', zIndex: 9, background: 'transparent'
            }} onMouseDown={(e) => handleTextEdgeResizeMouseDown('left', e)}>
              <div style={{
                position: 'absolute', top: '50%', left: '1px', transform: 'translateY(-50%)',
                width: '4px', height: '10px', background: 'var(--accent)', borderRadius: '2px'
              }}></div>
            </div>

            <div className="text-edge-handle right" style={{
              position: 'absolute', top: '10%', bottom: '10%', right: '-4px', width: '6px',
              cursor: 'ew-resize', zIndex: 9, background: 'transparent'
            }} onMouseDown={(e) => handleTextEdgeResizeMouseDown('right', e)}>
              <div style={{
                position: 'absolute', top: '50%', right: '1px', transform: 'translateY(-50%)',
                width: '4px', height: '10px', background: 'var(--accent)', borderRadius: '2px'
              }}></div>
            </div>
          </div>
        )}
      </div>

      <div className="player-controls" style={{justifyContent: 'center', gap: '20px'}}>
        <button className="control-btn" onClick={togglePlay}>
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          )}
        </button>
        <div style={{fontSize: '13px', minWidth: '80px', textAlign: 'center'}}>
          {formatTime(currentTime)} / {formatTime(videoDuration)}
        </div>
      </div>
    </section>
  );
}
