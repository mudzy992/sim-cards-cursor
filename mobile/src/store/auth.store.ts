import { create } from 'zustand';
import type { AuthUser } from '@/types/auth.types';
import {
  clearSession as clearStoredSession,
  loadSession,
  saveSession,
} from '@/utils/storage';

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setSession: (payload: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,
  setSession: async ({ user, accessToken, refreshToken }) => {
    set({ user, accessToken, refreshToken, isAuthenticated: true });
    await saveSession({ user, accessToken, refreshToken });
  },
  clearSession: async () => {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    await clearStoredSession();
  },
  hydrate: async () => {
    const session = await loadSession();

    if (session) {
      set({
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        isAuthenticated: true,
        isHydrated: true,
      });
      return;
    }

    set({ isHydrated: true });
  },
}));
