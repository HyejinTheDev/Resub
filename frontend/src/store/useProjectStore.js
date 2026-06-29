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
  videoData: null,
  subtitles: [],
  blurMasks: [],
  activeSubtitleIndex: -1,
  activeBlurIndex: -1,
  subtitleStyle: defaultSubtitleStyle,
  cropStyle: defaultCropStyle,
  videoTransform: defaultVideoTransform,
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

  showToast: (msg) => {
    set({ toastMessage: msg });
    setTimeout(() => set({ toastMessage: '' }), 4000);
  },

  handleAddBlurMask: (newBlur) => set((state) => ({
    blurMasks: [...state.blurMasks, newBlur],
    activeBlurIndex: state.blurMasks.length
  })),

  handleDeleteBlurMask: (index) => set((state) => ({
    blurMasks: state.blurMasks.filter((_, idx) => idx !== index),
    activeBlurIndex: -1
  })),

  handleSubtitleTextChange: (index, value) => set((state) => ({
    subtitles: state.subtitles.map((sub, idx) =>
      idx === index ? { ...sub, text: value } : sub
    )
  })),

  handleSubtitleVoiceChange: (index, voiceId) => set((state) => ({
    subtitles: state.subtitles.map((sub, idx) =>
      idx === index ? { ...sub, voice: voiceId } : sub
    )
  })),

  handleBulkVoiceChange: (voiceId) => set((state) => ({
    subtitles: state.subtitles.map(sub => ({ ...sub, voice: voiceId }))
  })),

  resetProject: () => set({
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
  })
}));
