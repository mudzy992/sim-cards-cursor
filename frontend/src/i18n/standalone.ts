import { normalizeLanguage, translate } from './core';
import type { TranslateOptions } from './core';
import bs from './locales/bs';
import en from './locales/en';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from './types';
import type { SupportedLanguage, TranslationDictionary } from './types';

const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = { bs, en };

export function getActiveLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
}

export function translateCurrent(key: string, options?: TranslateOptions): string {
  const lang = getActiveLanguage();
  return translate(DICTIONARIES[lang], DICTIONARIES[FALLBACK_LANGUAGE], key, options);
}
