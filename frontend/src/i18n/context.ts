import { createContext } from 'react';
import type { TranslateOptions } from './core';
import type { SupportedLanguage } from './types';

export interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, options?: TranslateOptions) => string;
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);
