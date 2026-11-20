import rawTokens from './tokens.json';

export type ResolvedTheme = 'light' | 'dark';
export type ThemePreference = 'system' | ResolvedTheme;
export type TableDensity = 'comfortable' | 'compact';

export interface StatusTokenSet {
  bg: string;
  fg: string;
  border: string;
}

export interface ThemeTokenPalette {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  surfaceHover: string;
  headerBackdrop: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;
  accentPrimary: string;
  accentHover: string;
  accentOnPrimary: string;
  accentLink: string;
  accentLinkHover: string;
  accentSoftBg: string;
  accentSoftFg: string;
  focusRing: string;
  selectionBg: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
  shadowCard: string;
  shadowElevated: string;
  status: {
    success: StatusTokenSet;
    warning: StatusTokenSet;
    danger: StatusTokenSet;
    info: StatusTokenSet;
    neutral: StatusTokenSet;
  };
}

export const DESIGN_TOKENS = rawTokens as {
  light: ThemeTokenPalette;
  dark: ThemeTokenPalette;
  printPaper: typeof rawTokens.printPaper;
};

export function getThemeTokens(mode: ResolvedTheme): ThemeTokenPalette {
  return DESIGN_TOKENS[mode];
}
