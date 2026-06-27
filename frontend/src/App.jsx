import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3051/api';

// Available voices
const VOICES = [
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoài My (Nữ - Miền Nam)' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh (Nam - Miền Nam)' }
];

const hexToRgba = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const PRESET_COLORS = [
  { name: 'Đen', value: '#000000' },
  { name: 'Xám', value: '#1e1e1e' },
  { name: 'Trắng', value: '#ffffff' },
  { name: 'Xanh dương', value: '#1d4ed8' },
  { name: 'Đỏ', value: '#b91c1c' }
];

const TEXT_PRESETS = [
  { id: 'white-shadow', name: 'Trắng đổ bóng', color: '#ffffff', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true },
  { id: 'yellow-shadow', name: 'Vàng đổ bóng', color: '#facc15', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true },
  { id: 'black-white', name: 'Đen viền trắng', color: '#000000', outlineColor: '#ffffff', outlineWidth: 2, bg: 'transparent', shadow: false },
  { id: 'white-bg', name: 'Hộp nền đen', color: '#ffffff', outlineColor: 'transparent', outlineWidth: 0, bg: 'rgba(0, 0, 0, 0.75)', shadow: false },
  { id: 'yellow-bg', name: 'Hộp nền vàng', color: '#facc15', outlineColor: 'transparent', outlineWidth: 0, bg: 'rgba(0, 0, 0, 0.75)', shadow: false },
  { id: 'green-shadow', name: 'Xanh lá', color: '#22c55e', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true },
  { id: 'purple-shadow', name: 'Tím', color: '#a855f7', outlineColor: '#000000', outlineWidth: 2, bg: 'transparent', shadow: true },
];

