import { create } from 'zustand';

export const usePlaybackStore = create((set) => ({
  isPlaying: false,
  currentTime: 0,
  videoDuration: 0,
  videoDimensions: { width: 1280, height: 720 },
  bgVolume: 0.15,
  defaultVoice: 'vi-VN-HoaiMyNeural',

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setVideoDuration: (videoDuration) => set({ videoDuration }),
  setVideoDimensions: (videoDimensions) => set({ videoDimensions }),
  setBgVolume: (bgVolume) => set({ bgVolume }),
  setDefaultVoice: (defaultVoice) => set({ defaultVoice })
}));
