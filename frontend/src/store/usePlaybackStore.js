import { create } from 'zustand';

export const usePlaybackStore = create((set) => ({
  isPlaying: false,
  currentTime: 0,
  videoDuration: 0,
  videoDimensions: { width: 1280, height: 720 },
  bgVolume: 0.15,
  ttsVolume: 1.0, // Default to 100% volume
  defaultVoice: 'vi-VN-HoaiMyNeural',
  pixelsPerSecond: 50,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setVideoDuration: (videoDuration) => set({ videoDuration }),
  setVideoDimensions: (videoDimensions) => set({ videoDimensions }),
  setBgVolume: (bgVolume) => set({ bgVolume }),
  setTtsVolume: (ttsVolume) => set({ ttsVolume }),
  setDefaultVoice: (defaultVoice) => set({ defaultVoice }),
  setPixelsPerSecond: (pixelsPerSecond) => set({ pixelsPerSecond })
}));
