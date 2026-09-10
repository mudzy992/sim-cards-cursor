import enUS from 'antd/locale/en_US';
import type { Locale } from 'antd/es/locale';
import bsBA from './antd-locale-bs';
import type { SupportedLanguage } from './types';

export { I18nProvider, useTranslation } from './I18nProvider';
export type { SupportedLanguage } from './types';
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from './types';

const ANTD_LOCALES: Record<SupportedLanguage, Locale> = {
  bs: bsBA,
  en: enUS,
};

/** Maps the active app language to the matching Ant Design `ConfigProvider` locale. */
export function getAntdLocale(language: SupportedLanguage): Locale {
  return ANTD_LOCALES[language];
}
