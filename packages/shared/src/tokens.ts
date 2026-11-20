export type SemanticStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusColorTriple {
  bg: string;
  fg: string;
  border: string;
}

/**
 * Shared WCAG AAA industrial slate & steel-cobalt tokens synchronized between
 * Web (frontend/src/styles/tokens.json) and Mobile (mobile/src/theme/*).
 */
export const SHARED_THEME_COLORS = {
  light: {
    canvas: '#f3f5f8',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    surfaceSunken: '#eaeff5',
    textPrimary: '#0b1220',
    textSecondary: '#1e293b',
    textMuted: '#3b4758',
    borderSubtle: '#d0d8e2',
    borderDefault: '#586578',
    borderStrong: '#334155',
    accentPrimary: '#0c4a6e',
    accentHover: '#08334e',
    accentOnPrimary: '#ffffff',
    accentLink: '#0c4a6e',
    status: {
      success: { bg: '#ecfdf5', fg: '#064e3b', border: '#047857' },
      warning: { bg: '#fffbeb', fg: '#713f12', border: '#a16207' },
      danger: { bg: '#fef2f2', fg: '#7f1d1d', border: '#b91c1c' },
      info: { bg: '#f0f9ff', fg: '#0c4a6e', border: '#0369a1' },
      neutral: { bg: '#eef2f6', fg: '#1e293b', border: '#475569' },
    },
  },
  dark: {
    canvas: '#0a0e13',
    surface: '#111720',
    surfaceRaised: '#171f2b',
    surfaceSunken: '#070a0e',
    textPrimary: '#f1f5f9',
    textSecondary: '#d5dee9',
    textMuted: '#aebbc9',
    borderSubtle: '#222d3d',
    borderDefault: '#7c8ea3',
    borderStrong: '#aebbc9',
    accentPrimary: '#0e4d7a',
    accentHover: '#0b3e63',
    accentOnPrimary: '#ffffff',
    accentLink: '#7dd3fc',
    status: {
      success: { bg: '#052a20', fg: '#a7f3d0', border: '#34d399' },
      warning: { bg: '#291c04', fg: '#fde68a', border: '#fbbf24' },
      danger: { bg: '#2e0d14', fg: '#fecdd3', border: '#f87171' },
      info: { bg: '#0b2239', fg: '#bae6fd', border: '#38bdf8' },
      neutral: { bg: '#171f2b', fg: '#d5dee9', border: '#7c8ea3' },
    },
  },
} as const;
