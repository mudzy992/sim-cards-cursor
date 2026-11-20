import { FALLBACK_DASH, ICCID_GROUP_SIZE } from '@/constants/ui';
import type { SupportedLanguage } from '@/i18n/types';

export function getActiveIntlLocale(language?: SupportedLanguage): string {
  if (language === 'en') return 'en-US';
  if (language === 'bs') return 'bs-BA';
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang;
    if (lang === 'en') return 'en-US';
  }
  return 'bs-BA';
}

function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: string | number | Date | null | undefined,
  language?: SupportedLanguage,
  fallback = FALLBACK_DASH,
): string {
  const date = toValidDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(getActiveIntlLocale(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  language?: SupportedLanguage,
  fallback = FALLBACK_DASH,
): string {
  const date = toValidDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(getActiveIntlLocale(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(
  value: number | null | undefined,
  language?: SupportedLanguage,
  options?: Intl.NumberFormatOptions,
  fallback = FALLBACK_DASH,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return new Intl.NumberFormat(getActiveIntlLocale(language), options).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  language?: SupportedLanguage,
  maximumFractionDigits = 1,
  fallback = FALLBACK_DASH,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return new Intl.NumberFormat(getActiveIntlLocale(language), {
    style: 'percent',
    maximumFractionDigits,
  }).format(value / 100);
}

export function formatIccid(iccid: string | null | undefined, fallback = FALLBACK_DASH): string {
  if (!iccid) return fallback;
  const clean = iccid.replace(/\s+/g, '');
  if (!clean) return fallback;
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += ICCID_GROUP_SIZE) {
    groups.push(clean.slice(i, i + ICCID_GROUP_SIZE));
  }
  return groups.join(' ');
}
