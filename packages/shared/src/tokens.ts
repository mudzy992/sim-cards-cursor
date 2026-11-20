export type SemanticStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusColorTriple {
  bg: string;
  fg: string;
  border: string;
}

/**
 * Shared WCAG AAA brand & semantic status tokens synchronized between
 * Web (frontend/src/styles/tokens.json) and Mobile (mobile/src/theme/*).
 */
export const SHARED_THEME_COLORS = {
  light: {
    canvas: '#f8fafc',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    surfaceSunken: '#f1f5f9',
    textPrimary: '#09090b',
    textSecondary: '#1e293b',
    textMuted: '#334155',
    borderSubtle: '#cbd5e1',
    borderDefault: '#525e70',
    borderStrong: '#334155',
    accentPrimary: '#2d249c',
    accentHover: '#221a7a',
    accentOnPrimary: '#ffffff',
    accentLink: '#2d249c',
    status: {
      success: { bg: '#ecfdf5', fg: '#064e3b', border: '#047857' },
      warning: { bg: '#fffbeb', fg: '#713f12', border: '#a16207' },
      danger: { bg: '#fef2f2', fg: '#7f1d1d', border: '#b91c1c' },
      info: { bg: '#eff6ff', fg: '#1e3a8a', border: '#1d4ed8' },
      neutral: { bg: '#f1f5f9', fg: '#1e293b', border: '#475569' },
    },
  },
  dark: {
    canvas: '#09090b',
    surface: '#131316',
    surfaceRaised: '#1a1b20',
    surfaceSunken: '#0d0d10',
    textPrimary: '#f8fafc',
    textSecondary: '#e2e8f0',
    textMuted: '#c2c6d4',
    borderSubtle: '#26272e',
    borderDefault: '#818596',
    borderStrong: '#b4b7c4',
    accentPrimary: '#3730a3',
    accentHover: '#4338ca',
    accentOnPrimary: '#ffffff',
    accentLink: '#c7d2fe',
    status: {
      success: { bg: '#052e22', fg: '#a7f3d0', border: '#34d399' },
      warning: { bg: '#2b1e04', fg: '#fde68a', border: '#fbbf24' },
      danger: { bg: '#320d12', fg: '#fecdd3', border: '#f87171' },
      info: { bg: '#0c1c38', fg: '#dbeafe', border: '#60a5fa' },
      neutral: { bg: '#1c1d22', fg: '#e2e8f0', border: '#818596' },
    },
  },
} as const;
