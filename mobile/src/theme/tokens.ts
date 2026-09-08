/**
 * SIM Tracker — Design tokens ("Faza 1" redizajna)
 * -----------------------------------------------------------------------------
 * Referenta: mobile/instrukcije.md
 *  - 80–90% neutralnih povrsina, 10–20% brand/semanticke boje
 *  - skupljeni radius sistem (nema "pill" izjednacenosti)
 *  - tehnicka tipografija: podaci (ICCID, brojila) u monospace tretmanu
 *
 * Brand plava (#16489B) ostaje identitet aplikacije — koristi se selektivno.
 * Ne dira postojeci src/theme/colors.ts (backward-compatible), vec ga nadopunjuje.
 */
import { Platform, type TextStyle } from 'react-native';
import { colors } from '@/theme/colors';

export const palette = {
  /* ------------------------------- brand -------------------------------- */
  brand: colors.primary ?? '#16489B',
  brandPressed: colors.primaryPressed ?? '#0F3576',
  brandSoft: '#EBF0FA',
  brandSoftStrong: '#DBE5F6',

  /* ------------------------------ neutral -------------------------------- */
  background: '#F4F5F7',
  surface: colors.surface ?? '#FFFFFF',
  surfaceMuted: colors.surfaceMuted ?? '#F1F3F5',
  surfaceSunken: '#ECEEF1',
  border: colors.border ?? '#E4E7EB',
  borderStrong: '#CAD0D8',

  textPrimary: colors.text ?? '#0B1220',
  textSecondary: '#475569',
  textMuted: '#8A94A3',
  inverse: '#FFFFFF',

  graphite: '#111827',
  graphiteSoft: '#1F2937',
  graphite0050: 'rgba(255,255,255,0.08)',

  /* ------------------------------ semantic ------------------------------- */
  success: '#15803D',
  successSoft: '#E7F6EC',
  successBorder: '#BDE5CB',
  warning: '#B45309',
  warningSoft: '#FCF1E2',
  warningBorder: '#F1D9B5',
  danger: '#B91C1C',
  dangerSoft: '#FBEAEA',
  dangerBorder: '#F0C6C6',
  info: '#1D4ED8',
  infoSoft: '#E9EFFC',
  infoBorder: '#C6D6F3',

  overlayScrim: 'rgba(4, 10, 24, 0.64)',
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
      shadowColor: '#0B1220',
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    default: {},
  }),
} as const;

/* ----------------------------- Hit targeti -------------------------------- */

/** Minimalna visina dodirne mete (Apple HIG): 44pt. */
export const HIT_TARGET = 44;
