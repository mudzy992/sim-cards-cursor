import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  DENSITY_STORAGE_KEY,
  THEME_STORAGE_KEY,
  resolveTheme,
  useThemeStore,
} from './theme.store';

describe('theme.store', () => {
  beforeEach(() => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    window.localStorage.removeItem(DENSITY_STORAGE_KEY);
    useThemeStore.getState().setPreference('system');
    useThemeStore.getState().setDensity('comfortable');
  });

  it('defaults to system preference and updates DOM dataset.theme on switch', () => {
    expect(useThemeStore.getState().preference).toBe('system');

    useThemeStore.getState().setPreference('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    useThemeStore.getState().setPreference('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('resolves system theme from prefers-color-scheme media query', () => {
    const matchSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(resolveTheme('system')).toBe('dark');
    matchSpy.mockRestore();
  });

  it('defaults to comfortable density and persists table density preference', () => {
    expect(useThemeStore.getState().density).toBe('comfortable');
    useThemeStore.getState().setDensity('compact');
    expect(useThemeStore.getState().density).toBe('compact');
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
  });
});
