import { create } from 'zustand';

const defaultSubtitleStyle = {
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
};

const defaultCropStyle = {
  aspectRatio: 'original',
  xPercent: 50,
  yPercent: 50,
  heightPercent: 100
};

const defaultVideoTransform = {
  zoom: 100,
  xOffset: 0,
  yOffset: 0,
  rotation: 0
};

export const useProjectStore = create((set) => ({
  projects: JSON.parse(localStorage.getItem('resub_projects') || '[]'),
  currentProjectId: null,
  videoData: null,
  subtitles: [],
  blurMasks: [],
  activeSubtitleIndex: -1,
  activeBlurIndex: -1,
  subtitleStyle: defaultSubtitleStyle,
  cropStyle: defaultCropStyle,
  videoTransform: defaultVideoTransform,
  historyPast: [],
  historyFuture: [],
  leftWidth: 42,
  rightWidth: 23,
  topHeight: 62,
  isProcessing: false,
  statusMessage: '',
  toastMessage: '',
  searchQuery: '',
  isExporting: false,
  exportedVideoUrl: '',
  inspectorTab: 'text',
  previewLoadingIndex: -1,
  uploadProgress: 0,

  setVideoData: (videoData) => set({ videoData }),
  setSubtitles: (subtitles) => set({ subtitles }),
  setBlurMasks: (blurMasks) => set({ blurMasks }),
  setActiveSubtitleIndex: (activeSubtitleIndex) => set({ activeSubtitleIndex }),
  setActiveBlurIndex: (activeBlurIndex) => set({ activeBlurIndex }),
  setSubtitleStyle: (updater) => set((state) => ({
    subtitleStyle: typeof updater === 'function' ? updater(state.subtitleStyle) : updater
  })),
  setCropStyle: (updater) => set((state) => ({
    cropStyle: typeof updater === 'function' ? updater(state.cropStyle) : updater
  })),
  setVideoTransform: (updater) => set((state) => ({
    videoTransform: typeof updater === 'function' ? updater(state.videoTransform) : updater
  })),
  setLeftWidth: (leftWidth) => set({ leftWidth }),
  setRightWidth: (rightWidth) => set({ rightWidth }),
  setTopHeight: (topHeight) => set({ topHeight }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setToastMessage: (toastMessage) => set({ toastMessage }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setExportedVideoUrl: (exportedVideoUrl) => set({ exportedVideoUrl }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setPreviewLoadingIndex: (previewLoadingIndex) => set({ previewLoadingIndex }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),

  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => set({ toastMessage: '' }), 4000);
  },

  saveHistory: () => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    const newPast = [...state.historyPast, snapshot].slice(-50);
    return {
      historyPast: newPast,
      historyFuture: []
    };
  }),

  undo: () => set((state) => {
    if (state.historyPast.length === 0) return {};
    
    const previous = state.historyPast[state.historyPast.length - 1];
    const newPast = state.historyPast.slice(0, -1);
    
    const currentSnapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    
    return {
      subtitles: previous.subtitles,
      blurMasks: previous.blurMasks,
      subtitleStyle: previous.subtitleStyle,
      cropStyle: previous.cropStyle,
      videoTransform: previous.videoTransform,
      historyPast: newPast,
      historyFuture: [currentSnapshot, ...state.historyFuture]
    };
  }),

  redo: () => set((state) => {
    if (state.historyFuture.length === 0) return {};
    
    const next = state.historyFuture[0];
    const newFuture = state.historyFuture.slice(1);
    
    const currentSnapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    
    return {
      subtitles: next.subtitles,
      blurMasks: next.blurMasks,
      subtitleStyle: next.subtitleStyle,
      cropStyle: next.cropStyle,
      videoTransform: next.videoTransform,
      historyPast: [...state.historyPast, currentSnapshot],
      historyFuture: newFuture
    };
  }),

  handleAddBlurMask: (newBlur) => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    return {
      historyPast: [...state.historyPast, snapshot].slice(-50),
      historyFuture: [],
      blurMasks: [...state.blurMasks, newBlur],
      activeBlurIndex: state.blurMasks.length
    };
  }),

  handleDeleteBlurMask: (index) => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    return {
      historyPast: [...state.historyPast, snapshot].slice(-50),
      historyFuture: [],
      blurMasks: state.blurMasks.filter((_, idx) => idx !== index),
      activeBlurIndex: -1
    };
  }),

  handleSubtitleTextChange: (index, value) => set((state) => ({
    subtitles: state.subtitles.map((sub, idx) =>
      idx === index ? { ...sub, text: value } : sub
    )
  })),

  handleAddSubtitle: (startTimeSecs, voiceId) => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };

    const mins = Math.floor(startTimeSecs / 60);
    const secs = Math.floor(startTimeSecs % 60);
    const ms = Math.round((startTimeSecs % 1) * 1000);
    const formattedStart = `${mins.toString().padStart(2, '0')}m${secs.toString().padStart(2, '0')}s${ms.toString().padStart(3, '0')}ms`;

    const endTimeSecs = startTimeSecs + 2.0;
    const minsEnd = Math.floor(endTimeSecs / 60);
    const secsEnd = Math.floor(endTimeSecs % 60);
    const msEnd = Math.round((endTimeSecs % 1) * 1000);
    const formattedEnd = `${minsEnd.toString().padStart(2, '0')}m${secsEnd.toString().padStart(2, '0')}s${msEnd.toString().padStart(3, '0')}ms`;

    const newSub = {
      startTime: formattedStart,
      endTime: formattedEnd,
      chineseText: '',
      text: 'Lời thoại mới',
      voice: voiceId || 'vi-VN-HoaiMyNeural'
    };

    const parseTimeInline = (timeStr) => {
      if (!timeStr) return 0;
      const match = timeStr.match(/(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?/);
      if (match && (match[1] || match[2] || match[3])) {
        const m = parseInt(match[1] || '0', 10);
        const s = parseInt(match[2] || '0', 10);
        const mill = parseInt(match[3] || '0', 10);
        return m * 60 + s + mill / 1000;
      }
      return parseFloat(timeStr) || 0;
    };

    const newSubtitles = [...state.subtitles, newSub].sort((a, b) => {
      return parseTimeInline(a.startTime) - parseTimeInline(b.startTime);
    });

    const newIdx = newSubtitles.findIndex(sub => sub.startTime === formattedStart && sub.text === 'Lời thoại mới');

    return {
      historyPast: [...state.historyPast, snapshot].slice(-50),
      historyFuture: [],
      subtitles: newSubtitles,
      activeSubtitleIndex: newIdx !== -1 ? newIdx : state.activeSubtitleIndex
    };
  }),

  handleDeleteSubtitle: (index) => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    return {
      historyPast: [...state.historyPast, snapshot].slice(-50),
      historyFuture: [],
      subtitles: state.subtitles.filter((_, idx) => idx !== index),
      activeSubtitleIndex: -1
    };
  }),

  handleSubtitleVoiceChange: (index, voiceId) => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    return {
      historyPast: [...state.historyPast, snapshot].slice(-50),
      historyFuture: [],
      subtitles: state.subtitles.map((sub, idx) =>
        idx === index ? { ...sub, voice: voiceId } : sub
      )
    };
  }),

  handleBulkVoiceChange: (voiceId) => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    return {
      historyPast: [...state.historyPast, snapshot].slice(-50),
      historyFuture: [],
      subtitles: state.subtitles.map(sub => ({ ...sub, voice: voiceId }))
    };
  }),

  resetProject: () => set((state) => {
    const snapshot = {
      subtitles: JSON.parse(JSON.stringify(state.subtitles)),
      blurMasks: JSON.parse(JSON.stringify(state.blurMasks)),
      subtitleStyle: { ...state.subtitleStyle },
      cropStyle: { ...state.cropStyle },
      videoTransform: { ...state.videoTransform }
    };
    return {
      historyPast: [...state.historyPast, snapshot].slice(-50),
      historyFuture: [],
      videoData: null,
      subtitles: [],
      blurMasks: [],
      activeSubtitleIndex: -1,
      activeBlurIndex: -1,
      subtitleStyle: defaultSubtitleStyle,
      cropStyle: defaultCropStyle,
      videoTransform: defaultVideoTransform,
      isProcessing: false,
      statusMessage: '',
      isExporting: false,
      exportedVideoUrl: '',
      inspectorTab: 'text',
      previewLoadingIndex: -1,
      searchQuery: ''
    };
  }),

  saveProjectProgress: () => set((state) => {
    if (!state.videoData) return {};
    
    let projectId = state.currentProjectId;
    let newProjects = [...state.projects];
    let project = newProjects.find(p => p.id === projectId);
    
    const now = Date.now();
    const projectData = {
      subtitles: state.subtitles,
      blurMasks: state.blurMasks,
      subtitleStyle: state.subtitleStyle,
      cropStyle: state.cropStyle,
      videoTransform: state.videoTransform,
      videoData: state.videoData,
      updatedAt: now
    };
    
    if (project) {
      Object.assign(project, projectData);
    } else {
      projectId = `proj-${window.crypto.randomUUID()}`;
      // Derive name from filename or videoData
      let projName = 'Dự án không tên';
      if (state.videoData.videoId) {
        projName = `Dự án ${state.videoData.videoId.substring(0, 8)}`;
      } else if (state.videoData.videoPath) {
        const parts = state.videoData.videoPath.split(/[\\/]/);
        const filename = parts[parts.length - 1];
        projName = filename.replace(/\.[^/.]+$/, "");
      }
      
      const newProject = {
        id: projectId,
        name: projName,
        createdAt: now,
        ...projectData
      };
      newProjects.unshift(newProject);
    }
    
    localStorage.setItem('resub_projects', JSON.stringify(newProjects));
    return {
      projects: newProjects,
      currentProjectId: projectId
    };
  }),

  loadProject: (projectId) => set((state) => {
    const proj = state.projects.find(p => p.id === projectId);
    if (!proj) return {};
    return {
      currentProjectId: projectId,
      videoData: proj.videoData,
      subtitles: proj.subtitles || [],
      blurMasks: proj.blurMasks || [],
      subtitleStyle: proj.subtitleStyle || state.subtitleStyle,
      cropStyle: proj.cropStyle || state.cropStyle,
      videoTransform: proj.videoTransform || state.videoTransform,
      historyPast: [],
      historyFuture: []
    };
  }),

  deleteProject: (projectId) => set((state) => {
    const newProjects = state.projects.filter(p => p.id !== projectId);
    localStorage.setItem('resub_projects', JSON.stringify(newProjects));
    const isCurrent = state.currentProjectId === projectId;
    return {
      projects: newProjects,
      currentProjectId: isCurrent ? null : state.currentProjectId,
      videoData: isCurrent ? null : state.videoData
    };
  }),

  renameProject: (projectId, newName) => set((state) => {
    const newProjects = state.projects.map(p => 
      p.id === projectId ? { ...p, name: newName, updatedAt: Date.now() } : p
    );
    localStorage.setItem('resub_projects', JSON.stringify(newProjects));
    return { projects: newProjects };
  }),

  closeProject: () => set({
    currentProjectId: null,
    videoData: null,
    subtitles: [],
    blurMasks: [],
    activeSubtitleIndex: -1,
    activeBlurIndex: -1,
    historyPast: [],
    historyFuture: []
  })
}));
