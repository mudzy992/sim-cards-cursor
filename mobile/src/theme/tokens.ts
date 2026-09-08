/**
 * SIM Tracker — Design tokens ("Faza 1" redizajna)
 * -----------------------------------------------------------------------------
 * Referenta: mobile/instrukcije.md
 *  - 80–90% neutralnih povrsina, 10–20% brand/semanticke boje
 *  - skupljeni radius sistem (nema "pill" izjednacenosti)
 *  - tehnicka tipografija: podaci (ICCID, brojila) u monospace tretmanu
 *
 * Dark-only tema: brand plava ostaje identitet, ali je osvijetljena radi
 * pristupačnog kontrasta na grafitnim površinama.
 */
import { Platform, type TextStyle } from 'react-native';
import { colors } from '@/theme/colors';

export const palette = {
  /* ------------------------------- brand -------------------------------- */
  brand: colors.primary,
  brandPressed: colors.primaryPressed,
  brandSoft: '#14213A',
  brandSoftStrong: '#1C3357',

  /* ------------------------------ neutral -------------------------------- */
  background: colors.background,
  surface: colors.surface,
  surfaceMuted: colors.surfaceMuted,
  surfaceSunken: '#070B12',
  border: colors.border,
  borderStrong: '#344155',

  textPrimary: colors.text,
  textSecondary: '#AEB9C8',
  textMuted: '#718096',
  inverse: '#FFFFFF',

  graphite: '#050810',
  graphiteSoft: '#0D1421',
  graphite0050: 'rgba(255,255,255,0.08)',

  /* ------------------------------ semantic ------------------------------- */
  success: '#4ADE80',
  successSoft: '#10281B',
  successBorder: '#1E5132',
  warning: '#FBBF24',
  warningSoft: '#2A2110',
  warningBorder: '#5B471B',
  danger: '#FB7185',
  dangerSoft: '#2E151B',
  dangerBorder: '#632938',
  info: '#60A5FA',
  infoSoft: '#12233D',
  infoBorder: '#274C77',

  overlayScrim: 'rgba(0, 0, 0, 0.78)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Restrained radius hierarchy (instrukcije §8). Pill samo za statusne oznake. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/* ------------------------------ Tipografija ------------------------------ */

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const type = {
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: palette.textPrimary,
  } satisfies TextStyle,
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: palette.textMuted,
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: palette.textPrimary,
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  } satisfies TextStyle,
  caption: {
    fontSize: 13,
    fontWeight: '400',
    color: palette.textSecondary,
  } satisfies TextStyle,
  /** ICCID / brojevi brojila / kolicine — povecana citljivost */
  data: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: monoFamily,
    letterSpacing: 0.3,
    color: palette.textPrimary,
  } satisfies TextStyle,
  dataLarge: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: monoFamily,
    letterSpacing: 0.5,
    color: palette.textPrimary,
  } satisfies TextStyle,
  dataSmall: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: monoFamily,
    letterSpacing: 0.3,
    color: palette.textSecondary,
  } satisfies TextStyle,
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: monoFamily,
    letterSpacing: -0.6,
    color: palette.textPrimary,
  } satisfies TextStyle,
} as const;

/* -------------------------------- Senke ---------------------------------- */

export const shadows = {
  /** suptilna elevacija povrsina — bez efekta "floatanja" */
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.42,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.58,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 7 },
    default: {},
  }),
} as const;

/* ----------------------------- Hit targeti -------------------------------- */

/** Minimalna visina dodirne mete (Apple HIG): 44pt. */
export const HIT_TARGET = 44;
