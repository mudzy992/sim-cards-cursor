/**
 * SIM Tracker — Design tokens (WCAG AAA Dual Light/Dark)
 * -----------------------------------------------------------------------------
 * Synchronized with `@sim-tracker/shared` `SHARED_THEME_COLORS` (`light` & `dark`).
 * - Light mode: high-contrast industrial daylight theme for direct outdoor sun
 * - Dark mode: low-glare graphite theme for dimly lit basements / night shifts
 */
import { useMemo } from 'react';
import { Platform, StyleSheet, type TextStyle } from 'react-native';
import { SHARED_THEME_COLORS } from '@sim-tracker/shared';
import { buildThemeColors, type ThemeColors } from '@/theme/colors';
import {
  useThemeStore,
  type ResolvedThemeScheme,
  type ThemeMode,
} from '@/store/theme.store';

export function createPalette(scheme: ResolvedThemeScheme) {
  const base = SHARED_THEME_COLORS[scheme];
  const themeColors = buildThemeColors(scheme);
  const isLight = scheme === 'light';

  return {
    /* ------------------------------- brand -------------------------------- */
    brand: themeColors.primary,
    brandPressed: themeColors.primaryPressed,
    brandText: base.accentLink,
    brandSoft: base.status.info.bg,
    brandSoftStrong: isLight ? '#dbeafe' : '#13314d',

    /* ------------------------------ neutral -------------------------------- */
    background: base.canvas,
    surface: base.surface,
    surfaceMuted: base.surfaceRaised,
    surfaceSunken: base.surfaceSunken,
    border: base.borderSubtle,
    borderStrong: base.borderDefault,

    textPrimary: base.textPrimary,
    textSecondary: base.textSecondary,
    textMuted: base.textMuted,
    inverse: base.accentOnPrimary,

    graphite: isLight ? '#0f172a' : '#050810',
    graphiteSoft: isLight ? '#1e293b' : '#0d1421',
    graphite0050: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',

    /* ------------------------------ semantic (WCAG AAA) */
    success: base.status.success.fg,
    successSoft: base.status.success.bg,
    successBorder: base.status.success.border,
    warning: base.status.warning.fg,
    warningSoft: base.status.warning.bg,
    warningBorder: base.status.warning.border,
    danger: base.status.danger.fg,
    dangerSoft: base.status.danger.bg,
    dangerBorder: base.status.danger.border,
    dangerSolid: '#991b1b',
    dangerSolidPressed: '#7f1d1d',
    info: base.status.info.fg,
    infoSoft: base.status.info.bg,
    infoBorder: base.status.info.border,

    /* ------------------------------ camera & media overlay */
    cameraBg: '#000000',
    cameraFg: '#ffffff',
    cameraTorchActive: '#fbbf24',
    cameraSweep: '#60a5fa',
    notificationAccent: '#b91c1c',
    shadowColor: '#000000',

    overlayScrim: isLight ? 'rgba(15, 23, 42, 0.56)' : 'rgba(0, 0, 0, 0.78)',
  } as const;
}

export type ThemePalette = ReturnType<typeof createPalette>;

export const palettes: Record<ResolvedThemeScheme, ThemePalette> = {
  light: createPalette('light'),
  dark: createPalette('dark'),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export function createTypography(p: ThemePalette) {
  return {
    screenTitle: {
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: p.textPrimary,
    } satisfies TextStyle,
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: p.textMuted,
    } satisfies TextStyle,
    body: {
      fontSize: 15,
      fontWeight: '400',
      color: p.textPrimary,
    } satisfies TextStyle,
    bodyStrong: {
      fontSize: 15,
      fontWeight: '600',
      color: p.textPrimary,
    } satisfies TextStyle,
    caption: {
      fontSize: 13,
      fontWeight: '400',
      color: p.textSecondary,
    } satisfies TextStyle,
    data: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: monoFamily,
      letterSpacing: 0.3,
      color: p.textPrimary,
    } satisfies TextStyle,
    dataLarge: {
      fontSize: 17,
      fontWeight: '700',
      fontFamily: monoFamily,
      letterSpacing: 0.5,
      color: p.textPrimary,
    } satisfies TextStyle,
    dataSmall: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: monoFamily,
      letterSpacing: 0.3,
      color: p.textSecondary,
    } satisfies TextStyle,
    statNumber: {
      fontSize: 28,
      fontWeight: '700',
      fontFamily: monoFamily,
      letterSpacing: -0.6,
      color: p.textPrimary,
    } satisfies TextStyle,
  } as const;
}

export type ThemeTypography = ReturnType<typeof createTypography>;

export const typographyThemes: Record<ResolvedThemeScheme, ThemeTypography> = {
  light: createTypography(palettes.light),
  dark: createTypography(palettes.dark),
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: palettes.dark.shadowColor,
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: palettes.dark.shadowColor,
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 7 },
    default: {},
  }),
} as const;

export const HIT_TARGET = 44;

/** Default dark palette & typography for static/non-React callers. */
export const palette = palettes.dark;
export const type = typographyThemes.dark;

export interface ActiveTheme {
  scheme: ResolvedThemeScheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  palette: ThemePalette;
  colors: ThemeColors;
  type: ThemeTypography;
}

export function useTheme(): ActiveTheme {
  const scheme = useThemeStore((s) => s.resolvedScheme);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return useMemo(
    () => ({
      scheme,
      mode,
      setMode,
      isDark: scheme === 'dark',
      palette: palettes[scheme],
      colors: buildThemeColors(scheme),
      type: typographyThemes[scheme],
    }),
    [scheme, mode, setMode],
  );
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (p: ThemePalette, t: ThemeTypography) => T,
): T {
  const { palette: activePalette, type: activeType } = useTheme();
  return useMemo(
    () => StyleSheet.create(factory(activePalette, activeType)),
    [activePalette, activeType, factory],
  );
}
