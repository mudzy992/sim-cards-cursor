import type {
  SupportedLanguage,
  TranslationDictionary,
  TranslationParams,
} from './types';
import { FALLBACK_LANGUAGE } from './types';

/**
 * Resolves a dot-notated key (e.g. "auth.login.title") against a nested
 * translation dictionary. Returns undefined when the key path doesn't exist
 * or doesn't resolve to a string leaf.
 */
function resolveKey(dict: TranslationDictionary, key: string): string | undefined {
  const parts = key.split('.');
  let node: TranslationDictionary | TranslationLeafOrDict = dict;

  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      return undefined;
    }
    node = (node as TranslationDictionary)[part];
  }

  return typeof node === 'string' ? node : undefined;
}

type TranslationLeafOrDict = string | TranslationDictionary;

/**
 * Interpolates `{{paramName}}` placeholders in a translation string.
 * Also supports simple ICU-lite pluralization via `{{count}}` + a
 * `_plural` key suffix convention handled by the caller (see translate()).
 */
function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, paramKey: string) => {
    const value = params[paramKey];
    return value === undefined || value === null ? match : String(value);
  });
}

export interface TranslateOptions extends TranslationParams {
  /** Overrides pluralization pick when provided; otherwise uses `count`. */
  count?: number;
  /** Explicit fallback text used only if the key is missing in every dictionary. */
  defaultValue?: string;
}

/**
 * Core translate function. Looks up `key` in `dict` (active language),
 * falls back to `fallbackDict` (FALLBACK_LANGUAGE), then to
 * `options.defaultValue`, then finally to the raw key itself so missing
 * translations are visibly obvious in development rather than crashing.
 *
 * Pluralization convention: if `options.count` is provided and a key
 * `${key}_plural` exists, it is used when `count !== 1`.
 */
export function translate(
  dict: TranslationDictionary,
  fallbackDict: TranslationDictionary,
  key: string,
  options?: TranslateOptions,
): string {
  let resolvedKey = key;

  if (options && typeof options.count === 'number' && options.count !== 1) {
    const pluralKey = `${key}_plural`;
    if (resolveKey(dict, pluralKey) !== undefined || resolveKey(fallbackDict, pluralKey) !== undefined) {
      resolvedKey = pluralKey;
    }
  }

  const raw =
    resolveKey(dict, resolvedKey) ??
    resolveKey(fallbackDict, resolvedKey) ??
    options?.defaultValue ??
    key;

  return interpolate(raw, options as TranslationParams | undefined);
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === 'bs' || value === 'en';
}

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  if (isSupportedLanguage(value)) return value;
  // Handle browser locales like "bs-BA" or "en-US"
  const short = value?.split('-')[0];
  if (isSupportedLanguage(short)) return short;
  return FALLBACK_LANGUAGE;
}
