import { create } from 'zustand';

export const useSettingsStore = create((set) => ({
  geminiKey: localStorage.getItem('gemini_api_key') || '',
  capcutCookie: localStorage.getItem('capcut_cookie') || '',

  setGeminiKey: (geminiKey) => {
    localStorage.setItem('gemini_api_key', geminiKey);
    set({ geminiKey });
  },
  setCapcutCookie: (capcutCookie) => {
    localStorage.setItem('capcut_cookie', capcutCookie);
    set({ capcutCookie });
  }
}));
