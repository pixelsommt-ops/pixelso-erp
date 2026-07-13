import { create } from 'zustand';
import * as authService from '../services/authService';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  initialized: false,

  login: async (email, password) => {
    const { data } = await authService.login(email, password);
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user, initialized: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, initialized: true });
  },

  // Memulihkan data user setelah refresh halaman (token ada di localStorage tapi state user kosong).
  restoreSession: async () => {
    const token = get().token;
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const { data } = await authService.me();
      set({ user: data, initialized: true });
    } catch (err) {
      localStorage.removeItem('token');
      set({ token: null, user: null, initialized: true });
    }
  },
}));

export default useAuthStore;
