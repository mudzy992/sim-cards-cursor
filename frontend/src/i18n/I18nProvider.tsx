import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { translate } from './core';
import type { TranslateOptions } from './core';
import { normalizeLanguage } from './core';
import bs from './locales/bs';
import en from './locales/en';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from './types';
import type { SupportedLanguage, TranslationDictionary } from './types';

const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = { bs, en };

interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, options?: TranslateOptions) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function readPersistedLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    // localStorage unavailable (privacy mode, SSR, etc.) — fall through
  }
  // No stored preference yet: try the browser language, else default.
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

/**
 * Primary hook for translations: `const { t } = useTranslation();` then
 * `t('common.actions.save')`. Also exposes the active language and setter
 * so components (e.g. a language switcher) can read/change it.
 */
export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return ctx;
}
