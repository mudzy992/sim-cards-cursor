import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedThemeScheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'sim_tracker_theme_mode';

function normalizeMode(raw: string | null | undefined): ThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return 'system';
}

function resolveScheme(
  mode: ThemeMode,
  systemScheme: 'light' | 'dark' | null | undefined,
): ResolvedThemeScheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return systemScheme === 'light' ? 'light' : 'dark';
}

interface ThemeState {
  mode: ThemeMode;
  systemScheme: ResolvedThemeScheme;
  resolvedScheme: ResolvedThemeScheme;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
  syncSystemScheme: (scheme: 'light' | 'dark' | null | undefined) => void;
}

const initialSystem: ResolvedThemeScheme =
  Appearance.getColorScheme() === 'light' ? 'light' : 'dark';

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  systemScheme: initialSystem,
  resolvedScheme: initialSystem,
  isHydrated: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
      const mode = normalizeMode(stored);
      const systemScheme: ResolvedThemeScheme =
        Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
      set({
        mode,
        systemScheme,
        resolvedScheme: resolveScheme(mode, systemScheme),
        isHydrated: true,
      });
      return;
    } catch {
      const systemScheme: ResolvedThemeScheme =
        Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
      set({
        mode: 'system',
        systemScheme,
        resolvedScheme: systemScheme,
        isHydrated: true,
      });
    }
  },

  setMode: async (mode: ThemeMode) => {
    const { systemScheme } = get();
    set({
      mode,
      resolvedScheme: resolveScheme(mode, systemScheme),
    });
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors — in-memory choice remains active
    }
  },

  syncSystemScheme: (scheme) => {
    const systemScheme: ResolvedThemeScheme = scheme === 'light' ? 'light' : 'dark';
    const { mode } = get();
    set({
      systemScheme,
      resolvedScheme: resolveScheme(mode, systemScheme),
    });
  },
}));
