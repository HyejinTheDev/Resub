import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  currentUser: (() => {
    try {
      return JSON.parse(localStorage.getItem('resub_user')) || null;
    } catch {
      return null;
    }
  })(),

  setCurrentUser: (user) => {
    if (user) {
      localStorage.setItem('resub_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('resub_user');
    }
    set({ currentUser: user });
  },

  logout: () => {
    localStorage.removeItem('resub_user');
    set({ currentUser: null });
  }
}));
