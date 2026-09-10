export type SupportedLanguage = 'bs' | 'en';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['bs', 'en'];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'bs';
export const FALLBACK_LANGUAGE: SupportedLanguage = 'bs';

export const LANGUAGE_STORAGE_KEY = 'sim-tracker.language';

/** Leaf value types allowed in a translation dictionary. */
export type TranslationLeaf = string;

/** Recursive dictionary shape: nested namespaces of string leaves. */
export interface TranslationDictionary {
  [key: string]: TranslationLeaf | TranslationDictionary;
}

/** Values that can be interpolated into a translation string, e.g. t('a.b', { count: 3 }) */
export type TranslationParams = Record<string, string | number>;
