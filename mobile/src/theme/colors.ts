import { SHARED_THEME_COLORS } from '@sim-tracker/shared';
import type { ResolvedThemeScheme } from '@/store/theme.store';

export function buildThemeColors(scheme: ResolvedThemeScheme) {
  const base = SHARED_THEME_COLORS[scheme];
  return {
    primary: base.accentPrimary,
    primaryPressed: base.accentHover,
    primaryDark: base.accentPrimary,
    onPrimary: base.accentOnPrimary,
    link: base.accentLink,
    disabled: base.borderDefault,

    background: base.canvas,
    surface: base.surface,
    surfaceMuted: base.surfaceRaised,
    border: base.borderSubtle,
    text: base.textPrimary,
    textMuted: base.textMuted,

    danger: base.status.danger.border,
    warningSurface: base.status.warning.bg,
    warningBorder: base.status.warning.border,
  } as const;
}

export type ThemeColors = ReturnType<typeof buildThemeColors>;

export const colorThemes: Record<ResolvedThemeScheme, ThemeColors> = {
  light: buildThemeColors('light'),
  dark: buildThemeColors('dark'),
};

/**
 * Default static fallback colors (dark scheme) for non-component callers.
 * Components and screens should use `useTheme().colors`.
 */
export const colors = colorThemes.dark;
