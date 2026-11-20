/**
 * Centralizovan registar asset-a (typed) — zamjena za raspred prepisane
 * relativne putanje ('../../../assets/…') po ekranima.
 */
export const APP_ASSETS = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  scanBeep: require('../../assets/scan-beep.mp3'),
} as const;
