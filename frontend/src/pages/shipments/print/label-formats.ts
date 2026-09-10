export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * Visina lista u printu namjerno 0.2mm manja od 297mm: sprječava da browser
 * zbog zaokruživanja izbaci prazan dodatni list (poznati problem Chrome/Firefox).
 */
export const PRINT_SHEET_HEIGHT_MM = 296.8;

export const MM_TO_PX = 96 / 25.4;

/** Prosječna širina znaka monospace fonta u em jedinicama. */
const MONO_CHAR_EM = 0.602;

/** Razmak između redova teksta unutar etikete. */
export const LABEL_LINE_GAP_MM = 0.5;

export type LabelFormatId =
  | 'a4-35.6x16.9'
  | 'a4-37x14'
  | 'a4-52.5x21.2' /* F20 */
  | 'a4-37.6x23.5' /* F14 */
  | 'a4-48.5x16.9' /* F10 */
  | 'a4-38x21.2'; /* F01 */

export interface LabelSheetLayout {
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  rows: number;
  /** Ugao prvog reda/kolone od ivice papira */
  marginTopMm: number;
  marginLeftMm: number;
  /** Razmak između etiketa (pitch - dimenzija etikete) */
  gapXMm: number;
  gapYMm: number;
}

export interface LabelFormatPreset extends LabelSheetLayout {
  id: LabelFormatId;
  name: string;
  description: string;
}

/**
 * Podrazumijevana podešavanja — PROVJERITI sa stvarnim papirom kalibracionim
 * printom (okviri) i po potrebi korigovati (brzi razmaci X/Y su uvijek vidljivi,
 * pune margine/dimenzije u "Napredna podešavanja"). Korekcije se čuvaju u
 * localStorage-u po formatu.
 */
export const LABEL_FORMAT_PRESETS: LabelFormatPreset[] = [
  {
    id: 'a4-35.6x16.9',
    name: '35,6 × 16,9 mm',
    description: '5 kolona × 16 redova · 80 etiketa/list',
    labelWidthMm: 35.6,
    labelHeightMm: 16.9,
    columns: 5,
    rows: 16,
    marginTopMm: 13.3,
    marginLeftMm: 16,
    gapXMm: 0,
    gapYMm: 0,
  },
  {
    id: 'a4-37x14',
    name: '37 × 14 mm',
    description: '5 kolona × 21 red · 105 etiketa/list',
    labelWidthMm: 37,
    labelHeightMm: 14,
    columns: 5,
    rows: 21,
    marginTopMm: 1.5,
    marginLeftMm: 12.5,
    gapXMm: 0,
    gapYMm: 0,
  },
  {
    id: 'a4-52.5x21.2',
    name: 'F20 · 52,5 × 21,2 mm',
    description: '4 kolone × 14 redova · 56 etiketa/list',
    labelWidthMm: 52.5,
    labelHeightMm: 21.2,
    columns: 4,
    rows: 14,
    marginTopMm: 0.1,
    marginLeftMm: 0,
    gapXMm: 0,
    gapYMm: 0,
  },
  {
    id: 'a4-37.6x23.5',
    name: 'F14 · 37,6 × 23,5 mm',
    description: '5 kolona × 12 redova · 60 etiketa/list',
    labelWidthMm: 37.6,
    labelHeightMm: 23.5,
    columns: 5,
    rows: 12,
    marginTopMm: 7.5,
    marginLeftMm: 11,
    gapXMm: 0,
    gapYMm: 0,
  },
  {
    id: 'a4-48.5x16.9',
    name: 'F10 · 48,5 × 16,9 mm',
    description: '4 kolone × 17 redova · 68 etiketa/list',
    labelWidthMm: 48.5,
    labelHeightMm: 16.9,
    columns: 4,
    rows: 17,
    marginTopMm: 4.8,
    marginLeftMm: 8,
    gapXMm: 0,
    gapYMm: 0,
  },
  {
    id: 'a4-38x21.2',
    name: 'F01 · 38 × 21,2 mm',
    description: '5 kolona × 14 redova · 70 etiketa/list',
    labelWidthMm: 38,
    labelHeightMm: 21.2,
    columns: 5,
    rows: 14,
    marginTopMm: 0.1,
    marginLeftMm: 10,
    gapXMm: 0,
    gapYMm: 0,
  },
];

