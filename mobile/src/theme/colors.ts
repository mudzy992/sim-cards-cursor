/**
 * SIM Tracker legacy/global boje — DARK ONLY.
 *
 * Ovaj fajl zadržava ista imena tokena koja koriste stariji produkcijski
 * ekrani i komponente, pa dark prelazak ne zahtijeva njihovo pojedinačno
 * prepisivanje. Novi UI koristi detaljniji theme/tokens.ts.
 */
export const colors = {
  primary: '#4D82E6',
  primaryPressed: '#376CC9',
  primaryDark: '#1C4C9F',
  onPrimary: '#FFFFFF',
  link: '#7BB0FF',
  disabled: '#566275',

  background: '#0B0F17',
  surface: '#111827',
  surfaceMuted: '#172033',
  border: '#263244',
  text: '#F3F6FB',
  textMuted: '#8B98AA',

  danger: '#FB7185',
  warningSurface: '#2A2110',
  warningBorder: '#5B471B',
} as const