export default function App() {
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [activeTab, setActiveTab] = useState('url');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // App States
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [videoData, setVideoData] = useState(null); // { videoUrl, audioUrl, videoPath, audioPath, videoId }
  const [subtitles, setSubtitles] = useState([]); // [{ startTime, endTime, chineseText, text, voice }]
  
  // Media Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [bgVolume, setBgVolume] = useState(0.15);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState(-1);
  const [defaultVoice, setDefaultVoice] = useState('vi-VN-HoaiMyNeural');
 
  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportedVideoUrl, setExportedVideoUrl] = useState('');
  const [inspectorTab, setInspectorTab] = useState('text');
  const [searchQuery, setSearchQuery] = useState('');
  const [blurMasks, setBlurMasks] = useState([]);
  const [activeBlurIndex, setActiveBlurIndex] = useState(-1);

  const [subtitleStyle, setSubtitleStyle] = useState({
    fontSize: 17,
    color: '#ffffff',
    textColorPreset: 'white-shadow',
    xPercent: 50,
    yPercent: 85,
    widthPercent: 80,
    bold: false,
    italic: false,
    outlineColor: '#000000',
    outlineWidth: 2,
    bg: 'transparent',
    shadow: true
  });

  const [leftWidth, setLeftWidth] = useState(42); // percentage
  const [rightWidth, setRightWidth] = useState(23); // percentage
  const [topHeight, setTopHeight] = useState(62); // percentage

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
  }, []);

  const isScrubbingRef = useRef(false);

  const handleTimelineMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.timeline-block')) return;

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

  const isDraggingMaskRef = useRef(false);

  const handleMaskMouseDown = (index, e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setActiveBlurIndex(index);
    
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
      
      setBlurMasks(prev => prev.map((item, idx) => 
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

  const isResizingMaskRef = useRef(false);
  const isResizingMaskCornerRef = useRef(false);

  const handleMaskCornerResizeMouseDown = (index, corner, e) => {
    e.stopPropagation();
    e.preventDefault();
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
      
      setBlurMasks(prev => prev.map((item, idx) => 
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

  const handleMaskEdgeResizeMouseDown = (index, edge, e) => {
    e.stopPropagation();
    e.preventDefault();
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
        setBlurMasks(prev => prev.map((item, idx) => 
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
        setBlurMasks(prev => prev.map((item, idx) => 
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

  const handleAddBlurMask = () => {
    const startSecs = currentTime;
    const endSecs = Math.min(videoDuration || 30, startSecs + 5);
    const newBlur = {
      id: `blur-${Date.now()}`,
      startTime: formatSecondsToCustomTime(startSecs),
      endTime: formatSecondsToCustomTime(endSecs),
      xPercentage: 50,
      yPercentage: 75,
      widthPercentage: 80,
      heightPercentage: 15,
      blurRadius: 15,
      color: '#000000',
      opacity: 0.45
    };
    setBlurMasks(prev => [...prev, newBlur]);
    setActiveBlurIndex(blurMasks.length);
  };

  const handleDeleteBlurMask = (index) => {
    setBlurMasks(prev => prev.filter((_, idx) => idx !== index));
    setActiveBlurIndex(-1);
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
        setBlurMasks(prev => prev.map((item, idx) => 
          idx === index ? { ...item, startTime: formatSecondsToCustomTime(newStart) } : item
        ));
      } else {
        const newEnd = Math.max(originalStart + 0.2, Math.min(videoDuration || 30, originalEnd + deltaSeconds));
        setBlurMasks(prev => prev.map((item, idx) => 
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

  const isDraggingTextRef = useRef(false);

  const handleTextMouseDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
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
      
      setSubtitleStyle(prev => ({
        ...prev,
        xPercent: Math.round(newX),
        yPercent: Math.round(newY)
      }));
    };

    const handleMouseUp = () => {
      isDraggingTextRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const isResizingTextRef = useRef(false);
  const isResizingWidthRef = useRef(false);

  const handleTextCornerResizeMouseDown = (corner, e) => {
    e.stopPropagation();
    e.preventDefault();
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

      setSubtitleStyle(prev => ({
        ...prev,
        fontSize: newFontSize,
        widthPercent: newWidthPercent
      }));
    };

    const handleMouseUp = () => {
      isResizingTextRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTextEdgeResizeMouseDown = (edge, e) => {
    e.stopPropagation();
    e.preventDefault();
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

      setSubtitleStyle(prev => ({
        ...prev,
        widthPercent: Math.round(newWidthPercent)
      }));
    };

    const handleMouseUp = () => {
      isResizingWidthRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const videoRef = useRef(null);
  const timelineRef = useRef(null);

  // Sync Gemini key to localStorage
  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiKey);
  }, [geminiKey]);

  // Sync HTML5 video volume with bgVolume state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = bgVolume;
    }
  }, [bgVolume, videoData]);

  // Handle Toast Notifications
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Convert "00m02s500ms" or "0:02.50" to seconds
  const parseTimeToSeconds = (timeStr) => {
    if (typeof timeStr === 'number') return timeStr;
    if (!timeStr) return 0;
    
    const match = timeStr.match(/(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?/);
    if (match && (match[1] || match[2] || match[3])) {
      const mins = parseInt(match[1] || '0', 10);
      const secs = parseInt(match[2] || '0', 10);
      const ms = parseInt(match[3] || '0', 10);
      return mins * 60 + secs + ms / 1000;
    }

    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secsParts = parts[1].split('.');
      const secs = parseInt(secsParts[0], 10);
      const ms = parseInt(secsParts[1] || '0', 10) * (secsParts[1]?.length === 2 ? 10 : 1);
      return mins * 60 + secs + ms / 1000;
    }

    return parseFloat(timeStr) || 0;
  };

  const formatSecondsToCustomTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}m${secs.toString().padStart(2, '0')}s${ms.toString().padStart(3, '0')}ms`;
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
        setSubtitles(prev => prev.map((item, idx) => 
          idx === index ? { ...item, startTime: formatSecondsToCustomTime(newStart) } : item
        ));
      } else {
        const newEnd = Math.max(originalStart + 0.1, Math.min(videoDuration || 30, originalEnd + deltaSeconds));
        setSubtitles(prev => prev.map((item, idx) => 
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

  // Keep track of which subtitle is currently active based on video playback
  useEffect(() => {
    if (!videoRef.current) return;
    const index = subtitles.findIndex(sub => {
      const start = parseTimeToSeconds(sub.startTime);
      const end = parseTimeToSeconds(sub.endTime);
      return currentTime >= start && currentTime <= end;
    });
    setActiveSubtitleIndex(index);

    // Auto-scroll timeline to keep playhead centered
    if (timelineRef.current && isPlaying) {
      const pixelsPerSecond = 50;
      const scrollPos = currentTime * pixelsPerSecond - timelineRef.current.clientWidth / 2;
      timelineRef.current.scrollLeft = Math.max(0, scrollPos);
    }
  }, [currentTime, subtitles, isPlaying]);

  // Handle Download (Douyin / TikTok link)
  const handleDownload = async () => {
    if (!videoUrlInput) return;
    setIsProcessing(true);
    setStatusMessage('Đang tải video từ liên kết (yt-dlp)...');
    setVideoData(null);
    setSubtitles([]);

    try {
      const response = await fetch(`${API_BASE_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrlInput })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to download video');
      }

      const data = await response.json();
      setVideoData(data);
      showToast('Tải video và trích xuất âm thanh thành công!');
      
      // Auto trigger transcription
      await handleTranscribe(data.audioPath);
    } catch (error) {
      showToast(`Lỗi: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    setIsProcessing(true);
    setStatusMessage('Đang tải lên video và trích xuất âm thanh...');
    setVideoData(null);
    setSubtitles([]);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload video');
      }

      const data = await response.json();
      setVideoData(data);
      showToast('Tải video cục bộ thành công!');
      
      // Auto trigger transcription
      await handleTranscribe(data.audioPath);
    } catch (error) {
      showToast(`Lỗi: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // Handle Speech Transcription & Translation via Gemini API
  const handleTranscribe = async (audioPath) => {
    if (!geminiKey) {
      showToast('Vui lòng nhập Gemini API Key để dịch thuật phụ đề!');
      setIsProcessing(false);
      return;
    }

    setStatusMessage('Gemini AI đang lắng nghe tiếng Trung & dịch sang tiếng Việt...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, geminiKey })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      // Set default voice for all segments
      const populatedSubs = data.subtitles.map(sub => ({
        ...sub,
        voice: defaultVoice
      }));
      setSubtitles(populatedSubs);
      showToast(`Hoàn tất! Đã tạo ${populatedSubs.length} phân đoạn thuyết minh.`);
    } catch (error) {
      showToast(`Lỗi nhận dạng: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Play / Pause Video
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setVideoDuration(videoRef.current.duration);
  };

  // Seek video to specific time
  const handleSeek = (time) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Edit single subtitle translation text
  const handleSubtitleTextChange = (index, value) => {
    const updated = [...subtitles];
    updated[index].text = value;
    setSubtitles(updated);
  };

  // Edit single subtitle voice selection
  const handleSubtitleVoiceChange = (index, voiceId) => {
    const updated = [...subtitles];
    updated[index].voice = voiceId;
    setSubtitles(updated);
  };

  // Bulk update default voice for all subtitles
  const handleBulkVoiceChange = (voiceId) => {
    setDefaultVoice(voiceId);
    setSubtitles(subtitles.map(sub => ({ ...sub, voice: voiceId })));
    showToast(`Đã đổi giọng thuyết minh mặc định sang giọng mới.`);
  };

  const [previewLoadingIndex, setPreviewLoadingIndex] = useState(-1);

  // Render & Export final video
  const handleExportVideo = async () => {
    if (subtitles.length === 0 || !videoData) return;
    setIsExporting(true);
    setExportedVideoUrl('');

    try {
      const response = await fetch(`${API_BASE_URL}/dub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPath: videoData.videoPath,
          subtitles,
          bgVolume,
          blurMasks,
          subtitleStyle
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to export dubbed video');
      }

      const data = await response.json();
      setExportedVideoUrl(data.videoUrl);
      showToast('Xuất video lồng tiếng thành công! Bạn có thể tải video về.');
    } catch (error) {
      showToast(`Lỗi xuất video: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Preview individual subtitle voiceover
  const handlePreviewVoice = async (index, e) => {
    e.stopPropagation(); // Prevent seeking video when clicking preview
    const sub = subtitles[index];
    if (!sub.text) {
      showToast('Nội dung phụ đề trống, không thể nghe thử!');
      return;
    }

    setPreviewLoadingIndex(index);
    try {
      const response = await fetch(`${API_BASE_URL}/tts-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sub.text,
          voice: sub.voice
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Lỗi tạo âm thanh nghe thử');
      }

      const data = await response.json();
      const audio = new Audio(data.audioUrl);
      await audio.play();
    } catch (error) {
      showToast(`Nghe thử thất bại: ${error.message}`);
    } finally {
      setPreviewLoadingIndex(-1);
    }
  };

  // Filter subtitles based on search query (supports text, raw time strings, and numeric active seconds)
  const filteredSubtitles = subtitles.map((sub, index) => ({ ...sub, originalIndex: index }))
    .filter(sub => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      // 1. Match Chinese text or Vietnamese translation text
      const textMatch = (sub.chineseText && sub.chineseText.toLowerCase().includes(query)) ||
                         (sub.text && sub.text.toLowerCase().includes(query));
      if (textMatch) return true;

      // 2. Match raw timestamp strings (e.g., "00m02s", "04s")
      const rawTimeMatch = (sub.startTime && sub.startTime.toLowerCase().includes(query)) ||
                            (sub.endTime && sub.endTime.toLowerCase().includes(query));
      if (rawTimeMatch) return true;

      // 3. Match active second (e.g. user types "3" or "12.5" to find what is active then)
      const querySeconds = parseFloat(query);
      if (!isNaN(querySeconds)) {
        const start = parseTimeToSeconds(sub.startTime);
        const end = parseTimeToSeconds(sub.endTime);
        if (querySeconds >= start && querySeconds <= end) {
          return true;
        }
      }

      return false;
    });

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <span className="logo-text">RESUB</span>
          <span className="logo-badge">Auto Dubbing v1.0</span>
        </div>
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
      </header>

      {/* Setup / Media Loader Screen */}
      {!videoData && !isProcessing && (
        <main className="setup-view">
          <div className="setup-card">
            <h2 className="setup-title">Lồng Tiếng Video Trung - Việt</h2>
            <p className="setup-subtitle">Tự động dịch thuật phụ đề bằng Gemini AI và lồng tiếng khớp mốc thời gian</p>

            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'url' ? 'active' : ''}`}
                onClick={() => setActiveTab('url')}
              >
                Nhập Link Video
              </button>
              <button 
                className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Tải File Lên
              </button>
            </div>

            {activeTab === 'url' ? (
              <div className="input-group">
                <input 
                  type="text" 
                  placeholder="Dán link Douyin, TikTok, hoặc YouTube..." 
                  className="url-input"
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                />
                <button 
                  className="action-btn"
                  onClick={handleDownload}
                  disabled={!videoUrlInput || !geminiKey}
                >
                  Tải & Lồng Tiếng
                </button>
              </div>
            ) : (
              <div>
                <label className="upload-zone" htmlFor="video-upload-file">
                  <div className="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  </div>
                  <p style={{fontWeight: 500, marginBottom: '6px'}}>Kéo thả hoặc nhấp để chọn file video</p>
                  <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>Hỗ trợ MP4, MKV, AVI, v.v.</p>
                  <input 
                    type="file" 
                    id="video-upload-file" 
                    style={{display: 'none'}} 
                    accept="video/*"
                    onChange={handleFileUpload}
                    disabled={!geminiKey}
                  />
                </label>
              </div>
            )}
            {!geminiKey && (
              <p style={{color: '#f87171', fontSize: '13px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Vui lòng nhập Gemini Key ở góc trên bên phải trước khi tải video.
              </p>
            )}
          </div>
        </main>
      )}

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

      {/* Main CapCut-like Workspace */}
      {videoData && !isProcessing && (
        <main className="workspace-view">
          {/* Top Panel Splitter */}
          <div className="editor-grid" style={{ height: `${topHeight}%` }}>
            
            {/* Left Panel: Subtitles Editor list */}
            <section className="left-panel" style={{ width: `${leftWidth}%` }}>
              <div className="panel-header">
                <span className="panel-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Danh sách phụ đề dịch thuật ({subtitles.length} câu)
                </span>
              </div>

              {/* Search Bar */}
              <div className="search-bar-container">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm chữ hoặc thời gian (vd: bệnh nhân, 02s, 3.5)..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                )}
              </div>

              <div className="subtitle-list">
                {filteredSubtitles.map((sub) => {
                  const i = sub.originalIndex;
                  return (
                    <div 
                      key={i} 
                      className={`subtitle-card ${activeSubtitleIndex === i ? 'active' : ''}`}
                      onClick={() => handleSeek(parseTimeToSeconds(sub.startTime))}
                    >
                      <div className="card-metadata">
                        <span className="card-index">Câu {i + 1}</span>
                        <span>{sub.startTime} - {sub.endTime}</span>
                      </div>
                      <div className="chinese-text">{sub.chineseText}</div>
                      <input 
                        type="text" 
                        className="translation-input"
                        value={sub.text}
                        onChange={(e) => handleSubtitleTextChange(i, e.target.value)}
                      />
                      <div className="voice-select-container">
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <span style={{color: 'var(--text-muted)'}}>Giọng:</span>
                          <select 
                            className="voice-dropdown"
                            value={sub.voice}
                            onChange={(e) => handleSubtitleVoiceChange(i, e.target.value)}
                          >
                            {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        </div>
                        <button 
                          className="preview-btn"
                          onClick={(e) => handlePreviewVoice(i, e)}
                          disabled={previewLoadingIndex === i}
                          title="Nghe thử giọng thuyết minh câu này"
                        >
                          {previewLoadingIndex === i ? (
                            <div className="mini-spinner"></div>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                          )}
                          {previewLoadingIndex === i ? 'Đang tạo...' : 'Nghe thử'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredSubtitles.length === 0 && subtitles.length > 0 && (
                  <p style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '20px'}}>Không tìm thấy phụ đề nào khớp với từ khóa.</p>
                )}
              </div>
            </section>

            {/* Vertical Splitter 1 */}
            <div className="resizer-col" onMouseDown={(e) => handleMouseDown('col1', e)}></div>

            {/* Center Panel: Video Preview Player */}
            <section className="center-panel" style={{ width: `${100 - leftWidth - rightWidth}%` }}>
              <div className="video-container">
                <video 
                  src={videoData.videoUrl}
                  ref={videoRef}
                  className="video-player"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlay}
                />
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
                        backdropFilter: `blur(${mask.blurRadius}px) brightness(0.8)`,
                        WebkitBackdropFilter: `blur(${mask.blurRadius}px) brightness(0.8)`,
                        backgroundColor: hexToRgba(mask.color, mask.opacity),
                        pointerEvents: 'auto',
                        cursor: 'move',
                        position: 'absolute',
                        zIndex: 8,
                        boxSizing: 'border-box'
                      }}
                      onMouseDown={(e) => handleMaskMouseDown(i, e)}
                    >
                      {isSelected && (
                        <>
                          <div className="mask-select-border" style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            border: '1.5px dashed rgba(16, 185, 129, 0.8)',
                            pointerEvents: 'none'
                          }}></div>

                          {/* Corner Handles */}
                          <div className="mask-resize-handle tl" style={{
                            position: 'absolute',
                            top: '-4px',
                            left: '-4px',
                            width: '8px',
                            height: '8px',
                            background: 'var(--accent)',
                            border: '1.5px solid #fff',
                            borderRadius: '50%',
                            cursor: 'nwse-resize',
                            zIndex: 10
                          }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'tl', e)}></div>

                          <div className="mask-resize-handle tr" style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            width: '8px',
                            height: '8px',
                            background: 'var(--accent)',
                            border: '1.5px solid #fff',
                            borderRadius: '50%',
                            cursor: 'nesw-resize',
                            zIndex: 10
                          }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'tr', e)}></div>

                          <div className="mask-resize-handle bl" style={{
                            position: 'absolute',
                            bottom: '-4px',
                            left: '-4px',
                            width: '8px',
                            height: '8px',
                            background: 'var(--accent)',
                            border: '1.5px solid #fff',
                            borderRadius: '50%',
                            cursor: 'nesw-resize',
                            zIndex: 10
                          }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'bl', e)}></div>

                          <div className="mask-resize-handle br" style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            width: '8px',
                            height: '8px',
                            background: 'var(--accent)',
                            border: '1.5px solid #fff',
                            borderRadius: '50%',
                            cursor: 'nwse-resize',
                            zIndex: 10
                          }} onMouseDown={(e) => handleMaskCornerResizeMouseDown(i, 'br', e)}></div>

                          {/* Top/Bottom Edge Handles */}
                          <div className="mask-edge-handle top" style={{
                            position: 'absolute',
                            top: '-4px',
                            left: '10%',
                            right: '10%',
                            height: '6px',
                            cursor: 'ns-resize',
                            zIndex: 9
                          }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'top', e)}></div>

                          <div className="mask-edge-handle bottom" style={{
                            position: 'absolute',
                            bottom: '-4px',
                            left: '10%',
                            right: '10%',
                            height: '6px',
                            cursor: 'ns-resize',
                            zIndex: 9
                          }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'bottom', e)}></div>

                          {/* Left/Right Edge Handles */}
                          <div className="mask-edge-handle left" style={{
                            position: 'absolute',
                            left: '-4px',
                            top: '10%',
                            bottom: '10%',
                            width: '6px',
                            cursor: 'ew-resize',
                            zIndex: 9
                          }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'left', e)}></div>

                          <div className="mask-edge-handle right" style={{
                            position: 'absolute',
                            right: '-4px',
                            top: '10%',
                            bottom: '10%',
                            width: '6px',
                            cursor: 'ew-resize',
                            zIndex: 9
                          }} onMouseDown={(e) => handleMaskEdgeResizeMouseDown(i, 'right', e)}></div>
                        </>
                      )}
                    </div>
                  );
                })}
                {activeSubtitleIndex !== -1 && (
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
                      className={`subtitle-text ${blurMasks.some(mask => currentTime >= parseTimeToSeconds(mask.startTime) && currentTime <= parseTimeToSeconds(mask.endTime)) ? 'no-bg' : ''}`}
                      style={{
                        fontSize: `${subtitleStyle.fontSize}px`,
                        color: subtitleStyle.color,
                        backgroundColor: subtitleStyle.bg || 'transparent',
                        borderColor: subtitleStyle.outlineColor,
                        fontWeight: subtitleStyle.bold ? 'bold' : 'normal',
                        fontStyle: subtitleStyle.italic ? 'italic' : 'normal',
                        textShadow: subtitleStyle.shadow && !blurMasks.some(mask => currentTime >= parseTimeToSeconds(mask.startTime) && currentTime <= parseTimeToSeconds(mask.endTime))
                          ? `0 2px 4px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.95)` 
                          : blurMasks.some(mask => currentTime >= parseTimeToSeconds(mask.startTime) && currentTime <= parseTimeToSeconds(mask.endTime)) ? `0 2px 4px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.95)` : 'none',
                        border: subtitleStyle.bg !== 'transparent' && !blurMasks.some(mask => currentTime >= parseTimeToSeconds(mask.startTime) && currentTime <= parseTimeToSeconds(mask.endTime)) ? 'none' : undefined,
                        padding: subtitleStyle.bg !== 'transparent' && !blurMasks.some(mask => currentTime >= parseTimeToSeconds(mask.startTime) && currentTime <= parseTimeToSeconds(mask.endTime)) ? '4px 10px' : '0',
                        borderRadius: subtitleStyle.bg !== 'transparent' && !blurMasks.some(mask => currentTime >= parseTimeToSeconds(mask.startTime) && currentTime <= parseTimeToSeconds(mask.endTime)) ? '4px' : '0',
                        width: '100%',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        pointerEvents: 'none'
                      }}
                    >
                      {subtitles[activeSubtitleIndex].text}
                    </div>
                    
                    <div className="text-select-border" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: '1.5px dashed rgba(16, 185, 129, 0.8)',
                      pointerEvents: 'none',
                      borderRadius: '4px'
                    }}></div>

                    {/* Corner Handles for Font Size scaling */}
                    <div className="text-resize-handle tl" style={{
                      position: 'absolute',
                      top: '-4px',
                      left: '-4px',
                      width: '8px',
                      height: '8px',
                      background: 'var(--accent)',
                      border: '1.5px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                      zIndex: 10
                    }} onMouseDown={(e) => handleTextCornerResizeMouseDown('tl', e)}></div>

                    <div className="text-resize-handle tr" style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '8px',
                      height: '8px',
                      background: 'var(--accent)',
                      border: '1.5px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nesw-resize',
                      zIndex: 10
                    }} onMouseDown={(e) => handleTextCornerResizeMouseDown('tr', e)}></div>

                    <div className="text-resize-handle bl" style={{
                      position: 'absolute',
                      bottom: '-4px',
                      left: '-4px',
                      width: '8px',
                      height: '8px',
                      background: 'var(--accent)',
                      border: '1.5px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nesw-resize',
                      zIndex: 10
                    }} onMouseDown={(e) => handleTextCornerResizeMouseDown('bl', e)}></div>

                    <div className="text-resize-handle br" style={{
                      position: 'absolute',
                      bottom: '-4px',
                      right: '-4px',
                      width: '8px',
                      height: '8px',
                      background: 'var(--accent)',
                      border: '1.5px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                      zIndex: 10
                    }} onMouseDown={(e) => handleTextCornerResizeMouseDown('br', e)}></div>

                    {/* Horizontal Edge Side Handles for Width stretching */}
                    <div className="text-edge-handle left" style={{
                      position: 'absolute',
                      top: '10%',
                      bottom: '10%',
                      left: '-4px',
                      width: '6px',
                      cursor: 'ew-resize',
                      zIndex: 9,
                      background: 'transparent'
                    }} onMouseDown={(e) => handleTextEdgeResizeMouseDown('left', e)}>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '1px',
                        transform: 'translateY(-50%)',
                        width: '4px',
                        height: '10px',
                        background: 'var(--accent)',
                        borderRadius: '2px'
                      }}></div>
                    </div>

                    <div className="text-edge-handle right" style={{
                      position: 'absolute',
                      top: '10%',
                      bottom: '10%',
                      right: '-4px',
                      width: '6px',
                      cursor: 'ew-resize',
                      zIndex: 9,
                      background: 'transparent'
                    }} onMouseDown={(e) => handleTextEdgeResizeMouseDown('right', e)}>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        right: '1px',
                        transform: 'translateY(-50%)',
                        width: '4px',
                        height: '10px',
                        background: 'var(--accent)',
                        borderRadius: '2px'
                      }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Player Controls */}
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

            {/* Vertical Splitter 2 */}
            <div className="resizer-col" onMouseDown={(e) => handleMouseDown('col2', e)}></div>

            {/* Right Panel: CapCut-style Inspector Panel */}
            <section className="right-panel" style={{ width: `${rightWidth}%` }}>
              <div className="inspector-tabs">
                <button 
                  className={`inspector-tab ${inspectorTab === 'text' ? 'active' : ''}`}
                  onClick={() => setInspectorTab('text')}
                >
                  Văn bản
                </button>
                <button 
                  className={`inspector-tab ${inspectorTab === 'mask' ? 'active' : ''}`}
                  onClick={() => setInspectorTab('mask')}
                >
                  Làm mờ
                </button>
                <button 
                  className={`inspector-tab ${inspectorTab === 'audio' ? 'active' : ''}`}
                  onClick={() => setInspectorTab('audio')}
                >
                  Âm thanh
                </button>
                <button 
                  className={`inspector-tab ${inspectorTab === 'export' ? 'active' : ''}`}
                  onClick={() => setInspectorTab('export')}
                >
                  Xuất video
                </button>
              </div>

              <div className="inspector-content">
                {inspectorTab === 'text' && (
                  <div className="inspector-section">
                    <h3 className="section-title">Chỉnh sửa phụ đề</h3>
                    
                    {activeSubtitleIndex !== -1 ? (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        <div className="control-group">
                          <label className="control-label">Nội dung phụ đề</label>
                          <textarea 
                            className="inspector-textarea" 
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              color: 'var(--text-main)',
                              padding: '10px',
                              fontSize: '13px',
                              outline: 'none',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                            value={subtitles[activeSubtitleIndex].text}
                            onChange={(e) => {
                              const newText = e.target.value;
                              setSubtitles(prev => prev.map((sub, idx) => 
                                idx === activeSubtitleIndex ? { ...sub, text: newText } : sub
                              ));
                            }}
                          />
                        </div>

                        <div className="control-group">
                          <div className="mask-setting-row">
                            <span className="mask-setting-label">Cỡ chữ (Font Size)</span>
                            <div className="mask-setting-input-wrapper">
                              <input 
                                type="number" 
                                min="10" 
                                max="60" 
                                value={subtitleStyle.fontSize}
                                onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontSize: Math.max(10, Math.min(60, parseInt(e.target.value) || 0)) }))}
                                className="mask-number-input"
                              />
                              <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>px</span>
                            </div>
                          </div>
                          <input 
                            type="range"
                            min="10"
                            max="60"
                            value={subtitleStyle.fontSize}
                            onChange={(e) => setSubtitleStyle(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                            className="volume-range-slider"
                          />
                        </div>

                        <div className="control-group">
                          <span className="control-label" style={{marginBottom: '10px', display: 'block'}}>Kiểu mặc định</span>
                          <div className="text-preset-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '10px'
                          }}>
                            {TEXT_PRESETS.map(preset => (
                              <button
                                key={preset.id}
                                className={`text-preset-btn ${subtitleStyle.textColorPreset === preset.id ? 'active' : ''}`}
                                style={{
                                  background: 'var(--bg-tertiary)',
                                  border: subtitleStyle.textColorPreset === preset.id ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  padding: '8px 4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s'
                                }}
                                onClick={() => setSubtitleStyle(prev => ({
                                  ...prev,
                                  textColorPreset: preset.id,
                                  color: preset.color,
                                  outlineColor: preset.outlineColor,
                                  outlineWidth: preset.outlineWidth,
                                  bg: preset.bg,
                                  shadow: preset.shadow
                                }))}
                              >
                                <span style={{
                                  fontSize: '15px',
                                  fontWeight: 'bold',
                                  color: preset.color,
                                  textShadow: preset.shadow ? '0 1px 2px rgba(0,0,0,0.8)' : 'none',
                                  backgroundColor: preset.bg !== 'transparent' ? '#111' : 'transparent',
                                  padding: preset.bg !== 'transparent' ? '2px 4px' : '0',
                                  borderRadius: '2px'
                                }}>
                                  Aa
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="control-group" style={{display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px'}}>
                          <button
                            className={`inspector-btn-style ${subtitleStyle.bold ? 'active' : ''}`}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: subtitleStyle.bold ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                              border: subtitleStyle.bold ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                              borderRadius: '6px',
                              color: subtitleStyle.bold ? 'var(--accent)' : 'var(--text-main)',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSubtitleStyle(prev => ({ ...prev, bold: !prev.bold }))}
                          >
                            B
                          </button>
                          <button
                            className={`inspector-btn-style ${subtitleStyle.italic ? 'active' : ''}`}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: subtitleStyle.italic ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                              border: subtitleStyle.italic ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                              borderRadius: '6px',
                              color: subtitleStyle.italic ? 'var(--accent)' : 'var(--text-main)',
                              fontStyle: 'italic',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSubtitleStyle(prev => ({ ...prev, italic: !prev.italic }))}
                          >
                            I
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="help-card-panel" style={{
                        padding: '24px 16px',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '12px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '13px'
                      }}>
                        <p style={{marginBottom: '10px'}}>💡 Chưa chọn đoạn phụ đề nào!</p>
                        <p>Vui lòng click chọn một đoạn phụ đề trên danh sách bên trái hoặc trên Timeline để bắt đầu chỉnh sửa nội dung và kiểu chữ trực quan.</p>
                      </div>
                    )}
                  </div>
                )}

                {inspectorTab === 'audio' && (
                  <div className="inspector-section">
                    <h3 className="section-title">Điều chỉnh âm lượng</h3>
                    <div className="control-group">
                      <label className="control-label">Âm lượng video gốc</label>
                      <div className="volume-control-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.05"
                          value={bgVolume}
                          onChange={(e) => setBgVolume(parseFloat(e.target.value))}
                          className="volume-range-slider"
                        />
                        <span className="volume-percentage">{Math.round(bgVolume * 100)}%</span>
                      </div>
                    </div>

                    <div className="control-group" style={{marginTop: '24px'}}>
                      <label className="control-label">Giọng thuyết minh mặc định</label>
                      <select 
                        className="inspector-select"
                        value={defaultVoice}
                        onChange={(e) => handleBulkVoiceChange(e.target.value)}
                      >
                        {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                      <p className="control-help">Thay đổi giọng này sẽ lập tức cập nhật cho tất cả phân đoạn phụ đề.</p>
                    </div>
                  </div>
                )}

                {inspectorTab === 'mask' && (
                  <div className="inspector-section">
                    <h3 className="section-title">Chọn kiểu làm mờ</h3>
                    
                    {activeBlurIndex !== -1 ? (
                      <div className="mask-settings-panel">
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                          <h4 className="control-label" style={{margin: 0, fontSize: '12px', fontWeight: 600}}>Tùy chỉnh phân đoạn làm mờ</h4>
                          <button 
                            onClick={() => handleDeleteBlurMask(activeBlurIndex)}
                            style={{
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                          >
                            Xóa phân đoạn
                          </button>
                        </div>
                        
                        <div style={{background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '11px', color: 'var(--text-muted)'}}>
                          Thời gian: <strong>{blurMasks[activeBlurIndex].startTime}</strong> - <strong>{blurMasks[activeBlurIndex].endTime}</strong>
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                          <div>
                            <div className="mask-setting-row">
                              <span className="mask-setting-label">Vị trí dọc (Y)</span>
                              <div className="mask-setting-input-wrapper">
                                <input 
                                  type="number" 
                                  min="5" 
                                  max="95" 
                                  value={blurMasks[activeBlurIndex].yPercentage}
                                  onChange={(e) => {
                                    const val = Math.max(5, Math.min(95, parseInt(e.target.value) || 0));
                                    setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, yPercentage: val } : m));
                                  }}
                                  className="mask-number-input"
                                />
                                <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>%</span>
                              </div>
                            </div>
                            <input 
                              type="range"
                              min="5"
                              max="95"
                              value={blurMasks[activeBlurIndex].yPercentage}
                              onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, yPercentage: val } : m));
                              }}
                              className="volume-range-slider"
                            />
                          </div>

                          <div>
                            <div className="mask-setting-row">
                              <span className="mask-setting-label">Chiều cao thanh</span>
                              <div className="mask-setting-input-wrapper">
                                <input 
                                  type="number" 
                                  min="5" 
                                  max="50" 
                                  value={blurMasks[activeBlurIndex].heightPercentage}
                                  onChange={(e) => {
                                    const val = Math.max(5, Math.min(50, parseInt(e.target.value) || 0));
                                    setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, heightPercentage: val } : m));
                                  }}
                                  className="mask-number-input"
                                />
                                <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>%</span>
                              </div>
                            </div>
                            <input 
                              type="range"
                              min="5"
                              max="50"
                              value={blurMasks[activeBlurIndex].heightPercentage}
                              onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, heightPercentage: val } : m));
                              }}
                              className="volume-range-slider"
                            />
                          </div>

                          <div>
                            <div className="mask-setting-row">
                              <span className="mask-setting-label">Đo độ nhòe (Blur)</span>
                              <div className="mask-setting-input-wrapper">
                                <input 
                                  type="number" 
                                  min="2" 
                                  max="50" 
                                  value={blurMasks[activeBlurIndex].blurRadius}
                                  onChange={(e) => {
                                    const val = Math.max(2, Math.min(50, parseInt(e.target.value) || 0));
                                    setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, blurRadius: val } : m));
                                  }}
                                  className="mask-number-input"
                                />
                                <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>px</span>
                              </div>
                            </div>
                            <input 
                              type="range"
                              min="2"
                              max="50"
                              value={blurMasks[activeBlurIndex].blurRadius}
                              onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, blurRadius: val } : m));
                              }}
                              className="volume-range-slider"
                            />
                          </div>

                          <div style={{borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px'}}>
                            <span className="mask-setting-label" style={{display: 'block', marginBottom: '8px'}}>Màu sắc dải che</span>
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                              {PRESET_COLORS.map(c => (
                                <button 
                                  key={c.value}
                                  className={`color-preset-circle ${blurMasks[activeBlurIndex].color === c.value ? 'active' : ''}`}
                                  style={{ backgroundColor: c.value }}
                                  onClick={() => {
                                    setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, color: c.value } : m));
                                  }}
                                  title={c.name}
                                />
                              ))}
                              
                              <div className="custom-color-picker-wrapper" title="Màu tự chọn">
                                <input 
                                  type="color" 
                                  value={blurMasks[activeBlurIndex].color}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, color: val } : m));
                                  }}
                                  className="custom-color-picker-input"
                                />
                                <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>Tự chọn</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="mask-setting-row">
                              <span className="mask-setting-label">Độ mờ đục (Opacity)</span>
                              <div className="mask-setting-input-wrapper">
                                <input 
                                  type="number" 
                                  min="0" 
                                  max="100" 
                                  value={Math.round(blurMasks[activeBlurIndex].opacity * 100)}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                                    setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, opacity: val } : m));
                                  }}
                                  className="mask-number-input"
                                />
                                <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>%</span>
                              </div>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={blurMasks[activeBlurIndex].opacity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setBlurMasks(prev => prev.map((m, idx) => idx === activeBlurIndex ? { ...m, opacity: val } : m));
                              }}
                              className="volume-range-slider"
                            />
                          </div>
                        </div>

                        <p className="control-help" style={{marginTop: '16px'}}>💡 Bạn cũng có thể nhấn giữ và kéo trực tiếp dải làm mờ trên màn hình video để thay đổi vị trí Y, hoặc co kéo biên trên/dưới của nó!</p>
                      </div>
                    ) : (
                      <div style={{textAlign: 'center', padding: '24px 16px', border: '1.5px dashed var(--border-color)', borderRadius: '12px'}}>
                        <p style={{color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px'}}>
                          💡 Chưa chọn phân đoạn làm mờ nào hoặc chưa tạo dải làm mờ!
                        </p>
                        <button 
                          className="action-btn" 
                          onClick={handleAddBlurMask}
                          style={{
                            background: 'var(--accent)',
                            color: '#000',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            cursor: 'pointer'
                          }}
                        >
                          Thêm làm mờ mới (+)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {inspectorTab === 'export' && (
                  <div className="inspector-section">
                    <h3 className="section-title">Xuất video lồng tiếng</h3>
                    
                    <div className="export-info-box">
                      Tiến hành tổng hợp thuyết minh tiếng Việt, điều chỉnh tốc độ khớp hình ảnh và chèn phụ đề.
                    </div>

                    {!exportedVideoUrl ? (
                      <button 
                        className="action-btn export-run-btn"
                        onClick={handleExportVideo}
                        disabled={isExporting}
                      >
                        {isExporting ? 'Đang tổng hợp thuyết minh...' : 'Khởi chạy xuất video'}
                      </button>
                    ) : (
                      <div className="export-success-box">
                        <p className="success-text">🎉 Xuất video thành công!</p>
                        <a 
                          href={exportedVideoUrl}
                          download="resub_dubbed_video.mp4"
                          className="action-btn export-download-btn"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Tải Video (.mp4)
                        </a>
                        <button 
                          className="reset-export-btn"
                          onClick={() => setExportedVideoUrl('')}
                        >
                          Hủy & Chỉnh sửa tiếp
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Horizontal Splitter */}
          <div className="resizer-row" onMouseDown={(e) => handleMouseDown('row', e)}></div>

          {/* Bottom Panel: Timeline */}
          <section className="bottom-panel" style={{ height: `calc(${100 - topHeight}% - 4px)` }}>
            <div className="timeline-toolbar">
              <span>Timeline Workspace</span>
              <span>Kéo đầu kim đỏ để cuộn phát</span>
            </div>

            <div className="timeline-container">
              {/* Fixed Left Labels Column */}
              <div className="timeline-labels-column">
                <div className="timeline-label-header"></div>
                <div className="timeline-label-item">Video</div>
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
                      style={{ left: 0, width: `${(videoDuration || 30) * 50}px` }}
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
          </section>
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
