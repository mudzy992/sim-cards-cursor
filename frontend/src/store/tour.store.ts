import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MySettings, UserTourState } from '@/api/settings.api';
import { settingsApi } from '@/api/settings.api';
import type { AuthUser } from '@/types/auth.types';

type TourState = {
  settingsLoaded: boolean;
  loading: boolean;
  tour: UserTourState | null;
  currentVersion: string;
  loadForUser: (user: AuthUser | null) => Promise<void>;
  markWebTourCompleted: (role: 'SYSTEM_ADMIN' | 'MODERATOR') => Promise<void>;
  markMobileTourCompleted: () => Promise<void>;
  resetWebTourForRole: (role: 'SYSTEM_ADMIN' | 'MODERATOR') => Promise<void>;
};

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      settingsLoaded: false,
      loading: false,
      tour: null,
      currentVersion: 'v1',
      loadForUser: async (user) => {
        if (!user) {
          set({ tour: null, settingsLoaded: false });
          return;
        }
        set({ loading: true });
        try {
          const data: MySettings = await settingsApi.getMy();
          set({
            tour: data.tour ?? null,
            settingsLoaded: true,
          });
        } catch {
          set({ settingsLoaded: true });
        } finally {
          set({ loading: false });
        }
      },
      markWebTourCompleted: async (role) => {
        const { tour, currentVersion } = get();
        const now = new Date().toISOString();

        const next: UserTourState = {
          ...(tour ?? {}),
          web: {
            ...(tour?.web ?? {}),
            ...(role === 'SYSTEM_ADMIN' && {
              systemAdmin: {
                ...(tour?.web?.systemAdmin ?? {}),
                completedAt: now,
              },
            }),
            ...(role === 'MODERATOR' && {
              moderator: {
                ...(tour?.web?.moderator ?? {}),
                completedAt: now,
              },
            }),
            lastVersionSeen: currentVersion,
          },
        };

        set({ tour: next });
        try {
          await settingsApi.updateMy({ tour: next });
        } catch {
          // swallow – lokalni state ostaje
        }
      },
      markMobileTourCompleted: async () => {
        const { tour } = get();
        const now = new Date().toISOString();
        const next: UserTourState = {
          ...(tour ?? {}),
          mobile: {
            ...(tour?.mobile ?? {}),
            completedAt: now,
          },
        };
        set({ tour: next });
        try {
          await settingsApi.updateMy({ tour: next });
        } catch {
          // ignore
        }
      },
      resetWebTourForRole: async (role) => {
        const { tour } = get();
        const next: UserTourState = {
          ...(tour ?? {}),
          web: {
            ...(tour?.web ?? {}),
            ...(role === 'SYSTEM_ADMIN' && {
              systemAdmin: {
                ...(tour?.web?.systemAdmin ?? {}),
                completedAt: null,
              },
            }),
            ...(role === 'MODERATOR' && {
              moderator: {
                ...(tour?.web?.moderator ?? {}),
                completedAt: null,
              },
            }),
            lastVersionSeen: null,
          },
        };
        set({ tour: next });
        try {
          await settingsApi.updateMy({ tour: next });
        } catch {
          // ignore
        }
      },
    }),
    {
      name: 'sim-tracker-tour',
      partialize: (state) => ({
        tour: state.tour,
        currentVersion: state.currentVersion,
      }),
    },
  ),
);

