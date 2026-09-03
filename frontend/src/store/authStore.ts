import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    custom_claims?: {
      name?: string;
    };
    [key: string]: any;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        sessionStorage.setItem('lexiaudit_token', token);
        try {
          localStorage.removeItem('lexiaudit_token');
          localStorage.removeItem('lexiaudit-auth');
        } catch (_) {}
        set({ user, token });
      },
      logout: () => {
        sessionStorage.removeItem('lexiaudit_token');
        try {
          localStorage.removeItem('lexiaudit_token');
          localStorage.removeItem('lexiaudit-auth');
          sessionStorage.removeItem('lexiaudit-auth-session');
        } catch (_) {}
        set({ user: null, token: null });
      },
      isAuthenticated: () => {
        return !!get().token && !!sessionStorage.getItem('lexiaudit_token');
      },
    }),
    {
      name: 'lexiaudit-auth-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);

export default useAuthStore;
