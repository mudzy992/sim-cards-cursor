import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatIccid,
  formatNumber,
  formatPercent,
  getActiveIntlLocale,
} from './formatters';

describe('formatters', () => {
  it('resolves active locale for bs and en', () => {
    expect(getActiveIntlLocale('bs')).toBe('bs-BA');
    expect(getActiveIntlLocale('en')).toBe('en-US');
  });

  it('formats valid dates and falls back to em-dash on invalid inputs', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate('2026-11-20T10:30:00Z', 'en')).toContain('2026');
    expect(formatDateTime('2026-11-20T10:30:00Z', 'bs')).toContain('2026');
  });

  it('formats numbers, percentages, and ICCID groups safely', () => {
    expect(formatNumber(12345, 'en')).toBe('12,345');
    expect(formatNumber(Number.NaN, 'en')).toBe('—');
    expect(formatPercent(75.5, 'en')).toContain('75.5');
    expect(formatIccid('8938701000012345678')).toBe('8938 7010 0001 2345 678');
    expect(formatIccid(null)).toBe('—');
  });
});