export interface PrintableSimCard {
  id: string;
  iccid: string;
  ipAddress: string | null;
  publicIpAddress?: string | null;
}

export interface LabelSlot<T extends PrintableSimCard = PrintableSimCard> {
  sim: T | null;
  /** true = pozicija na papiru već iskorištena (preskočena), ne printa se ništa */
  used: boolean;
}

/* --------------------------------- račun --------------------------------- */

export const labelsPerSheet = (l: LabelSheetLayout): number => l.columns * l.rows;

/** Preostala margina desno/dolje — za kontrolu da layout "staje" na A4. */
export const rightMarginMm = (l: LabelSheetLayout): number =>
  A4_WIDTH_MM - (l.marginLeftMm + l.columns * l.labelWidthMm + (l.columns - 1) * l.gapXMm);

export const bottomMarginMm = (l: LabelSheetLayout): number =>
  A4_HEIGHT_MM - (l.marginTopMm + l.rows * l.labelHeightMm + (l.rows - 1) * l.gapYMm);

export const layoutOverflows = (l: LabelSheetLayout): boolean =>
  rightMarginMm(l) < -0.001 || bottomMarginMm(l) < -0.001;

/** Automatsko centriranje mreže etiketa na papir (uz zadate razmake). */
export const centeredLayout = (l: LabelSheetLayout): LabelSheetLayout => {
  const rounded = (n: number) => Math.round(n * 10) / 10;
  return {
    ...l,
    marginLeftMm: rounded(
      (A4_WIDTH_MM - (l.columns * l.labelWidthMm + (l.columns - 1) * l.gapXMm)) / 2,
    ),
    marginTopMm: rounded(
      (A4_HEIGHT_MM - (l.rows * l.labelHeightMm + (l.rows - 1) * l.gapYMm)) / 2,
    ),
  };
};

/**
 * Raspoređuje kartice u listove — direktna indeks-matematika (bez stream
 * rezanja), tako da je punjenje lista deterministično:
 *  - slot < startOffset                     → iskorištena etiketa (prazna)
 *  - inače itemIndex = (slot - offset) / copies
 *  - zadnji list se dopunjava praznim slotovima do pune mreže (geometrija!)
 * Svaki potpuni list ima TAČNO perSheet etiketa.
 */
export function buildSheets<T extends PrintableSimCard>(
  items: T[],
  layout: LabelSheetLayout,
  startOffset: number,
  copies: number,
): LabelSlot<T>[][] {
  const perSheet = labelsPerSheet(layout);
  const copiesSafe = Math.max(1, Math.floor(copies));
  const offsetSafe = Math.max(0, Math.floor(startOffset));
  const totalSlots = Math.max(perSheet, offsetSafe + items.length * copiesSafe);
  const sheetCount = Math.ceil(totalSlots / perSheet);

  const sheets: LabelSlot<T>[][] = [];
  for (let s = 0; s < sheetCount; s += 1) {
    const cells: LabelSlot<T>[] = [];
    for (let c = 0; c < perSheet; c += 1) {
      const slotIndex = s * perSheet + c;
      if (slotIndex < offsetSafe) {
        cells.push({ sim: null, used: true });
      } else {
        const itemIndex = Math.floor((slotIndex - offsetSafe) / copiesSafe);
        const sim = itemIndex < items.length ? (items[itemIndex] ?? null) : null;
        cells.push({ sim, used: false });
      }
    }
    sheets.push(cells);
  }
  return sheets;
}

/** Koliko je etiketa u listu stvarno popunjeno (za indikator popunjenosti). */
export const filledInSheet = <T extends PrintableSimCard>(cells: LabelSlot<T>[]): number =>
  cells.reduce((acc, c) => acc + (c.sim && !c.used ? 1 : 0), 0);

/* --------------------------------- tekst ---------------------------------- */

