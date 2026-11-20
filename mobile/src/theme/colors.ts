import { SHARED_THEME_COLORS } from '@sim-tracker/shared';

const dark = SHARED_THEME_COLORS.dark;

/**
 * SIM Tracker legacy/global boje — DARK ONLY.
 *
 * Bazne površine i semantičke statusne boje sinhronizovane sa
 * `@sim-tracker/shared` WCAG AAA tokenima.
 */
export const colors = {
  primary: '#4D82E6',
  primaryPressed: '#376CC9',
  primaryDark: dark.accentPrimary,
  onPrimary: dark.accentOnPrimary,
  link: dark.accentLink,
  disabled: '#566275',

  background: dark.canvas,
  surface: dark.surface,
  surfaceMuted: dark.surfaceRaised,
  border: dark.borderSubtle,
  text: dark.textPrimary,
  textMuted: dark.textMuted,

  danger: dark.status.danger.border,
  warningSurface: dark.status.warning.bg,
  warningBorder: dark.status.warning.border,
} as const;
