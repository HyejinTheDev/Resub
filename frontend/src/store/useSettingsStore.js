import { create } from 'zustand';

export const useSettingsStore = create((set) => ({
  geminiKey: localStorage.getItem('gemini_api_key') || '',
  fptApiKey: localStorage.getItem('fpt_api_key') || 'gpj9SyLQ2wJu9I3SDAkHSWes2tczoFpR',
  capcutCookie: localStorage.getItem('capcut_cookie') || '',

  setGeminiKey: (geminiKey) => {
    localStorage.setItem('gemini_api_key', geminiKey);
    set({ geminiKey });
  },
  setFptApiKey: (fptApiKey) => {
    localStorage.setItem('fpt_api_key', fptApiKey);
    set({ fptApiKey });
  },
  setCapcutCookie: (capcutCookie) => {
    localStorage.setItem('capcut_cookie', capcutCookie);
    set({ capcutCookie });
  }
}));
