import { describe, expect, it } from 'vitest';
import {
  LABEL_FORMAT_PRESETS,
  buildSheets,
  cardsForSheets,
  labelsPerSheet,
  presetById,
} from './label-formats';

function makeSim(index: number) {
  return {
    id: `sim-${index}`,
    iccid: `893870000000000${String(index).padStart(4, '0')}`,
    ipAddress: `10.10.0.${index}`,
    publicIpAddress: null,
  };
}

describe('label-formats print pagination & skip handling', () => {
  it('computes per-sheet capacity and cardsForSheets respecting skipped slots and copies', () => {
    const f20 = presetById('a4-52.5x21.2'); // 4 x 14 = 56
    const compact = presetById('a4-37x14'); // 5 x 21 = 105
    expect(labelsPerSheet(f20)).toBe(56);
    expect(labelsPerSheet(compact)).toBe(105);

    expect(cardsForSheets(1, f20, 0, 1)).toBe(56);
    expect(cardsForSheets(1, f20, 10, 1)).toBe(46);
    expect(cardsForSheets(1, f20, 10, 2)).toBe(23);
    expect(cardsForSheets(1, compact, 0, 1)).toBe(105);
  });

  it('clamps out-of-range startOffset to sheet 1 and preserves exact sequential items without duplicates', () => {
    const f20 = presetById('a4-52.5x21.2'); // 56 per sheet
    const items = Array.from({ length: 120 }, (_, i) => makeSim(i + 1));

    // Preskakanje veće od perSheet-1 se clampuje na 55 (zadnja ćelija 1. lista), nikad ne preliva na 2. list
    const sheets = buildSheets(items, f20, 999, 1);
    const renderedIds = sheets
      .flat()
      .filter((c) => c.sim && !c.used)
      .map((c) => c.sim!.id);

    expect(sheets[0]!.filter((c) => c.used).length).toBe(55);
    expect(sheets[1]!.some((c) => c.used)).toBe(false);
    expect(renderedIds).toEqual(items.map((i) => i.id));
    expect(LABEL_FORMAT_PRESETS.length).toBeGreaterThan(0);
  });
});
