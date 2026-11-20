import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { translate, normalizeLanguage } from './core';
import type { TranslateOptions } from './core';
import { I18nContext, type I18nContextValue } from './context';
import bs from './locales/bs';
import en from './locales/en';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from './types';
import type { SupportedLanguage, TranslationDictionary } from './types';

const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = { bs, en };

function readPersistedLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    // localStorage unavailable
  }
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
  return browserLang ? normalizeLanguage(browserLang) : DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(readPersistedLanguage);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore persistence failures
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, []);

  const t = useCallback(
    (key: string, options?: TranslateOptions) =>
      translate(DICTIONARIES[language], DICTIONARIES[FALLBACK_LANGUAGE], key, options),
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
