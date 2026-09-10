import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { translate } from './core';
import type { TranslateOptions } from './core';
import { normalizeLanguage } from './core';
import bs from './locales/bs';
import en from './locales/en';
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY } from './types';
import type { SupportedLanguage, TranslationDictionary } from './types';

const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = { bs, en };

interface I18nState {
  language: SupportedLanguage;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string, options?: TranslateOptions) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  language: DEFAULT_LANGUAGE,
  isHydrated: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
      if (stored) {
        set({ language: normalizeLanguage(stored), isHydrated: true });
        return;
      }
    } catch {
      // SecureStore unavailable — fall through to default language
    }

    // No stored preference yet: use the app default (Bosnian).
    // NOTE: to auto-detect the device locale instead, add the `expo-localization`
    // package and read `Localization.getLocales()[0]?.languageCode` here — it was
    // intentionally left out since it isn't in this project's package.json and
    // this environment couldn't run `npm install` to add it.
    set({ language: DEFAULT_LANGUAGE, isHydrated: true });
  },

  setLanguage: async (lang: SupportedLanguage) => {
    set({ language: lang });
    try {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore persistence failures — in-memory language still applies this session
    }
  },

  t: (key: string, options?: TranslateOptions) => {
    const { language } = get();
    return translate(DICTIONARIES[language], DICTIONARIES[FALLBACK_LANGUAGE], key, options);
  },
}));

/**
 * Convenience hook for components: `const { t, language, setLanguage } = useTranslation();`
 * Note: `t` re-reads `language` from the store on every render via selector below,
 * so components re-render (and re-translate) automatically when language changes.
 */
export function useTranslation() {
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);
  const t = (key: string, options?: TranslateOptions) =>
    translate(DICTIONARIES[language], DICTIONARIES[FALLBACK_LANGUAGE], key, options);
  return { language, setLanguage, t };
}
