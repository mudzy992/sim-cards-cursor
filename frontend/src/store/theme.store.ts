import { create } from 'zustand';
import {
  DESIGN_TOKENS,
  type ResolvedTheme,
  type TableDensity,
  type ThemePreference,
} from '@/styles/tokens';

export const THEME_STORAGE_KEY = 'sim-tracker.theme';
export const DENSITY_STORAGE_KEY = 'sim-tracker.density';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore storage errors
  }
  return 'system';
}

function readStoredDensity(): TableDensity {
  if (typeof window === 'undefined') return 'comfortable';
  try {
    const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    if (raw === 'comfortable' || raw === 'compact') return raw;
  } catch {
    // ignore storage errors
  }
  return 'comfortable';
}

export function applyResolvedThemeToDom(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', DESIGN_TOKENS[resolved].canvas);
  }
}

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  density: TableDensity;
  setPreference: (preference: ThemePreference) => void;
  setDensity: (density: TableDensity) => void;
  syncFromSystem: () => void;
}

const initialPreference = readStoredPreference();
const initialResolved = resolveTheme(initialPreference);
applyResolvedThemeToDom(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  resolvedTheme: initialResolved,
  density: readStoredDensity(),

  setPreference: (preference) => {
    const resolvedTheme = resolveTheme(preference);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // ignore storage errors
    }
    applyResolvedThemeToDom(resolvedTheme);
    set({ preference, resolvedTheme });
  },

  setDensity: (density) => {
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      // ignore storage errors
    }
    set({ density });
  },

  syncFromSystem: () => {
    const { preference } = get();
    if (preference !== 'system') return;
    const resolvedTheme = resolveTheme('system');
    applyResolvedThemeToDom(resolvedTheme);
    set({ resolvedTheme });
  },
}));

let mediaListenerAttached = false;
export function initSystemThemeListener(): void {
  if (
    mediaListenerAttached ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return;
  }
  mediaListenerAttached = true;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    useThemeStore.getState().syncFromSystem();
  };
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onChange);
  }
}