/** Grupisanje ICCID-a u blokove od 4 cifre radi lakšeg očitavanja. */
export const formatIccid = (iccid: string, grouping: 'plain' | 'group4'): string => {
  if (grouping !== 'group4') return iccid;
  return iccid.replace(/(.{4})/g, '$1 ').trim();
};

export const displayLength = (iccid: string, grouping: 'plain' | 'group4'): number =>
  formatIccid(iccid, grouping).length;

/**
 * Najveća veličina monospace fonta (u mm) tako da `charCount` znakova stane u
 * `usableWidthMm` bez prelamanja. Rezultat je ograničen u [minMm, maxMm].
 */
export const fitFontMm = (
  charCount: number,
  usableWidthMm: number,
  maxMm: number,
  minMm: number,
): number => {
  if (charCount <= 0) return maxMm;
  const fit = usableWidthMm / (charCount * MONO_CHAR_EM);
  return Math.min(maxMm, Math.max(minMm, fit));
};

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export const formatMm = (n: number): string =>
  n.toLocaleString('bs-BA', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/* ------------------------- sadržaj etikete (linije) ------------------------ */

export interface LabelFieldFlags {
  showIp: boolean;
  showPublicIp: boolean;
  showReceivedDate: boolean;
}

/** Po-linijske veličine fonta (već izračunate i skalirane). */
export interface LabelLineFonts {
  iccidMm: number;
  ipMm: number;
  publicIpMm: number;
  dateMm: number;
}

export interface LabelLineSpec {
  text: string;
  fontMm: number;
  weight: number;
  muted?: boolean;
}

/**
 * Sastavlja linije etikete prema uključenim poljima.
 * Redoslijed na etiketi: ICCID → interna IP → javna IP → datum prijema.
 */
export function buildLabelLines(
  sim: PrintableSimCard,
  flags: LabelFieldFlags,
  iccidGrouping: 'plain' | 'group4',
  fonts: LabelLineFonts,
  receivedDateText: string,
): LabelLineSpec[] {
  const lines: LabelLineSpec[] = [
    { text: formatIccid(sim.iccid, iccidGrouping), fontMm: fonts.iccidMm, weight: 700 },
  ];
  if (flags.showIp) lines.push({ text: sim.ipAddress ?? '—', fontMm: fonts.ipMm, weight: 500 });
  if (flags.showPublicIp)
    lines.push({ text: sim.publicIpAddress ?? '—', fontMm: fonts.publicIpMm, weight: 500 });
  if (flags.showReceivedDate)
    lines.push({ text: receivedDateText, fontMm: fonts.dateMm, weight: 400, muted: true });
  return lines;
}

/* ------------------------------ perzistencija ----------------------------- */

const STORAGE_KEY = 'sim-print:label-settings:v1';

export interface PersistedPrintSettings {
  formatId: LabelFormatId;
  layouts: Partial<Record<LabelFormatId, LabelSheetLayout>>;
  copies: number;
  iccidGrouping: 'plain' | 'group4';
  fontScale: number;
  showIp: boolean;
  showPublicIp: boolean;
  showReceivedDate: boolean;
  showOutlines: boolean;
}

export const defaultPersistedSettings = (): PersistedPrintSettings => ({
  formatId: 'a4-35.6x16.9',
  layouts: {},
  copies: 1,
  iccidGrouping: 'plain',
  fontScale: 100,
  showIp: true,
  showPublicIp: false,
  showReceivedDate: false,
  showOutlines: true,
});

export const loadPersistedSettings = (): PersistedPrintSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersistedSettings();
    const parsed = JSON.parse(raw) as Partial<PersistedPrintSettings>;
    // merge sa defaultima → nova polja se pojave i kod staro-sačuvanih postavki
    return { ...defaultPersistedSettings(), ...parsed };
  } catch {
    return defaultPersistedSettings();
  }
};

export const savePersistedSettings = (s: PersistedPrintSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* localStorage nedostupan — ignorirati */
  }
};

export const presetById = (id: LabelFormatId): LabelFormatPreset =>
  LABEL_FORMAT_PRESETS.find((p) => p.id === id) ?? LABEL_FORMAT_PRESETS[0]!;
